"use client"

import React, { useRef, useCallback } from "react"
import { ScheduleTable } from "./schedule-table"
import { StatsPanel } from "./stats-panel"
import { RealtimeProvider } from "./realtime-provider"
import type { DateWindow, ParentId, ScheduleDay } from "@/lib/schedule/types"

type EntryUpdate = {
  id: string
  childId: string
  day: string
  parentId: ParentId
  status: "draft" | "published"
  notes: string | null
}

interface ScheduleWithRealtimeProps {
  initialData: DateWindow
  onDaysChange?: (days: ScheduleDay[]) => void
  publishRef?: React.RefObject<(() => void) | null>
}

export function ScheduleWithRealtime({ initialData, onDaysChange, publishRef }: ScheduleWithRealtimeProps) {
  const realtimeRef = useRef<((entry: EntryUpdate) => void) | null>(null)

  const handleEntryChange = useCallback((entry: EntryUpdate) => {
    realtimeRef.current?.(entry)
  }, [])

  return (
    <RealtimeProvider onEntryChange={handleEntryChange}>
      <ScheduleTable
          initialData={initialData}
          realtimeRef={realtimeRef}
          publishRef={publishRef}
          renderAbove={(days) => <StatsPanel days={days} />}
          onDaysChange={onDaysChange}
        />
    </RealtimeProvider>
  )
}
