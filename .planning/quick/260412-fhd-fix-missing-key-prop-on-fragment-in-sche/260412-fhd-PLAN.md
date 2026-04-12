---
quick_id: 260412-fhd
description: fix missing key prop on fragment in ScheduleTable map
date: 2026-04-12
status: planned
---

# Quick Task 260412-fhd: Fix Missing Key Prop on Fragment in ScheduleTable Map

## Problem

In `src/components/schedule/schedule-table.tsx:168`, `days.map()` renders a React Fragment `<>` without a `key` prop. React requires keys on the outermost element returned from a `map` callback. The separator `<tr>` and the day `<tr>` inside each fragment have `key` props, but the wrapping fragment does not.

## Fix

Replace the unkeyed `<>` fragment with `<React.Fragment key={day.date}>`.

## Tasks

### Task 1: Add key to fragment in ScheduleTable map

**File:** `src/components/schedule/schedule-table.tsx`

**Action:** At line 168, replace `<>` with `<React.Fragment key={day.date}>` and replace the closing `</>` at the end of the map callback with `</React.Fragment>`.

**Verify:** `npx tsc --noEmit` exits 0; React console warning no longer appears.

**Done:** Fragment has key prop matching `day.date`.
