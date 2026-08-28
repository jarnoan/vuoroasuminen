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
import { MAX_DENSITY, parseDensity, type Density } from "./density"

const DENSITY_STORAGE_KEY = "vuoroasuminen-density"
// Row density is a per-device display preference, kept in localStorage rather than the URL
// or DB. useSyncExternalStore reads it without an SSR/hydration mismatch (server snapshot is
// always density 0) and re-renders on change, including from the buttons below — the native
// "storage" event only fires in *other* tabs, so we dispatch this one ourselves.
const DENSITY_CHANGE_EVENT = "vuoroasuminen-density-change"

function subscribeToDensity(callback: () => void) {
  window.addEventListener(DENSITY_CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(DENSITY_CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getDensitySnapshot() {
  return parseDensity(localStorage.getItem(DENSITY_STORAGE_KEY))
}

function getDensityServerSnapshot(): Density {
  return 0
}

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

  const density = useSyncExternalStore(subscribeToDensity, getDensitySnapshot, getDensityServerSnapshot)
  const stepDensity = useCallback((delta: 1 | -1) => {
    const next = Math.min(MAX_DENSITY, Math.max(0, getDensitySnapshot() + delta))
    localStorage.setItem(DENSITY_STORAGE_KEY, String(next))
    window.dispatchEvent(new Event(DENSITY_CHANGE_EVENT))
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
            onClick={() => stepDensity(1)}
            disabled={density >= MAX_DENSITY}
            aria-label="Loitonna (pienemmät rivit)"
            title="Loitonna (pienemmät rivit)"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => stepDensity(-1)}
            disabled={density <= 0}
            aria-label="Lähennä (suuremmat rivit)"
            title="Lähennä (suuremmat rivit)"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <PublishButton days={days} viewStart={initialViewStart} viewEnd={initialViewEnd} onPublished={handlePublished} />
      </div>
      <main className="flex-1 p-4">
        <ScheduleWithRealtime days={days} setDays={setDays} publishRef={publishRef} parents={parents} viewStart={initialViewStart} viewEnd={initialViewEnd} currentParentId={currentParentId} density={density} />
        <ExtendPanel scheduleEndDate={scheduleEndDate} lastWeekStartParent={lastWeekStartParent} parents={parents} />
        <ClearPanel childCount={childCount} />
      </main>
    </div>
  )
}
