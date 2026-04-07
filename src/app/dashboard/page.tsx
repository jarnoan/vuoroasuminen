import { getScheduleWindow } from "@/lib/schedule/queries"
import { DashboardShell } from "@/components/schedule/dashboard-shell"

export default async function Dashboard() {
  const schedule = await getScheduleWindow()

  return <DashboardShell initialData={schedule} />
}
