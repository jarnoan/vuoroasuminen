"use client"

import React, { useEffect, useCallback, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
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
  renderAbove?: (days: ScheduleDay[]) => React.ReactNode
  parents: Array<{ id: ParentId; name: string }>
}

export function ScheduleTable({ days, setDays, realtimeRef, publishRef, renderAbove, parents }: ScheduleTableProps) {

  // Expose a callback for realtime updates
  const handleRealtimeEntry = useCallback((entry: RealtimeEntry) => {
    setDays(prev => prev.map(day => {
      if (day.date !== entry.day) return day
      return {
        ...day,
        cells: day.cells.map(cell =>
          cell.entryId === entry.id || (cell.childId === entry.childId && cell.entryId === null)
            ? { ...cell, entryId: entry.id, parentId: entry.parentId, status: entry.status }
            : cell
        ),
        notes: entry.notes ?? day.notes,
        notesEntryId: day.notesEntryId === entry.id ? entry.id : day.notesEntryId,
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
      todayRow.scrollIntoView({ behavior: "instant", block: "center" })
    }
  }, [])

  const [notesOpenDates, setNotesOpenDates] = useState<Set<string>>(new Set())

  async function handleToggle(entryId: string, newParentId: ParentId) {
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
      // Revert on failure
      const revertParentId: ParentId = newParentId === "father" ? "mother" : "father"
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          cells: day.cells.map((cell) =>
            cell.entryId === entryId ? { ...cell, parentId: revertParentId } : cell
          ),
        }))
      )
      toast.error("Tallennus epäonnistui. Yritä uudelleen.")
    }
  }

  async function handleClear(entryId: string) {
    // Capture prior state so we can revert on failure
    let priorParentId: ParentId | null = null
    let priorStatus: "draft" | "published" = "draft"
    setDays((prev) => {
      // Capture & optimistically null the cell in a single pass
      return prev.map((day) => ({
        ...day,
        cells: day.cells.map((cell) => {
          if (cell.entryId !== entryId) return cell
          priorParentId = cell.parentId
          priorStatus = cell.status
          return { ...cell, parentId: null, status: "draft" as const }
        }),
      }))
    })

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

    // Capture for revert
    let priorParentId: ParentId | null = null
    let priorStatus: "draft" | "published" = "draft"
    setDays((prev) =>
      prev.map((d) => {
        if (d.date !== day) return d
        return {
          ...d,
          cells: d.cells.map((cell) => {
            if (cell.childId !== childId) return cell
            priorParentId = cell.parentId
            priorStatus = cell.status
            return { ...cell, parentId: "father" as ParentId, status: "draft" as const }
          }),
        }
      })
    )

    try {
      await toggleCell(entryId, "father")
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
    setDays((prev) =>
      prev.map((day) =>
        day.notesEntryId === entryId ? { ...day, notes } : day
      )
    )
    try {
      await saveNotes(entryId, notes)
    } catch {
      toast.error("Muistiinpanon tallennus epäonnistui.")
    }
  }

  // Derive column headers from first day's cells
  const childNames = days[0]?.cells.map((c) => c.childName) ?? []
  const colCount = childNames.length + 2 // Date + children + Notes

  return (
    <>
      <div className="sm:overflow-y-auto sm:h-[calc(100svh-8rem)]">
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
            {days.map((day, index) => (
              <React.Fragment key={day.date}>
                {day.isWeekStart && index > 0 && (
                  <tr key={`sep-${day.date}`}>
                    <td
                      colSpan={colCount}
                      className="h-px bg-border"
                    />
                  </tr>
                )}
                <tr
                  key={day.date}
                  data-date={day.date}
                  data-today={day.isToday ? "true" : undefined}
                  className={day.isToday ? "bg-yellow-50 dark:bg-yellow-950/20" : undefined}
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
                        <PlusIcon className="h-4 w-4" />
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
                    <td colSpan={colCount} className="px-1 py-1 pb-1">
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
    </>
  )
}
