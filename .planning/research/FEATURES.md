# Feature Research

**Domain:** Co-parenting / shared custody scheduling web app
**Researched:** 2026-04-04
**Confidence:** HIGH (corroborated across multiple live apps and user reviews)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Shared calendar / schedule view | Every co-parenting app has one; users arrive with this expectation | MEDIUM | Rows-by-day + parent color-coding is standard |
| Color-coding by parent | Instant visual recognition of "whose day is this" | LOW | Two colors, one per parent |
| Alternating-week default pattern | The most common legal custody arrangement; users expect it pre-filled | LOW | Pre-fill on setup; users edit exceptions |
| Per-child custody tracking | Each child may have independent schedule; apps like OFW and AppClose support this | MEDIUM | Each cell = one child's location, not all-children-together |
| Change request / approval workflow | Standard in OFW, AppClose, Custody X Change; avoids silent overwrites | MEDIUM | Project uses draft → approve → publish; either parent can approve |
| Both parents see identical data | Core trust requirement; "same truth" between two households | HIGH | Real-time sync; last-write-wins is acceptable |
| Mobile-usable interface | Parents check on phone constantly | LOW | Responsive web is sufficient; native app not required |
| Google sign-in (OAuth) | Parents already have Google accounts; no new credentials to manage | LOW | Hard requirement per PROJECT.md |
| Google Calendar sync | Calendar is where parents actually live; every major app lists this as a top request | HIGH | One calendar per parent; all-day events per child per day |
| Shared notes per day | Quick coordination notes ("Emma has doctor at 3pm") expected alongside schedule | LOW | Single shared column; private notes are out of scope |
| Statistics / parenting time totals | Users need to verify fairness and sometimes present to courts | MEDIUM | Days per parent per child, child-free days/weekends per parent |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Independent per-child per-day assignment | Most apps treat all children as a unit on a given day; this app supports splitting children across parents on the same day | MEDIUM | The table model (rows=days, columns=children) enables this visually and logically |
| Draft mode with explicit publish step | Competitors either auto-save live or require both parents to approve; draft → either-parent-approves avoids deadlock while keeping the "intentional" feel | MEDIUM | Draft state is local to the planning session; published state syncs to calendar |
| 12-week rolling planning window | Most apps are month-at-a-time; a continuous 12-week window better matches how custody is actually planned (schools, holidays) | LOW | Rolling window vs. month view is a UX decision with outsized practical value |
| Google Calendar as the output layer | Rather than a proprietary calendar users must remember to check, changes appear where parents already live (Google Calendar) | HIGH | Biggest technical differentiator; requires Calendar API integration |
| Real-time collaborative editing | Both parents can edit simultaneously and see changes in real time, without a request/approve round-trip for every cell | HIGH | Last-write-wins; reduces friction vs. OFW's request-approval model |
| Child-free weekend statistics | Competitor apps focus on "days with parent" but parents also care about "when do I have a child-free weekend" | LOW | Simple derived stat but meaningfully different from what competitors show |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Secure / tamper-proof messaging | OFW's court-proof messages are a major selling point | This app is between two cooperating parents, not adversarial co-parents; adding tamper-proof audit logs creates legal liability and product complexity that has no payoff in this use case | Use any normal messaging channel (WhatsApp, SMS); keep the notes column simple |
| Expense tracking & payment | 2Houses and OFW both offer it; parents do share expenses | Expense tracking is a completely separate domain — accounting, receipts, payment processing — and balloons scope enormously | Defer entirely; dedicated apps (Splitwise, Venmo) already solve this well |
| Per-parent private notes | Feels natural to want "my private view" | Two sets of notes per day create coordination confusion ("did they see this?"); the app's value is shared truth | Shared notes column only, as specified in PROJECT.md |
| Conflict flagging / merge UI | Simultaneous edits could theoretically conflict | For two cooperating parents, last-write-wins is always sufficient; a merge UI adds UX complexity with near-zero real-world benefit | Last-write-wins conflict resolution |
| Legal documentation / court export | OFW and TalkingParents market court-approved records as a core feature | This audience is cooperative co-parents who don't need a legal trail; adding "court mode" features creates a false impression of the product's purpose and adds security/compliance complexity | Not applicable; out of scope |
| In-app messaging / communication tools | Many apps bundle messaging with scheduling | Messaging is its own product; bundling it competes with dedicated messaging apps and distracts from the core scheduling value | Parents use existing channels; this app is the schedule, not the conversation |
| Recurring exception templates | Users want to pre-program "every summer Dad gets 3 weeks" | Exception templates require a rule engine that conflicts with the simple table model; most exceptions happen ad hoc | Edit the table directly; 12-week window covers most planning needs |
| Notification / reminder system | Parents want reminders for upcoming custody changes | Push notification infrastructure (FCM/APNs) is a significant engineering investment; Google Calendar already handles reminders natively once events are synced | Let Google Calendar reminders serve this need |
| Third-party access (grandparents, lawyers) | OFW allows sharing with third parties | Multi-stakeholder access control adds auth complexity; this app is designed for exactly two principals | Two-parent design is a feature, not a limitation |

## Feature Dependencies

```
Google OAuth login
    └──requires──> (nothing — entry point)

Schedule table UI
    └──requires──> Google OAuth login
    └──requires──> Schedule data model (per-child, per-day, per-parent)

Draft mode
    └──requires──> Schedule table UI
    └──requires──> Draft/published state distinction in data model

Approve & publish
    └──requires──> Draft mode
    └──requires──> Google Calendar API integration

Google Calendar sync
    └──requires──> Google OAuth login (Calendar API scope)
    └──requires──> Approved/published schedule state

Real-time collaborative editing
    └──requires──> Schedule table UI
    └──requires──> Real-time data layer (WebSocket or similar)

Statistics panel
    └──requires──> Schedule data model (need enough published + draft data)
    └──enhances──> Draft mode (stats preview during planning is more useful than post-publish only)

Shared notes column
    └──requires──> Schedule table UI
    └──enhances──> Real-time collaborative editing (notes benefit from same live sync)

Alternating-week default pre-fill
    └──requires──> Schedule table UI
    └──requires──> Setup flow (which parent starts, from which date)
```

### Dependency Notes

- **Google Calendar sync requires OAuth with Calendar scope:** The OAuth login must request `https://www.googleapis.com/auth/calendar` at sign-in time; adding it later forces a re-auth prompt.
- **Draft mode requires clear state distinction:** The data model must carry a `draft | published` flag per day (or per change-set); ambiguity here causes calendar pollution.
- **Statistics requires the schedule data model to stabilize first:** Stats are derived from the schedule; building stats before the schedule model is settled causes rework.
- **Real-time editing and draft mode interact:** A "pending draft" that one parent is editing live must not accidentally overwrite the other parent's concurrent edits in a destructive way; last-write-wins needs to be scoped at the cell level, not the whole schedule.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Google OAuth login for both parents — identity foundation; everything else depends on it
- [ ] Schedule table UI (12-week window, rows=days, columns=children + notes) — the core product
- [ ] Alternating-week pre-fill on first setup — removes the blank-slate barrier
- [ ] Real-time collaborative editing with last-write-wins — both parents must see the same data
- [ ] Draft mode → approve → publish flow — prevents accidental calendar writes
- [ ] Google Calendar sync (one calendar per parent, all-day events per child) — the primary value delivery mechanism
- [ ] Statistics panel (days per parent per child, solo days, child-free weekends) — validates fairness; parents need this to trust the plan

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Schedule change history / audit log — add when parents request accountability for who changed what
- [ ] Mobile-optimized layout improvements — add when usage data shows mobile is a primary access point
- [ ] Onboarding flow for adding children and setting up the family — add when first-run experience becomes a conversion problem

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] iCal / Outlook export — defer until Google-only is validated; adds Calendar API complexity
- [ ] Third-party view-only access (grandparents, au pairs) — defer; adds auth model complexity
- [ ] Per-period statistics breakdown (by month or school term) — defer; full 12-week totals are sufficient for v1

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google OAuth login | HIGH | LOW | P1 |
| Schedule table UI | HIGH | MEDIUM | P1 |
| Alternating-week pre-fill | HIGH | LOW | P1 |
| Real-time collaborative editing | HIGH | HIGH | P1 |
| Draft → approve → publish | HIGH | MEDIUM | P1 |
| Google Calendar sync | HIGH | HIGH | P1 |
| Statistics panel | HIGH | MEDIUM | P1 |
| Shared notes column | MEDIUM | LOW | P1 |
| Schedule change history | MEDIUM | MEDIUM | P2 |
| Onboarding / setup flow | MEDIUM | LOW | P2 |
| Mobile layout refinements | MEDIUM | LOW | P2 |
| iCal / Outlook export | LOW | MEDIUM | P3 |
| Third-party view-only access | LOW | HIGH | P3 |
| Per-period statistics | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | OurFamilyWizard | Custody X Change | AppClose | Our Approach |
|---------|----------------|------------------|----------|--------------|
| Shared schedule view | Yes, color-coded | Yes, calendar-based | Yes | Table grid, not calendar view |
| Per-child independent days | No — all children move together | No | No | Yes — each column is one child |
| Draft before publishing | Request/approve per change | Plan export only | No | Explicit draft → publish batch flow |
| Google Calendar sync | No | Yes (up to 24h delay) | No | Yes, real-time on publish |
| Secure/court-proof messaging | Yes (core feature) | No | Yes | Deliberately excluded |
| Expense tracking | Yes | No | Yes | Deliberately excluded |
| Real-time collaborative editing | No — request/approve model | No | No | Yes — live shared editing |
| Parenting time statistics | Yes | Yes | Yes | Yes, plus child-free weekend stat |
| Shared notes | No | No | Comments per event | Per-day shared column |
| Mobile app | Yes (iOS + Android) | Yes | Yes | Responsive web only |
| Third-party access | Yes (grandparents, lawyers) | No | Yes | Deliberately excluded |

## Sources

- [OurFamilyWizard Calendar Features](https://www.ourfamilywizard.com/product-features/calendar)
- [The 10 Co-Parenting Apps of 2026](https://family.justalk.com/blog/list-of-co-parenting-apps.html)
- [OurFamilyWizard vs. TalkingParents Comparison](https://farzadlaw.com/ourfamilywizard-versus-talkingparents)
- [2 Family Lawyers Review Co-Parenting Apps (2025)](https://www.lakemunrolaw.com/blogs/co-parenting-apps-in-2025--reviews-and-insights)
- [Custody X Change: Custody Schedules in Calendar Apps](https://www.custodyxchange.com/topics/schedules/overview/outlook-apple-google.php)
- [Best Co-Parenting Apps 2025 — Wealthy Single Mommy](https://www.wealthysinglemommy.com/best-co-parenting-apps/)
- [Best Co-Parenting Calendar App — Our Days](https://ourdayscalendar.com/)
- [Qustody — Simple Custody Calendar](https://qustody.com/)
- [Alimentor 2 — Custody Tracker](https://alimentor.org/en/)

---
*Feature research for: Co-parenting / shared custody scheduling (vuoroasuminen)*
*Researched: 2026-04-04*
