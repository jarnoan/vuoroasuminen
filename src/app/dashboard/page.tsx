import Header from "@/components/layout/header"
import { getScheduleWindow } from "@/lib/schedule/queries"
import { ScheduleWithRealtime } from "@/components/schedule/schedule-with-realtime"
import { PublishButton } from "@/components/schedule/publish-button"

export default async function Dashboard() {
  const schedule = await getScheduleWindow()

  return (
    <div className="min-h-screen flex flex-col">
      <Header>
        <PublishButton initialData={schedule} />
      </Header>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime initialData={schedule} />
      </main>
    </div>
  )
}
