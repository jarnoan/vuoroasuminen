"use client"

import React, { useEffect, useCallback, useMemo, useState, useRef } from "react"
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { getISOWeek } from "date-fns"
import { toggleCell, clearCell } from "@/actions/schedule"
import type { DayNote, ScheduleDay, ParentId } from "@/lib/schedule/types"
import { layoutNotes } from "@/lib/schedule/notes"
import { ScheduleCell } from "./schedule-cell"
import { useNoteActions, type SetNotes } from "./use-note-actions"
import { NoteEditor, type NoteEditorTarget } from "./note-editor"
import {
  DesktopDayNotes, DesktopNotesContinuation, MobileNoteChips, MobileRails,
  chipSlotsFor, continuesFromPrevDay, useNoteDrag, type NoteHandlers,
} from "./day-notes"
import { computeZoomVars } from "./row-zoom"
import { usePinchZoom } from "./use-pinch-zoom"
import { MobileSummaryPanel, SplitBar, parentName, useScheduleStats } from "./stats-panel"

type RealtimeEntry = {
  id: string
  childId: string
  day: string
  parentId: ParentId | null
  status: "draft" | "published"
}

interface ScheduleTableProps {
  days: ScheduleDay[]
  setDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>
  notes: DayNote[]
  setNotes: SetNotes
  realtimeRef?: React.RefObject<((entry: RealtimeEntry) => void) | null>
  publishRef?: React.RefObject<(() => void) | null>
  parents: Array<{ id: ParentId; name: string }>
  currentParentId?: ParentId
  zoom?: number
  onAddWeeks?: () => void  // phones: end-of-schedule "Lisää viikkoja" button
  // phones: shown instead of "Lisää viikkoja" when saved days exist after the shown range
  onNextPeriod?: () => void
  // Where to scroll at mount; reset to null afterwards. Lets the page scroll to today on
  // first load (and on "back to this week") but keep its position on other range changes.
  scrollOnMountRef?: React.RefObject<ScrollTarget>
}

export type ScrollTarget = "today" | "top" | null

export function ScheduleTable({ days, setDays, notes, setNotes, realtimeRef, publishRef, parents, currentParentId, zoom = 1, onAddWeeks, onNextPeriod, scrollOnMountRef }: ScheduleTableProps) {
  const stats = useScheduleStats(days, parents)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  usePinchZoom(wrapperRef)

  // Expose a callback for realtime updates
  const handleRealtimeEntry = useCallback((entry: RealtimeEntry) => {
    setDays(prev => prev.map(day => {
      if (day.date !== entry.day) return day
      return {
        ...day,
        cells: day.cells.map(cell =>
          (cell.entryId === entry.id && cell.childId === entry.childId)
            || (cell.childId === entry.childId && cell.entryId === null)
            ? { ...cell, entryId: entry.id, parentId: entry.parentId, status: entry.status }
            : cell
        ),
      }
    }))
  }, [])

  // Assign to ref so parent can call it
  useEffect(() => {
    if (realtimeRef && 'current' in realtimeRef) {
      (realtimeRef as React.MutableRefObject<typeof handleRealtimeEntry | null>).current = handleRealtimeEntry
    }
    return () => {
      if (realtimeRef && 'current' in realtimeRef) {
        (realtimeRef as React.MutableRefObject<typeof handleRealtimeEntry | null>).current = null
      }
    }
  }, [handleRealtimeEntry, realtimeRef])

  // Expose a callback to apply optimistic publish (draft → published) in local state
  const applyPublished = useCallback(() => {
    setDays(prev => prev.map(day => ({
      ...day,
      cells: day.cells.map(cell =>
        cell.status === "draft" ? { ...cell, status: "published" as const } : cell
      ),
    })))
  }, [])

  // Assign applyPublished to publishRef so parent can trigger it
  useEffect(() => {
    if (publishRef && 'current' in publishRef) {
      (publishRef as React.MutableRefObject<(() => void) | null>).current = applyPublished
    }
    return () => {
      if (publishRef && 'current' in publishRef) {
        (publishRef as React.MutableRefObject<(() => void) | null>).current = null
      }
    }
  }, [applyPublished, publishRef])

  // Scroll on mount, when requested (without a ref: always to today)
  useEffect(() => {
    const target = scrollOnMountRef ? scrollOnMountRef.current : "today"
    if (scrollOnMountRef) scrollOnMountRef.current = null
    if (target === "top") {
      window.scrollTo({ top: 0, behavior: "instant" })
    } else if (target === "today") {
      document.querySelector('[data-today="true"]')?.scrollIntoView({ behavior: "instant", block: "start" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  // Multi-day notes: optimistic actions, drag-to-extend and lane layout
  const noteActions = useNoteActions(setNotes)
  const { displayNotes, startDrag, nudge, draggingId } = useNoteDrag(notes, noteActions.update)
  const layout = useMemo(() => layoutNotes(displayNotes, days.map(d => d.date)), [displayNotes, days])
  const [editor, setEditor] = useState<NoteEditorTarget | null>(null)
  const noteHandlers: NoteHandlers = {
    open: (note) => setEditor({ note }),
    add: (date) => setEditor({ newOn: date }),
    create: noteActions.create,
    update: noteActions.update,
    remove: noteActions.remove,
    startDrag,
    nudge,
    draggingId,
  }

  async function handleToggle(entryId: string, newParentId: ParentId) {
    // Capture prior state before optimistic update
    let priorParentId: ParentId | null = null
    for (const day of days) {
      const cell = day.cells.find((c) => c.entryId === entryId)
      if (cell) { priorParentId = cell.parentId; break }
    }

    // Capture prior status too, for rollback on failure
    let priorStatus: "draft" | "published" = "draft"
    for (const day of days) {
      const cell = day.cells.find((c) => c.entryId === entryId)
      if (cell) { priorStatus = cell.status; break }
    }

    // Optimistic update — toggleCell always sets status to draft, so mirror that here
    // to avoid a flash of the old (possibly published) color before the server confirms.
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        cells: day.cells.map((cell) =>
          cell.entryId === entryId ? { ...cell, parentId: newParentId, status: "draft" as const } : cell
        ),
      }))
    )

    try {
      await toggleCell(entryId, newParentId)
    } catch {
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          cells: day.cells.map((cell) =>
            cell.entryId === entryId ? { ...cell, parentId: priorParentId, status: priorStatus } : cell
          ),
        }))
      )
      toast.error("Tallennus epäonnistui. Yritä uudelleen.")
    }
  }

  async function handleClear(entryId: string) {
    // Capture prior state from current prop snapshot — safe, synchronous
    let priorParentId: ParentId | null = null
    let priorStatus: "draft" | "published" = "draft"
    for (const day of days) {
      const cell = day.cells.find((c) => c.entryId === entryId)
      if (cell) {
        priorParentId = cell.parentId
        priorStatus = cell.status
        break
      }
    }

    // Optimistic clear
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        cells: day.cells.map((cell) =>
          cell.entryId === entryId
            ? { ...cell, parentId: null, status: "draft" as const }
            : cell
        ),
      }))
    )

    try {
      const result = await clearCell(entryId)
      if (!result.success) {
        throw new Error(result.error)
      }
    } catch {
      // Revert on failure
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          cells: day.cells.map((cell) =>
            cell.entryId === entryId
              ? { ...cell, parentId: priorParentId, status: priorStatus }
              : cell
          ),
        }))
      )
      toast.error("Tyhjennys epäonnistui. Yritä uudelleen.")
    }
  }

  async function handleAssignEmpty(entryId: string | null, childId: string, day: string) {
    if (!entryId) {
      // No DB row exists for this (childId, day) yet — extremely rare given queries.ts seeds
      // the full window. Fail silently with a toast; the user can re-publish to seed.
      toast.error("Solua ei voi merkitä — aikatauluriviä ei löydy.")
      return
    }

    // Capture prior state from current prop snapshot — safe, synchronous
    let priorParentId: ParentId | null = null
    let priorStatus: "draft" | "published" = "draft"
    const targetDay = days.find((d) => d.date === day)
    if (targetDay) {
      const cell = targetDay.cells.find((c) => c.childId === childId)
      if (cell) {
        priorParentId = cell.parentId
        priorStatus = cell.status
      }
    }

    const assignedParentId = currentParentId ?? parents[0]?.id
    if (!assignedParentId) {
      toast.error("Kirjaudu sisään merkintöjen lisäämiseksi.")
      return
    }

    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== day) return d
        return {
          ...d,
          cells: d.cells.map((cell) =>
            cell.childId === childId
              ? { ...cell, parentId: assignedParentId, status: "draft" as const }
              : cell
          ),
        }
      })
    )

    try {
      await toggleCell(entryId, assignedParentId)
    } catch {
      setDays((prev) =>
        prev.map((d) => {
          if (d.date !== day) return d
          return {
            ...d,
            cells: d.cells.map((cell) =>
              cell.childId === childId
                ? { ...cell, parentId: priorParentId, status: priorStatus }
                : cell
            ),
          }
        })
      )
      toast.error("Tallennus epäonnistui. Yritä uudelleen.")
    }
  }

  // Derive column headers from first day's cells
  const childNames = days[0]?.cells.map((c) => c.childName) ?? []
  const colCount = Math.max(childNames.length + 3, 1)
  const isiName = parentName(parents, "father")
  const aitiName = parentName(parents, "mother")
  const freeFor = (id: ParentId) => stats.parentFreeStats.find((p) => p.parentId === id)
  const headerPad = { paddingTop: "var(--header-py)", paddingBottom: "var(--header-py)" }

  return (
    <div className="bg-background border rounded-2xl overflow-clip">
      {/* Legend (+ free days on phones, where the sidebar is hidden) */}
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap px-3 sm:px-4 py-3 border-b text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-isi" aria-hidden="true" />
          {isiName}
          <span className="sm:hidden tabular-nums">
            · vapaat {freeFor("father")?.childFreeDays ?? 0} pv, {freeFor("father")?.childFreeWeekends ?? 0} vkl
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-aiti" aria-hidden="true" />
          {aitiName}
          <span className="sm:hidden tabular-nums">
            · {freeFor("mother")?.childFreeDays ?? 0} pv, {freeFor("mother")?.childFreeWeekends ?? 0} vkl
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] border-[1.5px] border-dashed border-muted-foreground/60" aria-hidden="true" />
          Luonnos
        </span>
        <span className="max-sm:hidden ml-auto font-normal">Napauta solua vaihtaaksesi vanhempaa</span>
      </div>

      <div ref={wrapperRef} style={{ ...computeZoomVars(zoom), touchAction: "pan-y" }}>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col className="max-sm:w-[92px] sm:w-[150px]" />
            {/* Mobile: child columns share the width. Desktop: fixed child columns,
                and the notes column (3rd col on desktop, since the mobile pencil
                cell is display:none) takes all remaining space. */}
            {childNames.map(name => <col key={name} className="sm:w-36" />)}
            <col className="max-sm:w-9" />
            <col className="w-0" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--color-border)]">
            <tr>
              <th className="pl-4 pr-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap sticky left-0 z-10 bg-background" style={headerPad}>
                <span className="max-sm:hidden">Päivä</span>
                {/* Phones: the header doubles as the summary toggle */}
                <button
                  type="button"
                  onClick={() => setSummaryOpen(o => !o)}
                  aria-expanded={summaryOpen}
                  aria-controls="mobile-summary"
                  aria-label={summaryOpen ? "Sulje yhteenveto" : "Näytä yhteenveto"}
                  className="sm:hidden size-8 -ml-1 rounded-lg border bg-background inline-flex items-center justify-center text-foreground aria-expanded:bg-muted"
                >
                  <ChevronDown className={`size-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </th>
              {stats.childStats.map((child) => (
                <th key={child.childName} className="px-1 text-left font-semibold min-w-[64px] sm:min-w-[90px]" style={headerPad}>
                  <span className="max-sm:hidden text-sm">{child.childName}</span>
                  <button
                    type="button"
                    onClick={() => setSummaryOpen(o => !o)}
                    aria-hidden="true"
                    tabIndex={-1}
                    className="sm:hidden w-full flex flex-col gap-1 text-left"
                  >
                    <span className="text-sm truncate">{child.childName}</span>
                    <SplitBar father={child.father} mother={child.mother} />
                    <span className="text-[11px] tabular-nums leading-none">
                      <span className="text-isi">{child.father}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-aiti-ink">{child.mother}</span>
                    </span>
                  </button>
                </th>
              ))}
              <th className="max-sm:hidden px-3 text-left text-xs font-semibold text-muted-foreground min-w-[160px]" style={headerPad}>
                Muistiinpanot
              </th>
              <th className="sm:hidden" />
            </tr>
            {summaryOpen && (
              <tr className="sm:hidden">
                <td colSpan={colCount} className="border-t bg-background">
                  <MobileSummaryPanel days={days} parents={parents} stats={stats} onClose={() => setSummaryOpen(false)} />
                </td>
              </tr>
            )}
          </thead>
          <tbody>
            {days.map((day, dayIndex) => {
              const [weekday, date] = splitDayLabel(day.dayLabel)
              const isWindowStart = dayIndex === 0
              const slots = layout.byDate.get(day.date) ?? []
              const laneCount = layout.laneCount.get(day.date) ?? 0
              const chips = chipSlotsFor(slots, isWindowStart)
              const hasNoteRow = chips.length > 0
              const rowBg = day.isToday ? "bg-today" : "bg-background"
              const rowPad = { paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }
              return (
              <React.Fragment key={day.date}>
                {day.isWeekStart && (
                  <tr>
                    <td
                      colSpan={childNames.length + 1}
                      className="relative pl-4 pb-1.5 font-heading text-sm font-bold"
                      style={{ paddingTop: "var(--week-pt)" }}
                    >
                      {!isWindowStart && <MobileRails slots={slots.filter(continuesFromPrevDay)} left={92} />}
                      <span className="relative bg-background pr-1">Viikko {getISOWeek(new Date(day.date))}</span>
                    </td>
                    <td className="sm:hidden" />
                    <td className="max-sm:hidden p-0 h-px">
                      {!isWindowStart && <DesktopNotesContinuation slots={slots} laneCount={laneCount} />}
                    </td>
                  </tr>
                )}
                <tr
                  data-date={day.date}
                  data-today={day.isToday ? "true" : undefined}
                  className={[
                    "scroll-mt-14 group/row",
                    day.isToday ? "bg-today" : "",
                    hasNoteRow ? "max-sm:[&>td]:pb-0" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td
                    className={`pl-2 pr-1 sm:pl-4 sm:pr-2 text-sm whitespace-nowrap sticky left-0 ${rowBg}`}
                    style={{ paddingTop: "var(--date-py)", paddingBottom: "var(--date-py)", lineHeight: "min(1.25rem, var(--cell-min-h))" }}
                  >
                    <MobileRails
                      slots={slots}
                      edges={(slot) => ({
                        top: slot.part === "start" ? "var(--row-py)" : 0,
                        bottom: slot.part === "end" && !hasNoteRow ? "var(--row-py)" : 0,
                      })}
                    />
                    <span className="inline-flex items-center gap-1 sm:gap-1.5">
                      <span className={`w-[1.4em] sm:w-[1.6em] ${day.isToday ? "font-semibold" : "text-muted-foreground"}`}>{weekday}</span>
                      <span className="font-semibold tabular-nums">{date}</span>
                      {day.isToday && (
                        <span className="max-sm:hidden rounded-full bg-today-badge text-today-badge-fg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                          Tänään
                        </span>
                      )}
                    </span>
                  </td>
                  {day.cells.map((cell) => (
                    <td key={cell.childId} className="px-1" style={rowPad}>
                      {cell.entryId && cell.parentId ? (
                        <ScheduleCell
                          entryId={cell.entryId}
                          parentId={cell.parentId}
                          status={cell.status}
                          childName={cell.childName}
                          onToggle={handleToggle}
                          onClear={handleClear}
                          parents={parents}
                        />
                      ) : (
                        <button
                          type="button"
                          className="w-full h-full rounded-[10px] border-[1.5px] border-dashed border-border text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                          style={{ minHeight: "var(--cell-min-h)", fontSize: "var(--cell-font)" }}
                          onClick={() => handleAssignEmpty(cell.entryId, cell.childId, day.date)}
                          title="Lisää merkintä"
                          aria-label={`Lisää merkintä — ${cell.childName} ${day.dayLabel}`}
                        >
                          +
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-1 max-sm:table-cell sm:hidden text-center" style={rowPad}>
                    <button
                      type="button"
                      onClick={() => setEditor({ newOn: day.date })}
                      aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
                      className="w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                      // Shrinks with the row zoom so the button doesn't hold compact rows open.
                      style={{ touchAction: "manipulation", height: "min(2rem, var(--cell-min-h))" }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </td>
                  <td className="max-sm:hidden p-0 h-px">
                    <DesktopDayNotes
                      date={day.date}
                      dayLabel={day.dayLabel}
                      slots={slots}
                      laneCount={laneCount}
                      isWindowStart={isWindowStart}
                      handlers={noteHandlers}
                    />
                  </td>
                </tr>
                {hasNoteRow && (
                  <tr className={`max-sm:table-row sm:hidden ${day.isToday ? "bg-today" : ""}`}>
                    <td className={`sticky left-0 p-0 ${rowBg}`}>
                      <MobileRails slots={slots.filter(s => s.part === "start" || s.part === "mid")} />
                    </td>
                    <td colSpan={colCount - 1} className="pt-0.5 pb-3 pr-2 pl-1">
                      <MobileNoteChips slots={chips} onOpen={(note) => setEditor({ note })} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {onNextPeriod ? (
        <div className="sm:hidden p-3 border-t">
          <button
            type="button"
            onClick={onNextPeriod}
            className="w-full h-12 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-muted"
          >
            Seuraava jakso
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : onAddWeeks && (
        <div className="sm:hidden p-3 border-t">
          <button
            type="button"
            onClick={onAddWeeks}
            className="w-full h-12 rounded-xl border-[1.5px] border-dashed text-sm font-semibold text-muted-foreground inline-flex items-center justify-center gap-2 hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            Lisää viikkoja
          </button>
        </div>
      )}

      <NoteEditor
        target={editor}
        onClose={() => setEditor(null)}
        onSave={(input, existing) => existing ? noteActions.update(existing.id, input) : noteActions.create(input)}
        onDelete={(note) => noteActions.remove(note.id)}
      />
    </div>
  )
}

// "ma 9.11." → ["ma", "9.11."]
function splitDayLabel(label: string): [string, string] {
  const i = label.indexOf(" ")
  return i < 0 ? ["", label] : [label.slice(0, i), label.slice(i + 1)]
}
