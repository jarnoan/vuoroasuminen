"use client"

import React, { useEffect, useCallback, useState, useRef } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { getISOWeek } from "date-fns"
import { toggleCell, saveNotes, clearCell } from "@/actions/schedule"
import type { ScheduleDay, ParentId } from "@/lib/schedule/types"
import { ScheduleCell } from "./schedule-cell"
import { NotesCell } from "./notes-cell"

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
}

export function ScheduleTable({ days, setDays, realtimeRef, publishRef, parents, currentParentId }: ScheduleTableProps) {

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

    // Optimistic update
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        cells: day.cells.map((cell) =>
          cell.entryId === entryId ? { ...cell, parentId: newParentId } : cell
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
            cell.entryId === entryId ? { ...cell, parentId: priorParentId } : cell
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

  return (
    <div>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-semibold whitespace-nowrap border-b sticky left-0 z-10 bg-background">
                Päivä
              </th>
              {childNames.map((name) => (
                <th
                  key={name}
                  className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[72px] sm:min-w-[90px]"
                >
                  {name}
                </th>
              ))}
              <th className="px-1 py-2 text-left text-sm font-semibold border-b min-w-[160px] max-sm:hidden">
                Muistiinpanot
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <React.Fragment key={day.date}>
                {day.isWeekStart && (
                  <tr>
                    <td
                      colSpan={colCount}
                      className="px-3 pt-3 pb-1 text-xs text-muted-foreground"
                    >
                      Viikko {getISOWeek(new Date(day.date))}
                    </td>
                  </tr>
                )}
                <tr
                  data-date={day.date}
                  data-today={day.isToday ? "true" : undefined}
                  className={[
                    day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20 scroll-mt-10" : "scroll-mt-10",
                    (day.notes || notesOpenDates.has(day.date)) ? "max-sm:[&>td]:border-b-0 max-sm:[&>td]:pb-0" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td
                    className="px-3 py-2 text-sm whitespace-nowrap font-mono sticky left-0 bg-background data-[today=true]:bg-yellow-50 dark:data-[today=true]:bg-yellow-950/20"
                    data-today={day.isToday ? "true" : undefined}
                  >
                    {day.dayLabel}
                  </td>
                  {day.cells.map((cell) => (
                    <td key={cell.childId} className="px-1 py-1">
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
                          className="w-full h-full min-h-[40px] rounded-md text-sm text-muted-foreground bg-muted/30 hover:bg-muted transition-colors"
                          onClick={() => handleAssignEmpty(cell.entryId, cell.childId, day.date)}
                          title="Lisää merkintä"
                          aria-label={`Lisää merkintä — ${cell.childName} ${day.dayLabel}`}
                        >
                          —
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-1 max-sm:table-cell sm:hidden">
                    {!day.notes && !notesOpenDates.has(day.date) ? (
                      <button
                        type="button"
                        onClick={() => setNotesOpenDates(prev => new Set(prev).add(day.date))}
                        aria-label={`Lisää muistiinpano — ${day.dayLabel}`}
                        className="text-muted-foreground hover:text-foreground"
                        style={{ touchAction: "manipulation" }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                  <td className="px-1 py-1 max-sm:hidden">
                    <NotesCell
                      entryId={day.notesEntryId}
                      value={day.notes}
                      onSave={handleNoteSave}
                    />
                  </td>
                </tr>
                {(day.notes || notesOpenDates.has(day.date)) && (
                  <tr className="max-sm:table-row sm:hidden">
                    <td
                      className={[
                        "sticky left-0 pt-0 pb-1",
                        day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-background",
                      ].join(" ")}
                    />
                    <td colSpan={colCount - 1} className="pt-0 pb-1 pr-1">
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
            ))}
          </tbody>
        </table>
      </div>
  )
}
