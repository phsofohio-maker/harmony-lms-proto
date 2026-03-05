  
**HARMONY HEALTH LMS**

Project Completion Guides

From Current State to Production Deployment

Prepared for Parrish Health Systems  
February 18, 2026

**CORRECTED BASELINE**  
All 31 verification tests passing. Phase 1 at 100%.  
Course Publish workflow confirmed operational.

# **Project Completion Overview**

This document contains seven self-contained guides. Each guide targets a specific deliverable required to bring Harmony Health LMS from its current state to production deployment for Parrish Health Systems.

## **Corrected Baseline (What Is Done)**

The following systems are fully operational and verified:

* **Firebase Infrastructure & Auth:** Auth, Firestore, Storage, 6 Cloud Functions deployed

* **Security Rules:** Three-tier RBAC via JWT claims, fail-closed, immutable audit logs

* **Audit Trail:** Client \+ server-side logging on every write operation

* **Enrollment & Progress:** Enrollment, progress tracking, grade persistence verified

* **Weighted Grading Engine:** Cloud Function calculates weighted course grades

* **5 Quiz Types:** MC, T/F, fill-blank, matching, short-answer (31/31 tests passing)

* **Content Builder:** Block-based editor for text, images, video, quizzes

* **Course Player:** Renders blocks, tracks progress, records quiz attempts with gradeCalculation wired in

* **Course Publish Workflow:** Draft/Published toggle with audit logging in CourseManager

* **Grade Management:** Review modal with per-question display, approve/reject with audit trail

* **All Application Pages:** Login, Dashboard, Catalog, Detail, Player, Builder, Grades, Users, Audit Logs, Invitations

## **What Remains (Guide Map)**

| Guide | Deliverable | Estimate | Tier |
| :---- | :---- | :---- | :---- |
| 1 | Grade UI Components (Breakdown, Summary, Roster) | 1-2 days | Must-Ship |
| 2 | Grade Review Queue Wiring | 1-2 days | Must-Ship |
| 3 | Supervisor Unlock & Remediation UI | 1 day | Must-Ship |
| 4 | Production Build Pipeline | 1-2 days | Must-Ship |
| 5 | Seed Content & User Accounts | 1-2 days | Must-Ship |
| 6 | Cohort Management & Bulk Enrollment | 3-4 days | Should-Ship |
| 7 | Clinical Compliance Tools | 2-3 weeks | Full Rollout |

**Total estimated time to initial internal deployment:** 7-10 working days (Guides 1-5)

**Total to full rollout:** Additional 4-6 weeks (Guides 6-7)

## **Execution Principles**

Each guide follows the Resilient Engineering Manifesto:

1. **Evidence-Based Iteration:** Build component, verify with data, confirm Firestore persistence, then proceed.

2. **Surgical Precision:** Each guide targets one deliverable. No scope creep.

3. **Audit-First:** Every new write operation must create an audit log entry.

4. **Single Source of Truth:** Types come from functions/src/types.ts. Services are the only Firestore access layer.

**GUIDE 1**

**Grade UI Components**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 1-2 Days | MUST-SHIP | Phase 2 |

## **Root Cause**

The weighted grading engine (Cloud Function 6\) calculates CourseGradeCalculation objects and persists them to Firestore. The data exists but has no UI surface. Instructors and learners cannot see grade breakdowns, module-level scores, or class rosters without these components.

## **The Contract (Types Already Defined)**

These types already exist in functions/src/types.ts and are the contracts for these components:

ModuleScore — Per-module score with weight, weighted score, critical flag, pass/fail status

CourseGradeCalculation — Full course grade with overall score, critical module tracking, module breakdown array, completion percent

CourseGradeDoc — Firestore document shape for persisted course grades

## **Deliverable A: GradeBreakdown Component**

**Location:** src/components/grades/GradeBreakdown.tsx

**Purpose:** Displays the module-by-module breakdown of a course grade. Shows each module's raw score, weight, weighted contribution, critical flag, and pass/fail status.

**Props Interface:**

{ calculation: CourseGradeCalculation; showWeights?: boolean; }

**Implementation Steps:**

1. Create the file at the path above. Import CourseGradeCalculation and ModuleScore from ../functions/src/types

2. Render a table with columns: Module Name, Raw Score, Weight, Weighted Score, Critical, Status

3. For each entry in calculation.moduleBreakdown, render a row. Use color coding: green for passed, red for failed, amber for not-yet-graded (score \=== null)

4. Show a summary footer row with: calculation.overallScore (weighted average), calculation.completionPercent, and calculation.allCriticalModulesPassed

5. Critical modules should display a shield icon (Shield from lucide-react) and be visually distinct

**Visual Layout:**

Use the existing design patterns from GradeManagement.tsx: slate-900 header bar, white card body, cn() utility for conditional classes. Minimum touch targets of 44px for the eventual tablet use case.

## **Deliverable B: GradeSummaryCard Component**

**Location:** src/components/grades/GradeSummaryCard.tsx

**Purpose:** A compact card showing a learner's overall course grade at a glance. Used on Dashboard and MyGrades pages.

**Props Interface:**

{ courseGrade: CourseGradeDoc; courseTitle: string; onClick?: () \=\> void; }

**Implementation Steps:**

1. Display: overall score as a large percentage, pass/fail badge, completion ring (completionPercent), critical modules status (e.g., "3/3 critical passed")

2. Competency level badge derived from score: Mastery (90+), Competent (80-89), Developing (70-79), Not Competent (\<70)

3. The card should be clickable (calls onClick) to navigate to the full GradeBreakdown view

## **Deliverable C: CourseRoster Component**

**Location:** src/components/grades/CourseRoster.tsx

**Purpose:** Admin/Instructor view showing all enrolled learners for a course with their current grade status.

**Props Interface:**

{ courseId: string; }

**Implementation Steps:**

1. Fetch all enrollments for the course using getCourseEnrollments(courseId) from enrollmentService

2. For each enrolled user, fetch their course grade from the course\_grades collection (doc ID: userId\_courseId)

3. Render a sortable table: Learner Name, Overall Score, Completion %, Critical Modules, Status, Last Activity

4. Add filter controls: All / Passing / Failing / Needs Review / Not Started

5. Wire the table rows to expand and show the per-module GradeBreakdown inline

## **Data Access Pattern**

These components consume data that already exists. The read path is:

1. course\_grades/{userId}\_{courseId} — persisted by Cloud Function 6 (onGradeWrite)

2. Query with: where('courseId', '==', courseId) for roster, or direct doc get for individual learner

3. If no course\_grades doc exists yet, show "Not yet graded" state — grades are only computed after at least one module grade is entered

## **Integration Points**

* Add GradeSummaryCard to Dashboard.tsx (replace or augment existing enrollment cards for completed courses)

* Add GradeBreakdown to MyGrades.tsx (expandable per-course view)

* Add CourseRoster to GradeManagement.tsx as a tab or section alongside the existing review queue

## **Verification**

Complete when:

1. GradeBreakdown renders correctly with mock CourseGradeCalculation data

2. GradeSummaryCard displays on Dashboard for a completed enrollment

3. CourseRoster loads all enrolled learners and their grade status for a course

4. Clicking a roster row expands to show GradeBreakdown

5. Console shows no Firestore permission errors (security rules allow reads for enrolled users and admins/instructors)

**GUIDE 2**

**Grade Review Queue Wiring**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 1-2 Days | MUST-SHIP | Phase 2 |

## **Root Cause**

GradeManagement.tsx has the full review modal UI built out (per-question answer display for all 5 types, approve/reject buttons, score override, reject reason field). The gap is that the needs\_review query may not be surfacing submissions reliably, and the connection between CoursePlayer submission and GradeManagement fetch needs end-to-end verification.

## **Current State**

What already works in GradeManagement.tsx:

* Review modal renders student answers per question type (MC, T/F, fill-blank, matching, short-answer)

* handleApprove(): calls enterGrade, updates enrollment to 'completed', creates audit log

* handleReject(): resets enrollment to 'in\_progress', creates audit log with rejection reason

* Score override capability (instructor can adjust the auto-calculated score)

## **What Needs Wiring**

**Step 1: Verify the submission-to-review pipeline**

When a learner submits a quiz containing short-answer questions in CoursePlayer, the enrollment status must change to 'needs\_review'. Trace the flow:

1. CoursePlayer.handleSubmit() calls submitQuiz() from useModuleProgress hook

2. The hook should detect if gradeQuiz() returns needsReview: true (which it does when short-answer questions are present)

3. If needsReview is true, enrollment status should be set to 'needs\_review' instead of continuing to 'completed'

4. Verify: submit a quiz with a short-answer question, then check Firestore to confirm enrollment status is 'needs\_review'

*If enrollment status is not being set to 'needs\_review', the fix belongs in the useModuleProgress hook's submitQuiz function or in the CoursePlayer's handleSubmit, adding a status update call after quiz submission when needsReview is detected.*

**Step 2: Verify the GradeManagement fetch query**

GradeManagement.tsx queries enrollments directly from Firestore. Confirm the query is:

query(collection(db, 'enrollments'), where('status', '==', 'needs\_review'))

Ensure this query does not hit Firestore security rule failures. The rules must allow admin and instructor roles to read enrollments across all users. Check the JWT token claims for the logged-in instructor.

**Step 3: Verify student answers are persisted and retrievable**

When the review modal opens, it calls getModuleWithBlocks to load quiz definitions. The student's answers need to be stored somewhere retrievable. Verify where answers are persisted:

* Check if answers are stored in the progress document (progress/{userId}\_{moduleId})

* Or in the enrollment document's metadata

* The review modal needs to pair quiz definitions (from module blocks) with student answers to render the per-question display

**Step 4: Wire the grade entry to trigger course grade recalculation**

After an instructor approves a submission via handleApprove(), the grade is written to the grades collection. This should trigger Cloud Function 6 (weighted course grade calculation). Verify the chain:

1. handleApprove() calls enterGrade() from gradeService

2. enterGrade writes to grades/{gradeId}

3. Cloud Function onGradeCreate fires, creates audit log

4. Cloud Function 6 should recalculate and persist the course-level grade to course\_grades/{userId}\_{courseId}

## **Verification**

Complete when this end-to-end scenario works:

1. Learner submits quiz with short-answer question in CoursePlayer

2. Enrollment status changes to 'needs\_review' in Firestore

3. Instructor opens GradeManagement, sees the submission in the queue

4. Instructor opens review modal, sees all answers rendered correctly

5. Instructor approves (with or without score override) — grade and audit log are created

6. Course grade recalculates automatically (check course\_grades collection)

7. Instructor rejects with reason — enrollment resets to in\_progress, learner can retry

**GUIDE 3**

**Supervisor Unlock & Remediation UI**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 1 Day | MUST-SHIP | Phase 2 |

## **Root Cause**

Cloud Function 1 (onGradeCreate) already auto-creates remediation\_requests when a learner fails a module 3+ times. The data is written to Firestore. What is missing is a UI for supervisors/admins to view pending remediation requests and unlock learners.

## **Backend (Already Done)**

The Cloud Function writes this document to remediation\_requests when triggered:

{ userId, moduleId, courseId, supervisorId, reason, status: 'pending', requestedAt }

enrollmentService already has a resetEnrollment() function that resets progress and status.

## **Deliverable: RemediationQueue Page**

**Location:** src/pages/RemediationQueue.tsx

**Step 1: Create the page component**

1. Query remediation\_requests collection where status \== 'pending'

2. For each request, resolve the user profile and module title for display

3. Render a table: Learner Name, Module, Attempts, Reason, Requested At, Actions

**Step 2: Implement the Unlock action**

1. When supervisor clicks 'Unlock', call resetEnrollment(userId, courseId, actorId, actorName) from enrollmentService

2. Update the remediation\_requests document: set status: 'approved', resolvedBy: supervisorId, resolvedAt: serverTimestamp()

3. Create an audit log entry: 'REMEDIATION\_APPROVED' action type

**Step 3: Implement the Deny action (optional but recommended)**

Set remediation request status to 'denied' with a reason field. The learner remains locked. This provides an audit trail for cases where supervisors determine additional training outside the system is needed.

**Step 4: Add route to App.tsx**

Add '/remediation' to the sidebar nav (admin/instructor only) and the route switch in App.tsx, following the same pattern as GradeManagement.

## **Security Rules**

Verify that remediation\_requests has appropriate Firestore rules:

* Read: admin and instructor roles only

* Write: Only Cloud Functions (server-side) should create these

* Update: admin and instructor roles can update status

## **Verification**

1. Create a test scenario: learner fails a module 3 times

2. Confirm remediation\_requests document appears in Firestore

3. Open RemediationQueue as admin — see the pending request

4. Click Unlock — enrollment resets, audit log created, request status updated

5. Learner can now retry the module

**GUIDE 4**

**Production Build Pipeline**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 1-2 Days | MUST-SHIP | Phase 2 |

## **Root Cause**

Firebase Hosting currently serves the default placeholder page (public/index.html). The Vite build output is not deployed. Tailwind is loaded from a CDN which is unreliable for production. These two issues block anyone outside the development environment from using the system.

## **Step 1: Fix firebase.json Hosting Config**

The current firebase.json points hosting at the 'public' directory, which contains the Firebase placeholder page. Change it to point at the Vite build output:

**Current (wrong):**

"hosting": { "public": "public", ... }

**Correct:**

"hosting": { "public": "dist", ... }

The 'dist' directory is Vite's default output. The rewrites rule (\*\* to /index.html) is already correct for SPA routing.

## **Step 2: Bundle Tailwind CSS**

Replace the CDN link with a proper PostCSS build:

1. Install: npm install \-D tailwindcss postcss autoprefixer

2. Create tailwind.config.js with content paths pointing to './src/\*\*/\*.{ts,tsx}'

3. Create postcss.config.js with tailwindcss and autoprefixer plugins

4. Create src/index.css with the three Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;

5. Import './index.css' in main.tsx

6. Remove the CDN \<link\> tag from index.html

## **Step 3: Environment Variables**

Move the hardcoded Firebase config in services/firebase.ts to environment variables:

1. Create .env file at project root with VITE\_FIREBASE\_API\_KEY, VITE\_FIREBASE\_AUTH\_DOMAIN, etc.

2. Update services/firebase.ts to read from import.meta.env.VITE\_FIREBASE\_\*

3. Add .env to .gitignore (already likely there)

4. Create .env.example with placeholder values for documentation

## **Step 4: Production Build & Deploy**

1. Run npm run build — Vite outputs to dist/

2. Verify: ls dist/ should show index.html, assets/, etc.

3. Test locally: npx serve dist — confirm the app loads

4. Deploy: firebase deploy \--only hosting

5. Verify: visit https://harmony-lms.web.app and confirm the app loads

## **Step 5: CI/CD (Recommended)**

Create a GitHub Actions workflow for automated deployment:

* Trigger: push to main branch

* Steps: checkout, npm install, npm run build, firebase deploy

* Store FIREBASE\_TOKEN as a GitHub secret (generate with firebase login:ci)

## **Verification**

1. npm run build completes with no errors

2. Local serve of dist/ loads the app correctly

3. firebase deploy \--only hosting succeeds

4. Visiting the Firebase Hosting URL shows the real app, not the placeholder

5. All pages load, authentication works, Firestore operations succeed from the deployed site

**GUIDE 5**

**Seed Content & User Accounts**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 1-2 Days | MUST-SHIP | Phase 3 |

## **Root Cause**

The system needs real Parrish staff accounts and at least one complete training course before internal deployment can begin. Currently only development/test accounts exist.

## **Step 1: Create Staff Accounts**

Use the existing UserManagement page or Firebase Admin SDK to create accounts:

| Role | Count | Purpose |
| :---- | :---- | :---- |
| Admin | 1-2 | System administrators (you, IT lead) |
| Instructor | 2-3 | Supervisors who grade and review |
| Staff | 5-10 | Clinical staff who take training |

**Critical:** Each account must have JWT custom claims set via Firebase Admin SDK. The custom claim (role: 'admin' | 'instructor' | 'staff') is the source of truth for security rules. The Firestore user profile role must match.

Script approach: create a Node.js script using Firebase Admin SDK that reads a CSV of employees and creates accounts with proper claims. This is reusable for future staff onboarding.

## **Step 2: Build First Training Course**

Use the Module Builder to create at least one complete course with real clinical content. Recommended structure:

1. **Course:** "Hospice Documentation Fundamentals" (or equivalent real Parrish curriculum)

2. **Module 1:** Introduction — text and heading blocks, 1 image block. Mark as non-critical, weight: 20

3. **Module 2:** Core Concepts — text content with a quiz block containing MC, T/F, and fill-blank questions. Mark as critical, weight: 40

4. **Module 3:** Practical Application — text content with a quiz block containing matching and short-answer questions (triggers review queue). Mark as critical, weight: 40

**Why this structure:** It exercises every code path: non-critical and critical modules, all 5 question types, auto-grading and manual review, weighted grade calculation.

## **Step 3: End-to-End Walkthrough**

With real accounts and real content, perform a complete test:

1. Admin publishes the course via CourseManager

2. Staff user logs in, sees course in Catalog, enrolls

3. Staff user completes all modules, submits quizzes

4. Module 3 submission triggers 'needs\_review' status (short-answer)

5. Instructor logs in, sees pending review in GradeManagement

6. Instructor approves — grade created, course grade recalculates, audit trail complete

7. Staff user sees completed status and grade on Dashboard and MyGrades

8. Admin verifies audit trail in Audit Logs page

**Document any issues found.** This walkthrough is your acceptance test for internal deployment.

## **Verification**

1. All user roles can log in and see appropriate pages

2. The training course is visible in Catalog with correct module count

3. Complete learner journey works end-to-end without errors

4. Audit logs capture every action in the walkthrough

**GUIDE 6**

**Cohort Management & Bulk Enrollment**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 3-4 Days | SHOULD-SHIP | Phase 3 |

## **Root Cause**

Parrish has staff organized by job title and department. Manually enrolling each person in each required course does not scale. Cohort management enables bulk operations: enroll all RNs in Wound Care, all new hires in Onboarding, etc.

## **The Contract**

**New type needed in functions/src/types.ts:**

interface Cohort { id: string; name: string; description: string; filterCriteria: { jobTitles?: string\[\]; departments?: string\[\]; }; courseIds: string\[\]; createdBy: string; createdAt: string; }

## **Deliverables**

**A. Cohort CRUD Service**

**Location:** src/services/cohortService.ts

Standard Firestore CRUD for the cohorts collection. createCohort, updateCohort, getCohorts, getCohort, deleteCohort. All operations create audit log entries.

**B. Bulk Enrollment Function**

**Location:** New Cloud Function or client-side batch operation

Given a cohort ID, query all users matching the filter criteria (job title, department), then create enrollment documents for each user-course pair that does not already exist. Use Firestore batch writes (max 500 per batch).

**C. CohortManagement Page**

**Location:** src/pages/CohortManagement.tsx

1. List all cohorts with member count and assigned courses

2. Create/edit cohort with job title and department multi-select filters

3. Preview: show which users would be matched before executing enrollment

4. 'Enroll Cohort' button triggers bulk enrollment with progress indicator

5. Add route to App.tsx sidebar (admin only)

## **Verification**

1. Create a cohort targeting a specific job title

2. Preview shows the correct users

3. Bulk enroll creates enrollment documents for all matched users

4. Re-running enrollment does not create duplicates (idempotent)

5. Audit log captures the bulk operation

**GUIDE 7**

**Clinical Compliance Tools**

| Estimate | Priority | Phase |
| :---- | :---- | :---- |
| 2-3 Weeks | FULL ROLLOUT | Phase 4 |

## **Root Cause**

These features elevate Harmony from an LMS to a clinical compliance platform. They are not required for initial internal deployment but are essential for CMS audit readiness and onboarding external healthcare organizations.

## **Deliverable A: Correction Log Component**

**Estimate:** 3-4 days

**Location:** src/components/clinical/CorrectionLog.tsx

**Purpose:** A specialized text input that digitally replicates the medical "single-line-and-initial" protocol. When a user edits a saved entry, the original text is displayed with a strikethrough, the correction is appended with a timestamp and the user's initials. This is a CMS audit requirement for documentation training.

**Implementation:**

1. Store entries as an array of { text: string; author: string; timestamp: string; isOriginal: boolean; supersedes?: string }

2. Display original entries in normal text. When edited, original gets line-through CSS, correction appears below with timestamp and initials

3. Entries are immutable once saved — corrections are additive only

4. Integrate as a new block type in the content builder: 'correction\_log'

## **Deliverable B: License Gating System**

**Estimate:** 2-3 days

**Purpose:** Block access to clinical content when a staff member's license has expired. The User type already has licenseNumber and licenseExpiry fields.

**Implementation:**

1. Create a useLicenseCheck hook that compares user.licenseExpiry to current date

2. Wrap clinical course access in the CourseDetail and CoursePlayer pages with a license gate

3. Expired users see a blocked state: "Your license expired on \[date\]. Contact your supervisor."

4. Admin dashboard shows users with expiring/expired licenses

5. Firestore security rules: add license check to course-content read rules if license gating is stored as a course property

## **Deliverable C: Objective vs. Subjective Validator**

**Estimate:** 3-4 days

**Purpose:** An interactive exercise where learners categorize clinical data as either "Objective" or "Subjective." This is a common competency check in hospice documentation training.

**Implementation:**

1. Create a new block type: 'obj\_subj\_validator'

2. Data structure: { items: Array\<{ text: string; category: 'objective' | 'subjective' }\> }

3. UI: drag-and-drop or two-column tap interface. Learner sorts items into the correct category

4. Grading: pure function, full points for correct categorization, zero for incorrect. No partial credit

5. Add to gradeCalculation.ts as a new case in the grading switch

## **Integration Note**

Each of these tools adds a new block type or system behavior. The existing architecture supports this cleanly: add the type to BlockType union in types.ts, add the editor in BlockEditor, add the renderer in BlockRenderer, add the grading logic in gradeCalculation.ts. The pattern is well-established from the quiz question type expansion.

## **Verification**

1. Correction Log: edit a saved entry, verify strikethrough \+ correction appears with timestamp

2. License Gating: set a test user's license to expired, verify they cannot access clinical courses

3. Obj/Subj Validator: create a module with the exercise, complete it, verify grading works

4. All new block types persist correctly through builder, player, and grading pipeline