"use client"

import React, { useRef, useCallback } from "react"
import { ScheduleTable } from "./schedule-table"
import { RealtimeProvider, type NoteChange } from "./realtime-provider"
import type { DateWindow, DayNote, ParentId, ScheduleDay } from "@/lib/schedule/types"

type EntryUpdate = {
  id: string
  childId: string
  day: string
  parentId: ParentId | null
  status: "draft" | "published"
}

interface ScheduleWithRealtimeProps {
  days: ScheduleDay[]
  setDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>
  notes: DayNote[]
  setNotes: React.Dispatch<React.SetStateAction<DayNote[]>>
  publishRef?: React.RefObject<(() => void) | null>
  parents: Array<{ id: ParentId; name: string }>
  viewStart?: string
  viewEnd?: string
  currentParentId?: ParentId
  zoom?: number
  onAddWeeks?: () => void
  scrollToTodayRef?: React.RefObject<boolean>
}

export function ScheduleWithRealtime({ days, setDays, notes, setNotes, publishRef, parents, viewStart, viewEnd, currentParentId, zoom, onAddWeeks, scrollToTodayRef }: ScheduleWithRealtimeProps) {
  const realtimeRef = useRef<((entry: EntryUpdate) => void) | null>(null)

  const handleEntryChange = useCallback((entry: EntryUpdate) => {
    realtimeRef.current?.(entry)
  }, [])

  const handleRefresh = useCallback((data: DateWindow) => {
    setDays(data.days)
    setNotes(data.notes)
  }, [setDays, setNotes])

  const handleNoteChange = useCallback((change: NoteChange) => {
    if (change.type === "delete") {
      setNotes(prev => prev.filter(n => n.id !== change.id))
    } else {
      setNotes(prev => [...prev.filter(n => n.id !== change.note.id), change.note])
    }
  }, [setNotes])

  return (
    <RealtimeProvider onEntryChange={handleEntryChange} onNoteChange={handleNoteChange} onRefresh={handleRefresh} viewStart={viewStart} viewEnd={viewEnd}>
      <ScheduleTable
        days={days}
        setDays={setDays}
        notes={notes}
        setNotes={setNotes}
        realtimeRef={realtimeRef}
        publishRef={publishRef}
        parents={parents}
        currentParentId={currentParentId}
        zoom={zoom}
        onAddWeeks={onAddWeeks}
        scrollToTodayRef={scrollToTodayRef}
      />
    </RealtimeProvider>
  )
}
