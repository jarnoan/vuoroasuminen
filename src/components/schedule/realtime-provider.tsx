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
    parent_id: string | null   // null when cell is cleared
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
    parentId: ParentId | null
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      console.error("[RealtimeProvider] Missing Supabase env vars — realtime disabled")
      return
    }
    const supabase = createBrowserClient(supabaseUrl, supabaseKey)

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    // Named handler — used for both initial subscribe and recovery re-subscribe
    const handlePayload = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new as RealtimePayload["new"]
      if (!row || typeof row.id !== "string" || typeof row.child_id !== "string" || typeof row.day !== "string") return
      // Allow null (cleared cell) and valid parent ids; reject anything else
      if (row.parent_id !== null && !VALID_PARENT_IDS.includes(row.parent_id as ParentId)) return
      if (!VALID_STATUSES.includes(row.status as "draft" | "published")) return
      onEntryChangeRef.current({
        id: row.id,
        childId: row.child_id,
        day: row.day,
        parentId: row.parent_id as ParentId | null,
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

      // Guard: check cancelled again right before creating the channel so we can
      // clean up immediately if the component unmounted while we were awaiting.
      if (cancelled) return
      const newChannel = supabase
        .channel("schedule-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handlePayload)
        .subscribe()

      if (cancelled) {
        // Component unmounted between the last await and here — clean up immediately
        supabase.removeChannel(newChannel)
        return
      }
      channel = newChannel
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
