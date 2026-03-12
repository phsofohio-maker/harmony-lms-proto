# Harmony Health LMS — UI Brand & Implementation Guide

> **This is a binding style contract.** Every component, page, and layout in the Harmony Health LMS must conform to the rules below. If a rule is not listed here, default to the most minimal, clinical option. When in doubt: white space, green accents, no decoration.

---

## 0. Hard Rules (Non-Negotiable)

1. **NO emojis anywhere in the UI.** Strip every emoji from headings, labels, buttons, sidebar items, toasts, badges, and inline text. Replace with Lucide icons only where an icon is genuinely needed. Many labels need no icon at all.
2. **White is the base.** The application background is white or near-white. Green is the accent, never the dominant surface.
3. **Logo must be horizontally centered** on the Login page and any splash/landing screen. In the sidebar, it sits at the top, centered within the sidebar width.
4. **Icons must be light** — on dark green surfaces use `#FFFFFF` at `opacity: 0.85`. On white surfaces use the muted gray `#6B7280` or the primary green `#0F7B4F`. Never use black (`#000000`) icons.
5. **One font family only:** `"Inter", sans-serif` — loaded from Google Fonts at weights 400, 500, 600, 700. Do not mix font families.
6. **No gradients, no decorative borders, no colored backgrounds on containers.** Cards and panels are white with a subtle gray border. Depth comes from shadow, not color.

---

## 1. Color Palette

Extracted from the official logo (white-background version). The logo's green is a true clinical emerald.

### 1.1 Primary Green Scale

| Token              | Hex       | Usage                                              |
|--------------------|-----------|-----------------------------------------------------|
| `--primary-900`    | `#064E2B` | Sidebar background, footer background               |
| `--primary-800`    | `#0B6637` | Primary button background, nav active indicator      |
| `--primary-700`    | `#0F7B4F` | Primary button hover, links                          |
| `--primary-600`    | `#159A61` | Icon accent on white, focus ring color               |
| `--primary-500`    | `#1DB86F` | Progress bars, success badges, toggle ON state       |
| `--primary-400`    | `#4FD493` | Light accent: active tab underline, chart lines      |
| `--primary-300`    | `#86E4B6` | Tag/chip backgrounds (with dark text)                |
| `--primary-200`    | `#B6F0D3` | Subtle highlights, selected table row                |
| `--primary-100`    | `#DCF7E9` | Hover state on table rows, light card tint           |
| `--primary-50`     | `#F0FBF5` | Section background (alternating), input focus bg     |

### 1.2 Neutral Gray Scale

| Token              | Hex       | Usage                                              |
|--------------------|-----------|-----------------------------------------------------|
| `--gray-900`       | `#111827` | Page titles, high-emphasis headings                  |
| `--gray-800`       | `#1F2937` | Subheadings, bold body text                          |
| `--gray-700`       | `#374151` | Primary body text                                    |
| `--gray-600`       | `#4B5563` | Secondary body text, table cell text                 |
| `--gray-500`       | `#6B7280` | Placeholder text, icons on white surfaces            |
| `--gray-400`       | `#9CA3AF` | Disabled text, muted captions                        |
| `--gray-300`       | `#D1D5DB` | Input borders (resting), dividers, table borders     |
| `--gray-200`       | `#E5E7EB` | Card borders, separator lines                        |
| `--gray-100`       | `#F3F4F6` | Input field background, table header bg (light)      |
| `--gray-50`        | `#F9FAFB` | App background (use this, not pure white, for the page body) |
| `--white`          | `#FFFFFF` | Card surfaces, modals, sidebar text                  |

### 1.3 Semantic Colors

| Token              | Hex       | Usage                                              |
|--------------------|-----------|-----------------------------------------------------|
| `--success`        | `#0F7B4F` | Passing grade, complete status (reuses primary-700)  |
| `--warning`        | `#D97706` | License expiring, needs-review flag                  |
| `--danger`         | `#DC2626` | Failed grade, expired license, destructive actions   |
| `--info`           | `#2563EB` | Informational banners, help tooltips                 |

### 1.4 Surfaces & Elevation

```
App background ........... --gray-50   (#F9FAFB)
Card / panel / modal ..... --white     (#FFFFFF)
Sidebar .................. --primary-900 (#064E2B)
Top bar (if used) ........ --white     (#FFFFFF) with bottom border --gray-200
Overlay / backdrop ....... rgba(17, 24, 39, 0.45)
```

### 1.5 Shadows (Subtle, Clinical)

```css
--shadow-xs:  0 1px 2px 0 rgba(0, 0, 0, 0.04);
--shadow-sm:  0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04);
--shadow-md:  0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
--shadow-lg:  0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
```

Cards use `--shadow-xs` at rest. Modals use `--shadow-lg`. Interactive cards use `--shadow-sm` on hover. That's it.

---

## 2. Typography

**Single font family. No exceptions.**

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
```

Load from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

| Role           | Weight | Size        | Line Height | Color         | Tracking       |
|----------------|--------|-------------|-------------|---------------|----------------|
| Page Title     | 700    | 1.5rem (24px) | 1.25      | `--gray-900`  | -0.025em       |
| Section Head   | 600    | 1.25rem (20px)| 1.3       | `--gray-900`  | -0.015em       |
| Card Title     | 600    | 1rem (16px)   | 1.4       | `--gray-800`  | 0              |
| Body           | 400    | 0.875rem (14px)| 1.6      | `--gray-700`  | 0              |
| Body Emphasis  | 500    | 0.875rem (14px)| 1.6      | `--gray-800`  | 0              |
| Small / Caption| 400    | 0.75rem (12px) | 1.5      | `--gray-500`  | 0.01em         |
| Button Label   | 600    | 0.875rem (14px)| 1        | (context)     | 0.01em         |
| Badge / Tag    | 500    | 0.75rem (12px) | 1        | (context)     | 0.02em         |
| Nav Item       | 500    | 0.875rem (14px)| 1        | `--white`     | 0              |
| Table Header   | 600    | 0.75rem (12px) | 1.5      | `--gray-600`  | 0.05em (uppercase) |

---

## 3. Spacing System

8px base grid. Use only these values:

```
4px   — icon-to-label gap, tight inline padding
8px   — default inline gap, badge padding vertical
12px  — input internal padding, small card padding
16px  — card padding (compact), gap between form fields
20px  — standard card padding
24px  — card padding (comfortable), gap between card groups
32px  — section spacing within a page
48px  — major section breaks
64px  — page-level top/bottom padding
```

### Border Radius

```
4px   — badges, tags, small chips
6px   — buttons, inputs
8px   — cards, panels, modals, dropdowns
Full  — avatars, status dots (border-radius: 9999px)
```

Everything uses these four values. Nothing else.

---

## 4. Component Specifications

### 4.1 Logo

- **Login/splash:** Horizontally and vertically centered in its container. Max width `200px`. Clear space of `24px` minimum on all sides.
- **Sidebar:** Centered horizontally within sidebar width. Max height `40px`. Padding `20px` top, `24px` bottom, with a `1px solid rgba(255,255,255,0.12)` divider below.
- **Use the PNG (transparent background) on ALL surfaces.** The JPG is for reference only.
- **Never** stretch, crop, recolor, add drop shadows to, or rotate the logo.

### 4.2 Sidebar Navigation

```
Background ............... --primary-900 (#064E2B)
Width .................... 260px (expanded), 68px (collapsed icon-only)
Transition ............... width 200ms ease

Nav item (rest):
  padding ................ 10px 16px
  border-radius .......... 6px
  margin ................. 0 8px (inset from sidebar edges)
  text ................... --white, Inter 500, 14px
  icon ................... --white at opacity 0.7, size 20px, stroke-width 1.75
  background ............. transparent

Nav item (hover):
  background ............. rgba(255, 255, 255, 0.08)
  icon opacity ........... 0.9

Nav item (active):
  background ............. rgba(255, 255, 255, 0.12)
  icon opacity ........... 1.0
  left border ............ 3px solid --primary-400 (#4FD493)
  font-weight ............ 600

Section label:
  text ................... rgba(255, 255, 255, 0.4)
  font ................... Inter 600, 11px, uppercase
  letter-spacing ......... 0.08em
  padding ................ 24px 16px 8px 16px
```

### 4.3 Buttons

**Primary:**
```
background ............... --primary-800 (#0B6637)
color .................... --white
padding ............. 10px 20px
border-radius ............ 6px
font ..................... Inter 600, 14px
shadow ................... --shadow-xs
hover → background ....... --primary-700, shadow --shadow-sm
active → background ...... --primary-900
disabled → background .... --gray-200, color --gray-400, no shadow
```

**Secondary (outline):**
```
background ............... transparent
border ................... 1.5px solid --gray-300
color .................... --gray-700
hover → background ....... --gray-50, border-color --gray-400
active → background ...... --gray-100
```

**Ghost:**
```
background ............... transparent
color .................... --gray-600
hover → background ....... --gray-100
```

**Danger:**
```
background ............... --danger (#DC2626)
color .................... --white
hover → background ....... #B91C1C
```

### 4.4 Cards

```
background ............... --white
border ................... 1px solid --gray-200
border-radius ............ 8px
padding .................. 20px (compact) or 24px (standard)
shadow ................... --shadow-xs

NO colored left borders, NO colored top accents, NO background tints.
Cards are clean white rectangles. Period.

If a card is interactive (clickable):
  hover → shadow ......... --shadow-sm
  hover → border-color ... --gray-300
  cursor ................. pointer
```

### 4.5 Tables

```
Container:
  border ................. 1px solid --gray-200
  border-radius .......... 8px
  overflow ............... hidden (clips inner rows to the radius)

Header row:
  background ............. --gray-50 (#F9FAFB)
  border-bottom .......... 1px solid --gray-200
  text ................... --gray-600, Inter 600, 12px, uppercase, letter-spacing 0.05em
  padding ................ 12px 16px

Body row:
  background ............. --white
  border-bottom .......... 1px solid --gray-100
  text ................... --gray-700, Inter 400, 14px
  padding ................ 12px 16px

Row hover:
  background ............. --primary-50 (#F0FBF5)

Alternating stripes:
  DO NOT USE. Keep all rows white. Hover is the only visual differentiation.
```

### 4.6 Form Inputs

```
background ............... --white
border ................... 1px solid --gray-300
border-radius ............ 6px
padding .................. 10px 14px
font ..................... Inter 400, 14px, color --gray-700

placeholder .............. --gray-400

focus:
  border-color ........... --primary-600 (#159A61)
  box-shadow ............. 0 0 0 3px rgba(15, 123, 79, 0.12)
  outline ................ none

error:
  border-color ........... --danger
  box-shadow ............. 0 0 0 3px rgba(220, 38, 38, 0.1)

label:
  font ................... Inter 500, 14px, color --gray-700
  margin-bottom .......... 6px

helper text:
  font ................... Inter 400, 12px, color --gray-500
  margin-top ............. 4px
```

### 4.7 Badges & Status Indicators

All badges: `font: Inter 500, 12px`, `padding: 2px 10px`, `border-radius: 9999px`.

| State            | Background     | Text Color    |
|------------------|----------------|---------------|
| Passing / Active | `--primary-100`| `--primary-800` |
| Complete         | `--primary-100`| `--primary-800` |
| Failed / Expired | `#FEE2E2`      | `#991B1B`     |
| Warning / Expiring| `#FEF3C7`     | `#92400E`     |
| Info / Pending   | `#DBEAFE`      | `#1E40AF`     |
| Neutral / Draft  | `--gray-100`   | `--gray-600`  |

These are **soft** badges (tinted background + dark text). Do NOT use solid-colored badges with white text — that reads as aggressive, not clinical.

### 4.8 Icons

- **Library:** Lucide React. No other icon set.
- **Default size:** `18px` inline with text, `20px` in nav/buttons, `24px` standalone.
- **Stroke width:** `1.75` (not the default 2 — the thinner stroke reads as more clinical/refined).
- **Colors:**
  - On white/light surfaces: `--gray-500` (default), or `--primary-700` (for emphasis/action)
  - On sidebar (dark green): `#FFFFFF` at `opacity: 0.7` (rest), `0.85` (hover), `1.0` (active)
  - **Never use `#000000` or any near-black color for icons.**
- **Alignment:** Always vertically centered with adjacent text. Use `display: inline-flex; align-items: center;` on the parent.

### 4.9 Toasts / Notifications

```
background ............... --white
border ................... 1px solid --gray-200
border-left .............. 4px solid (semantic color: success/warning/danger/info)
border-radius ............ 8px
shadow ................... --shadow-md
padding .................. 16px
max-width ................ 420px
position ................. fixed, top-right, 24px from edges

Title: Inter 600, 14px, --gray-900
Body:  Inter 400, 14px, --gray-600
```

---

## 5. Tailwind CSS Configuration

Drop this into `tailwind.config.js` to enforce the palette:

```js
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#F0FBF5',
          100: '#DCF7E9',
          200: '#B6F0D3',
          300: '#86E4B6',
          400: '#4FD493',
          500: '#1DB86F',
          600: '#159A61',
          700: '#0F7B4F',
          800: '#0B6637',
          900: '#064E2B',
        },
        // Extend default gray if needed, but Tailwind's 
        // built-in gray scale is close enough to the spec above.
        // Only override if exact hex matching matters.
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.025em', fontWeight: '700' }],
        'section':    ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'card-title': ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body':       ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'caption':    ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
        'table-head': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      boxShadow: {
        'xs':  '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'sm':  '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'md':  '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'lg':  '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
};
```

---

## 6. Implementation Checklist

When applying this guide across the app, verify each item:

- [ ] **Global:** All emojis removed from sidebar labels, headings, buttons, toasts, and inline text
- [ ] **Global:** Font is Inter at all weights (400/500/600/700) — no other font family present
- [ ] **Global:** App background is `#F9FAFB`, card/panel surfaces are `#FFFFFF`
- [ ] **Global:** No gradients, no colored card backgrounds, no decorative borders
- [ ] **Login page:** Logo horizontally centered, max-width 200px, adequate white space
- [ ] **Sidebar:** Background is `#064E2B`, text is white, icons are white at correct opacity
- [ ] **Sidebar:** Active nav item has left green border indicator, not a colored background fill
- [ ] **Sidebar:** Logo centered within sidebar, with divider below
- [ ] **Buttons:** Primary buttons are `#0B6637` with white text. No other green shades for button bg.
- [ ] **Icons:** All Lucide. Stroke-width 1.75. Gray (`#6B7280`) on light, white on dark. Never black.
- [ ] **Tables:** Gray-50 header, white body rows, no alternating stripes, hover is `primary-50`
- [ ] **Badges:** Soft style (tinted bg + dark text), not solid color + white text
- [ ] **Inputs:** White background, gray-300 border, green focus ring
- [ ] **Shadows:** Only xs/sm/md/lg as defined — no custom or heavy shadows
- [ ] **Spacing:** All padding/margin values are multiples of 4px (ideally 8px grid)

---

## 7. What This Replaces

If any existing styles conflict with this guide, **this guide wins.** Specifically:

- Remove any colored sidebar section backgrounds that aren't `--primary-900`
- Remove any emoji characters (`🎓`, `📊`, `✅`, etc.) from component labels
- Replace any instances of black icons with the gray/green values specified
- Remove any font-family declarations that aren't Inter
- Remove any gradient definitions
- Remove any `box-shadow` definitions that don't match the four defined above
- Remove any badge styles that use solid colored backgrounds with white text
