"use client"

import React, { useEffect, useCallback, useState, useRef } from "react"
import { ChevronDown, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { getISOWeek } from "date-fns"
import { toggleCell, saveNotes, clearCell } from "@/actions/schedule"
import type { ScheduleDay, ParentId } from "@/lib/schedule/types"
import { ScheduleCell } from "./schedule-cell"
import { NotesCell } from "./notes-cell"
import { computeZoomVars } from "./row-zoom"
import { usePinchZoom } from "./use-pinch-zoom"
import { MobileSummaryPanel, SplitBar, parentName, useScheduleStats } from "./stats-panel"

type RealtimeEntry = {
  id: string
  childId: string
  day: string
  parentId: ParentId | null
  status: "draft" | "published"
  notes: string | null
}

interface ScheduleTableProps {
  days: ScheduleDay[]
  setDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>
  realtimeRef?: React.RefObject<((entry: RealtimeEntry) => void) | null>
  publishRef?: React.RefObject<(() => void) | null>
  parents: Array<{ id: ParentId; name: string }>
  currentParentId?: ParentId
  zoom?: number
  onAddWeeks?: () => void  // phones: end-of-schedule "Lisää viikkoja" button
}

export function ScheduleTable({ days, setDays, realtimeRef, publishRef, parents, currentParentId, zoom = 1, onAddWeeks }: ScheduleTableProps) {
  const stats = useScheduleStats(days, parents)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  usePinchZoom(wrapperRef)

  // Expose a callback for realtime updates
  const handleRealtimeEntry = useCallback((entry: RealtimeEntry) => {
    setDays(prev => prev.map(day => {
      if (day.date !== entry.day) return day
      const isNotesEntry = day.notesEntryId === entry.id
      return {
        ...day,
        cells: day.cells.map(cell =>
          (cell.entryId === entry.id && cell.childId === entry.childId)
            || (cell.childId === entry.childId && cell.entryId === null)
            ? { ...cell, entryId: entry.id, parentId: entry.parentId, status: entry.status }
            : cell
        ),
        // Only update notes when this realtime event is for the notes-bearing entry
        notes: isNotesEntry ? (entry.notes ?? "") : day.notes,
        notesEntryId: isNotesEntry ? entry.id : day.notesEntryId,
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

  // Auto-scroll to today on mount
  useEffect(() => {
    const todayRow = document.querySelector('[data-today="true"]')
    if (todayRow) {
      todayRow.scrollIntoView({ behavior: "instant", block: "start" })
    }
  }, [])

  const [notesOpenDates, setNotesOpenDates] = useState<Set<string>>(new Set())
  const prevDaysLengthRef = useRef(days.length)
  useEffect(() => {
    if (days.length !== prevDaysLengthRef.current) {
      setNotesOpenDates(new Set())
      prevDaysLengthRef.current = days.length
    }
  }, [days.length])

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

  async function handleNoteSave(entryId: string, notes: string) {
    // Capture prior value before optimistic update
    let priorNotes = ""
    for (const day of days) {
      if (day.notesEntryId === entryId) { priorNotes = day.notes; break }
    }

    setDays((prev) =>
      prev.map((day) =>
        day.notesEntryId === entryId ? { ...day, notes } : day
      )
    )
    try {
      await saveNotes(entryId, notes)
    } catch {
      // Only revert if the local state still matches what we optimistically set
      setDays((prev) =>
        prev.map((day) =>
          day.notesEntryId === entryId && day.notes === notes
            ? { ...day, notes: priorNotes }
            : day
        )
      )
      toast.error("Muistiinpanon tallennus epäonnistui.")
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
            <col className="max-sm:w-[84px] sm:w-[150px]" />
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
            {days.map((day) => {
              const [weekday, date] = splitDayLabel(day.dayLabel)
              const hasNoteRow = Boolean(day.notes) || notesOpenDates.has(day.date)
              const rowBg = day.isToday ? "bg-today" : "bg-background"
              return (
              <React.Fragment key={day.date}>
                {day.isWeekStart && (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="pl-4 pb-1.5 font-heading text-sm font-bold"
                      style={{ paddingTop: "var(--week-pt)" }}
                    >
                      Viikko {getISOWeek(new Date(day.date))}
                    </td>
                  </tr>
                )}
                <tr
                  data-date={day.date}
                  data-today={day.isToday ? "true" : undefined}
                  className={[
                    "scroll-mt-14",
                    day.isToday ? "bg-today" : "",
                    hasNoteRow ? "max-sm:[&>td]:pb-0" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td
                    className={`pl-3 pr-1 sm:pl-4 sm:pr-2 text-sm whitespace-nowrap sticky left-0 ${rowBg}`}
                    style={{ paddingTop: "var(--date-py)", paddingBottom: "var(--date-py)" }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-[1.6em] ${day.isToday ? "font-semibold" : "text-muted-foreground"}`}>{weekday}</span>
                      <span className="font-semibold tabular-nums">{date}</span>
                      {day.isToday && (
                        <span className="max-sm:hidden rounded-full bg-today-badge text-today-badge-fg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                          Tänään
                        </span>
                      )}
                    </span>
                  </td>
                  {day.cells.map((cell) => (
                    <td key={cell.childId} className="px-1" style={{ paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }}>
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
                  <td className="px-1 max-sm:table-cell sm:hidden text-center" style={{ paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }}>
                    {!hasNoteRow ? (
                      <button
                        type="button"
                        onClick={() => setNotesOpenDates(prev => new Set(prev).add(day.date))}
                        aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
                        className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted"
                        style={{ touchAction: "manipulation" }}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 max-sm:hidden">
                    <NotesCell
                      entryId={day.notesEntryId}
                      value={day.notes}
                      onSave={handleNoteSave}
                    />
                  </td>
                </tr>
                {hasNoteRow && (
                  <tr className={`max-sm:table-row sm:hidden ${day.isToday ? "bg-today" : ""}`}>
                    <td className={`sticky left-0 pt-0 pb-1.5 ${rowBg}`} />
                    <td colSpan={colCount - 1} className="pt-0.5 pb-1.5 pr-2">
                      <NotesCell
                        entryId={day.notesEntryId}
                        value={day.notes}
                        onSave={(entryId, notes) => {
                          handleNoteSave(entryId, notes)
                          if (!notes) {
                            setNotesOpenDates(prev => {
                              const next = new Set(prev)
                              next.delete(day.date)
                              return next
                            })
                          }
                        }}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {onAddWeeks && (
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
    </div>
  )
}

// "ma 9.11." → ["ma", "9.11."]
function splitDayLabel(label: string): [string, string] {
  const i = label.indexOf(" ")
  return i < 0 ? ["", label] : [label.slice(0, i), label.slice(i + 1)]
}
