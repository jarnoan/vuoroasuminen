"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { addDays, format, parseISO } from "date-fns"
import { Plus } from "lucide-react"
import { MAX_NOTE_DAYS, isMultiDay, noteDayCount, type DayNoteSlot, type NoteInput } from "@/lib/schedule/notes"
import type { DayNote } from "@/lib/schedule/types"
import { NotesCell } from "./notes-cell"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TONES = [
  { bg: "bg-note-1", ink: "text-note-1-ink", meta: "text-note-1-meta" },
  { bg: "bg-note-2", ink: "text-note-2-ink", meta: "text-note-2-meta" },
  { bg: "bg-note-3", ink: "text-note-3-ink", meta: "text-note-3-meta" },
]
export const noteTone = (lane: number) => TONES[lane % TONES.length]

// "9.–11.11. · 3 pv", or "30.11.–2.12. · 3 pv" across months
export function formatNoteRange(note: Pick<DayNote, "startDay" | "endDay">): string {
  const s = parseISO(note.startDay)
  const e = parseISO(note.endDay)
  const range = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
    ? `${format(s, "d.")}–${format(e, "d.M.")}`
    : `${format(s, "d.M.")}–${format(e, "d.M.")}`
  return `${range} · ${noteDayCount(note)} pv`
}

// A multi-day slot that also covers the previous day (it continues through a week header)
export const continuesFromPrevDay = (slot: DayNoteSlot) => slot.part === "mid" || slot.part === "end"

export interface NoteHandlers {
  open: (note: DayNote) => void
  add: (date: string) => void
  create: (input: NoteInput) => void
  update: (id: string, input: NoteInput) => void
  remove: (id: string) => void
  startDrag: (note: DayNote, e: ReactPointerEvent<HTMLElement>) => void
  nudge: (note: DayNote, delta: number) => void
  draggingId: string | null
}

// ---------------------------------------------------------------------------
// Drag to extend (desktop)
// ---------------------------------------------------------------------------

// Dragging a note's bottom handle moves its end day to the row under the pointer. While the
// drag runs the note is shown with the provisional end (displayNotes); releasing saves it.
export function useNoteDrag(notes: DayNote[], update: (id: string, input: NoteInput) => void) {
  const [drag, setDrag] = useState<{ noteId: string; endDay: string } | null>(null)
  const refocusRef = useRef<string | null>(null)

  const displayNotes = useMemo(
    () => (drag ? notes.map(n => (n.id === drag.noteId ? { ...n, endDay: drag.endDay } : n)) : notes),
    [notes, drag],
  )

  const clampEnd = (note: DayNote, end: string) => {
    if (end < note.startDay) return note.startDay
    const max = format(addDays(parseISO(note.startDay), MAX_NOTE_DAYS - 1), "yyyy-MM-dd")
    return end > max ? max : end
  }

  const startDrag = useCallback((note: DayNote, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2   // probe the rows straight below the notes column
    let endDay = note.endDay
    setDrag({ noteId: note.id, endDay })
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = "ns-resize"
    document.body.style.userSelect = "none"

    // The handle re-mounts in another row as the end moves, so listen on window
    // rather than relying on pointer capture.
    const onMove = (ev: PointerEvent) => {
      const row = document.elementFromPoint(x, ev.clientY)?.closest<HTMLElement>("tr[data-date]")
      const date = row?.dataset.date
      if (!date) return
      const next = clampEnd(note, date)
      if (next !== endDay) {
        endDay = next
        setDrag({ noteId: note.id, endDay: next })
      }
    }
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
      window.removeEventListener("keydown", onKey)
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = ""
      setDrag(null)
      if (commit && endDay !== note.endDay) update(note.id, { startDay: note.startDay, endDay, text: note.text })
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") finish(false) }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    window.addEventListener("keydown", onKey)
  }, [update])

  // Keyboard alternative: ArrowUp/ArrowDown on the handle shortens/extends by a day
  const nudge = useCallback((note: DayNote, delta: number) => {
    const next = clampEnd(note, format(addDays(parseISO(note.endDay), delta), "yyyy-MM-dd"))
    if (next === note.endDay) return
    refocusRef.current = note.id
    update(note.id, { startDay: note.startDay, endDay: next, text: note.text })
  }, [update])

  // The handle moved to a different row: put keyboard focus back on it
  useEffect(() => {
    const id = refocusRef.current
    if (!id) return
    refocusRef.current = null
    document.querySelector<HTMLElement>(`[data-note-handle="${CSS.escape(id)}"]`)?.focus()
  })

  return { displayNotes, startDrag, nudge, draggingId: drag?.noteId ?? null }
}

function DragHandle({ note, handlers }: { note: DayNote; handlers: NoteHandlers }) {
  const days = noteDayCount(note)
  const active = handlers.draggingId === note.id
  return (
    <span
      role="slider"
      tabIndex={0}
      data-note-handle={note.id}
      aria-label={`Muistiinpanon kesto: ${note.text}`}
      aria-valuemin={1}
      aria-valuemax={MAX_NOTE_DAYS}
      aria-valuenow={days}
      aria-valuetext={`${days} pv`}
      title="Vedä pidentääksesi"
      onPointerDown={(e) => handlers.startDrag(note, e)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); handlers.nudge(note, 1) }
        if (e.key === "ArrowUp") { e.preventDefault(); handlers.nudge(note, -1) }
      }}
      className={`absolute left-1/2 -translate-x-1/2 bottom-0 z-[1] h-3 w-10 flex items-center justify-center cursor-ns-resize touch-none focus-visible:outline-none group/handle ${active ? "opacity-100" : "opacity-0 group-hover/note:opacity-100 focus-visible:opacity-100"}`}
    >
      <span className="h-1 w-6 rounded-full bg-foreground/35 group-hover/handle:bg-foreground/60 group-focus-visible/handle:bg-ring" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Desktop notes column
// ---------------------------------------------------------------------------

const lanesGrid = (lanes: number): CSSProperties => ({
  gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr)) 1.75rem`,
})

// Contents of the desktop notes cell for one day. Without notes it's an inline input; with
// notes it's a grid of lanes (side-by-side when notes overlap) plus an add button.
export function DesktopDayNotes({
  date, dayLabel, slots, laneCount, isWindowStart, handlers,
}: {
  date: string
  dayLabel: string
  slots: DayNoteSlot[]
  laneCount: number
  isWindowStart: boolean
  handlers: NoteHandlers
}) {
  if (slots.length === 0) {
    return (
      <div className="px-2 h-full flex items-center" style={{ paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }}>
        <NotesCell
          value=""
          ariaLabel={`Lisää muistiinpano — ${dayLabel}`}
          onCommit={(text) => { if (text) handlers.create({ startDay: date, endDay: date, text }) }}
        />
      </div>
    )
  }

  const lanes = Array.from({ length: Math.max(laneCount, 1) }, (_, lane) => slots.find(s => s.lane === lane))
  return (
    <div className="h-full grid gap-x-1 px-2" style={lanesGrid(lanes.length)}>
      {lanes.map((slot, lane) => {
        if (!slot) return <div key={`empty-${lane}`} />
        if (slot.part === "single") {
          return (
            <div key={slot.note.id} className="relative group/note min-w-0 flex items-center" style={{ paddingTop: "var(--row-py)", paddingBottom: "var(--row-py)" }}>
              <NotesCell
                value={slot.note.text}
                ariaLabel={`Muistiinpano — ${dayLabel}`}
                className={laneCount > 1 ? "bg-muted" : ""}
                onCommit={(text) => text
                  ? handlers.update(slot.note.id, { startDay: slot.note.startDay, endDay: slot.note.endDay, text })
                  : handlers.remove(slot.note.id)}
              />
              <DragHandle note={slot.note} handlers={handlers} />
            </div>
          )
        }
        return <MultiDayPiece key={slot.note.id} slot={slot} showLabel={slot.part === "start" || isWindowStart} handlers={handlers} />
      })}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => handlers.add(date)}
          aria-label={`Lisää muistiinpano — ${dayLabel}`}
          title="Lisää muistiinpano"
          className="size-7 rounded-lg inline-flex items-center justify-center text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function MultiDayPiece({ slot, showLabel, handlers }: { slot: DayNoteSlot; showLabel: boolean; handlers: NoteHandlers }) {
  const { note, part, lane } = slot
  const tone = noteTone(lane)
  const isStart = part === "start"
  const isEnd = part === "end"
  return (
    <div
      className={`relative group/note min-w-0 ${tone.bg} ${isStart ? "rounded-t-lg" : ""} ${isEnd ? "rounded-b-lg" : ""}`}
      style={{ marginTop: isStart ? "var(--row-py)" : 0, marginBottom: isEnd ? "var(--row-py)" : 0 }}
    >
      <button
        type="button"
        onClick={() => handlers.open(note)}
        title={`${note.text} (${formatNoteRange(note)})`}
        aria-label={`Muokkaa muistiinpanoa: ${note.text}, ${formatNoteRange(note)}`}
        tabIndex={showLabel ? 0 : -1}
        className={`block w-full h-full text-left px-2 py-1 min-w-0 overflow-hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${isStart ? "rounded-t-lg" : ""} ${isEnd ? "rounded-b-lg" : ""}`}
      >
        {showLabel && (
          <>
            <span className={`block truncate text-[13px] font-semibold leading-tight ${tone.ink}`}>{note.text}</span>
            <span className={`block truncate text-[11px] font-medium leading-tight mt-0.5 ${tone.meta}`}>{formatNoteRange(note)}</span>
          </>
        )}
      </button>
      {isEnd && <DragHandle note={note} handlers={handlers} />}
    </div>
  )
}

// Desktop notes cell in a week-header row: keeps multi-day blocks continuous across the header
export function DesktopNotesContinuation({ slots, laneCount }: { slots: DayNoteSlot[]; laneCount: number }) {
  const continuing = slots.filter(continuesFromPrevDay)
  if (continuing.length === 0) return null
  const lanes = Array.from({ length: Math.max(laneCount, 1) }, (_, lane) => continuing.find(s => s.lane === lane))
  return (
    <div className="h-full grid gap-x-1 px-2" style={lanesGrid(lanes.length)} aria-hidden="true">
      {lanes.map((slot, lane) => <div key={lane} className={slot ? noteTone(slot.lane).bg : ""} />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile: rails in the date column + chips under the day
// ---------------------------------------------------------------------------

const RAIL_LANES = 2   // at most two rails fit beside the date

// Rails for multi-day notes, drawn at the right edge of the sticky date cell (which is the
// containing block). `top`/`bottom` per slot let the rail end flush with the cells.
export function MobileRails({
  slots, edges, left,
}: {
  slots: DayNoteSlot[]
  edges?: (slot: DayNoteSlot) => { top: string | number; bottom: string | number }
  left?: number   // position from the left instead (rows whose first cell is wider than the date column)
}) {
  const rails = slots.filter(s => isMultiDay(s.note) && s.lane < RAIL_LANES)
  if (rails.length === 0) return null
  return (
    <>
      {rails.map(slot => {
        const { top, bottom } = edges ? edges(slot) : { top: 0, bottom: 0 }
        const offset = 2 + slot.lane * 8
        return (
          <span
            key={slot.note.id}
            aria-hidden="true"
            className={`sm:hidden absolute w-1.5 ${noteTone(slot.lane).bg} ${slot.part === "start" ? "rounded-t-full" : ""} ${slot.part === "end" ? "rounded-b-full" : ""}`}
            style={{ top, bottom, ...(left !== undefined ? { left: left - offset - 6 } : { right: offset }) }}
          />
        )
      })}
    </>
  )
}

// Notes shown in the chip row under a day: those starting that day, plus (on the first day of
// the view) notes that started before it.
export function chipSlotsFor(slots: DayNoteSlot[], isWindowStart: boolean): DayNoteSlot[] {
  return slots.filter(s => s.part === "single" || s.part === "start" || (isWindowStart && continuesFromPrevDay(s)))
}

export function MobileNoteChips({ slots, onOpen }: { slots: DayNoteSlot[]; onOpen: (note: DayNote) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {slots.map(({ note, lane }) => {
        const multi = isMultiDay(note)
        const tone = noteTone(lane)
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpen(note)}
            className={`w-full text-left rounded-lg px-2.5 py-1.5 ${multi ? tone.bg : "bg-muted"}`}
            style={{ touchAction: "manipulation" }}
          >
            <span className={`block text-[13px] leading-snug font-medium break-words ${multi ? tone.ink : ""}`}>{note.text}</span>
            {multi && <span className={`block text-[11px] font-semibold mt-0.5 ${tone.meta}`}>{formatNoteRange(note)}</span>}
          </button>
        )
      })}
    </div>
  )
}
