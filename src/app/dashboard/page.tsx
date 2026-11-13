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

// The displayed date range is client state in DashboardShell (not in the URL);
// the server always renders the default window and the shell fetches others.
export default async function Dashboard() {
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
      getScheduleWindow(),
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
        initialData={schedule}
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
