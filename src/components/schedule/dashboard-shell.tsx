"use client"

import React, { useCallback, useRef, useState } from "react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import { ViewToolbar } from "./view-toolbar"
import { ExtendPanel } from "./extend-panel"
import { ClearPanel } from "./clear-panel"
import type { DateWindow, ScheduleDay } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
  initialViewStart?: string
  scheduleEndDate: string
  header: React.ReactNode
}

export function DashboardShell({ initialData, initialViewStart, scheduleEndDate, header }: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)
  const publishRef = useRef<(() => void) | null>(null)

  const handlePublished = useCallback(() => {
    // Update DashboardShell's own days state optimistically
    setDays(prev => prev.map(day => ({
      ...day,
      cells: day.cells.map(cell =>
        cell.status === "draft" ? { ...cell, status: "published" as const } : cell
      ),
    })))
    // Also update ScheduleTable's internal days so CDC events for published cells are no-ops
    publishRef.current?.()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <ViewToolbar initialViewStart={initialViewStart} />
      <div className="flex items-center justify-end px-4 py-2 border-b">
        <PublishButton days={days} onPublished={handlePublished} />
      </div>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime initialData={initialData} onDaysChange={setDays} publishRef={publishRef} />
        <ExtendPanel scheduleEndDate={scheduleEndDate} />
        <ClearPanel />
      </main>
    </div>
  )
}
