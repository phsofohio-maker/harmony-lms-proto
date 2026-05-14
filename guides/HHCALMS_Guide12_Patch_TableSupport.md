# HHCALMS Guide 12 Patch — Table Support in Course Builder

**Guide 12 Patch | May 2026 | TipTap Table Extension, Grid Picker, Paste from Word/Docs**
**Scope: 4 new packages, 3 modified files, 1 new component**

---

## Architecture Decision: Table Implementation Strategy

**Decision: Use TipTap's official `@tiptap/extension-table` family. No custom ProseMirror nodes.**

Rationale:
- `prosemirror-tables` is already a dependency of `@tiptap/pm` (confirmed in lock file at v3.20.5). The ProseMirror table layer is already installed — we are only adding TipTap wrappers.
- TipTap's table extensions provide built-in paste handling for HTML table markup from Word and Google Docs clipboard. No custom `transformPastedHTML` hook needed.
- Column resizing, merged cells (`colspan`/`rowspan`), and header row toggling are built-in commands. Zero custom logic required.
- Tables are block-level nodes. They do not conflict with Guide 13's `ClinicalTerm` inline marks.
- HTML output from `editor.getHTML()` produces standard `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` tags — semantic HTML that renders correctly in print stylesheets.
- Existing content in Firestore has no table tags. Zero migration required. Backward compatibility is automatic.

**Complexity Budget Justification:** Tables are a core content format for clinical training — medication dosage charts, procedure checklists, vital sign reference ranges, comparison matrices. This is not feature creep; it closes a gap in the authoring surface that forces instructors to use screenshots of tables instead of native editable content.

---

## Execution Rules

Complete each fix in order. Verify independently before proceeding.

### Out-of-Scope Files (DO NOT TOUCH)

- `functions/src/index.ts`, `functions/src/types.ts`
- `firestore.rules`, `storage.rules`
- `src/services/*` — no service layer changes
- `src/contexts/AuthContext.tsx`
- `src/components/ui/RichTextEditorMini.tsx` — descriptions do NOT get tables
- Quiz question text / answer option text

### Conventions

- Inter font, Lucide icons (strokeWidth={1.75}), clinical emerald palette
- All new UI elements must match existing toolbar styling: `p-1.5`, icon `h-4 w-4`, `text-gray-500 hover:bg-gray-100 rounded`, active state `text-primary-700 bg-primary-50`
- Group separator: `w-px h-5 bg-gray-200 mx-1`

---

## Complete File Change Manifest

| File Path | Action | Purpose |
|-----------|--------|---------|
| *(npm packages)* | INSTALL | `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header` |
| `src/components/ui/TableGridPicker.tsx` | CREATE | Grid picker dropdown component for table insertion |
| `src/components/ui/RichTextEditor.tsx` | MODIFY | Add table extensions + toolbar dropdown |
| `src/components/ui/RichTextRenderer.tsx` | MODIFY | Update DOMPurify whitelist for table tags |
| `src/styles/tiptap.css` | MODIFY | Add table styles scoped to `.tiptap-content` |

---

## Fix 1: Install Table Extension Packages

**Estimate:** 5 minutes | **Risk:** None

```bash
npm install @tiptap/extension-table @tiptap/extension-table-row \
  @tiptap/extension-table-cell @tiptap/extension-table-header
```

### Package Purpose Map

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `@tiptap/extension-table` | Table node, column resize, table commands | ~5KB gzipped |
| `@tiptap/extension-table-row` | `<tr>` node definition | ~1KB gzipped |
| `@tiptap/extension-table-cell` | `<td>` node definition | ~1KB gzipped |
| `@tiptap/extension-table-header` | `<th>` node definition (header cells) | ~1KB gzipped |

Total bundle impact: ~8KB gzipped. ProseMirror peer (`prosemirror-tables`) is already installed.

### Verification

1. `npm ls @tiptap/extension-table` shows installed version matching `@tiptap/core` at `^3.20.5`.
2. No peer dependency warnings.
3. No build errors after install.

---

## Fix 2: Create TableGridPicker Component

**Estimate:** 1 hour | **Files:** 1 new | **Risk:** Low

### Create `src/components/ui/TableGridPicker.tsx`

A hover-based grid picker (up to 6×6) that allows instructors to visually select table dimensions before insertion. Appears as a dropdown when the "Table" toolbar button is clicked.

```typescript
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../utils';

interface TableGridPickerProps {
  onInsert: (rows: number, cols: number) => void;
  onClose: () => void;
}

const MAX_ROWS = 6;
const MAX_COLS = 6;

export const TableGridPicker: React.FC<TableGridPickerProps> = ({
  onInsert,
  onClose,
}) => {
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCellClick = useCallback(() => {
    if (hoverRow > 0 && hoverCol > 0) {
      onInsert(hoverRow, hoverCol);
    }
  }, [hoverRow, hoverCol, onInsert]);

  return (
    <div
      ref={pickerRef}
      className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50"
    >
      {/* Grid label */}
      <div className="text-xs text-gray-500 mb-2 text-center font-medium">
        {hoverRow > 0 && hoverCol > 0
          ? `${hoverRow} × ${hoverCol} table`
          : 'Select table size'}
      </div>

      {/* Grid cells */}
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)`,
        }}
      >
        {Array.from({ length: MAX_ROWS * MAX_COLS }).map((_, index) => {
          const row = Math.floor(index / MAX_COLS) + 1;
          const col = (index % MAX_COLS) + 1;
          const isHighlighted = row <= hoverRow && col <= hoverCol;

          return (
            <button
              key={index}
              type="button"
              className={cn(
                'w-5 h-5 border rounded-sm transition-colors',
                isHighlighted
                  ? 'bg-primary-100 border-primary-400'
                  : 'bg-white border-gray-300 hover:border-gray-400'
              )}
              onMouseEnter={() => {
                setHoverRow(row);
                setHoverCol(col);
              }}
              onClick={handleCellClick}
              aria-label={`Insert ${row} by ${col} table`}
            />
          );
        })}
      </div>
    </div>
  );
};
```

### Key Design Points

- Max grid size is 6×6. Clinical content rarely needs larger tables, and instructors can add rows/columns after insertion.
- The grid uses `primary-100` / `primary-400` for highlighted cells — matches the existing editor active state palette.
- Closes on outside click or Escape key — standard dropdown behavior.
- The dimension label (`3 × 4 table`) updates on hover before click, so the instructor sees what they're selecting.
- Accessible: each cell has an `aria-label` describing the action.

### Verification

1. Component renders a 6×6 grid of cells.
2. Hovering over a cell highlights all cells from (1,1) to (row, col).
3. Label updates to show dimensions on hover.
4. Clicking a cell calls `onInsert` with correct row and column counts.
5. Clicking outside the picker calls `onClose`.
6. Pressing Escape calls `onClose`.

---

## Fix 3: Modify RichTextEditor — Add Table Extensions and Toolbar

**Estimate:** 1.5 hours | **Files:** 1 modified | **Risk:** Medium (modifying a live authoring component)

### Modify `src/components/ui/RichTextEditor.tsx`

**3A. Add imports:**

```typescript
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Table2, Plus, Minus, Trash2, ToggleLeft } from 'lucide-react';
import { TableGridPicker } from './TableGridPicker';
```

**3B. Add extensions to the extensions array:**

Add after the existing extensions (Highlight, Link, Typography, Placeholder, ClinicalTerm if present):

```typescript
Table.configure({
  resizable: true,
  HTMLAttributes: { class: 'clinical-table' },
}),
TableRow,
TableCell,
TableHeader,
```

**3C. Add table state and toolbar dropdown:**

Add state for the table dropdown:

```typescript
const [showTablePicker, setShowTablePicker] = useState(false);
const [showTableMenu, setShowTableMenu] = useState(false);
```

**3D. Add table insertion handler:**

```typescript
const handleInsertTable = useCallback((rows: number, cols: number) => {
  if (!editor) return;
  editor
    .chain()
    .focus()
    .insertTable({ rows, cols, withHeaderRow: true })
    .run();
  setShowTablePicker(false);
}, [editor]);
```

**3E. Add table toolbar group to the toolbar:**

Insert this group after the existing toolbar groups (after Highlight dropdown, before Undo/Redo):

```tsx
{/* Table group */}
<Separator />
<div className="relative">
  {editor.isActive('table') ? (
    // When cursor is inside a table: show table operations menu
    <>
      <ToolbarButton
        onClick={() => setShowTableMenu(!showTableMenu)}
        active={true}
        title="Table options"
      >
        <Table2 className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      {showTableMenu && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
          <TableMenuButton
            onClick={() => { editor.chain().focus().addRowBefore().run(); setShowTableMenu(false); }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Add row above"
          />
          <TableMenuButton
            onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false); }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Add row below"
          />
          <TableMenuButton
            onClick={() => { editor.chain().focus().addColumnBefore().run(); setShowTableMenu(false); }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Add column left"
          />
          <TableMenuButton
            onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false); }}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Add column right"
          />
          <div className="border-t border-gray-100 my-1" />
          <TableMenuButton
            onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false); }}
            icon={<Minus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Delete row"
          />
          <TableMenuButton
            onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false); }}
            icon={<Minus className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Delete column"
          />
          <div className="border-t border-gray-100 my-1" />
          <TableMenuButton
            onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setShowTableMenu(false); }}
            icon={<ToggleLeft className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Toggle header row"
          />
          <div className="border-t border-gray-100 my-1" />
          <TableMenuButton
            onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }}
            icon={<Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />}
            label="Delete table"
            className="text-red-600 hover:bg-red-50"
          />
        </div>
      )}
    </>
  ) : (
    // When cursor is NOT in a table: show insert button with grid picker
    <div className="relative">
      <ToolbarButton
        onClick={() => setShowTablePicker(!showTablePicker)}
        title="Insert table"
      >
        <Table2 className="h-4 w-4" strokeWidth={1.75} />
      </ToolbarButton>
      {showTablePicker && (
        <TableGridPicker
          onInsert={handleInsertTable}
          onClose={() => setShowTablePicker(false)}
        />
      )}
    </div>
  )}
</div>
```

**3F. Add TableMenuButton helper component:**

Add this inside the file (above the main component export, or as a local function component):

```typescript
function TableMenuButton({
  onClick,
  icon,
  label,
  className,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors',
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}
```

**3G. Close table menu when clicking outside:**

Add an effect to close the table operations menu when clicking outside:

```typescript
const tableMenuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
      setShowTableMenu(false);
    }
  };
  if (showTableMenu) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showTableMenu]);
```

Wrap the table operations dropdown `<div className="relative">` with `ref={tableMenuRef}`.

### Verification

1. Open ModuleBuilder → text block editor.
2. Toolbar shows Table icon (Table2 from Lucide) after the highlight group.
3. Click Table icon → grid picker appears (6×6 grid).
4. Hover over cells → highlighting shows selected dimensions.
5. Click a cell → table inserted with header row.
6. Cursor inside table → Table icon becomes active (green), clicking shows operations menu.
7. "Add row below" → new row appears below cursor row.
8. "Add row above" → new row appears above cursor row.
9. "Add column left" / "Add column right" → columns added correctly.
10. "Delete row" / "Delete column" → removes the current row/column.
11. "Toggle header row" → first row toggles between `<th>` and `<td>`.
12. "Delete table" → entire table removed, cursor returns to paragraph.
13. Click outside operations menu → menu closes.
14. Click outside grid picker → picker closes.
15. Escape closes either dropdown.
16. Typing in cells works. Bold/italic/underline work inside cells.
17. Tab key moves to next cell. Shift+Tab moves to previous cell.

---

## Fix 4: Update DOMPurify Whitelist in RichTextRenderer

**Estimate:** 30 minutes | **Files:** 1 modified | **Risk:** Medium (security-critical change)

### Modify `src/components/ui/RichTextRenderer.tsx`

**4A. Update ALLOWED_TAGS:**

Add table-related tags to the existing whitelist:

```typescript
// BEFORE:
ALLOWED_TAGS: [
  'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'code',
  'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'span',
],

// AFTER:
ALLOWED_TAGS: [
  'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'code',
  'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'colgroup', 'col',
],
```

**4B. Update ALLOWED_ATTR:**

Add table-specific attributes:

```typescript
// BEFORE:
ALLOWED_ATTR: ['href', 'target', 'rel', 'data-color', 'class', 'data-term-id', 'data-term'],

// AFTER:
ALLOWED_ATTR: ['href', 'target', 'rel', 'data-color', 'class', 'data-term-id', 'data-term',
  'colspan', 'rowspan', 'colwidth', 'data-colwidth', 'style',
],
```

**4C. Add DOMPurify hook to restrict `style` attribute to safe properties:**

The `style` attribute is needed for TipTap's column resize persistence (inline `width` on cells). However, unrestricted `style` is an XSS vector. Add a sanitization hook immediately after the `DOMPurify.sanitize()` call setup:

```typescript
// Add this ONCE, outside the component (module-level) to avoid re-registering on every render:

// Style sanitization hook — only allows width-related CSS properties
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute('style')) {
    const style = node.getAttribute('style') || '';
    // Only allow width, min-width, max-width (for table column sizing)
    const safeProperties = style
      .split(';')
      .map(s => s.trim())
      .filter(s => /^\s*(min-|max-)?width\s*:/i.test(s))
      .join('; ');
    if (safeProperties) {
      node.setAttribute('style', safeProperties);
    } else {
      node.removeAttribute('style');
    }
  }
});
```

**Security analysis:**
- `colspan` / `rowspan`: integer attributes with no executable surface. Safe.
- `colwidth` / `data-colwidth`: TipTap stores column width data. Read-only numeric values. Safe.
- `style`: restricted to `width`, `min-width`, `max-width` only via the DOMPurify hook. Properties like `background`, `url()`, `expression()`, `-moz-binding`, etc. are stripped. This closes the XSS vector while preserving TipTap's column resize data.

### Verification

1. Render content with `<table>` tags → table displays correctly.
2. Render content with `colspan="2"` → merged cell renders correctly.
3. Render content with `style="width: 50%"` on a `<td>` → width preserved.
4. Render content with `style="background: url(javascript:alert(1))"` → style attribute stripped entirely.
5. Render content with `style="width: 100px; background-image: url(evil)"` → only `width: 100px` preserved.
6. Render content with `<script>` inside a `<td>` → script tag stripped.
7. Render content with `<td onclick="alert(1)">` → onclick stripped.
8. Existing content without tables renders identically (no regression).

---

## Fix 5: Add Table Styles to tiptap.css

**Estimate:** 20 minutes | **Files:** 1 modified | **Risk:** None

### Modify `src/styles/tiptap.css`

Add the following rules at the end of the file, after the existing placeholder styles:

```css
/* ============================================
   Tables (Guide 12 Patch)
   ============================================ */

.tiptap-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  font-size: 0.875rem;
  table-layout: auto;
  overflow: visible;
}

.tiptap-content th,
.tiptap-content td {
  border: 1px solid #D1D5DB;
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
  min-width: 80px;
  position: relative;
}

.tiptap-content th {
  background-color: #F3F4F6;
  font-weight: 600;
  color: #111827;
}

.tiptap-content tr:nth-child(even) td {
  background-color: #F9FAFB;
}

/* Rich text inside table cells */
.tiptap-content td p,
.tiptap-content th p {
  margin-bottom: 0.25rem;
}
.tiptap-content td p:last-child,
.tiptap-content th p:last-child {
  margin-bottom: 0;
}

/* Lists inside cells — tighter spacing */
.tiptap-content td ul,
.tiptap-content td ol,
.tiptap-content th ul,
.tiptap-content th ol {
  margin-bottom: 0.25rem;
  padding-left: 1.25rem;
}

/* Column resize handle (editor mode only) */
.tiptap-content .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #0F7B4F;
  cursor: col-resize;
  pointer-events: auto;
  z-index: 10;
}

/* Selected cell highlight (editor mode only) */
.tiptap-content .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: rgba(220, 247, 233, 0.4);
  pointer-events: none;
  z-index: 1;
}

/* Table wrapper for horizontal scroll on small viewports */
.tiptap-content .tableWrapper {
  overflow-x: auto;
  margin: 0.75rem 0;
}

/* Ensure resize cursor shows on table edge */
.tiptap-content table .resize-cursor {
  cursor: col-resize;
}
```

### Style Design Points

- Header cells use `#F3F4F6` (gray-100) background — matches the existing brand guide table header convention.
- Alternating row striping uses `#F9FAFB` (gray-50) — subtle, clinical, matches the app background.
- Borders use `#D1D5DB` (gray-300) — consistent with existing input borders and dividers.
- Column resize handle uses `#0F7B4F` (primary-700) — the primary brand green, making it visible but on-brand.
- Selected cell overlay uses `rgba(220, 247, 233, 0.4)` — a transparent version of primary-100, so selected cells are visible without obscuring content.
- Cell padding `0.5rem 0.75rem` matches the density expected in clinical reference tables.
- `min-width: 80px` prevents cells from collapsing to unreadable widths.
- Rich text inside cells (paragraphs, lists) gets tighter spacing to avoid excessive vertical whitespace in table context.

### Verification

1. Inserted table has visible borders on all cells.
2. Header row has gray background, bold text.
3. Even rows have subtle striping.
4. Column resize handle appears as a green vertical bar on hover between columns.
5. Selected cells show a green tint overlay.
6. Tables are responsive — horizontal scroll appears on narrow viewports.
7. Content inside cells (bold, italic, lists) renders with appropriate spacing.
8. Print the page — table renders correctly with borders and header background.

---

## Ripple Effect Summary

| Area | Impact | Action Required |
|------|--------|-----------------|
| `BlockEditor.tsx` | None — already delegates to `RichTextEditor` | None |
| `BlockRenderer.tsx` | None — already delegates to `RichTextRenderer` | None |
| `RichTextEditorMini.tsx` | **No change** — descriptions do not get tables | None |
| `CoursePlayer` | Tables render via `RichTextRenderer` automatically | None |
| `CourseDetail` | Tables in descriptions render via `RichTextRenderer` | None |
| Firestore schema | None — still stores HTML strings in `content` field | None |
| Firestore security rules | None | None |
| `auditService` | None — content block writes already audited | None |
| Certificate generation | None — certs use Google Docs API, not course HTML | None |
| Print stylesheet | Tables use semantic HTML — prints correctly by default | None |
| Existing content | No table tags exist in current content. Unaffected | None |
| Guide 13 Clinical Terms | Compatible — terms are inline marks, tables are block nodes | None |
| DOMPurify `style` attr | New hook restricts to width-only properties | Security-hardened |
| Bundle size | +~8KB gzipped | Negligible against existing ~115KB TipTap footprint |

---

## Execution Order Summary

| # | Fix | Estimate | Dependency |
|---|-----|----------|------------|
| 1 | Install table extension packages | 5 min | None |
| 2 | Create TableGridPicker component | 1 hr | None |
| 3 | Modify RichTextEditor (extensions + toolbar) | 1.5 hrs | Fixes 1, 2 |
| 4 | Update DOMPurify whitelist in RichTextRenderer | 30 min | Fix 1 |
| 5 | Add table styles to tiptap.css | 20 min | None |

**Total: ~3.5 focused hours across 1 new file and 3 modified files.**

---

## End-to-End Verification Checklist

### Manual Table Creation
- [ ] Click Table icon → grid picker appears
- [ ] Select 3×4 → table inserted with header row (1 header + 3 body rows, 4 columns)
- [ ] Type content in cells
- [ ] Bold, italic, underline work inside cells
- [ ] Tab navigates to next cell; Shift+Tab to previous
- [ ] Clicking Table icon while cursor is in table → operations menu appears
- [ ] Add row above / below works
- [ ] Add column left / right works
- [ ] Delete row / column works
- [ ] Toggle header row works
- [ ] Delete table removes entire table
- [ ] Column resize by dragging handle works

### Paste from External Sources
- [ ] Copy a table from Microsoft Word → paste into editor → table structure preserved with header row
- [ ] Copy a table from Google Docs → paste into editor → table structure preserved
- [ ] Pasted table with merged cells (`colspan`/`rowspan`) renders correctly
- [ ] Pasted table with styled cells → only width-related styles preserved, other styles stripped

### Persistence & Rendering
- [ ] Save module with table content → reload → table persists with all formatting
- [ ] View in CoursePlayer (learner view) → table renders with borders, header styling, zebra striping
- [ ] View on narrow viewport → table scrolls horizontally
- [ ] Print page → table renders correctly

### Security
- [ ] Inject `<td style="background:url(javascript:alert(1))">` → DOMPurify strips the style
- [ ] Inject `<td onclick="alert(1)">` → onclick stripped
- [ ] Inject `<script>` inside `<td>` → script stripped
- [ ] `<td style="width: 100px; -moz-binding: url(evil)">` → only `width: 100px` preserved

### Regression
- [ ] Existing text content (no tables) renders identically
- [ ] Existing rich text formatting (bold, italic, lists, links, highlights) unaffected
- [ ] RichTextEditorMini (description fields) has NO table button
- [ ] Clinical Term marks (Guide 13) work inside table cells (if Guide 13 is deployed)
