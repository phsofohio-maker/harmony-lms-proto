# Parrish HALO — Guide 14: Staff Assignment Visibility
## Claude Code Execution Brief

**Date:** May 14, 2026
**Scope:** Dashboard refactor — prioritized assignment view for clinical staff
**Estimated Effort:** 2–3 focused days
**Firebase Project:** `parrish-harmonyhca` / `harmony-lms`
**Risk Level:** LOW (frontend-only, zero backend changes)

---

## Root Cause

Clinical staff cannot determine what training they need to complete next. The current Dashboard shows "Active Enrollments" as a flat card grid with no prioritization, no deadline visibility, and no module-level context. The result: the Director of Clinical & QA prints a course list and circles assignments on paper because the app does not answer the question "what should I do right now?"

This is a presentation problem, not a data model problem. Enrollment records, availability windows, course metadata, and module-level progress all exist in Firestore. The gap is entirely in how `Dashboard.tsx` queries and presents existing data.

## Complexity Budget

- Zero new Firestore collections
- Zero new Cloud Functions
- Zero Firestore schema changes
- Zero security rule changes
- Zero new npm dependencies
- One file modified (`Dashboard.tsx`), one file lightly modified (`CourseDetail.tsx`)
- Consumes existing `checkAvailability()` utility and `getLastActiveModuleProgress()` service

All data required for the new view already exists. This feature reshapes presentation, not architecture.

---

## Execution Rules

Complete each step in order. Verify independently before proceeding to the next step. Do not batch steps.

### Out-of-Scope Files (DO NOT TOUCH)

- `src/contexts/AuthContext.tsx`
- `src/services/auditService.ts`
- `src/services/enrollmentService.ts`
- `src/services/progressService.ts`
- `src/services/courseService.ts`
- `src/utils/availabilityUtils.ts`
- `functions/src/index.ts`
- `firestore.rules`
- `storage.rules`
- All existing Cloud Functions
- All auto-save implementation in `CoursePlayer.tsx` (Guide 11 — protected)

### Conventions

- Inter font, Lucide icons (`strokeWidth={1.75}`), clinical emerald palette (`#064E2B`)
- Gray icons on white surfaces — never black
- White cards with `border border-gray-200 shadow-sm`
- Section headers: `text-sm font-bold text-gray-400 uppercase tracking-widest`
- Minimum 44px touch targets for tablet use

---

## Complete File Change Manifest

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/Dashboard.tsx` | MODIFY | Restructure Active Enrollments into prioritized assignment sections |
| `src/pages/CourseDetail.tsx` | MODIFY | Add module-level availability badges to module list |

**Total files touched: 2**

---

## The Contract

### View-Model Interface

No new types are added to `functions/src/types.ts`. The view-model is local to Dashboard:

```typescript
// Local to Dashboard.tsx — NOT exported, NOT in shared types
type AssignmentUrgency = 'overdue' | 'due_soon' | 'normal';

interface AssignmentCard {
  enrollment: Enrollment;
  course: Course;
  modules: Module[];
  availableModuleCount: number;
  totalModuleCount: number;
  nextModuleToComplete: Module | null;
  nextModuleProgress: ModuleProgressRecord | null;
  urgency: AssignmentUrgency;
  deadlineMessage: string | null;       // "Due in 3 days" or "Overdue — closed May 10"
  moduleProgressLine: string | null;    // "Module 2 of 4 · Part 2 - Teaching Content"
}
```

### Urgency Classification Logic

```typescript
function classifyUrgency(
  course: Course,
  enrollment: Enrollment
): { urgency: AssignmentUrgency; deadlineMessage: string | null } {
  const check = checkAvailability(course.availability);

  if (check.status === 'closed' && enrollment.status !== 'completed') {
    return {
      urgency: 'overdue',
      deadlineMessage: `Overdue — closed ${check.closesAt!.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      })}`,
    };
  }

  if (check.closesAt) {
    const daysRemaining = Math.ceil(
      (check.closesAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return {
        urgency: 'due_soon',
        deadlineMessage: daysRemaining === 1
          ? 'Due tomorrow'
          : `Due in ${daysRemaining} days`,
      };
    }
  }

  return { urgency: 'normal', deadlineMessage: null };
}
```

### Next Module Determination Logic

```typescript
function findNextModule(
  modules: Module[],
  courseProgressRecords: ModuleProgressRecord[]
): Module | null {
  const completedModuleIds = new Set(
    courseProgressRecords.filter(p => p.isComplete).map(p => p.moduleId)
  );

  // Modules are already sorted by `order` from getModules()
  for (const mod of modules) {
    if (completedModuleIds.has(mod.id)) continue;

    // Check module-level availability
    const modAvail = checkAvailability(mod.availability);
    if (modAvail.status === 'available') return mod;
  }

  return null;
}
```

---

## Execution Steps

### Step 1: Add urgency classification utility to Dashboard.tsx [MODIFY]

**Estimate:** 30 minutes | **Risk:** None

Add the following above the `Dashboard` component definition in `Dashboard.tsx`:

1. Import `checkAvailability` from `../utils/availabilityUtils` (if not already imported).
2. Import `Module` from `../functions/src/types` (if not already imported).
3. Add the `AssignmentUrgency` type alias and `AssignmentCard` interface as local types (not exported).
4. Add the `classifyUrgency` function as defined in the contract above.
5. Add the `findNextModule` function as defined in the contract above.

**Verification:**
- [ ] TypeScript compiles clean — `npm run build` (or Vite dev server shows zero errors)
- [ ] No runtime changes yet — Dashboard renders identically to before

---

### Step 2: Expand data fetching to include modules per enrollment [MODIFY `Dashboard.tsx`]

**Estimate:** 1 hour | **Risk:** Low (additional Firestore reads)

The current Dashboard `useEffect` fetches `getLastActiveModuleProgress` and `getModules` for each active enrollment. Expand this to also build `AssignmentCard` objects.

**Current data fetch pattern (in the `useEffect`):**

```typescript
const [lastProgress, modules] = await Promise.all([
  getLastActiveModuleProgress(user.uid, enrollment.courseId),
  getModules(enrollment.courseId),
]);
```

**New pattern — replace the existing `useEffect` that populates `activeInfo`:**

```typescript
// Replace the ActiveEnrollmentInfo type and state with:
const [assignmentCards, setAssignmentCards] = useState<AssignmentCard[]>([]);

// Replace the useEffect body:
useEffect(() => {
  if (!user?.uid || activeEnrollments.length === 0) {
    setAssignmentCards([]);
    return;
  }

  const buildCards = async () => {
    const cards: AssignmentCard[] = [];

    await Promise.all(activeEnrollments.map(async (enrollment) => {
      const course = courses.find(c => c.id === enrollment.courseId);
      if (!course) return;

      try {
        const [modules, lastProgress, courseProgress] = await Promise.all([
          getModules(enrollment.courseId),
          getLastActiveModuleProgress(user.uid, enrollment.courseId),
          getCourseProgress(user.uid, enrollment.courseId),
        ]);

        const { urgency, deadlineMessage } = classifyUrgency(course, enrollment);
        const nextModule = findNextModule(modules, courseProgress);

        const availableModuleCount = modules.filter(m => {
          const avail = checkAvailability(m.availability);
          return avail.status === 'available';
        }).length;

        const nextModuleIndex = nextModule
          ? modules.findIndex(m => m.id === nextModule.id)
          : -1;

        const moduleProgressLine = nextModule && nextModuleIndex >= 0
          ? `Module ${nextModuleIndex + 1} of ${modules.length} · ${nextModule.title}`
          : null;

        cards.push({
          enrollment,
          course,
          modules,
          availableModuleCount,
          totalModuleCount: modules.length,
          nextModuleToComplete: nextModule,
          nextModuleProgress: lastProgress,
          urgency,
          deadlineMessage,
          moduleProgressLine,
        });
      } catch {
        // Graceful degradation — show card without enrichment
        cards.push({
          enrollment,
          course,
          modules: [],
          availableModuleCount: 0,
          totalModuleCount: 0,
          nextModuleToComplete: null,
          nextModuleProgress: null,
          urgency: 'normal',
          deadlineMessage: null,
          moduleProgressLine: null,
        });
      }
    }));

    // Sort: overdue first, then due_soon, then normal
    const urgencyOrder: Record<AssignmentUrgency, number> = {
      overdue: 0,
      due_soon: 1,
      normal: 2,
    };
    cards.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    setAssignmentCards(cards);
  };

  buildCards();
}, [user?.uid, activeEnrollments.length, courses]);
```

**Also add the import for `getCourseProgress`:**

```typescript
import { getLastActiveModuleProgress, getCourseProgress, ModuleProgressRecord } from '../services/progressService';
```

**Verification:**
- [ ] TypeScript compiles clean
- [ ] Dashboard loads without errors — check browser console
- [ ] `assignmentCards` state populates (add a temporary `console.log(assignmentCards)` to verify, then remove)

---

### Step 3: Replace the Active Enrollments render section [MODIFY `Dashboard.tsx`]

**Estimate:** 2–3 hours | **Risk:** Medium (primary UI change)

Replace the entire `{activeEnrollments.length > 0 && (...)}` block (the "Continue Learning" section) with three new sections. Remove the old `activeInfo` state and its `useEffect` — they are fully replaced by `assignmentCards`.

**Section layout:**

**Section A — "Action Required"** (overdue + due_soon cards only)

Only renders if at least one card has urgency `overdue` or `due_soon`.

```tsx
{(() => {
  const urgentCards = assignmentCards.filter(
    c => c.urgency === 'overdue' || c.urgency === 'due_soon'
  );
  if (urgentCards.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Action Required
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {urgentCards.map(card => (
          <AssignmentCardComponent key={card.enrollment.id} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
})()}
```

**Section B — "In Progress"** (normal urgency, progress > 0)

```tsx
{(() => {
  const inProgressCards = assignmentCards.filter(
    c => c.urgency === 'normal' && c.enrollment.progress > 0
  );
  if (inProgressCards.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <PlayCircle className="h-4 w-4 text-primary-500" />
        In Progress
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inProgressCards.map(card => (
          <AssignmentCardComponent key={card.enrollment.id} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
})()}
```

**Section C — "Not Started"** (normal urgency, progress === 0)

```tsx
{(() => {
  const notStartedCards = assignmentCards.filter(
    c => c.urgency === 'normal' && c.enrollment.progress === 0
  );
  if (notStartedCards.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-gray-400" />
        Not Started
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notStartedCards.map(card => (
          <AssignmentCardComponent key={card.enrollment.id} card={card} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
})()}
```

**The existing "Your Course Grades" section and "Completed Training" section remain untouched and stay below these three sections.**

**Verification:**
- [ ] Dashboard renders the three sections correctly
- [ ] Sections with zero matching cards do not render (no empty headers)
- [ ] Cards appear in the correct section based on urgency and progress
- [ ] Completed enrollments still appear in the existing grades section below

---

### Step 4: Build the AssignmentCardComponent [MODIFY `Dashboard.tsx`]

**Estimate:** 1.5 hours | **Risk:** Low

Add as a local component inside `Dashboard.tsx` (above the `Dashboard` component export). This replaces the old inline card JSX.

```tsx
interface AssignmentCardComponentProps {
  card: AssignmentCard;
  onNavigate: (path: string, context?: Record<string, any>) => void;
}

const AssignmentCardComponent: React.FC<AssignmentCardComponentProps> = ({ card, onNavigate }) => {
  const { enrollment, course, urgency, deadlineMessage, moduleProgressLine,
          nextModuleToComplete, availableModuleCount, totalModuleCount } = card;

  const isOverdue = urgency === 'overdue';
  const isDueSoon = urgency === 'due_soon';

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-5 transition-all',
        isOverdue
          ? 'border-red-200 border-l-4 border-l-red-400'
          : isDueSoon
          ? 'border-amber-200 border-l-4 border-l-amber-400'
          : 'border-gray-200 hover:border-primary-300 hover:shadow-sm'
      )}
    >
      {/* Title */}
      <h3 className="font-bold text-gray-900 mb-2 line-clamp-1">{course.title}</h3>

      {/* Deadline badge */}
      {deadlineMessage && (
        <div className={cn(
          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mb-3',
          isOverdue
            ? 'bg-red-50 text-red-700'
            : 'bg-amber-50 text-amber-700'
        )}>
          <Clock className="h-3 w-3" />
          {deadlineMessage}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-700">{enrollment.progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all rounded-full',
              isOverdue ? 'bg-red-400' : isDueSoon ? 'bg-amber-400' : 'bg-primary-500'
            )}
            style={{ width: `${enrollment.progress}%` }}
          />
        </div>
      </div>

      {/* Module progress line */}
      {moduleProgressLine && (
        <p className="text-xs text-gray-600 mb-1 line-clamp-1 font-medium">
          {moduleProgressLine}
        </p>
      )}

      {/* Module availability count (only show if course has module-level windows) */}
      {availableModuleCount < totalModuleCount && totalModuleCount > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          {availableModuleCount} of {totalModuleCount} modules available
        </p>
      )}

      {/* Last activity timestamp */}
      {card.nextModuleProgress?.updatedAt && (
        <p className="text-xs text-gray-400 mb-3">
          {formatRelativeTime(card.nextModuleProgress.updatedAt)}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {nextModuleToComplete ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onNavigate('/player', {
              courseId: enrollment.courseId,
              moduleId: nextModuleToComplete.id,
              courseCategory: course.category,
            })}
          >
            {enrollment.progress > 0 ? 'Continue' : 'Start'}
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onNavigate('/course', { courseId: enrollment.courseId })}
          >
            <PlayCircle className="h-3 w-3 mr-1" />
            View Course
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNavigate('/course', { courseId: enrollment.courseId })}
        >
          Details
        </Button>
      </div>
    </div>
  );
};
```

**Design notes:**
- Overdue cards get a red left border (4px) — noticeable but not aggressive. Clinical staff have enough alert fatigue from EMR systems.
- Due-soon cards get an amber left border.
- Normal cards use the existing gray border with hover effect.
- The "Continue" button deep-links directly to the next incomplete, available module via the existing `onNavigate('/player', ...)` pattern.
- The module progress line ("Module 2 of 4 · Part 2 - Teaching Content") tells the staff member exactly where they are and what is next.

**Verification:**
- [ ] Overdue card shows red left border and red deadline badge
- [ ] Due-soon card shows amber left border and amber deadline badge
- [ ] Normal card shows standard gray border, no deadline badge
- [ ] "Continue" button navigates to CoursePlayer with the correct moduleId
- [ ] "Start" label appears on cards with 0% progress; "Continue" appears on cards with >0% progress
- [ ] "Details" button navigates to CourseDetail page
- [ ] Module progress line shows correct module number and title
- [ ] Cards with module-level availability windows show "X of Y modules available"

---

### Step 5: Clean up deprecated state and references [MODIFY `Dashboard.tsx`]

**Estimate:** 15 minutes | **Risk:** Low

Remove the old code that is now replaced:

1. Remove the `ActiveEnrollmentInfo` interface.
2. Remove the `activeInfo` state declaration (`useState<Record<string, ActiveEnrollmentInfo>>({})`).
3. Remove the old `useEffect` that populated `activeInfo`.
4. Remove any references to `activeInfo` in the JSX (the old card render block was replaced in Step 3).
5. Verify no remaining references to `activeInfo` exist in the file.

**Verification:**
- [ ] Search the file for `activeInfo` — zero results
- [ ] Search the file for `ActiveEnrollmentInfo` — zero results
- [ ] TypeScript compiles clean
- [ ] Dashboard renders correctly with the new sections

---

### Step 6: Add module availability badges to CourseDetail.tsx [MODIFY]

**Estimate:** 45 minutes | **Risk:** Low

In the module list on the CourseDetail page, add availability status indicators next to each module row. This gives staff a clear view of which modules are open, locked, or closed when they click into a course.

**Implementation:**

1. `checkAvailability` is already imported in `CourseDetail.tsx`.
2. In the module list render (where each module row is displayed), call `checkAvailability(module.availability)` for each module.
3. Based on the result:
   - `not_yet_open` → show a Lock icon (`lucide-react`) with the open date text in gray: `"Opens May 21"`
   - `closed` → show a small "Closed" badge in muted red: `"Closed"`
   - `available` → no additional indicator (current behavior)

**Add next to the module title in the module row:**

```tsx
{(() => {
  const modAvail = checkAvailability(module.availability);
  if (modAvail.status === 'not_yet_open') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-2">
        <Lock className="h-3 w-3" />
        {modAvail.message}
      </span>
    );
  }
  if (modAvail.status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400 ml-2">
        {modAvail.message}
      </span>
    );
  }
  return null;
})()}
```

**Verification:**
- [ ] Module with no availability window — no badge, renders as before
- [ ] Module with `opensAt` in the future — shows lock icon and "Opens [date]"
- [ ] Module with `closesAt` in the past — shows "Closed [date]" in muted red
- [ ] Module currently available — no additional indicator
- [ ] Zero TypeScript errors

---

## Ripple Effect Analysis

| Component | Impact | Action Required |
|---|---|---|
| `Dashboard.tsx` | Primary change — restructured Active Enrollments, new card component, new data fetch | Steps 1–5 |
| `CourseDetail.tsx` | Minor — module availability badges | Step 6 |
| `enrollmentService.ts` | None — existing queries sufficient | No changes |
| `progressService.ts` | None — `getLastActiveModuleProgress` and `getCourseProgress` already exist | No changes |
| `courseService.ts` | None — `getModules` already returns ordered modules | No changes |
| `availabilityUtils.ts` | None — `checkAvailability` consumed as-is | No changes |
| Firestore indexes | Existing `userId + enrolledAt` and `userId + courseId` indexes cover all queries | No new indexes |
| Cloud Functions | None | No changes |
| Security rules | None | No changes |
| Other pages | None — GradeManagement, MyGrades, CourseCatalog, CoursePlayer untouched | No changes |

---

## Verification Checklist

### Staff Dashboard — Assignment Sections

- [ ] Staff with zero enrollments → shows empty state, no section headers render, no errors
- [ ] Staff enrolled in a course with no availability window → appears in "In Progress" or "Not Started" based on progress, no deadline shown
- [ ] Staff enrolled in a course with `closesAt` in 3 days → appears in "Action Required" with amber badge "Due in 3 days"
- [ ] Staff enrolled in a course with `closesAt` in the past, not completed → appears in "Action Required" with red badge "Overdue — closed [date]"
- [ ] Staff enrolled in a course with `closesAt` > 7 days away → appears in "In Progress" or "Not Started" (normal urgency), no deadline badge
- [ ] Multiple enrollments sort correctly: overdue first, then due_soon, then normal
- [ ] "Continue" button navigates directly to the next incomplete, available module in CoursePlayer
- [ ] "Start" button appears on 0% progress cards; navigates to the first available module
- [ ] "Details" button navigates to CourseDetail page
- [ ] Module progress line shows "Module X of Y · [Module Title]"
- [ ] Completed courses still appear in "Your Course Grades" section, unchanged

### Module Availability on CourseDetail

- [ ] Course with module-level availability windows → lock icon and date shown on locked modules
- [ ] Course with no module availability → module list renders identically to before
- [ ] Closed modules show "Closed [date]" in muted red

### Regression

- [ ] Instructor/admin dashboard shows the same new sections (they are also enrolled in courses)
- [ ] Stats grid (Pending Courses, CE Credits, Compliance Alerts) unchanged
- [ ] Grade Summary Cards section unchanged
- [ ] Course list / catalog section at the bottom unchanged
- [ ] Zero TypeScript errors, clean Vite build
- [ ] No console errors on page load

---

## Estimated Effort Summary

| Step | Estimate | Risk |
|------|----------|------|
| Step 1: Urgency classification utility | 30 min | None |
| Step 2: Expanded data fetching | 1 hour | Low |
| Step 3: Section layout replacement | 2–3 hours | Medium |
| Step 4: AssignmentCardComponent | 1.5 hours | Low |
| Step 5: Cleanup deprecated state | 15 min | Low |
| Step 6: CourseDetail module badges | 45 min | Low |
| **Total** | **6–7 hours** | **Low** |

---

*Parrish HALO · Parrish Health Systems · Resilient Engineering Manifesto*
*Guide generated May 14, 2026*
