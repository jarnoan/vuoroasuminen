"use client"

import React, { useCallback, useState } from "react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import type { DateWindow, ScheduleDay } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
  header: React.ReactNode
}

export function DashboardShell({ initialData, header }: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)

  const handlePublished = useCallback(() => {
    setDays(prev => prev.map(day => ({
      ...day,
      cells: day.cells.map(cell =>
        cell.status === "draft" ? { ...cell, status: "published" as const } : cell
      ),
    })))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <div className="flex items-center justify-end px-4 py-2 border-b">
        <PublishButton days={days} onPublished={handlePublished} />
      </div>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} />
      </main>
    </div>
  )
}
