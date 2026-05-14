"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import type { ParentId } from "@/lib/schedule/types"

const VALID_PARENT_IDS = ["father", "mother"] as const
const VALID_STATUSES = ["draft", "published"] as const

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
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
      channel = supabase
        .channel("schedule-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "schedule_entries",
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new as RealtimePayload["new"]
            if (!row || typeof row.id !== "string" || typeof row.child_id !== "string" || typeof row.day !== "string") return
            if (!VALID_PARENT_IDS.includes(row.parent_id as ParentId)) return
            if (!VALID_STATUSES.includes(row.status as "draft" | "published")) return
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
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return <>{children}</>
}
