import { parseISO, isValid, startOfWeek, format } from "date-fns"
import { getScheduleWindow, getScheduleEndDate } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"
import Header from "@/components/layout/header"

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
  const [schedule, scheduleEndDate] = await Promise.all([
    getScheduleWindow(validatedStart),
    getScheduleEndDate(),
  ])

  return (
    <DashboardShell
      key={validatedStart ?? "default"}
      initialData={schedule}
      initialViewStart={validatedStart}
      scheduleEndDate={scheduleEndDate ?? schedule.endDate}
      header={<Header />}
    />
  )
}
