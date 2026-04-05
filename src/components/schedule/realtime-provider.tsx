"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { ParentId } from "@/lib/schedule/types"

interface RealtimePayload {
  new: {
    id: string
    child_id: string
    day: string
    parent_id: string
    status: string
    notes: string | null
  }
}

interface RealtimeProviderProps {
  children: React.ReactNode
  onEntryChange: (entry: {
    id: string
    childId: string
    day: string
    parentId: ParentId
    status: "draft" | "published"
    notes: string | null
  }) => void
}

export function RealtimeProvider({ children, onEntryChange }: RealtimeProviderProps) {
  const onEntryChangeRef = useRef(onEntryChange)
  onEntryChangeRef.current = onEntryChange

  useEffect(() => {
    const supabase = createBrowserClient()

    const channel = supabase
      .channel("schedule-changes")
      .on(
        "postgres_changes",
        {
          event: "*",        // INSERT and UPDATE
          schema: "public",
          table: "schedule_entries",
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as RealtimePayload["new"]
          onEntryChangeRef.current({
            id: row.id,
            childId: row.child_id,
            day: row.day,
            parentId: row.parent_id as ParentId,
            status: row.status as "draft" | "published",
            notes: row.notes,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return <>{children}</>
}
