# Phase 14: Realtime Reliability + Mobile Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 14-realtime-reliability-mobile-baseline
**Areas discussed:** Recovery mechanism, Recovery UX, Mobile baseline scope, Reconnect timing

---

## Gray Areas Presented

| Area | Options Shown | Selected |
|------|--------------|----------|
| Recovery mechanism | re-fetch+reconnect / reconnect-only / full reload | re-fetch + reconnect (Claude discretion) |
| Recovery UX | silent / spinner / toast | silent (Claude discretion) |
| Mobile baseline scope | viewport-only / viewport+overflow+safe-area / viewport+touch-action | viewport + overflow-x:hidden (Claude discretion) |
| Reconnect timing | always / threshold-based debounce | always (Claude discretion) |

**User's choice:** "I don't understand any of this. you decide."
**Notes:** User deferred all decisions to Claude. Decisions made based on codebase analysis, Supabase Realtime behavior, and phase success criteria.

---

## Claude's Discretion

All four gray areas deferred to Claude. Decisions logged in CONTEXT.md D-01 through D-09.

## Deferred Ideas

- Safe area insets → Phase 15
- Touch-action defaults → Phase 15/16
- Offline indicator → future milestone
