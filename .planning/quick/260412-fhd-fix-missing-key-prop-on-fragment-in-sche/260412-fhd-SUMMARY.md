---
quick_id: 260412-fhd
status: completed
date: 2026-04-12
commit: ac9bf22
---

# Quick Task 260412-fhd: Summary

## What was done

Fixed React console warning "Each child in a list should have a unique key prop" in `ScheduleTable`.

## Change

`src/components/schedule/schedule-table.tsx`
- Added `import React` to enable `React.Fragment` syntax
- Replaced unkeyed `<>` fragment inside `days.map()` with `<React.Fragment key={day.date}>`
- Closing `</>` replaced with `</React.Fragment>`

The inner `<tr>` elements keep their own keys — the fix adds a key to the outer fragment wrapper so React can track each map iteration.

## Verification

`npx tsc --noEmit` exits 0.
