# Architecture Research

**Domain:** Real-time collaborative scheduling app with Google Calendar integration
**Researched:** 2026-04-04
**Confidence:** MEDIUM-HIGH (real-time and GCal patterns well-established; specific scheduling data model is novel but composed of known primitives)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Two Users)                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React UI  (schedule table, draft/publish controls, stats)  │   │
│  │  Supabase Realtime client subscription (postgres_changes)   │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ HTTPS / WebSocket (Supabase Realtime)
┌─────────────────────────▼───────────────────────────────────────────┐
│                    Next.js Application Server                       │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  Auth Layer     │  │  API Routes      │  │  GCal Sync Worker │  │
│  │  (Auth.js v5)   │  │  (schedule CRUD, │  │  (triggered after │  │
│  │  Google OAuth   │  │  publish, stats) │  │  publish)         │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬──────────┘  │
└───────────┼────────────────────┼─────────────────────┼─────────────┘
            │                    │                      │
┌───────────▼────────────────────▼─────────────────────▼─────────────┐
│                         Supabase (Postgres)                         │
│                                                                     │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │  users /       │  │  schedule_    │  │  gcal_events           │ │
│  │  accounts      │  │  entries      │  │  (event_id mirror)     │ │
│  │  (tokens)      │  │  (day×child   │  │                        │ │
│  │                │  │   ×status)    │  │                        │ │
│  └────────────────┘  └───────────────┘  └────────────────────────┘ │
│                     Supabase Realtime broadcasts row changes        │
└─────────────────────────────────────────────────────────────────────┘
            │                                         │
            ▼                                         ▼
┌───────────────────────┐              ┌──────────────────────────────┐
│  Google OAuth / OIDC  │              │  Google Calendar API         │
│  (authentication)     │              │  (write events per parent)   │
└───────────────────────┘              └──────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| React UI | Render schedule table, handle cell edits, show draft/published state, stats panel | Next.js App Router + React Server Components for initial load, Client Components for realtime |
| Supabase Realtime client | Subscribe to `postgres_changes` on `schedule_entries`; merge incoming changes into local state | Supabase JS client `channel().on('postgres_changes')` |
| Auth.js (Auth layer) | Google OAuth flow for both parents; store access + refresh tokens per user in `accounts` table | `@auth/nextjs` with Prisma or Supabase adapter |
| API Routes | Validate and write cell edits; trigger publish action; serve stats | Next.js Route Handlers (`app/api/`) |
| GCal Sync Worker | After publish, compute diff between DB state and Google Calendar; apply minimal upsert/delete operations | Server-side function called synchronously after publish (at MVP scale) |
| Postgres (`schedule_entries`) | Single source of truth for schedule state (draft and published cells, notes) | Supabase Postgres table with RLS |
| Postgres (`gcal_events`) | Mirror of Google Calendar event IDs; enables idempotent upsert without re-querying GCal | Separate table keyed on `(user_id, child_id, date)` |
| Postgres (`accounts`) | OAuth tokens per user (Auth.js managed); includes `access_token`, `refresh_token`, `expires_at` | Auth.js adapter table |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Auth routes (sign-in, callback)
│   ├── api/
│   │   ├── schedule/           # Cell edit, publish endpoints
│   │   ├── stats/              # Statistics computation
│   │   └── gcal/               # GCal webhook receiver
│   └── schedule/               # Main schedule page (Server + Client)
├── components/
│   ├── ScheduleTable.tsx        # Grid: rows=days, cols=children+notes
│   ├── DraftBadge.tsx           # Visual draft/published state
│   └── StatsPanel.tsx           # 12-week totals
├── lib/
│   ├── db/                     # Supabase client, query helpers
│   ├── gcal/
│   │   ├── client.ts            # Authenticated googleapis client factory
│   │   ├── sync.ts              # Diff + upsert/delete logic
│   │   └── tokens.ts            # Token fetch + refresh from DB
│   ├── schedule/
│   │   ├── defaults.ts          # Alternating-week default generator
│   │   └── stats.ts             # Statistics calculations
│   └── auth.ts                 # Auth.js config
├── types/
│   └── schedule.ts             # Shared types: ScheduleEntry, Child, Parent
└── middleware.ts               # Route protection (require auth)
```

### Structure Rationale

- **`lib/gcal/`:** Isolates all Google Calendar logic; easy to stub in tests and swap if GCal changes
- **`lib/schedule/`:** Pure business logic (defaults, stats) separate from DB and UI concerns
- **`app/api/gcal/`:** Receives GCal webhook signals (push notifications) for future inbound sync
- **`(auth)/` route group:** Keeps auth pages separate from application shell

## Architectural Patterns

### Pattern 1: Supabase Realtime for Two-User Sync

**What:** Both browser clients subscribe to `postgres_changes` on the `schedule_entries` table. Every successful DB write is automatically broadcast to all subscribers. No custom WebSocket server needed.

**When to use:** When you control the database (Supabase/Postgres), user count is small and known (exactly 2 parents per schedule), and you want real-time without managing WebSocket infrastructure.

**Trade-offs:**
- Pro: Zero infrastructure; Supabase handles fanout
- Pro: Row Level Security (RLS) on the subscription — users only see their own schedule's rows
- Con: Supabase Realtime has a concurrent connection limit on free tier (200); fine for this app
- Con: Client receives the full new row value; no field-level diff required

**Example:**
```typescript
// Client component — subscribe to this schedule's entries
useEffect(() => {
  const channel = supabase
    .channel('schedule-entries')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schedule_entries',
        filter: `schedule_id=eq.${scheduleId}`,
      },
      (payload) => {
        // payload.new contains the updated row
        setEntries((prev) => upsertEntry(prev, payload.new as ScheduleEntry))
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [scheduleId])
```

### Pattern 2: Last-Write-Wins via DB Constraint

**What:** Each cell (day × child) has a single row in `schedule_entries`. API writes are simple `UPSERT` operations. The last writer wins — no version vector, no merge.

**When to use:** When conflicts are rare (co-parents coordinate informally) and simplicity matters more than precision.

**Trade-offs:**
- Pro: Trivial to implement; Postgres `ON CONFLICT DO UPDATE` handles it natively
- Pro: No client-side merge UI complexity
- Con: Simultaneous edits of the same cell silently overwrite; acceptable per requirements

**Example:**
```typescript
// Server-side upsert — conflict on (schedule_id, date, child_id)
await db
  .from('schedule_entries')
  .upsert({
    schedule_id: scheduleId,
    date: isoDate,
    child_id: childId,
    parent_id: newParentId,
    status: 'draft',
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'schedule_id,date,child_id' })
```

### Pattern 3: Write-Only Google Calendar Sync (App → GCal)

**What:** Google Calendar is treated as an output target, not a source of truth. The app's Postgres is the single source of truth. After a publish action, the sync worker computes which calendar events need to be created, updated, or deleted and executes them.

**When to use:** When the app owns the schedule and Google Calendar is a notification/display mechanism. Eliminates the complexity of bidirectional sync (loop detection, conflict resolution between two sources).

**Trade-offs:**
- Pro: Dramatically simpler than bidirectional sync — no sync token management, no loop guards
- Pro: Idempotent: can re-sync any time without risk
- Con: Changes made directly in Google Calendar are ignored; users must use the app
- Con: If GCal sync fails, calendar is stale until next publish

**Event ID strategy:** Generate deterministic event IDs from `(userId, childId, date)` so that insert operations are naturally idempotent. Mirror these IDs in `gcal_events` table to enable efficient deletes.

```typescript
// Deterministic event ID — safe to insert repeatedly
function gcalEventId(userId: string, childId: string, date: string): string {
  return `vuoro_${userId}_${childId}_${date}`.replace(/-/g, '')
}
```

### Pattern 4: Draft → Published State on the Row

**What:** Each `schedule_entry` row carries a `status` column: `'draft' | 'published'`. Draft entries are visible in the UI but not synced to Google Calendar. Publishing changes status to `'published'` and triggers the GCal sync.

**When to use:** When you need a planning/review step before committing to external systems.

**Trade-offs:**
- Pro: Simple enum on the row; no separate drafts table needed
- Pro: Mixed states are natural (some days published, future days still draft)
- Con: "Unpublishing" requires reverting status and deleting GCal events (add complexity later if needed)

## Data Flow

### Edit Flow (Real-Time Collaboration)

```
Parent A edits cell (day=2026-05-01, child=Emma, parent=dad)
    ↓
React UI optimistic update → cell shows new value immediately
    ↓
POST /api/schedule/entry
    ↓
API Route validates auth, ownership → UPSERT schedule_entries (status=draft)
    ↓
Postgres write → Supabase Realtime broadcasts row to all subscribers
    ↓
Parent B's browser receives postgres_change event → UI updates automatically
```

### Publish Flow (Google Calendar Sync)

```
Either parent clicks "Publish"
    ↓
POST /api/schedule/publish (with date range)
    ↓
API Route: UPDATE schedule_entries SET status='published' WHERE date IN (range)
    ↓
Fetch affected entries from DB
    ↓
GCal Sync Worker runs for BOTH parents:
  1. Load current gcal_events mirror from DB
  2. Compute diff: entries to create, update, delete
  3. Fetch user's OAuth token (decrypt from accounts table)
  4. Google Calendar API calls (upsert events using deterministic event IDs)
  5. Update gcal_events mirror in DB
```

### OAuth Token Flow

```
Parent signs in → Google OAuth → Auth.js stores access_token + refresh_token in accounts table
    ↓
GCal Sync Worker needs to write to GCal on behalf of user
    ↓
lib/gcal/tokens.ts: fetch account row → check expires_at
    ↓ (if expired)
POST https://oauth2.googleapis.com/token (refresh_token grant)
    ↓
Update accounts row with new access_token + expires_at
    ↓
Build googleapis client with fresh access_token → call Calendar API
```

### Key Data Flows Summary

1. **Cell edit → other parent:** Postgres write → Supabase Realtime → other browser (under 200ms typical)
2. **Publish → Google Calendar:** API route → GCal sync worker → googleapis → parent's calendar (seconds, not real-time; acceptable)
3. **Token refresh:** Lazy (on first expired use) — worker checks before each GCal call
4. **Statistics:** Computed server-side from `schedule_entries` on request; no separate aggregation store needed at MVP scale

## Data Model

### Core Tables

```
schedule_entries
  id              uuid PK
  schedule_id     uuid FK → schedules.id
  date            date        -- ISO date, one row per day per child
  child_id        uuid FK → children.id
  parent_id       uuid FK → users.id   -- which parent has this child this day
  status          text        -- 'draft' | 'published'
  notes           text        -- per-day shared note (shared across children)
  updated_by      uuid FK → users.id
  updated_at      timestamptz
  UNIQUE (schedule_id, date, child_id)

gcal_events                   -- mirror of what's in Google Calendar
  id              uuid PK
  user_id         uuid FK → users.id   -- which parent's calendar
  child_id        uuid FK → children.id
  date            date
  gcal_event_id   text        -- deterministic ID used in Calendar API
  last_synced_at  timestamptz
  UNIQUE (user_id, child_id, date)

schedules                     -- one per family
  id              uuid PK
  created_at      timestamptz

schedule_members              -- maps users to a schedule (exactly 2 parents)
  schedule_id     uuid FK
  user_id         uuid FK
  role            text        -- 'parent_a' | 'parent_b'

children
  id              uuid PK
  schedule_id     uuid FK
  name            text
```

Notes column lives on `schedule_entries` — since notes are per-day (not per child-day), either store on the first child row for a given date or extract to a separate `daily_notes` table in a later iteration. Simplest MVP: a `daily_notes (schedule_id, date, note)` table avoids null duplication.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–10 users (MVP) | Single Next.js instance, Supabase free tier, synchronous GCal sync in API route |
| 10–100 users | Same architecture; consider moving GCal sync to background queue (e.g., Vercel Queue or pg_cron) to avoid API route timeouts |
| 100k+ users | Supabase Realtime horizontal scaling; dedicated sync worker service; GCal API quota becomes real constraint |

### Scaling Priorities

1. **First bottleneck:** GCal sync latency — at MVP, sync runs synchronously in the publish API route. If syncing 3 months × 2 parents × multiple children, this could approach Google Calendar API rate limits or timeout. Fix: move sync to a background job.
2. **Second bottleneck:** Supabase Realtime concurrent connections — free tier caps at 200 connections. For this two-user app, this is irrelevant for years.

## Anti-Patterns

### Anti-Pattern 1: Bidirectional Google Calendar Sync

**What people do:** Set up GCal push notifications (webhooks) and try to sync changes from Google Calendar back into the app database.

**Why it's wrong:** Google Calendar webhooks fire on any change (including changes your own sync worker just made), creating infinite sync loops. You need to track every event ID, compare timestamps, guard against loops with metadata tags, and handle the 7-day webhook channel expiry. For a 2-user app where Google Calendar is display-only, this complexity is not justified.

**Do this instead:** Write-only sync. App → GCal only. If a parent edits directly in Google Calendar, those changes are lost on next publish. Document this in the UI. For co-parents sharing one app, this is acceptable.

### Anti-Pattern 2: Polling Instead of Supabase Realtime

**What people do:** Poll `/api/schedule` every N seconds to get updates from the other parent.

**Why it's wrong:** Wasteful, introduces latency proportional to polling interval, and Supabase Realtime already provides the capability for free.

**Do this instead:** `supabase.channel().on('postgres_changes')` subscription in a client component. Merge incoming rows into local state. No polling needed.

### Anti-Pattern 3: Storing OAuth Tokens Client-Side

**What people do:** Put Google access tokens in localStorage or return them from the session object to the client.

**Why it's wrong:** Google Calendar API calls must be server-side (tokens give access to the user's calendar). Exposing tokens client-side is a security violation.

**Do this instead:** Auth.js database strategy stores tokens in the `accounts` table server-side. GCal sync runs only in API routes/server functions that read tokens from DB, never exposing them to the client.

### Anti-Pattern 4: One Calendar Event per Day for All Children Combined

**What people do:** Create one all-day event like "Kids at dad" per day.

**Why it's wrong:** The requirement is one event per child per day so each child's location is independently visible (children can be split between parents). Combined events cannot represent split custody days.

**Do this instead:** Separate events per child: "Emma @ dad", "Mikael @ mum" — each independently created/deleted per child per day.

### Anti-Pattern 5: Recomputing Statistics on Every Keystroke

**What people do:** Run statistics queries inside the schedule cell edit handler.

**Why it's wrong:** Stats span 12 weeks × all children × all days — expensive to recompute on every cell change.

**Do this instead:** Compute stats server-side on explicit request (page load or manual refresh). At MVP scale, a single SQL aggregation query is fast enough. No caching needed initially.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth (identity) | Auth.js v5 Google provider → OAuth 2.0 authorization code flow | Request `calendar` scope during initial sign-in to avoid second permission prompt |
| Google Calendar API (write) | Server-side `googleapis` Node.js client; one authenticated client per user | Use deterministic event IDs for idempotent upsert; store mirror in `gcal_events` table |
| Supabase Realtime | Client-side `supabase.channel().on('postgres_changes')` subscription | Filter by `schedule_id` so parents only receive changes for their shared schedule |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React UI ↔ API Routes | HTTP (fetch) for mutations; Supabase Realtime for updates | Keep mutations in API routes so server-side validation + token refresh are co-located |
| API Routes ↔ GCal Sync | Direct function call at MVP; background job at scale | GCal sync is purely a side-effect of publish; keep it out of the core schedule write path |
| GCal Sync ↔ Postgres `accounts` | Direct DB query via service role client | Token rotation writes back to `accounts`; must use service role (bypass RLS) |
| Auth.js ↔ Postgres `accounts` | Auth.js adapter manages reads/writes | Do not manually write to `accounts` except for token refresh in the GCal worker |

## Build Order (Phase Dependencies)

The component dependencies create a natural build order:

1. **Auth + DB schema** — everything depends on users being authenticated and the schema existing
2. **Schedule table UI (read-only)** — renders from static data; validates data model before adding mutations
3. **Cell edit mutations (draft)** — adds write path; Supabase Realtime subscription works immediately once writes exist
4. **Draft/publish state + statistics** — layered on top of existing schedule data
5. **Google Calendar sync** — final layer; depends on published state being correct, and requires OAuth tokens that Auth sets up in step 1

The GCal sync is intentionally last because it has the most external dependencies (Google API, token management) and can fail independently of the core scheduling functionality.

## Sources

- [Google Calendar API: Synchronize resources efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) — sync token pattern
- [Google Calendar API: Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push) — webhook expiry, header-only notifications, renewal strategy
- [Google Calendar API: Create Events](https://developers.google.com/workspace/calendar/api/guides/create-events) — all-day event format, deterministic event IDs
- [Auth.js: Refresh Token Rotation](https://authjs.dev/guides/refresh-token-rotation) — per-user token storage in `accounts` table, database strategy
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — `postgres_changes` subscription pattern
- [WebSocket Architecture Best Practices — Ably](https://ably.com/topic/websocket-architecture-best-practices) — real-time collaborative app patterns
- [Implementing Real-Time Data Sync with WebSockets — Medium](https://medium.com/@biz_41031/implementing-real-time-data-sync-with-websockets-building-collaborative-apps-9a77eee7700a) — collaborative app patterns
- [Calendar Webhook Integration Developer Guide 2025 — CalendHub](https://calendhub.com/blog/calendar-webhook-integration-developer-guide-2025/) — bidirectional sync complexity analysis
- [Google Calendar Webhooks with Node.js — Stateful](https://stateful.com/blog/google-calendar-webhooks) — webhook implementation reference
- [Auth0: Token Storage](https://auth0.com/docs/secure/security-guidance/data-security/token-storage) — token security guidance

---
*Architecture research for: real-time collaborative custody scheduling app with Google Calendar integration*
*Researched: 2026-04-04*
