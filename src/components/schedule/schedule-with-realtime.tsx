"use client"

import React, { useRef, useCallback } from "react"
import { ScheduleTable } from "./schedule-table"
import { StatsPanel } from "./stats-panel"
import { RealtimeProvider } from "./realtime-provider"
import type { ParentId, ScheduleDay } from "@/lib/schedule/types"
import type { Density } from "./density"

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
  viewStart?: string
  viewEnd?: string
  currentParentId?: ParentId
  density?: Density
}

export function ScheduleWithRealtime({ days, setDays, publishRef, parents, viewStart, viewEnd, currentParentId, density }: ScheduleWithRealtimeProps) {
  const realtimeRef = useRef<((entry: EntryUpdate) => void) | null>(null)

  const handleEntryChange = useCallback((entry: EntryUpdate) => {
    realtimeRef.current?.(entry)
  }, [])

  const handleRefresh = useCallback((days: ScheduleDay[]) => {
    setDays(days)
  }, [setDays])

  return (
    <RealtimeProvider onEntryChange={handleEntryChange} onRefresh={handleRefresh} viewStart={viewStart} viewEnd={viewEnd}>
      <ScheduleTable
        days={days}
        setDays={setDays}
        realtimeRef={realtimeRef}
        publishRef={publishRef}
        parents={parents}
        currentParentId={currentParentId}
        density={density}
      />
      <StatsPanel days={days} parents={parents} />
    </RealtimeProvider>
  )
}
