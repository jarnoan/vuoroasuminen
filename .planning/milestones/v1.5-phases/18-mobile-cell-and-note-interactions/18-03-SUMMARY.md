---
phase: 18-mobile-cell-and-note-interactions
plan: 03
type: summary
status: approved
verified_by: operator
verified_at: "2026-05-22"
---

# Summary: 18-03 Human-Verify Phase 18 SC-1..SC-5

## Verification Result

**APPROVED** — all five Phase 18 success criteria pass on desktop and mobile.

## Pass/Fail per Success Criterion

| SC | Description | Result |
|----|-------------|--------|
| SC-1 | Pen icon on mobile note affordance button | PASS |
| SC-2 | Long-press shows 1s color fade toward red, vibrates, snaps to full-cell "Tyhjennä" | PASS (after fix) |
| SC-3 | Tapping armed cell clears it; auto-disarm after ~2s returns parent color | PASS |
| SC-4 | Desktop hover × unchanged; long-press on desktop does NOT trigger fade or armed state | PASS |
| SC-5 | Note row sits flush under day row, indented pl-8, no divider between day and note row | PASS |

## Gap Found and Fixed During Verification

**SC-2 initially failed:** holding a blue (father) cell faded to blue, not red.

**Root cause:** `bg-blue-500` from `colorClass` was winning over `[@media(pointer:coarse)]:bg-destructive` in Tailwind's stylesheet order. The 1s transition was running but animating from hover-blue back to blue-500 rather than toward destructive.

**Fix applied:** Added `!` important modifier to the destructive background on both the `isHolding` and `isArmed` class branches in `schedule-cell.tsx`:
- `[@media(pointer:coarse)]:!bg-destructive` (holding — enables the 1s fade to red)
- `[@media(pointer:coarse)]:!bg-destructive` (armed — ensures the snapped state is also red)

After the fix, SC-2 passed: 1s color fade visibly progresses from parent color toward red, cell snaps to solid red "Tyhjennä" at the 1s mark.

## Viewports / Browsers Tested

- Desktop: Chromium ≥640px, mouse pointer
- Mobile: DevTools Device Mode 360–430px (coarse pointer emulation)
- SC-2 vibration: pending real-device confirmation (visual fade and armed snap verified in DevTools)

## Files Changed

- `src/components/schedule/schedule-cell.tsx` — `!` important modifier on `[@media(pointer:coarse)]:bg-destructive` in holding and armed class branches
