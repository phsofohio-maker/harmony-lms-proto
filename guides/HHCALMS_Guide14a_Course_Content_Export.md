# HHCALMS Guide 14a — Course Content Export

**Status:** Ready for Execution
**Sco~pe:** Single feature — export a course to Markdown
**Estimate:** 1 day (4–6 focused hours)
**Dependencies:** None. Composes with Guide 13 (glossary read).
**Sequencing:** Ships before Guide 14 (Module Content Validation).

---

## A — Approach & Complexity Budget

### Root Cause

There is no programmatic way to extract the full content of a published course from HHCALMS. Reviewing a course requires logging into the LMS, navigating module by module, and reading content blocks in the player UI. This blocks three things:

1. **Audit defensibility** — A CMS auditor asking "show me what this nurse completed" cannot be answered with a structured artifact.
2. **Content review** — Subject-matter experts cannot review courses outside the LMS.
3. **Validator design** — Module Content Validation (Guide 14) needs real course data to calibrate its checks.

### Complexity Budget Justification

This feature adds **zero** new architectural layers. It is a pure read-and-format operation:

- No new Cloud Functions (course/module/glossary data is already client-readable to authorized roles)
- No new Firestore collections
- No new Storage paths
- No new Firestore rules
- One new service file (`courseExportService.ts`)
- One new UI entry point (button on `CourseManager.tsx`)
- One new audit action type

The export runs entirely client-side. The only side effect is an audit log entry recording who exported what.

### Design Philosophy

- **Deterministic.** The same course always exports to the same Markdown. No timestamps in body, no random ordering, no nondeterministic field traversal.
- **Lossless within scope.** Every authored field is included. If it isn't included, that's documented in the manifest (e.g., binary image data is referenced by URL, not embedded).
- **Human-readable.** The output opens cleanly in any Markdown viewer or text editor. Auditor-friendly.
- **Diff-able.** Two exports of the same course at different times produce textual diffs that reflect actual content changes.

---

## B — The Contract

### B.1 Output Format

A single `.md` file per course. Filename pattern:

```
{courseSlug}_{courseId}_{exportedAtISO}.md
```

Example: `infection-control-basics_course_abc123_2026-05-07T14-30-00.md`

### B.2 Markdown Structure

```markdown
# {Course Title}

**Course ID:** `{courseId}`
**Status:** {draft | published}
**Author:** {authorDisplayName} ({authorId})
**Created:** {createdAt ISO}
**Last Updated:** {updatedAt ISO}
**Exported:** {exportedAt ISO}
**Exported By:** {actorDisplayName} ({actorId})

---

## Course Description

{course.description}

## Course Metadata

- **Passing Score:** {passingScore}%
- **Estimated Duration:** {estimatedMinutes} minutes
- **Module Count:** {modules.length}
- **Total Question Count:** {sumAcrossModules}
- **Total Block Count:** {sumAcrossModules}

---

## Module 1: {Module Title}

**Module ID:** `{moduleId}`
**Order:** 1 of {totalModules}
**Block Count:** {n}
**Question Count:** {n}

### Block 1 (text)

{rendered content as Markdown — TipTap HTML converted to MD}

### Block 2 (image)

> **Image:** {alt text or "[no alt text provided]"}
> **URL:** {imageUrl}
> **Caption:** {caption if present}

### Block 3 (video)

> **Video:** {title}
> **URL:** {videoUrl}
> **Duration:** {duration if present}

### Block 4 (quiz)

#### Question 1 (multiple_choice)

**Prompt:** {questionPrompt}

- a. {optionA}
- b. {optionB}  ← CORRECT
- c. {optionC}
- d. {optionD}

**Explanation:** {explanation if present, otherwise "[none provided]"}
**Points:** {points}

#### Question 2 (true_false)

**Prompt:** {questionPrompt}

- True  ← CORRECT
- False

**Explanation:** {explanation if present}

---

## Module 2: ...

[same structure]

---

## Glossary Terms

Terms are read from `glossary/{courseId}/terms`. If the course has no terms, this section reads:

> *No glossary terms defined for this course.*

Otherwise, terms are listed alphabetically:

- **{term}**: {definition}
  *Created by {createdByName} on {createdAt}*

---

## Export Manifest

- **Schema Version:** 1.0
- **Exported By:** {actorDisplayName}
- **Export Timestamp:** {ISO}
- **Course Snapshot Timestamp:** {course.updatedAt}
- **Module Snapshot Timestamps:** [list]
- **Excluded Data:**
  - Image binary data (referenced by URL only)
  - Video binary data (referenced by URL only)
  - User progress/enrollment records (not part of content)
  - Audit logs (separate concern)
```

### B.3 TypeScript Interface

```typescript
// services/courseExportService.ts

export interface CourseExportOptions {
  courseId: string;
  actorId: string;
  actorName: string;
}

export interface CourseExportResult {
  filename: string;
  markdown: string;
  manifest: {
    schemaVersion: '1.0';
    courseId: string;
    moduleCount: number;
    blockCount: number;
    questionCount: number;
    glossaryTermCount: number;
    exportedAt: string; // ISO
    exportedBy: string;
  };
}

export async function exportCourseToMarkdown(
  options: CourseExportOptions
): Promise<CourseExportResult>;
```

The function:
1. Reads course doc from `courses/{courseId}`
2. Reads all modules from `courses/{courseId}/modules`
3. Reads all glossary terms from `glossary/{courseId}/terms`
4. Renders the Markdown deterministically
5. Calls `auditService.logToFirestore(actorId, actorName, 'COURSE_EXPORT', courseId, { ... })`
6. Returns the result — does **not** trigger download (caller is responsible for that)

### B.4 Audit Action Type

Add to `services/auditService.ts`:

```typescript
| 'COURSE_EXPORT'
```

---

## C — File Change Manifest

| File | Action | Purpose |
|------|--------|---------|
| `services/courseExportService.ts` | CREATE | Pure export logic; reads Firestore, returns Markdown string |
| `utils/htmlToMarkdown.ts` | CREATE | TipTap HTML → Markdown converter (small, scoped) |
| `services/auditService.ts` | MODIFY | Add `COURSE_EXPORT` to audit action union |
| `pages/CourseManager.tsx` | MODIFY | Add "Export Course" button on each course row |
| `components/ui/ExportCourseDialog.tsx` | CREATE | Confirmation modal + download trigger |

**Out-of-scope (do not touch):**
- `AuthContext.tsx`
- Any Cloud Function (no backend changes needed)
- `firestore.rules` (no rule changes needed)
- `storage.rules`
- Any Guide 11 or Guide 13 file (read-only consumption only)
- Any existing block editor / renderer logic

---

## D — Execution Steps

Execute in order. Verify each step independently before proceeding.

### Step D1: Add `COURSE_EXPORT` to audit action union [MODIFY]

**File:** `services/auditService.ts`
**Estimate:** 5 minutes
**Risk:** None

Add `'COURSE_EXPORT'` to the `AuditActionType` union, in alphabetical order with the other action types.

**Verification:**
- [ ] TypeScript compiles with zero errors
- [ ] No other audit usages broken

---

### Step D2: Create `utils/htmlToMarkdown.ts` [NEW]

**Estimate:** 1 hour
**Risk:** Low

This converts the TipTap HTML output into clean Markdown for the export. Scope is **deliberately narrow** — only the HTML elements TipTap actually produces in this app:

- `<p>` → blank-line-separated paragraphs
- `<strong>` / `<b>` → `**text**`
- `<em>` / `<i>` → `*text*`
- `<u>` → `<u>text</u>` (Markdown has no native underline; preserve as inline HTML)
- `<s>` / `<strike>` → `~~text~~`
- `<h2>` → `## text`
- `<h3>` → `### text`
- `<ul>` / `<ol>` / `<li>` → `- text` / `1. text`
- `<a href="...">` → `[text](url)`
- `<blockquote>` → `> text`
- `<code>` → `` `text` ``
- `<hr>` → `---`
- `<mark>` → `==text==` (Markdown extension; preserved verbatim)
- `<span class="clinical-term" data-term-id="...">` → `**text**` followed by trailing reference `[term:{termId}]` so the export captures the linkage to the glossary section. Do NOT inline the definition — the glossary section is the source of truth.

**Critical constraint:**
- The function must be **pure** — input HTML string, output Markdown string. No DOM access. Use a server-safe parser (`htmlparser2` or a hand-rolled tag walker — both are zero-dependency or already in `node_modules`).
- If an unrecognized tag is encountered, the function strips the tag but preserves the inner text. Log a `console.warn` with the unknown tag name. This makes the export resilient to future TipTap extensions.

**Interface:**
```typescript
export function htmlToMarkdown(html: string): string;
```

**Verification:**
- [ ] Unit test (or REPL test): a paragraph with bold + italic round-trips correctly
- [ ] Clinical term span produces `**term** [term:{id}]` format
- [ ] Unknown tags produce a warning but don't throw

---

### Step D3: Create `services/courseExportService.ts` [NEW]

**Estimate:** 2 hours
**Risk:** Medium (Firestore traversal + Markdown assembly)

**Implementation requirements:**

1. **Read course document** from `courses/{courseId}`. Throw a typed error if not found.
2. **Read modules** from `courses/{courseId}/modules`, ordered by `order` ascending.
3. **Read glossary terms** from `glossary/{courseId}/terms`, ordered by `term` ascending. Use the existing `getTermsForCourse(courseId)` from `glossaryService.ts` — do not re-implement.
4. **Assemble Markdown** in the structure defined in B.2. Use a string builder pattern (push to array, join at end) — do not concatenate in a loop.
5. **Counts must be derived, not assumed** — count blocks and questions by traversing the module data, not by reading any cached count field.
6. **Render each block type** via a switch on `block.type`. Unknown block types render as a placeholder: `> **Unknown block type:** {block.type}` and emit a `console.warn`.
7. **Render each question type** explicitly. Supported: `multiple_choice`, `true_false`, `fill_blank`, `matching`, `short_answer`. Unknown question types render as: `> **Unknown question type:** {question.type}` and emit a `console.warn`.
8. **Determinism:** every list iteration uses an explicit ordering field. Never rely on Firestore document iteration order.
9. **Audit log call:** after assembly, before return. Include `moduleCount`, `questionCount`, `glossaryTermCount` in the metadata payload.
10. **stripUndefined** on all audit log payloads, per project convention.

**Filename generation:**
- Slugify the course title: lowercase, replace whitespace and non-alphanumerics with `-`, collapse runs of `-`, trim leading/trailing `-`. Cap at 60 chars.
- Pattern: `{slug}_{courseId}_{ISO-with-colons-replaced-by-dashes}.md`

**Error handling:**
- Course not found → throw `CourseExportError('NOT_FOUND', 'Course {courseId} not found')`
- No modules → still export, with `## Modules\n\n*This course has no modules.*`
- Permission denied → let the Firestore SDK error propagate; the caller surfaces it

**Verification:**
- [ ] Export a course with 1 module, 3 blocks, 2 questions → Markdown structure matches B.2 exactly
- [ ] Export a course with 0 glossary terms → glossary section shows the empty-state line
- [ ] Audit log entry appears in `auditLogs` collection with `action: 'COURSE_EXPORT'`
- [ ] Re-running the export at the same instant produces byte-identical Markdown (determinism check)

---

### Step D4: Create `components/ui/ExportCourseDialog.tsx` [NEW]

**Estimate:** 45 minutes
**Risk:** Low

Confirmation modal that opens when the user clicks "Export Course." Behavior:

1. Shows course title, last-updated timestamp, and a brief description of what the export will contain ("Markdown file containing all module content, questions, answer keys, and glossary terms.").
2. Two buttons: **Cancel** (closes modal) and **Download Markdown** (primary, calls `exportCourseToMarkdown`, triggers browser download via Blob, closes modal).
3. While exporting, primary button shows a spinner and is disabled. No other UI state needed — the export is fast (< 2s for typical courses).
4. On error, surfaces a toast (use existing toast pattern) with the error message. Modal stays open.
5. On success, triggers download and closes modal. Toast confirms: "Course exported."

**Browser download trigger:**
```typescript
const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = result.filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

**Brand alignment (per Brand Guide):**
- Modal: `bg-white rounded-lg border border-gray-200 shadow-lg p-6 w-[480px]`
- Primary button: `bg-primary-800 text-white` with hover `bg-primary-700`
- Lucide `Download` icon at `strokeWidth={1.75}`, size 18px
- No emojis

**Verification:**
- [ ] Modal opens, course metadata shown correctly
- [ ] Download button triggers `.md` file download with correct filename
- [ ] Cancel button closes modal with no side effects
- [ ] Error case shows toast and keeps modal open

---

### Step D5: Wire button into `pages/CourseManager.tsx` [MODIFY]

**Estimate:** 30 minutes
**Risk:** Low (UI integration only)

**Changes:**

1. Import `ExportCourseDialog` and `Download` icon from Lucide
2. Add `exportingCourse: Course | null` state to the page
3. In each course row's action area, add an "Export" button. Visibility: any role with `canViewCourse(course)` permission. **Authors and admins only**, not staff/learners — this is a content management action, not a learner action.
4. Clicking the button sets `exportingCourse` to that course; setting it back to `null` closes the dialog.
5. Render `<ExportCourseDialog course={exportingCourse} onClose={() => setExportingCourse(null)} />` once at page level, not per-row.

**Permission check:**
- Use the existing role check pattern from `CourseManager.tsx`. Do not introduce a new permission concept.
- The Firestore rules already gate course/module reads — if the user can see the course in the manager, they can export it.

**Verification:**
- [ ] Authors and admins see the "Export" button on every course row they can manage
- [ ] Staff users (if they ever land on this page) do not see the button
- [ ] Clicking the button opens the dialog with the correct course
- [ ] Closing the dialog clears the state
- [ ] No regression in existing CourseManager actions (Edit, Delete, Publish toggle)

---

## E — Ripple Effect

**Direct dependencies (this feature reads from):**
- `courses/{courseId}` — read-only
- `courses/{courseId}/modules` — read-only
- `glossary/{courseId}/terms` — read-only via existing `glossaryService.getTermsForCourse`
- `auditService.logToFirestore` — write to audit log

**Direct dependencies (this feature writes to):**
- `auditLogs` collection — single new entry per export (existing service)

**No impact on:**
- Course player runtime
- Grading engine
- Enrollment flow
- Quiz attempt recording
- Authentication / RBAC
- Any Cloud Function
- Any existing UI page (other than the new button on CourseManager)

**Forward-compatibility considerations:**
- The Markdown schema version is `1.0`. If new block or question types are added later, they render as placeholders rather than breaking the export. Schema version bumps are documented in the manifest.
- The `htmlToMarkdown` function emits warnings on unknown tags — these surface in the console during testing and indicate the function needs an update before the next major TipTap extension lands.
- This export format is a known input to Guide 14 (Module Content Validation). Guide 14's audit script will read these exports rather than reading Firestore directly when running offline analysis.

---

## F — Verification

### F.1 Smoke Test (Manual)

1. Log in as an admin or instructor
2. Navigate to Course Manager
3. Identify a course with at least one module containing text, an image, and a quiz
4. Click "Export"
5. Confirm dialog shows correct course metadata
6. Click "Download Markdown"
7. File downloads with the expected filename pattern
8. Open the file in a Markdown viewer (VS Code, GitHub preview, Obsidian)
9. Verify structure matches B.2:
   - Course header block has all fields
   - Each module appears with title, ID, order
   - Each block renders with its type label
   - Each question shows the correct answer marked with `← CORRECT`
   - Glossary section is present (even if empty, with the empty-state line)
   - Manifest section is present

### F.2 Determinism Test

1. Export the same course twice within 60 seconds
2. Diff the two files
3. The only difference should be the **Exported** timestamp and the **Export Timestamp** in the manifest. Course content, module order, block order, question order, glossary order must be byte-identical.

### F.3 Audit Trail Test

1. Export a course
2. Query Firestore: `auditLogs` where `action == 'COURSE_EXPORT'` and `targetId == {courseId}`
3. Confirm:
   - Entry exists
   - `actorId` and `actorName` match the logged-in user
   - Metadata payload includes `moduleCount`, `questionCount`, `glossaryTermCount`
   - Timestamp is server-generated (not client-supplied)

### F.4 Permission Test

1. Log in as a staff/learner user (if such a role can reach CourseManager — likely not, but verify)
2. Confirm the Export button is not visible
3. Attempt to call `exportCourseToMarkdown` directly via dev console
4. Confirm Firestore rules block the read on `courses/{courseId}` if the user lacks permission

### F.5 Empty-State Tests

1. Export a course with zero modules → renders "*This course has no modules.*"
2. Export a course with zero glossary terms → renders "*No glossary terms defined for this course.*"
3. Export a module with zero blocks → renders the module header and a placeholder line
4. Neither case should throw

---

## G — Decisions Locked / Open

**Locked:**
- Output format is Markdown, not JSON, not PDF
- Schema version is `1.0`
- Filename pattern is `{slug}_{courseId}_{ISO}.md`
- Image and video binary data is referenced by URL, not embedded
- The export is client-side only — no Cloud Function

**Open (defer to implementation):**
- Whether to bundle multiple courses into a single export. **Recommendation: not in v1.** A separate "Export All Courses" button can be added later as a thin wrapper that calls `exportCourseToMarkdown` in a loop and zips the results. v1 is one course per export.
- Whether to expose this as a Cloud Function endpoint for programmatic access (e.g., automated nightly backups). **Recommendation: not in v1.** Adding a callable function is small but introduces an authentication surface that should be considered separately. v1 is UI-triggered only.

---

## H — Definition of Done

- [ ] All five steps (D1–D5) complete with verification checklists ticked
- [ ] At least one Miara-era course exported successfully
- [ ] At least one of Kobe's authored courses exported successfully
- [ ] Both exports are diff-clean across two consecutive runs (determinism verified)
- [ ] Audit log entries present and well-formed for both exports
- [ ] No TypeScript errors, no console warnings (other than expected unknown-tag warnings if any TipTap content uses unsupported tags)
- [ ] Brand compliance verified: Inter font, Lucide icons at 1.75 stroke, primary-800 button, no emojis
- [ ] Two exported `.md` files attached to the next planning session for use in Guide 14 calibration
