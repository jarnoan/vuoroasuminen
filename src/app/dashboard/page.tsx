import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { eq } from "drizzle-orm"
import { getScheduleWindow, getScheduleEndDate } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"
import { db } from "@/db"
import { userGoogleTokens } from "@/db/schema/tokens"
import { getAppConfig } from "@/config/app"
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

  const [schedule, scheduleEndDate, tokenRow] = await Promise.all([
    getScheduleWindow(validatedStart),
    getScheduleEndDate(),
    db
      .select({ email: userGoogleTokens.email })
      .from(userGoogleTokens)
      .where(eq(userGoogleTokens.email, ownerEmail))
      .limit(1)
      .then((rows) => rows[0]),
  ])

  const showOwnerWarning = !tokenRow

  return (
    <DashboardShell
      key={validatedStart ?? "default"}
      initialData={schedule}
      initialViewStart={validatedStart}
      scheduleEndDate={scheduleEndDate ?? schedule.endDate}
      header={<Header />}
      showOwnerWarning={showOwnerWarning}
    />
  )
}
