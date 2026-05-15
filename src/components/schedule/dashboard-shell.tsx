"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import { ViewToolbar } from "./view-toolbar"
import { ExtendPanel } from "./extend-panel"
import { ClearPanel } from "./clear-panel"
import { OwnerWarningBanner } from "@/components/owner-warning-banner"
import type { DateWindow, ScheduleDay } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
  initialViewStart?: string
  scheduleEndDate: string
  header: React.ReactNode
  showOwnerWarning?: boolean
}

export function DashboardShell({
  initialData,
  initialViewStart,
  scheduleEndDate,
  header,
  showOwnerWarning = false,
}: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)
  const publishRef = useRef<(() => void) | null>(null)

  // Re-sync when server refreshes (e.g. after clearRange + router.refresh())
  useEffect(() => {
    setDays(initialData.days)
  }, [initialData])

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
      {showOwnerWarning && <OwnerWarningBanner />}
      <ViewToolbar initialViewStart={initialViewStart} />
      <div className="flex items-center justify-end px-4 py-2 border-b">
        <PublishButton days={days} onPublished={handlePublished} />
      </div>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime days={days} setDays={setDays} publishRef={publishRef} />
        <ExtendPanel scheduleEndDate={scheduleEndDate} />
        <ClearPanel />
      </main>
    </div>
  )
}
