"use client"

import React, { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { Minus, Plus } from "lucide-react"
import { PublishButton } from "./publish-button"
import { ScheduleWithRealtime } from "./schedule-with-realtime"
import { ViewToolbar } from "./view-toolbar"
import { ExtendCard, ExtendSheet } from "./extend-panel"
import { ClearCard, ClearDialog } from "./clear-panel"
import { StatsCard } from "./stats-panel"
import { MobileActionsMenu } from "./mobile-actions-menu"
import { OwnerWarningBanner } from "@/components/owner-warning-banner"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getScheduleView } from "@/actions/schedule"
import type { DateWindow, DayNote, ScheduleDay, ParentId } from "@/lib/schedule/types"
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  subscribeToRowZoom,
  getRowZoomSnapshot,
  getRowZoomServerSnapshot,
  setRowZoom,
} from "./row-zoom"
import { saveViewRange, type ViewRange } from "./view-range-storage"

interface DashboardShellProps {
  initialData: DateWindow
  // The explicit bounds initialData was loaded with (empty = default window)
  initialView: ViewRange
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
  initialView,
  scheduleEndDate,
  lastWeekStartParent,
  header,
  showOwnerWarning = false,
  parents,
  childCount,
  currentParentId,
}: DashboardShellProps) {
  // The displayed range lives here (not in the URL) and is remembered per device in a
  // cookie; the server reads it and passes it as initialView. undefined bounds = server
  // default (12 weeks from this week's Monday).
  const [view, setView] = useState<ViewRange>(initialView)
  const [bounds, setBounds] = useState({ startDate: initialData.startDate, endDate: initialData.endDate })
  const [days, setDays] = useState<ScheduleDay[]>(initialData.days)
  const [notes, setNotes] = useState<DayNote[]>(initialData.notes)
  const [loading, setLoading] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const publishRef = useRef<(() => void) | null>(null)
  const loadSeqRef = useRef(0)
  // Scroll to today on first load; afterwards only when a range change asks for it
  const scrollToTodayRef = useRef(true)

  const loadView = useCallback(async (next: { viewStart?: string; viewEnd?: string }, opts?: { scrollToToday?: boolean }) => {
    const seq = ++loadSeqRef.current
    scrollToTodayRef.current = !!opts?.scrollToToday
    setLoading(true)
    try {
      const result = await getScheduleView(next.viewStart, next.viewEnd)
      if (seq !== loadSeqRef.current) return // a newer request superseded this one
      setView({ viewStart: result.viewStart, viewEnd: result.viewEnd })
      saveViewRange({ viewStart: result.viewStart, viewEnd: result.viewEnd })
      setBounds({ startDate: result.window.startDate, endDate: result.window.endDate })
      setDays(result.window.days)
      setNotes(result.window.notes)
    } catch {
      if (seq === loadSeqRef.current) toast.error("Aikataulun lataaminen epäonnistui. Yritä uudelleen.")
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [])

  const router = useRouter()
  const reloadView = useCallback(() => loadView(view), [loadView, view])
  // Clearing can move the schedule's last assigned day, so also refresh server props
  const handleCleared = useCallback(() => {
    reloadView()
    router.refresh()
  }, [reloadView, router])

  const zoom = useSyncExternalStore(subscribeToRowZoom, getRowZoomSnapshot, getRowZoomServerSnapshot)
  const stepZoom = useCallback((delta: number) => {
    setRowZoom(getRowZoomSnapshot() + delta)
  }, [])


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

  const extendProps = {
    scheduleEndDate,
    lastWeekStartParent,
    parents,
    onExtended: (newStartDate: string) => loadView({ viewStart: newStartDate }),
  }

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      {showOwnerWarning && <OwnerWarningBanner />}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-3 pt-3 pb-24 sm:px-8 sm:pt-6 sm:pb-10">
        {/* Toolbar: range (+ ⋯ on phones) left; zoom + publish right on desktop */}
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
          <h1 className="max-sm:hidden font-heading text-2xl font-bold tracking-tight">Aikataulu</h1>
          <ViewToolbar
            viewStart={view.viewStart}
            viewEnd={view.viewEnd}
            resolvedStart={bounds.startDate}
            resolvedEnd={bounds.endDate}
            hasLaterDays={scheduleEndDate > bounds.endDate}
            onChange={loadView}
          />
          <MobileActionsMenu onExtend={() => setExtendOpen(true)} onClear={() => setClearOpen(true)} />
          <div className="sm:ml-auto flex items-center gap-2">
            <div className="max-sm:hidden inline-flex items-center bg-background border rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => stepZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Loitonna (pienemmät rivit)"
                title="Loitonna (pienemmät rivit)"
                className="size-9 rounded-lg inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Lähennä (suuremmat rivit)"
                title="Lähennä (suuremmat rivit)"
                className="size-9 rounded-lg inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            {/* Toolbar button on desktop; a floating pill on phones */}
            <PublishButton days={days} viewStart={view.viewStart} viewEnd={view.viewEnd} onPublished={handlePublished} />
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div
            className={`min-w-0 ${loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}`}
            style={{ flex: "999 1 640px" }}
            aria-busy={loading}
          >
            {/* Keyed by the loaded window: remounts on range change so the realtime
                subscription uses the new range and the table re-scrolls to today. */}
            <ScheduleWithRealtime key={`${bounds.startDate}_${bounds.endDate}`} days={days} setDays={setDays} notes={notes} setNotes={setNotes} publishRef={publishRef} parents={parents} viewStart={view.viewStart} viewEnd={view.viewEnd} currentParentId={currentParentId} zoom={zoom} onAddWeeks={() => setExtendOpen(true)} scrollToTodayRef={scrollToTodayRef} />
          </div>
          <aside className="max-sm:hidden min-w-0 flex flex-col gap-4" style={{ flex: "1 1 320px" }}>
            <StatsCard days={days} parents={parents} />
            <ExtendCard {...extendProps} />
            <ClearCard onOpen={() => setClearOpen(true)} />
          </aside>
        </div>
      </main>
      <ExtendSheet open={extendOpen} onOpenChange={setExtendOpen} {...extendProps} />
      <ClearDialog open={clearOpen} onOpenChange={setClearOpen} childCount={childCount} onCleared={handleCleared} />
    </div>
  )
}
