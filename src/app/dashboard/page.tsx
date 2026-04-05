import Header from "@/components/layout/header"
import { getScheduleWindow } from "@/lib/schedule/queries"

export default async function Dashboard() {
  const schedule = await getScheduleWindow()

  return (
    <div className="min-h-screen">
      <Header />
      <main className="p-4">
        <p className="text-sm text-muted-foreground mb-2">
          Schedule: {schedule.startDate} to {schedule.endDate} ({schedule.days.length} days)
        </p>
        <p className="text-sm text-muted-foreground">
          Data loaded. Schedule table UI coming in Plan 02.
        </p>
      </main>
    </div>
  )
}
