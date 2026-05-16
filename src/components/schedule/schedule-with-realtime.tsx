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
  parents: Array<{ id: ParentId; name: string }>
}

export function ScheduleWithRealtime({ days, setDays, publishRef, parents }: ScheduleWithRealtimeProps) {
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
          parents={parents}
          renderAbove={(days) => <StatsPanel days={days} parents={parents} />}
        />
    </RealtimeProvider>
  )
}
