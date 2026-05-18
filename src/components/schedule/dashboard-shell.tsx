"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import { ViewToolbar } from "./view-toolbar"
import { ExtendPanel } from "./extend-panel"
import { ClearPanel } from "./clear-panel"
import { OwnerWarningBanner } from "@/components/owner-warning-banner"
import type { DateWindow, ScheduleDay, ParentId } from "@/lib/schedule/types"

interface DashboardShellProps {
  initialData: DateWindow
  initialViewStart?: string
  scheduleEndDate: string
  header: React.ReactNode
  showOwnerWarning?: boolean
  parents: Array<{ id: ParentId; name: string }>
  childCount: number
}

export function DashboardShell({
  initialData,
  initialViewStart,
  scheduleEndDate,
  header,
  showOwnerWarning = false,
  parents,
  childCount,
}: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)
  const publishRef = useRef<(() => void) | null>(null)
  const initialDataRef = useRef(initialData)

  // Re-sync only when the date window itself changes (e.g. after clearRange + router.refresh()),
  // not on every referential re-render of initialData. This prevents discarding in-flight
  // optimistic updates when router.refresh() returns an identical-data but new-object prop.
  useEffect(() => {
    if (
      initialData.startDate !== initialDataRef.current.startDate ||
      initialData.endDate !== initialDataRef.current.endDate
    ) {
      initialDataRef.current = initialData
      setDays(initialData.days)
    }
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
        <ScheduleWithRealtime days={days} setDays={setDays} publishRef={publishRef} parents={parents} viewStart={initialViewStart} />
        <ExtendPanel scheduleEndDate={scheduleEndDate} />
        <ClearPanel childCount={childCount} />
      </main>
    </div>
  )
}
