import { differenceInCalendarDays, isValid, parseISO } from "date-fns"
import type { DayNote } from "./types"

export const MAX_NOTE_LENGTH = 500
export const MAX_NOTE_DAYS = 366

export type NoteInput = { startDay: string; endDay: string; text: string }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Validates and normalises a note; returns an error message (Finnish, shown to the user) or the clean input.
export function validateNoteInput(input: NoteInput): { ok: true; value: NoteInput } | { ok: false; error: string } {
  const text = typeof input.text === "string" ? input.text.trim() : ""
  if (!text) return { ok: false, error: "Muistiinpano on tyhjä" }
  if (text.length > MAX_NOTE_LENGTH) return { ok: false, error: `Muistiinpano on liian pitkä (enintään ${MAX_NOTE_LENGTH} merkkiä)` }
  if (!ISO_DATE.test(input.startDay) || !ISO_DATE.test(input.endDay)) return { ok: false, error: "Virheellinen päivämäärä" }
  const start = parseISO(input.startDay)
  const end = parseISO(input.endDay)
  if (!isValid(start) || !isValid(end)) return { ok: false, error: "Virheellinen päivämäärä" }
  const days = differenceInCalendarDays(end, start) + 1
  if (days < 1) return { ok: false, error: "Päättymispäivä ei voi olla ennen alkamispäivää" }
  if (days > MAX_NOTE_DAYS) return { ok: false, error: `Muistiinpano voi kestää enintään ${MAX_NOTE_DAYS} päivää` }
  return { ok: true, value: { startDay: input.startDay, endDay: input.endDay, text } }
}

export function noteDayCount(note: Pick<DayNote, "startDay" | "endDay">): number {
  return differenceInCalendarDays(parseISO(note.endDay), parseISO(note.startDay)) + 1
}

export function isMultiDay(note: Pick<DayNote, "startDay" | "endDay">): boolean {
  return note.endDay > note.startDay
}

export type NotePart = "single" | "start" | "mid" | "end"

export interface DayNoteSlot {
  note: DayNote
  lane: number
  part: NotePart
}

export interface NoteLayout {
  // Per date (ISO): the notes covering it, ordered by lane
  byDate: Map<string, DayNoteSlot[]>
  // Per date: how many lanes its overlap group uses (≥ 1 when any note covers the date)
  laneCount: Map<string, number>
  // Per note id: its lane (stable within an overlap group)
  laneOf: Map<string, number>
}

// Assigns each note a lane so that overlapping notes sit side by side, like a calendar day
// view. Notes are placed earliest start first (longer first on ties) into the lowest free
// lane. Lane counts are per overlap group, so a group of days keeps a fixed number of lanes.
export function layoutNotes(notes: DayNote[], dates: string[]): NoteLayout {
  const sorted = [...notes].sort((a, b) =>
    a.startDay !== b.startDay ? (a.startDay < b.startDay ? -1 : 1)
      : a.endDay !== b.endDay ? (a.endDay > b.endDay ? -1 : 1)
      : a.id < b.id ? -1 : 1,
  )

  const laneOf = new Map<string, number>()
  const groupOf = new Map<string, number>()
  const groupLanes: number[] = []
  let laneEnds: string[] = []   // per lane: last endDay placed in the current group
  let groupEnd = ""
  let group = -1

  for (const note of sorted) {
    if (group < 0 || note.startDay > groupEnd) {
      // Starts a new overlap group
      group++
      groupLanes.push(0)
      laneEnds = []
      groupEnd = note.endDay
    } else if (note.endDay > groupEnd) {
      groupEnd = note.endDay
    }
    let lane = laneEnds.findIndex(end => end < note.startDay)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = note.endDay
    laneOf.set(note.id, lane)
    groupOf.set(note.id, group)
    groupLanes[group] = Math.max(groupLanes[group], lane + 1)
  }

  const byDate = new Map<string, DayNoteSlot[]>()
  const laneCount = new Map<string, number>()
  for (const date of dates) {
    const slots: DayNoteSlot[] = []
    let lanes = 0
    for (const note of sorted) {
      if (note.startDay > date || note.endDay < date) continue
      const part: NotePart = note.startDay === note.endDay ? "single"
        : date === note.startDay ? "start" : date === note.endDay ? "end" : "mid"
      slots.push({ note, lane: laneOf.get(note.id)!, part })
      lanes = Math.max(lanes, groupLanes[groupOf.get(note.id)!])
    }
    slots.sort((a, b) => a.lane - b.lane)
    byDate.set(date, slots)
    laneCount.set(date, lanes)
  }

  return { byDate, laneCount, laneOf }
}
