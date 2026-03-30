# Date Range Picker — Design Spec

**Date:** 2026-03-30
**Branch:** admin-dashboard
**Status:** Approved

---

## Overview

Replace the existing `TimeframeSelector` component in the admin analytics dashboard with an App Store Connect-style date range picker. The new component outputs the same two values (`from` and `to` as ISO date strings) — the analytics data layer is unchanged.

---

## Visual Reference

Closely mirrors the App Store Connect date picker:
- A trigger button displaying the selected range (e.g. `‹  27. Dec 2025 – 26. Mar 2026  ›`)
- A dropdown popover with 5 tabs: **Presets | Days | Weeks | Months | Range**
- Each tab closes the popover immediately on selection (except Range, which has Apply/Cancel)

---

## Architecture

### New files

```
src/components/admin/DateRangePicker.tsx       — trigger button + popover wrapper
src/components/admin/DateRangePickerPanel.tsx  — the 5-tab panel (pure UI, no side effects)
```

`TimeframeSelector.tsx` is kept but no longer used. `page.tsx` swaps the import.

### Unchanged

- `src/app/api/analytics/apps/[appId]/helpers/dates.ts` — `getRangeDates` is extended to handle new range values but the return shape (`{ startDate, endDate }`) stays identical.
- URL param names: `range`, `from`, `to` — consumers (`SingleProjectView`, `AllProjectsView`) are untouched.

---

## Data Model

```ts
// The component's output — same shape as today
type DateRangeOutput = {
  from: string  // "YYYY-MM-DD"
  to: string    // "YYYY-MM-DD"
}

// Internal tab state
type RangeMode = "presets" | "days" | "weeks" | "months" | "range"
```

The `Preset` type in `TimeframeSelector.tsx` is replaced by explicit range values passed via `from`/`to`. The `range` URL param becomes a hint for the prev/next arrow behavior (`day`, `week`, `month`, `custom`).

---

## Component: `DateRangePicker`

### Trigger Button

```
‹  27. Dec 2025 – 26. Mar 2026  ›
```

- Styled as a pill button (blue background like ASC), matching the accent color of the existing design system
- Left `‹` arrow: shifts the range backward by one period
- Right `›` arrow: shifts the range forward by one period
- Period is determined by the last-used mode:
  - Days → shift by 1 day
  - Weeks → shift by 7 days
  - Months → shift by 1 month
  - Presets/Range → shift by the same number of days as the current range
- Clicking the label text (not the arrows) toggles the popover open/closed

### Popover

- Positioned directly below the trigger, left-aligned
- White/surface background, rounded corners, subtle shadow
- Closes on outside click (`mousedown` listener on document)
- Does NOT close when clicking inside (except on tab selections and Apply)

---

## Tab: Presets

List view matching ASC layout — label on the left, date range on the right:

| Label | Range |
|-------|-------|
| Last 7 Days | rolling 7 days ending today |
| Last 30 Days | rolling 30 days ending today |
| Last 90 Days | rolling 90 days ending today |
| Last Week | Mon–Sun of previous week |
| Last Month | 1st to last day of previous month |
| Year to Date | Jan 1 of current year to today |
| All Time | first available data date to today (hardcoded as app creation baseline) |

Clicking any preset: sets `from`/`to`, closes popover immediately.

---

## Tab: Days

- Single-month calendar view (like ASC Days tab)
- Month navigation: `‹ December 2025 ›`
- Weekday header row: M T W T F S S
- Days from previous/next month shown greyed out (non-selectable)
- Click a day: sets both `from` and `to` to that day, closes popover

---

## Tab: Weeks

- Same single-month calendar layout as Days
- On hover: highlights the entire Mon–Sun row of the hovered week
- On click: sets `from` = Monday of that week, `to` = Sunday of that week, closes popover
- Selected week stays highlighted when popover reopens

---

## Tab: Months

- Year overview layout matching ASC: year header with `‹ 2025 ›` navigation, 12 months in a 3×4 grid
- Each month shows its name + a row of dot placeholders (decorative, matching ASC aesthetic)
- Click a month: sets `from` = 1st of month, `to` = last day of month, closes popover
- Selected month is highlighted

---

## Tab: Range

- Two text inputs at the top: **Start Date** | **End Date** (MM/DD/YYYY format)
- Single-month calendar below for visual picking
- First click sets start date, second click sets end date; clicking after both are set resets and starts over
- Selected range highlighted between the two dates
- Buttons at bottom: **Cancel** (reverts, closes) | **Apply** (confirms, closes)
- Apply is disabled until both dates are set and `from <= to`

---

## Integration: `page.tsx`

```tsx
// Before
import { TimeframeSelector, Preset } from "@/components/admin/TimeframeSelector";

// After
import { DateRangePicker } from "@/components/admin/DateRangePicker";
```

The `handleTimeframe` callback simplifies to:
```tsx
const handleRange = (from: string, to: string, mode: string) => {
  router.push(buildUrl({ from, to, range: mode }));
};
```

---

## `dates.ts` changes

`getRangeDates` is updated to handle the new `range` values while keeping the return signature identical. The old preset keys (`today`, `3d`, `7d`, `30d`) are replaced by always using `custom` with explicit `from`/`to` params — no breaking change to API routes.

---

## Styling Notes

- Follow existing design tokens: `bg-surface2`, `border-border`, `text-accent`, `text-secondary`, `text-primary`
- Trigger pill: `bg-accent text-white` (matches ASC blue button)
- Selected states: `bg-accent/10 text-accent` or `bg-accent text-white` for strong selection
- No new CSS files — Tailwind only
- No new dependencies

---

## Out of Scope

- Time-of-day selection (hours/minutes)
- Multi-month view for Range tab (single month is sufficient)
- Keyboard navigation
- Mobile/touch-specific optimizations
