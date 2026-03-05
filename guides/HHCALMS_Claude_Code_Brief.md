# HARMONY HEALTH LMS — Claude Code Execution Brief

## Mission

Fix the two blockers preventing the end-to-end user journey (staff grades visibility + needs_review pipeline), complete the Grade UI components, and deploy to production. This brief is the single source of truth for the session.

---

## Project Context

Harmony Health LMS is a clinical-grade Learning Management System for Parrish Health Systems. It replaces paper-based training with a digital platform that tracks legal defensibility — ensuring staff competency meets CMS audit standards.

**Tech Stack:** React + TypeScript frontend, Firebase/Firestore backend, Vite build tooling, 6 Cloud Functions (v2) for server-side business logic, Firestore Security Rules for RBAC.

**Current State:** Phase 1 infrastructure is 100% complete (31/31 verification tests passing). Phase 2 gradebook engine is ~70% complete. The backend is production-grade. What remains is fixing two Firestore permission/query issues, building 3 UI components, and deploying.

**Architecture Principles (Resilient Engineering Manifesto):**
- Audit-First: Every write operation creates an immutable audit log entry
- Fail-Closed: Firestore rules deny by default, allow explicitly
- Single Source of Truth: Types from `functions/src/types.ts`, services are the only Firestore access layer
- Evidence-Based Iteration: Build → verify with data → confirm Firestore persistence → proceed

---

## Critical File Map

Before making any changes, read these files to understand the system:

```
# Security & Rules
firestore.rules                          # Firestore security rules (RBAC enforcement)

# Core Services (Firestore access layer — ONLY these touch the database)
src/services/gradeService.ts             # Grade CRUD, correction, competency calculation
src/services/courseGradeService.ts        # Weighted course grade calculation + persistence
src/services/enrollmentService.ts        # Enrollment CRUD, status management
src/services/progressService.ts          # Module progress tracking, block completion
src/services/auditService.ts             # Immutable audit log writer

# Hooks (React state management layer — consume services)
src/hooks/useGrade.ts                    # useModuleGrade, useMyGrade, useUserGrades
src/hooks/useModuleProgress.ts           # useModuleProgress, useCourseProgress
src/hooks/useUserEnrollments.ts          # useEnrollment, useUserEnrollments

# Pages (UI layer)
src/pages/CoursePlayer.tsx               # Learner: plays modules, submits quizzes
src/pages/GradeManagement.tsx            # Instructor: review queue, approve/reject
src/pages/MyGrades.tsx                   # Staff: view own grades (BROKEN — Blocker 1)
src/pages/RemediationQueue.tsx           # Supervisor: unlock failed learners

# Cloud Functions (server-side triggers)
functions/src/index.ts                   # 6 Cloud Functions: grade validation, audit, enrollment cascades, remediation, progress, weighted grades

# Shared Types (THE contract between frontend and backend)
functions/src/types.ts                   # All TypeScript interfaces
```

---

## PHASE A: Fix the Two Blockers

### A1 — Fix Enrollments Cross-User Read (CRITICAL)

**Root Cause:** `GradeManagement.tsx` queries `where('status', '==', 'needs_review')` across ALL enrollments. The current Firestore security rules for the enrollments collection likely restrict reads to `resource.data.userId == request.auth.uid`, which means an instructor querying for other users' enrollments gets a silent permission denial (zero results, no error).

**The Fix:** Update `firestore.rules` in the enrollments `match` block. The read rule must follow the same pattern already used in the `grades` and `course_grades` collections:

```javascript
// IN firestore.rules — find the enrollments match block
match /enrollments/{enrollmentId} {
  // BEFORE (likely current state — only owner can read):
  // allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;

  // AFTER (owner OR admin/instructor can read):
  allow read: if isAuthenticated() && (
    resource.data.userId == request.auth.uid ||
    hasAnyRole(['admin', 'instructor'])
  );
  
  // ... leave create/update/delete rules unchanged
}
```

**Important:** Do NOT change any create/update/delete rules. Only modify the `allow read` line. The write rules enforce that staff can only create/update their own enrollments, which is correct.

**Deploy command:**
```bash
firebase deploy --only firestore:rules
```

**Verification:**
1. Log in as an instructor/admin account
2. Open browser console
3. Navigate to GradeManagement page
4. Console should NOT show "Missing or insufficient permissions"
5. If there are enrollments with `status: 'needs_review'` in Firestore, they should appear in the queue

---

### A2 — Create Missing Firestore Composite Indexes

**Root Cause:** Several grade queries use multi-field filters + ordering that require composite indexes. Firestore doesn't auto-create these. Without them, queries fail with permission-like errors.

**How to identify:** Run the app, navigate to MyGrades as a staff user, and check the browser console. Firestore provides a direct clickable URL to create each missing index.

**Expected indexes needed (based on service code):**

```
# grades collection
Collection: grades
Fields: userId (ASC), moduleId (ASC), gradedAt (DESC)

# grades collection (current grades)  
Collection: grades
Fields: userId (ASC), supersededBy (ASC), gradedAt (DESC)

# grades collection (module view)
Collection: grades
Fields: moduleId (ASC), supersededBy (ASC), gradedAt (DESC)

# course_grades collection (user transcript)
Collection: course_grades
Fields: userId (ASC), calculatedAt (DESC)

# course_grades collection (course roster)
Collection: course_grades
Fields: courseId (ASC), overallScore (DESC)
```

**Create via Firebase CLI or Console:**
```bash
# Option 1: Click the URL in the browser console error (easiest)
# Option 2: Add to firestore.indexes.json and deploy
firebase deploy --only firestore:indexes
```

**Verification:**
1. Wait 2-5 minutes for indexes to build (check Firebase Console → Firestore → Indexes)
2. Log in as a staff user
3. Navigate to MyGrades
4. Grades should load without permission errors
5. Check browser console — zero Firestore errors

---

### A3 — Verify the Submission-to-Review Pipeline

**Context:** `CoursePlayer.tsx` already has the `needs_review` logic wired in `handleSubmit()`. When `anyNeedsReview` is true (short-answer questions present), it updates the enrollment with `status: 'needs_review'` and persists `quizAnswers` to the enrollment document.

**What to verify (read, don't change unless broken):**

1. In `CoursePlayer.tsx` → `handleSubmit()`:
   - Confirm `anyNeedsReview` is set to `true` when `gradeQuiz()` returns `needsReview: true`
   - Confirm the enrollment doc update includes `status: 'needs_review'` and `quizAnswers: answers`
   - Add a temporary `console.log('anyNeedsReview:', anyNeedsReview)` if needed to debug

2. In `src/utils/gradeCalculation.ts` → `gradeQuiz()`:
   - Confirm `needsReview` is returned as `true` when any question has `type: 'short-answer'`

3. In `GradeManagement.tsx`:
   - Confirm the fetch query is: `query(collection(db, 'enrollments'), where('status', '==', 'needs_review'))`
   - After A1 rules fix, this query should now work for instructors

4. In `GradeManagement.tsx` → `handleApprove()`:
   - Confirm it calls `enterGrade()` from gradeService
   - Confirm `enterGrade()` writes to the `grades` collection (this triggers Cloud Function 1 → audit log, and Cloud Function 6 → weighted grade recalculation)

**If the pipeline IS broken** (enrollment status doesn't change to `needs_review` after quiz submission):
- The fix belongs in `CoursePlayer.tsx` → `handleSubmit()` or in `useModuleProgress` hook's `submitQuiz` function
- The `needsReview` flag from `gradeQuiz()` must propagate up to trigger the enrollment status update

**If the review modal doesn't show student answers:**
- Answers are stored on the enrollment document in the `quizAnswers` field
- The review modal in `GradeManagement.tsx` needs to read `enrollment.quizAnswers` and pair them with quiz definitions from `getModuleWithBlocks()`

**Verification (full chain):**
1. Log in as staff → enroll in course → play module with short-answer quiz → submit
2. Check Firestore: `enrollments/{staffId}_{courseId}` should have `status: 'needs_review'` and `quizAnswers` populated
3. Log in as instructor → open GradeManagement → see the submission in queue
4. Open review modal → see all answers rendered
5. Approve → check `grades` collection for new document → check `course_grades` for recalculated weighted grade
6. Check `audit_logs` for `GRADE_ENTRY` and `ASSESSMENT_SUBMIT` entries

---

## PHASE B: Grade UI Components (Guide 1)

Only start this after Phase A is verified.

### B1 — GradeBreakdown Component

**Location:** `src/components/grades/GradeBreakdown.tsx`

**Purpose:** Detailed per-module grade view showing how the weighted course grade was calculated.

**Props:**
```typescript
interface GradeBreakdownProps {
  courseGrade: CourseGradeCalculation; // from functions/src/types.ts
  courseTitle: string;
}
```

**Data source:** `course_grades/{userId}_{courseId}` — already written by Cloud Function 6

**Implementation:**
- Display overall score as large percentage + pass/fail badge
- List each module with: title, weight, score, pass/fail, critical flag
- Critical modules get a shield icon (Shield from lucide-react) and distinct visual treatment
- Show `completionPercent` progress ring
- Competency level badge: Mastery (90+), Competent (80-89), Developing (70-79), Not Competent (<70)

**Design patterns:** Match existing `GradeManagement.tsx` — slate-900 header bar, white card body, `cn()` utility for conditional classes, minimum 44px touch targets.

### B2 — GradeSummaryCard Component

**Location:** `src/components/grades/GradeSummaryCard.tsx`

**Purpose:** Compact card for Dashboard and MyGrades showing course grade at a glance.

**Props:**
```typescript
interface GradeSummaryCardProps {
  courseGrade: CourseGradeDoc; // from functions/src/types.ts
  courseTitle: string;
  onClick?: () => void;
}
```

**Implementation:**
- Large percentage score, pass/fail badge, completion ring
- Critical modules status (e.g., "3/3 critical passed")
- Competency level badge
- Clickable — calls `onClick` to navigate to full GradeBreakdown

### B3 — CourseRoster Component

**Location:** `src/components/grades/CourseRoster.tsx`

**Purpose:** Admin/Instructor view — all enrolled learners for a course with grade status.

**Props:**
```typescript
interface CourseRosterProps {
  courseId: string;
}
```

**Data access:**
```typescript
// Get enrollments
import { getCourseEnrollments } from '../services/enrollmentService';
// Get course grades
import { getCourseGradesForCourse } from '../services/courseGradeService';
```

**Implementation:**
- Sortable table: Learner Name, Overall Score, Completion %, Critical Modules, Status, Last Activity
- Filter controls: All / Passing / Failing / Needs Review / Not Started
- Row click expands to show GradeBreakdown inline

### B4 — Integration Points

After building the components:
- Add `GradeSummaryCard` to `Dashboard.tsx` for completed enrollments
- Add `GradeBreakdown` to `MyGrades.tsx` as expandable per-course view
- Add `CourseRoster` to `GradeManagement.tsx` as a tab alongside the review queue

**Verification:**
1. GradeBreakdown renders with real `CourseGradeCalculation` data from Firestore
2. GradeSummaryCard shows on Dashboard for a completed enrollment
3. CourseRoster loads all enrolled learners with correct grade data
4. Console shows zero Firestore permission errors

---

## PHASE C: End-to-End Walkthrough

Only start after Phases A and B pass verification.

Walk the complete journey without stopping. Document any failure point.

### Scenario 1: Auto-Graded Quiz (Happy Path)
1. Staff logs in → Dashboard → Course Catalog → enrolls in course
2. Opens module → reads content blocks → submits quiz (MC/TF/fill-blank only)
3. Quiz auto-grades → progress updates → enrollment completes at 100%
4. Staff navigates to MyGrades → sees GradeSummaryCard → clicks for GradeBreakdown
5. **Verify in Firestore:** enrollment status = 'completed', progress = 100, grades doc exists, course_grades doc exists, audit_logs entries for ENROLLMENT_CREATE, PROGRESS_CREATE, MODULE_COMPLETE, ASSESSMENT_SUBMIT

### Scenario 2: Short-Answer Review Pipeline
1. Staff submits quiz containing a short-answer question
2. Enrollment status → 'needs_review', quizAnswers persisted
3. Instructor logs in → GradeManagement → sees submission in queue
4. Opens review modal → sees all answers → approves with optional score override
5. Grade writes → Cloud Function 1 fires → audit log → Cloud Function 6 recalculates course grade
6. **Verify in Firestore:** grades doc, course_grades doc, audit_logs with GRADE_ENTRY

### Scenario 3: Rejection & Retry
1. Instructor rejects submission with reason
2. Enrollment resets to 'in_progress'
3. Staff can retry the module
4. **Verify in Firestore:** audit_logs with rejection reason

### Scenario 4: Remediation (3 Failures)
1. Staff fails a module 3 times
2. Cloud Function auto-creates remediation_requests doc
3. Supervisor opens RemediationQueue → sees pending request
4. Clicks Unlock → enrollment resets → learner can retry
5. **Verify in Firestore:** remediation_requests status = 'approved', enrollment reset, audit_logs entry

---

## PHASE D: Production Deploy

Only start after Phase C passes all scenarios.

### D1 — Build
```bash
npm run build
ls dist/  # Should contain index.html, assets/, etc.
```

### D2 — Verify firebase.json
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### D3 — Deploy
```bash
firebase deploy --only hosting
```

### D4 — Verify
- Navigate to the production URL
- Login should work
- Course catalog should load
- Repeat a quick E2E scenario at the production URL

---

## Rules of Engagement

1. **Read before you write.** Understand the existing code before modifying. The completion guides anticipated these exact issues.
2. **One change at a time.** Deploy → verify → proceed. Never batch multiple changes without checking each.
3. **Rules are not filters.** Firestore evaluates whether a query COULD return unauthorized documents. Every query must structurally match the security rule shape.
4. **Audit everything.** Every write operation must create an audit log entry via `auditService.logToFirestore()`.
5. **Don't change what works.** Phase 1 is verified at 100%. Do not modify Cloud Functions, grading utilities, or service layer logic unless a Phase A diagnostic proves it's broken.
6. **Types are the contract.** All interfaces come from `functions/src/types.ts`. Do not create parallel type definitions.

---

## Success Criteria

The brief is complete when:

- [ ] Staff can view their own grades on MyGrades without permission errors
- [ ] Instructor can see `needs_review` submissions in GradeManagement
- [ ] Instructor can approve/reject submissions and grades persist correctly
- [ ] GradeBreakdown, GradeSummaryCard, and CourseRoster render with real data
- [ ] All 4 E2E scenarios pass without Firestore errors
- [ ] Production build deploys and loads at the Firebase Hosting URL
- [ ] Zero console errors related to permissions, missing indexes, or undefined data
