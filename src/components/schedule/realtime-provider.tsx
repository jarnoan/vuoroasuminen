"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { getScheduleDays } from "@/actions/schedule"
import type { ParentId, ScheduleDay } from "@/lib/schedule/types"

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
  onRefresh?: (days: ScheduleDay[]) => void
  viewStart?: string
}

export function RealtimeProvider({ children, onEntryChange, onRefresh, viewStart }: RealtimeProviderProps) {
  const onEntryChangeRef = useRef(onEntryChange)
  onEntryChangeRef.current = onEntryChange

  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    // Named handler — used for both initial subscribe and recovery re-subscribe
    const handlePayload = (payload: { new: Record<string, unknown> }) => {
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

    // Initial subscribe
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (!session?.access_token) return
      supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel("schedule-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handlePayload)
        .subscribe()
    })

    // Recovery: on every hidden→visible transition, re-fetch + re-subscribe
    const handleVisibilityChange = async () => {
      if (document.hidden || cancelled) return  // only act on visible transition

      // Step 1: tear down dead/paused channel (await so old channel is gone before re-subscribing)
      if (channel) {
        await supabase.removeChannel(channel)
        channel = null
      }
      if (cancelled) return

      // Step 2: re-fetch full schedule via Server Action
      const freshDays = await getScheduleDays(viewStart)
      if (cancelled) return
      onRefreshRef.current?.(freshDays)  // silent update — no toast/spinner (D-05)

      // Step 3: get fresh session token and re-subscribe
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled || !session?.access_token) return
      supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel("schedule-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handlePayload)
        .subscribe()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])  // empty deps array — refs handle prop updates without re-running the effect

  return <>{children}</>
}
