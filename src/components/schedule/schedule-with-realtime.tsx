"use client"

import React, { useRef, useCallback } from "react"
import { ScheduleTable } from "./schedule-table"
import { StatsPanel } from "./stats-panel"
import { RealtimeProvider } from "./realtime-provider"
import type { ParentId, ScheduleDay } from "@/lib/schedule/types"

type EntryUpdate = {
  id: string
  childId: string
  day: string
  parentId: ParentId | null
  status: "draft" | "published"
  notes: string | null
}

interface ScheduleWithRealtimeProps {
  days: ScheduleDay[]
  setDays: React.Dispatch<React.SetStateAction<ScheduleDay[]>>
  publishRef?: React.RefObject<(() => void) | null>
}

export function ScheduleWithRealtime({ days, setDays, publishRef }: ScheduleWithRealtimeProps) {
  const realtimeRef = useRef<((entry: EntryUpdate) => void) | null>(null)

  const handleEntryChange = useCallback((entry: EntryUpdate) => {
    realtimeRef.current?.(entry)
  }, [])

  return (
    <RealtimeProvider onEntryChange={handleEntryChange}>
      <ScheduleTable
          days={days}
          setDays={setDays}
          realtimeRef={realtimeRef}
          publishRef={publishRef}
          renderAbove={(days) => <StatsPanel days={days} />}
        />
    </RealtimeProvider>
  )
}
