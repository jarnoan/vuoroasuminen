"use client"

import { useState } from "react"
import Header from "@/components/layout/header"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import type { DateWindow, ScheduleDay } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
}

export function DashboardShell({ initialData }: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)

  return (
    <div className="min-h-screen flex flex-col">
      <Header>
        <PublishButton days={days} />
      </Header>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} />
      </main>
    </div>
  )
}
