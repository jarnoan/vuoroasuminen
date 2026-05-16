# Onboarding Features

**Project:** Vuoroasuminen — v1.3 onboarding wizard
**Researched:** 2026-05-15
**Scope:** First-run UI replacing `src/config/app.ts` + env vars for parent/children/calendar config

---

## Context

The app has exactly two users: two co-parents who both already have Google accounts. The first
parent to set up the app is the "setup owner." The second parent joins via a share link. Neither
parent should need to edit env files, config code, or touch Supabase manually.

The existing `AppConfig` shape drives the entire app — parents (id, name, email, calendarId,
ownerEmail), children names, startDate, firstParent. Onboarding must collect exactly this data
and persist it to the database, replacing the in-memory module.

---

## Wizard Steps

### Step 1 — Sign in (pre-wizard gate)

The wizard is only visible to an authenticated user. The root page already redirects
authenticated users to `/dashboard`. A new `/setup` route (or `/onboarding`) should be the
post-auth redirect destination when the DB has no onboarding row yet.

**What happens here:** Google OAuth sign-in (already implemented). No new form fields.
The signed-in user automatically becomes "Parent A" (the setup owner). Their email is
pre-populated from the auth session — they cannot change it here.

---

### Step 2 — Family setup (single form page for all family data)

Collect everything needed to describe the family before dealing with calendar IDs.

**Fields:**

| Field | Label | Notes |
|---|---|---|
| Parent A name | "Your name" | Pre-filled from Google display name; editable |
| Parent B name | "Other parent's name" | Free text, required |
| Parent B email | "Other parent's Google email" | Required; validated as email format; used to match their sign-in |
| Children names | "Children" | Dynamic list: add/remove; at least one required |
| Schedule start date | "First Monday of the alternating pattern" | Date picker, must be a Monday; defaults to the coming Monday |
| First parent | "Who has the children in the first week?" | Radio: Parent A / Parent B |

**Why single page, not split across multiple steps:** The family data fields are small in
number (5–7 inputs) and have no technical dependency on each other. Splitting them across
multiple wizard steps adds navigation overhead without reducing cognitive load. Multi-step is
appropriate when each step requires server-side validation before the next can proceed, or when
the data volume per step would be overwhelming. This family data does not meet either criterion.

**Validation before proceeding:**
- Parent A name: non-empty (1–80 chars)
- Parent B name: non-empty (1–80 chars)
- Parent B email: valid email format; must differ from Parent A's email
- Children: at least one name; each name non-empty; no duplicates
- Start date: required; must be a Monday (enforce in picker, warn on manual entry)
- First parent: required (one of the two options selected)

---

### Step 3 — Calendar setup (one sub-section per parent)

Collect a Google Calendar ID for each parent. This is the most friction-heavy step and needs
explicit guidance.

**Fields:**

| Field | Label | Notes |
|---|---|---|
| Parent A calendar ID | "Your Google Calendar ID" | Pre-labeled with Parent A's name from Step 2 |
| Parent B calendar ID | "[Parent B name]'s Google Calendar ID" | Pre-labeled with Parent B's name |

**Strongly recommended UX addition (see Calendar ID Discovery section below):** offer a
"Select from your calendars" dropdown that calls `calendarList.list` using the already-stored
OAuth tokens, populated with Parent A's calendars on page load. Parent B's calendar selector
is deferred to when Parent B completes their own calendar step during invite acceptance.

**Validation before proceeding:**
- Both IDs non-empty
- Format check: calendar IDs are either `primary`, a Gmail address
  (`user@gmail.com`), or an opaque string ending in `@group.calendar.google.com`.
  Flag obvious garbage (e.g., contains spaces, has `http://`) with an inline error.
- Optional live verification: make a `calendarList.get` call server-side to confirm
  the authenticated user's token can read the supplied calendar ID. If it fails, show
  a warning ("We couldn't verify this calendar ID — double-check it and try again")
  but allow proceeding (the user might be entering the other parent's ID which their
  token can't read).

---

### Step 4 — Review and confirm

Single summary screen showing all collected data before writing to the database.

**Shows:**
- Parent A and B names + emails
- Children list
- Schedule start date and first-parent week
- Calendar IDs (abbreviated)
- A "Looks good — save and continue" primary button
- A "Go back and edit" secondary link

**Why a review step:** Onboarding writes are difficult to undo once the schedule is generated
and calendar IDs are committed. A review step catches typos (especially in emails and calendar
IDs) before the data is persisted.

**No validation here** — all validation is complete. This step is read-only.

---

### Step 5 — Invite Parent B

After saving family config, show the invite share link. This is a generated URL with a secure
token that the second parent uses to join.

**Content of this screen:**
- Confirmation that setup was saved ("Family setup complete!")
- The invite link displayed in a copy-to-clipboard input
- Brief instruction: "Send this link to [Parent B name] ([Parent B email]). When they open it
  and sign in with their Google account, they'll get access to the schedule."
- A "Go to schedule" link/button that takes Parent A to the main dashboard (the schedule is
  accessible immediately; it just won't show the second parent's changes until they join)

**No email sending by the app.** Parent A copies and pastes the link themselves. This avoids
the complexity of email delivery (SMTP, Supabase emails, spam filters) for a two-user app
where both parents are in direct contact anyway.

---

## Calendar ID Discovery

### The problem

Google Calendar IDs are not surfaced anywhere obvious. The standard path is:
Google Calendar web → hover a calendar in the left sidebar → three-dot menu → "Settings
and sharing" → scroll to "Calendar ID" section. This is 4 steps, desktop-only, and invisible
to most users. The mobile Calendar app does not expose IDs at all.

### Recommended approach: "Select from your calendars" dropdown (HIGH value)

Since the app already has the user's Google OAuth access token (required for Calendar sync
anyway), it can call `calendar.calendarList.list()` server-side and return the user's
calendar names and IDs as a select dropdown.

**Flow:**
1. Step 3 loads. A Server Action calls `calendarList.list` using the token from
   `user_google_tokens` for the signed-in parent.
2. The response lists all calendars the user can see (name + id).
3. The UI shows a `<select>` or shadcn/ui `<Combobox>` populated with calendar names.
   Selecting one auto-fills the calendar ID field.
4. The raw ID is still shown in a read-only text input below the selector so the user
   can verify what was selected.
5. A "Paste ID manually" toggle is available as fallback (for edge cases: new calendar
   not yet visible, shared calendar owned by the other parent, etc.).

**Why this is better than paste-only:**
- Eliminates the 4-step discovery path entirely for Parent A's own calendar.
- Users see friendly calendar names ("Emma's school calendar") not opaque strings.
- Reduces typo rate to zero for the picker path.

**Required OAuth scope:** `https://www.googleapis.com/auth/calendar.readonly` —
the app already requests `https://www.googleapis.com/auth/calendar` for write access,
so no additional scope is needed.

**For Parent B's calendar:** Parent A must either paste or select Parent B's calendar
ID from their own calendar list (not possible if it's a private calendar). Better UX:
leave Parent B's calendar ID collection to Parent B during invite acceptance (Step 3
is only Parent A's calendar; Parent B fills in their own calendar ID when they accept
the invite). This avoids Parent A needing access to Parent B's calendar.

**Revised calendar step split:**

| Setup owner (Parent A) | Invited parent (Parent B) |
|---|---|
| Selects/pastes their own calendar ID | Selects/pastes their own calendar ID |
| Sees a placeholder for Parent B's calendar | Their calendar ID is saved on invite acceptance |

The app writes `calendarId` for Parent A during wizard Step 3. Parent B's `calendarId`
is collected and written when Parent B completes invite acceptance.

### Inline instructions (fallback when picker fails or for manual entry)

Display collapsible step-by-step instructions directly in the UI:

> **Where to find your Calendar ID:**
> 1. Open [Google Calendar](https://calendar.google.com) on a computer (not the mobile app)
> 2. In the left sidebar, hover over the calendar you want to use
> 3. Click the three-dot menu → "Settings and sharing"
> 4. Scroll down to "Integrate calendar" — the Calendar ID is shown there
> 5. Copy and paste it here

---

## Invite Flow States

### Parent A's states

| State | What Parent A sees |
|---|---|
| Setup not started | Redirected to `/setup` after sign-in |
| Completing wizard steps 1–4 | Wizard with step progress indicator (e.g., "Step 2 of 4") |
| Step 5 — invite pending | "Setup complete! Send this link to [Parent B name]: [link] [copy button]". Dashboard link visible and functional. |
| Parent B has joined | No explicit notification on first release. Parent B's name appears in the header/schedule UI naturally. (Nice-to-have: a banner "Parent B has joined!" on next page load.) |

### Parent B's states

| State | What Parent B sees |
|---|---|
| Clicks invite link (not signed in) | Redirect to Google OAuth sign-in, then back to invite acceptance page |
| Clicks invite link (already signed in with wrong Google account) | Error: "This invite is for [Parent B email]. Please sign out and sign in with that account." |
| Invite link expired or already used | Error page: "This invite link is no longer valid. Ask [Parent A name] to generate a new one." |
| On invite acceptance page (correct account) | Simplified wizard: single step for their calendar ID. Their name and email are shown pre-filled (from what Parent A entered). They confirm their name (editable) and select/paste their calendar ID. |
| After Parent B confirms | "You're set up! You can now see and edit the shared schedule." → redirect to `/dashboard` |

### Invite token design

- Token: cryptographically random (e.g., `crypto.randomUUID()` or 32-byte hex)
- Stored in a new `invites` table: `(token, invited_email, expires_at, accepted_at)`
- Expiry: 7 days from generation is appropriate for a known two-person app
- Single-use: marked `accepted_at` on use; subsequent visits return "already used" error
- Parent B's email from the token is matched against their Google OAuth email on acceptance.
  Mismatch = clear error message, not silent failure.

---

## Completion Criteria

Onboarding is complete — and the main schedule view is unlocked — when ALL of the following
are true:

1. Parent A has completed the wizard (family config saved to DB)
2. Parent B has accepted the invite and saved their calendar ID

**Before Parent B joins:**
- Parent A can access the schedule immediately after Step 5. The schedule is functional for
  one parent. Calendar sync will fail or produce incomplete results until Parent B's calendar
  ID is present, but the app should not block Parent A from the schedule.
- A persistent non-blocking banner in the schedule view: "Waiting for [Parent B name] to join.
  [Copy invite link again]" — dismissible once Parent B joins.

**Unlocking logic:**
- Middleware checks: is user authenticated? → yes → is onboarding complete? → if no, redirect
  to `/setup` or `/setup/accept` (for invited parent). If yes, proceed to `/dashboard`.
- "Onboarding complete" DB flag: a `setup_complete` boolean or equivalent on the family config
  row, set to `true` when Parent B's `accepted_at` is recorded.

---

## Table Stakes vs Nice to Have

### Table stakes (must ship in v1.3)

| Feature | Reason |
|---|---|
| Multi-step wizard for Parent A (steps 1–5 above) | Core requirement; replaces env file editing entirely |
| Parent A can select calendar from dropdown (calendarList.list) | Eliminates the #1 user friction point; technically straightforward given existing token infrastructure |
| Inline instructions for manual Calendar ID entry | Fallback for cases where picker fails; always needed |
| Invite link generation (copy-paste, no email sending) | Two parents are in direct contact; email delivery infra is out of scope |
| Invite acceptance flow for Parent B (name confirmation + calendar ID) | Parent B must be able to complete setup without developer help |
| Validation at each step (email format, non-empty fields, Monday date) | Prevents silent bad data that breaks Calendar sync downstream |
| Review screen before writing to DB | One-time write with hard-to-undo consequences justifies a confirmation step |
| Invite token expiry and single-use enforcement | Basic security; token in URL is publicly visible if Parent B uses a shared device |
| Middleware redirect to `/setup` when onboarding incomplete | Prevents accessing the schedule before setup is done |
| "Waiting for Parent B" banner on dashboard | Parent A needs to know invite is pending without checking a separate admin screen |

### Nice to have (defer to later milestone)

| Feature | Reason to defer |
|---|---|
| Parent A notified when Parent B joins | Requires either polling or a Supabase Realtime subscription on the invites table; low urgency since the schedule view auto-reflects the join |
| Regenerate invite link (if expired) | Easy to add but adds a UI surface; first release can rely on developer resetting if needed |
| Edit family config post-onboarding (rename children, add a child, change calendar IDs) | Complex: changing a calendar ID invalidates all gcal_events rows; punted until a clear user need emerges |
| Parent B's calendar ID picker (calendarList.list for Parent B) | Technically identical to Parent A's picker; include if it fits cleanly into invite acceptance page |
| Progress persistence across browser sessions during wizard | Wizard is short (4 data steps); losing progress on refresh is acceptable for a one-time setup |
| "Skip calendar setup for now" option | Calendar sync is a core value proposition; skipping it defeats the purpose |
| Invite via email (app sends the link directly) | SMTP/email delivery adds infra complexity for a two-user app; out of scope |

---

## Implementation Notes (for roadmap planning)

### New DB tables needed

- `family_config` (or extend the existing seed pattern): stores parents array, children,
  startDate, firstParent — replaces `src/config/app.ts`
- `invites`: stores invite tokens, invited email, expiry, accepted_at

### Env vars to remove from required list

Once onboarding is DB-driven: `PARENT_FATHER_EMAIL`, `PARENT_MOTHER_EMAIL`, `APP_CHILDREN`,
`APP_START_DATE`, `PARENT_FATHER_NAME`, `PARENT_MOTHER_NAME`, `PARENT_FATHER_CALENDAR_ID`,
`PARENT_MOTHER_CALENDAR_ID`, `APP_FIRST_PARENT`. These move to the DB. `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` remain as infrastructure env vars.

### Middleware change

The current middleware handles Supabase session refresh. It needs a second check:
if authenticated but no family_config row exists, redirect to `/setup`.
If authenticated and invited_email matches and no accepted_at yet, redirect to `/setup/accept`.

### RLS consideration

The `family_config` and `invites` tables need RLS policies. The invite acceptance route runs
before Parent B is "registered" in the family_config — the token itself must authorize the
write without requiring a matching family_config row.

---

## Sources

- Nielsen Norman Group — Wizards: Definition and Design Recommendations: https://www.nngroup.com/articles/wizards/
- Eleken — Wizard UI Pattern: When to Use It and How to Get It Right: https://www.eleken.co/blog-posts/wizard-ui-pattern-explained
- Google Calendar API — CalendarList.list reference: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list
- Google Calendar API — Auth scopes: https://developers.google.com/workspace/calendar/api/auth
- University of Minnesota IT — How to Find Your Google Calendar ID: https://it.umn.edu/services-technologies/how-tos/google-calendar-find-your-google
- xFanatical — Everything You Need to Know About Google Calendar ID: https://xfanatical.com/blog/everything-you-need-to-know-about-google-calendar-id/
- Userpilot — How to Onboard Invited Users to Your SaaS Product: https://userpilot.com/blog/onboard-invited-users-saas/
- Appcues — How to onboard invited users and fast-track user engagement: https://www.appcues.com/blog/user-onboarding-strategies-invited-users
- Cloudscape Design System — Validation patterns: https://cloudscape.design/patterns/general/errors/validation/
