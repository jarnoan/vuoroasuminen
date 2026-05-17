import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { getScheduleWindow, getScheduleEndDate } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import { InviteSection } from "@/components/invite/invite-section"
import Header from "@/components/layout/header"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { getAppConfig } from "@/config/app"
import { getActiveInviteToken } from "@/actions/invite"
import { redirect } from "next/navigation"

function validateViewStart(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parsed = parseISO(raw)
  if (!isValid(parsed)) return undefined
  // Snap to Monday of that week (weekStartsOn: 1 = Monday, Finnish convention)
  const monday = startOfWeek(parsed, { weekStartsOn: 1 })
  return format(monday, "yyyy-MM-dd")
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ viewStart?: string }>
}) {
  const { viewStart } = await searchParams
  const validatedStart = validateViewStart(viewStart)

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

  const [schedule, scheduleEndDate, tokenRow, parent2TokenRow, activeInvite] =
    await Promise.all([
      getScheduleWindow(validatedStart),
      getScheduleEndDate(),
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
        key={validatedStart ?? "default"}
        initialData={schedule}
        initialViewStart={validatedStart}
        scheduleEndDate={scheduleEndDate ?? schedule.endDate}
        header={<Header />}
        showOwnerWarning={showOwnerWarning}
        parents={parentsForUI}
        childCount={config.children.length}
      />
    </>
  )
}
