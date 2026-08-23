import { parseISO, isValid, startOfWeek, endOfWeek, startOfToday, differenceInCalendarDays, format } from "date-fns"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { getScheduleWindow, getScheduleEndDate, getLastWeekStartParent } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import { InviteSection } from "@/components/invite/invite-section"
import Header from "@/components/layout/header"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { getAppConfig } from "@/config/app"
import { getActiveInviteToken } from "@/actions/invite"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function validateViewStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  // Snap to Monday of that week (weekStartsOn: 1 = Monday, Finnish convention)
  const monday = startOfWeek(parsed, { weekStartsOn: 1 })
  return format(monday, "yyyy-MM-dd")
}

// EXTEND-03/D-07 convention: end dates snap to Sunday (weekStartsOn: 1 → end of week)
function validateViewEnd(raw: string | undefined, validatedStart: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  const sunday = endOfWeek(parsed, { weekStartsOn: 1 })

  const start = validatedStart
    ? parseISO(validatedStart)
    : startOfWeek(startOfToday(), { weekStartsOn: 1 })

  const daysDelta = differenceInCalendarDays(sunday, start)
  // Ignore an end date that doesn't leave at least one day, or is unreasonably far out
  // (same 2-year cap as extendSchedule/clearRange in actions/schedule.ts)
  if (daysDelta < 1 || daysDelta > 730) return undefined

  return format(sunday, "yyyy-MM-dd")
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ viewStart?: string; viewEnd?: string }>
}) {
  const { viewStart, viewEnd } = await searchParams
  const validatedStart = validateViewStart(viewStart)
  const validatedEnd = validateViewEnd(viewEnd, validatedStart)

  // Phase 12 D-10: When no family_config row exists, redirect to /setup.
  // The wizard at /setup collects parent/children/calendar config and writes
  // it; on success the user is sent back to /dashboard.
  let config
  try {
    config = await getAppConfig()
  } catch {
    redirect("/setup")
  }

  // SAUTH-07 (preserved): Check whether the configured calendar owner has a
  // user_google_tokens row. When absent, GCal sync would silently fail on
  // publish — surface a banner upfront. Per Phase 8 D-01 and Phase 12 D-07,
  // both parent entries share the same ownerEmail; index 0 is canonical.
  const ownerEmail = config.parents[0].ownerEmail

  // D-03: parent2Email used to detect whether Parent B has joined.
  const parent2Email = config.parents[1].email

  const [schedule, scheduleEndDate, lastWeekStartParent, tokenRow, parent2TokenRow, activeInvite] =
    await Promise.all([
      getScheduleWindow(validatedStart, validatedEnd),
      getScheduleEndDate(),
      getLastWeekStartParent(),
      db
        .select({ email: userGoogleTokens.email })
        .from(userGoogleTokens)
        .where(eq(userGoogleTokens.email, ownerEmail))
        .limit(1)
        .then((rows) => rows[0]),
      // D-03: check if Parent B has signed in at least once
      db
        .select({ email: userGoogleTokens.email })
        .from(userGoogleTokens)
        .where(eq(userGoogleTokens.email, parent2Email))
        .limit(1)
        .then((rows) => rows[0]),
      // Fetch current invite token state for the invite section
      getActiveInviteToken(),
    ])

  const showOwnerWarning = !tokenRow
  // D-03: Parent B joined when their user_google_tokens row exists
  const parentBJoined = !!parent2TokenRow

  // Build origin for invite URL construction in InviteSection
  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const origin = `${protocol}://${host}`

  const parentsForUI = config.parents.map((p) => ({ id: p.id, name: p.name }))

  // Derive the current user's parentId so the UI assigns cells to the right parent
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserEmail = user?.email ?? null
  const currentParentId = config.parents.find((p) => p.email === currentUserEmail)?.id ?? null

  return (
    <>
      {!parentBJoined && activeInvite.success && (
        <InviteSection
          initialToken={activeInvite.token}
          initialExpiresAt={activeInvite.expiresAt}
          initialStatus={activeInvite.status}
          origin={origin}
        />
      )}
      <DashboardShell
        key={`${validatedStart ?? "default"}_${validatedEnd ?? "default"}`}
        initialData={schedule}
        initialViewStart={validatedStart}
        initialViewEnd={validatedEnd}
        scheduleEndDate={scheduleEndDate ?? schedule.endDate}
        lastWeekStartParent={lastWeekStartParent}
        header={<Header />}
        showOwnerWarning={showOwnerWarning}
        parents={parentsForUI}
        childCount={config.children.length}
        currentParentId={currentParentId ?? undefined}
      />
    </>
  )
}
