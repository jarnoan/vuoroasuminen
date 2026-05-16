# Phase 12: Onboarding Wizard - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema/domain.ts` (append) | model | CRUD | `src/db/schema/domain.ts` (existing tables) | exact |
| `src/config/app.ts` (rewrite) | config | request-response | `src/lib/gcal/client.ts` (async DB lookup) | role-match |
| `src/app/setup/page.tsx` | component | request-response | `src/app/page.tsx` + `src/app/auth/error/page.tsx` | role-match |
| `src/app/dashboard/page.tsx` (modify) | component | request-response | `src/app/page.tsx` (redirect pattern) | exact |
| `src/actions/setup.ts` (new) | service | request-response | `src/actions/schedule.ts` + `src/actions/auth.ts` | exact |
| `src/lib/gcal/sync.ts` (modify) | service | request-response | itself — add `await getAppConfig()` | exact |
| `src/lib/schedule/queries.ts` (modify) | service | CRUD | itself — add `await getAppConfig()` | exact |
| `src/lib/schedule/generate-default.ts` (modify) | utility | transform | itself — accept config param | exact |
| `scripts/generate-app-config.js` (delete) | utility | — | — | — |

---

## Pattern Assignments

### `src/db/schema/domain.ts` (append — model, CRUD)

**Analog:** `src/db/schema/domain.ts` (existing tables) and `src/db/schema/tokens.ts`

**Existing import block** (`src/db/schema/domain.ts` lines 1–1):
```typescript
import { pgTable, pgEnum, text, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
```
Extend this import to add `integer` and `array` support:
```typescript
import { pgTable, pgEnum, text, date, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core"
```

**Core pattern — existing table with UUID PK** (`src/db/schema/domain.ts` lines 9–14):
```typescript
export const children = pgTable("children", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
})
```

**Core pattern — existing table with timestamps** (`src/db/schema/domain.ts` lines 41–56):
```typescript
export const gcalEvents = pgTable("gcal_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  scheduleEntryId: text("schedule_entry_id")
    .notNull()
    .references(() => scheduleEntries.id, { onDelete: "cascade" }),
  googleEventId: text("google_event_id").notNull(),
  calendarId: text("calendar_id").notNull(),
  syncedAt: timestamp("synced_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("gcal_events_entry_calendar_unique").on(
    table.scheduleEntryId,
    table.calendarId
  ),
])
```

**Token table pattern with nullable columns** (`src/db/schema/tokens.ts` lines 1–7):
```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const userGoogleTokens = pgTable("user_google_tokens", {
  email: text("email").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})
```

**New tables to append** (from ONBOARDING-STACK.md):
```typescript
// familyConfig: single-row config table (CHECK id = 1 added via raw SQL after push)
export const familyConfig = pgTable("family_config", {
  id: integer("id").primaryKey().default(1),
  parent1Id: text("parent1_id").notNull(),
  parent1Name: text("parent1_name").notNull(),
  parent1Email: text("parent1_email").notNull(),
  parent1CalendarId: text("parent1_calendar_id").notNull(),
  parent2Id: text("parent2_id").notNull(),
  parent2Name: text("parent2_name").notNull(),
  parent2Email: text("parent2_email").notNull(),
  parent2CalendarId: text("parent2_calendar_id").notNull(),
  children: text("children").array().notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  firstParent: text("first_parent").notNull().default("father"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
})

// inviteTokens: created now (Phase 13 will add application logic)
export const inviteTokens = pgTable("invite_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
})
```

**`src/db/index.ts` — add new schema to the barrel** (lines 1–22):
```typescript
import * as domainSchema from "./schema/domain"
import * as tokensSchema from "./schema/tokens"

// After adding tables to domain.ts, no index.ts change is needed because
// domain.ts is already spread with `...domainSchema`. Verify that familyConfig
// and inviteTokens are exported from domain.ts — that is all that is required.
```

---

### `src/config/app.ts` (rewrite — config, request-response)

**Analog:** `src/lib/gcal/client.ts` — async function doing a Drizzle DB lookup with a hard throw on missing row.

**DB lookup + throw pattern** (`src/lib/gcal/client.ts` lines 29–49):
```typescript
export async function buildGCalClient(ownerEmail: string): Promise<calendar_v3.Calendar> {
  const [row] = await db
    .select({ refreshToken: userGoogleTokens.refreshToken })
    .from(userGoogleTokens)
    .where(eq(userGoogleTokens.email, ownerEmail))
    .limit(1)

  if (!row?.refreshToken) {
    console.error(`[GCal] No refresh token found for ${ownerEmail}`)
    throw new Error(
      `No refresh token found for ${ownerEmail}. Calendar owner must sign in.`
    )
  }
  // ... rest of function
}
```

**New `src/config/app.ts` shape** (from ONBOARDING-STACK.md §Step 3):
```typescript
import { db } from "@/db"
import { familyConfig } from "@/db/schema/domain"
import { eq } from "drizzle-orm"

export type ParentId = "father" | "mother"

export interface AppConfig {
  parents: Array<{
    id: ParentId
    name: string
    email: string
    calendarId: string
    ownerEmail: string
  }>
  children: string[]
  startDate: string
  firstParent: ParentId
}

export async function getAppConfig(): Promise<AppConfig> {
  const [row] = await db.select().from(familyConfig).where(eq(familyConfig.id, 1))
  if (!row) throw new Error("Family config not found — onboarding not complete")
  return {
    parents: [
      {
        id: row.parent1Id as ParentId,
        name: row.parent1Name,
        email: row.parent1Email,
        calendarId: row.parent1CalendarId,
        ownerEmail: row.parent1Email,   // D-07: ownerEmail = parent1Email for both entries
      },
      {
        id: row.parent2Id as ParentId,
        name: row.parent2Name,
        email: row.parent2Email,
        calendarId: row.parent2CalendarId,
        ownerEmail: row.parent1Email,   // D-07: same owner for both
      },
    ],
    children: row.children,
    startDate: row.startDate,
    firstParent: row.firstParent as ParentId,
  }
}
```

**Note:** Remove `export default config` — all call sites switch from `import config from "@/config/app"` to `import { getAppConfig } from "@/config/app"` + `const config = await getAppConfig()`.

---

### `src/app/setup/page.tsx` (new — component, request-response)

**Analog 1:** `src/app/page.tsx` — Server Component with auth guard + redirect pattern.

**Auth guard + redirect** (`src/app/page.tsx` lines 1–10):
```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")
  // ...
}
```

**Analog 2:** `src/app/auth/error/page.tsx` — Finnish copy, centered layout, client component with Button.

**Finnish page layout pattern** (`src/app/auth/error/page.tsx` lines 31–43):
```tsx
return (
  <main className="flex min-h-screen items-center justify-center">
    <div className="text-center space-y-6 max-w-md px-6">
      <p className="text-muted-foreground">
        Tarvitsemme pääsyn kalenteriin. Kirjaudu sisään uudelleen ja myönnä
        tarvittavat oikeudet.
      </p>
      <Button size="lg" onClick={handleRetry}>
        Kirjaudu sisään uudelleen
      </Button>
    </div>
  </main>
)
```

**Setup page structure** — the page itself is a Server Component that:
1. Checks auth via `createSupabaseServerClient` — redirect to `/` if not authenticated (copy from `src/app/page.tsx` lines 1–10)
2. Passes user email to a Client Component wizard (`"use client"`)
3. The wizard Client Component manages step state (`useState<1|2|3|4>(1)`), collects form data across steps, and submits via a Server Action

**Wizard Client Component pattern** (modeled on `src/components/schedule/extend-panel.tsx`):
```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

type Step = 1 | 2 | 3 | 4

export function SetupWizard({ parentAEmail, parentAName }: {
  parentAEmail: string
  parentAName: string
}) {
  const [step, setStep] = useState<Step>(1)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // ... form state per step

  return (
    <div className="max-w-lg mx-auto px-6 py-12 space-y-8">
      {/* Progress indicator: "Vaihe 1/4" */}
      <p className="text-sm text-muted-foreground">Vaihe {step}/4</p>
      {step === 1 && <StepFamilyData ... />}
      {step === 2 && <StepCalendars ... />}
      {step === 3 && <StepReview ... />}
      {step === 4 && <StepComplete />}
      {errorMsg && (
        <p className="text-sm text-destructive" role="alert">{errorMsg}</p>
      )}
    </div>
  )
}
```

**Error display pattern** (copy from `src/components/schedule/extend-panel.tsx` lines 222–226):
```tsx
{errorMsg && (
  <p className="text-sm text-destructive" role="alert">
    {errorMsg}
  </p>
)}
```

**isPending + button disabled pattern** (copy from `src/components/schedule/extend-panel.tsx` lines 203–213):
```tsx
<Button
  variant="default"
  size="sm"
  className="font-semibold"
  onClick={handleConfirm}
  disabled={isPending || !rangeEnd}
>
  {isPending ? "Lisätään..." : "Vahvista"}
</Button>
```

---

### `src/app/dashboard/page.tsx` (modify — component, request-response)

**Analog:** `src/app/page.tsx` — existing redirect pattern in Server Component.

**Redirect-on-condition pattern** (`src/app/page.tsx` lines 9–10):
```typescript
if (user) redirect("/dashboard")
```

**Modification:** Replace `import config from "@/config/app"` with the new async call, add redirect-on-missing:
```typescript
import { getAppConfig } from "@/config/app"
import { redirect } from "next/navigation"

export default async function Dashboard({ searchParams }) {
  // ... existing auth check ...

  let config
  try {
    config = await getAppConfig()
  } catch {
    redirect("/setup")
  }

  const ownerEmail = config.parents[0].ownerEmail
  // ... rest of existing Dashboard function unchanged ...
}
```

**Current import to replace** (`src/app/dashboard/page.tsx` line 8):
```typescript
import config from "@/config/app"
// → becomes:
import { getAppConfig } from "@/config/app"
```

**Current ownerEmail usage to keep** (`src/app/dashboard/page.tsx` line 30):
```typescript
const ownerEmail = config.parents[0].ownerEmail
// This line is unchanged — just config is now awaited above
```

---

### `src/actions/setup.ts` (new — service, request-response)

**Analog:** `src/actions/schedule.ts` — `"use server"`, auth check via `createSupabaseServerClient`, Drizzle write, typed return union.

**Server Action file header pattern** (`src/actions/schedule.ts` lines 1–13):
```typescript
"use server"

import { db } from "@/db"
import { scheduleEntries, schedules, children } from "@/db/schema/domain"
import { and, eq, gte, lte } from "drizzle-orm"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { ParentId } from "@/config/app"
import config from "@/config/app"
```

**Auth check pattern** (`src/actions/schedule.ts` lines 16–26):
```typescript
async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) throw new Error("Not authenticated")
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email }
}
```

**Typed return union pattern** (`src/actions/schedule.ts` lines 57–78):
```typescript
export async function publishSchedule(): Promise<
  | { success: true; count: number }
  | { success: false; error: string }
> {
  await requireAuthorizedParent()
  // ... business logic ...
  return { success: true, count: result.length }
}
```

**New `src/actions/setup.ts`** should contain:

1. `saveWizardConfig(input: WizardInput)` — validates input with Zod, writes to `family_config` via `db.insert().onConflictDoUpdate()`, returns `{ success: true } | { success: false; error: string }`
2. `listCalendars()` — auth check, calls `buildGCalClient(userEmail)` then `calendar.calendarList.list()`, returns calendar list for dropdown

**`listCalendars` pattern** (modeled on `src/lib/gcal/client.ts` buildGCalClient + `googleapis` calendarList):
```typescript
"use server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildGCalClient } from "@/lib/gcal/client"

export async function listCalendars(): Promise<
  | { success: true; calendars: Array<{ id: string; summary: string }> }
  | { success: false; error: string }
> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, error: "Ei kirjautunut" }

  try {
    const calendar = await buildGCalClient(user.email)
    const res = await calendar.calendarList.list()
    const items = (res.data.items ?? []).map(c => ({
      id: c.id ?? "",
      summary: c.summary ?? c.id ?? "",
    }))
    return { success: true, calendars: items }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
```

**`saveWizardConfig` pattern** (auth + Drizzle insert):
```typescript
export async function saveWizardConfig(input: {
  parent1Name: string; parent1Email: string; parent1CalendarId: string
  parent2Name: string; parent2Email: string; parent2CalendarId: string
  children: string[]; startDate: string; firstParent: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, error: "Ei kirjautunut" }

  await db.insert(familyConfig).values({
    id: 1,
    parent1Id: "father",
    parent1Name: input.parent1Name,
    parent1Email: input.parent1Email,
    parent1CalendarId: input.parent1CalendarId,
    parent2Id: "mother",
    parent2Name: input.parent2Name,
    parent2Email: input.parent2Email,
    parent2CalendarId: input.parent2CalendarId,
    children: input.children,
    startDate: input.startDate,
    firstParent: input.firstParent,
  }).onConflictDoUpdate({
    target: familyConfig.id,
    set: { /* all fields */ updatedAt: new Date() },
  })

  return { success: true }
}
```

---

### `src/lib/gcal/sync.ts` (modify — service, request-response)

**Analog:** itself. Mechanical substitution: two `config` reads become `await getAppConfig()`.

**Current import to replace** (`src/lib/gcal/sync.ts` line 6):
```typescript
import config from "@/config/app"
// → becomes:
import { getAppConfig } from "@/config/app"
```

**Current usages** (`src/lib/gcal/sync.ts` lines 91–93 and 115–117):
```typescript
// Line 91 (early-return branch):
parentResults: config.parents.map(p => ({ ... })),

// Line 115 (concurrent sync):
config.parents.map(parent => syncParentCalendar(parent, ...))
```

**After change** — add at the top of `syncCalendarsAfterPublish()`:
```typescript
export async function syncCalendarsAfterPublish(): Promise<SyncResult> {
  const config = await getAppConfig()   // add this line
  const { start, end } = getWindowBounds()
  // ... rest of function unchanged
}
```

---

### `src/lib/schedule/queries.ts` (modify — service, CRUD)

**Analog:** itself. Mechanical substitution.

**Current import to replace** (`src/lib/schedule/queries.ts` line 6):
```typescript
import config from "@/config/app"
// → becomes:
import { getAppConfig } from "@/config/app"
```

**Current usages** (`src/lib/schedule/queries.ts` lines 17, 30, 73):
```typescript
const childOrder = config.children
const defaults = generateDefaultEntries(start, end, config.children)
parentId: (entry ? (entry.parentId as ParentId | null) : config.firstParent) as ParentId | null,
```

**After change** — add at top of `getScheduleWindow()`:
```typescript
export async function getScheduleWindow(startDate?: string): Promise<DateWindow> {
  const config = await getAppConfig()   // add this line
  const { start, end } = getWindowBounds(startDate)
  // ... rest unchanged
}
```

---

### `src/lib/schedule/generate-default.ts` (modify — utility, transform)

**Analog:** itself. Refactor `generateDefaultEntries` to accept config values as parameters rather than reading module-scope singleton (D-16).

**Current import to remove** (`src/lib/schedule/generate-default.ts` line 2):
```typescript
import config from "@/config/app"
```

**Current module-scope reads** (`src/lib/schedule/generate-default.ts` lines 19–20):
```typescript
const patternStart = new Date(config.startDate)
const otherParent: ParentId = config.firstParent === "father" ? "mother" : "father"
```

**After change** — accept config as parameter:
```typescript
export function generateDefaultEntries(
  windowStart: Date,
  windowEnd: Date,
  childNames: string[],
  startDate: string,      // was: config.startDate
  firstParent: ParentId,  // was: config.firstParent
): Array<{ childName: string; day: string; parentId: ParentId }> {
  const patternStart = new Date(startDate)
  const otherParent: ParentId = firstParent === "father" ? "mother" : "father"
  // ... rest of function body unchanged
}
```

**Call site update pattern** — all callers (`queries.ts`, `schedule.ts`) must pass the new params:
```typescript
// Before:
generateDefaultEntries(start, end, config.children)

// After:
generateDefaultEntries(start, end, config.children, config.startDate, config.firstParent)
```

`getWindowBounds()` in this file does NOT read config — no change needed there.

---

### `src/actions/schedule.ts` (modify call sites — service, request-response)

The existing `schedule.ts` also calls `generateDefaultEntries` and reads `config` directly. After the refactor:

**Current import** (`src/actions/schedule.ts` line 8):
```typescript
import config from "@/config/app"
```
Replace with:
```typescript
import { getAppConfig } from "@/config/app"
```

**`requireAuthorizedParent`** currently reads `config.parents` synchronously. After refactor:
```typescript
async function requireAuthorizedParent() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email
  if (!email) throw new Error("Not authenticated")
  const config = await getAppConfig()
  const isAuthorized = config.parents.some((p) => p.email === email)
  if (!isAuthorized) throw new Error("Forbidden")
  return { user, email }
}
```

Each exported action that reads `config.children` or `config.firstParent` also needs `const config = await getAppConfig()` near its top, following the same pattern as `syncCalendarsAfterPublish`.

---

## Shared Patterns

### Authentication check in Server Actions
**Source:** `src/actions/schedule.ts` lines 16–26
**Apply to:** `src/actions/setup.ts` (both `listCalendars` and `saveWizardConfig`)
```typescript
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
const email = user?.email
if (!email) throw new Error("Not authenticated")
```

### Auth guard + redirect in Server Components
**Source:** `src/app/page.tsx` lines 1–11
**Apply to:** `src/app/setup/page.tsx` (redirect to `/` if not authenticated)
```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect("/")
```

### Drizzle DB connection
**Source:** `src/db/index.ts`
**Apply to:** `src/config/app.ts`, `src/actions/setup.ts`
```typescript
import { db } from "@/db"
// All server-side DB operations use this admin Drizzle connection (DATABASE_URL).
// Bypasses RLS — correct per Phase 8 D-11 for server-side writes.
```

### Drizzle select-one-or-throw pattern
**Source:** `src/lib/gcal/client.ts` lines 39–48
**Apply to:** `src/config/app.ts` `getAppConfig()`
```typescript
const [row] = await db.select().from(table).where(eq(table.id, 1)).limit(1)
if (!row) throw new Error("Row not found")
```

### Finnish UI copy conventions
**Source:** `src/app/auth/error/page.tsx` lines 32–38, `src/components/schedule/extend-panel.tsx` throughout
**Apply to:** `src/app/setup/page.tsx` and wizard sub-components
- All user-visible strings in Finnish
- Error messages use Finnish: `"Virheellinen sähköpostiosoite"`, `"Pakollinen kenttä"`
- Pending state labels: `"Tallennetaan..."`, `"Vahvista"`, `"Peruuta"`
- Layout: `<main className="flex min-h-screen items-center justify-center">`
- Card: `<div className="text-center space-y-6 max-w-md px-6">`

### GCal client construction
**Source:** `src/lib/gcal/client.ts` lines 29–91
**Apply to:** `src/actions/setup.ts` `listCalendars()`
```typescript
import { buildGCalClient } from "@/lib/gcal/client"
const calendar = await buildGCalClient(userEmail)
// calendar is a googleapis calendar_v3.Calendar instance
```

### Typed result union
**Source:** `src/actions/schedule.ts` lines 57–58
**Apply to:** `src/actions/setup.ts` all exported functions
```typescript
Promise<{ success: true } | { success: false; error: string }>
```

### isPending + error display in Client Components
**Source:** `src/components/schedule/extend-panel.tsx` lines 29–30, 203–226
**Apply to:** Wizard Client Component steps
```typescript
const [isPending, setIsPending] = useState(false)
const [errorMsg, setErrorMsg] = useState<string | null>(null)
// ...
{errorMsg && <p className="text-sm text-destructive" role="alert">{errorMsg}</p>}
```

### Calendar + Popover date picker
**Source:** `src/components/schedule/extend-panel.tsx` lines 157–182
**Apply to:** Step 1 of wizard (schedule start date field)
```tsx
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fi as fiPicker } from "react-day-picker/locale"

<Popover>
  <PopoverTrigger render={<Button variant="outline" size="sm" />}>
    {pickedDate ? format(pickedDate, "d.M.yyyy") : "Valitse päivä"}
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar mode="single" selected={pickedDate} onSelect={setPickedDate} locale={fiPicker} />
  </PopoverContent>
</Popover>
```

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/` (all subdirectories)
**Files scanned:** 47 source files
**Pattern extraction date:** 2026-05-16
