import type { ParentId } from "@/config/app"

export type { ParentId } from "@/config/app"

export interface ScheduleCell {
  entryId: string | null      // null = no DB row yet
  childId: string
  childName: string
  parentId: ParentId | null   // null = cleared (row exists, no parent assigned)
  status: "draft" | "published"
}

export interface ScheduleDay {
  date: string                // ISO date "2026-04-05"
  dayLabel: string            // "Mon 6 Apr" — human-readable
  isToday: boolean
  isWeekStart: boolean        // true for Mondays — used by week separator (D-02)
  cells: ScheduleCell[]       // one per child, ordered by config.children
  notes: string               // shared notes for the day (from first entry's notes or "")
  notesEntryId: string | null // the entry ID that holds the notes (first child's entry)
}

export interface DateWindow {
  startDate: string           // ISO date
  endDate: string             // ISO date
  days: ScheduleDay[]         // 84 days
}
