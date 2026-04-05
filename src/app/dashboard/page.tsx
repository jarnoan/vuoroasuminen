import Header from "@/components/layout/header"
import { getScheduleWindow } from "@/lib/schedule/queries"
import { ScheduleTable } from "@/components/schedule/schedule-table"

export default async function Dashboard() {
  const schedule = await getScheduleWindow()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4">
        <ScheduleTable initialData={schedule} />
      </main>
    </div>
  )
}
