"use client"

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { ZoomIn, ZoomOut } from "lucide-react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import { ViewToolbar } from "./view-toolbar"
import { ExtendPanel } from "./extend-panel"
import { ClearPanel } from "./clear-panel"
import { OwnerWarningBanner } from "@/components/owner-warning-banner"
import { Button } from "@/components/ui/button"
import type { DateWindow, ScheduleDay, ParentId } from "@/lib/schedule/types"
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  subscribeToRowZoom,
  getRowZoomSnapshot,
  getRowZoomServerSnapshot,
  setRowZoom,
} from "./row-zoom"

interface DashboardShellProps {
  initialData: DateWindow
  initialViewStart?: string
  initialViewEnd?: string
  scheduleEndDate: string
  lastWeekStartParent?: ParentId | null
  header: React.ReactNode
  showOwnerWarning?: boolean
  parents: Array<{ id: ParentId; name: string }>
  childCount: number
  currentParentId?: ParentId
}

export function DashboardShell({
  initialData,
  initialViewStart,
  initialViewEnd,
  scheduleEndDate,
  lastWeekStartParent,
  header,
  showOwnerWarning = false,
  parents,
  childCount,
  currentParentId,
}: DashboardShellProps) {
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)
  const publishRef = useRef<(() => void) | null>(null)
  const initialDataRef = useRef(initialData)

  const zoom = useSyncExternalStore(subscribeToRowZoom, getRowZoomSnapshot, getRowZoomServerSnapshot)
  const stepZoom = useCallback((delta: number) => {
    setRowZoom(getRowZoomSnapshot() + delta)
  }, [])

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

  const handlePublished = useCallback((revertedEntryIds: string[]) => {
    const reverted = new Set(revertedEntryIds)
    setDays(prev => prev.map(day => ({
      ...day,
      cells: day.cells.map(cell => {
        // Entries the server reverted (calendar sync failed) stay/become draft
        if (cell.entryId && reverted.has(cell.entryId)) {
          return cell.status === "draft" ? cell : { ...cell, status: "draft" as const }
        }
        return cell.status === "draft" ? { ...cell, status: "published" as const } : cell
      }),
    })))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      {showOwnerWarning && <OwnerWarningBanner />}
      <ViewToolbar
        initialViewStart={initialViewStart}
        initialViewEnd={initialViewEnd}
        resolvedStart={initialData.startDate}
        resolvedEnd={initialData.endDate}
      />
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => stepZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Loitonna (pienemmät rivit)"
            title="Loitonna (pienemmät rivit) — tai nipistä kosketusnäytöllä"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stepZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Lähennä (suuremmat rivit)"
            title="Lähennä (suuremmat rivit) — tai levitä sormia kosketusnäytöllä"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <PublishButton days={days} viewStart={initialViewStart} viewEnd={initialViewEnd} onPublished={handlePublished} />
      </div>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime days={days} setDays={setDays} publishRef={publishRef} parents={parents} viewStart={initialViewStart} viewEnd={initialViewEnd} currentParentId={currentParentId} zoom={zoom} />
        <ExtendPanel scheduleEndDate={scheduleEndDate} lastWeekStartParent={lastWeekStartParent} parents={parents} />
        <ClearPanel childCount={childCount} />
      </main>
    </div>
  )
}
