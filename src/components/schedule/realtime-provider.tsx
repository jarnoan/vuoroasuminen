"use client"

import { useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { getScheduleData } from "@/actions/schedule"
import type { DateWindow, DayNote, ParentId } from "@/lib/schedule/types"

const VALID_PARENT_IDS = ["father", "mother"] as const
const VALID_STATUSES = ["draft", "published"] as const

interface RealtimePayload {
  new: {
    id: string
    child_id: string
    day: string
    parent_id: string | null   // null when cell is cleared
    status: string
  }
}

export type NoteChange = { type: "upsert"; note: DayNote } | { type: "delete"; id: string }

interface RealtimeProviderProps {
  children: React.ReactNode
  onEntryChange: (entry: {
    id: string
    childId: string
    day: string
    parentId: ParentId | null
    status: "draft" | "published"
  }) => void
  onNoteChange: (change: NoteChange) => void
  onRefresh?: (data: DateWindow) => void
  viewStart?: string
  viewEnd?: string
}

export function RealtimeProvider({ children, onEntryChange, onNoteChange, onRefresh, viewStart, viewEnd }: RealtimeProviderProps) {
  const onEntryChangeRef = useRef(onEntryChange)
  onEntryChangeRef.current = onEntryChange

  const onNoteChangeRef = useRef(onNoteChange)
  onNoteChangeRef.current = onNoteChange

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
    // Bumped on every (re)subscribe attempt; a stale async attempt bails out instead
    // of racing a newer one (e.g. two quick hidden→visible transitions).
    let generation = 0

    // The browser Supabase client is shared, and supabase.channel(topic) returns an
    // EXISTING channel for the same topic. A fixed topic therefore collides with a
    // channel that is still subscribed (overlapping recovery, or a remounted provider
    // whose old channel is still being removed) and .on() throws. Use a unique topic
    // per subscription — postgres_changes filtering doesn't depend on the topic name.
    const subscribe = () => {
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`schedule-changes-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, handlePayload)
        .on("postgres_changes", { event: "*", schema: "public", table: "day_notes" }, handleNotePayload)
        .subscribe()
    }

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
      })
    }

    const handleNotePayload = (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (payload.eventType === "DELETE") {
        const id = payload.old?.id
        if (typeof id === "string") onNoteChangeRef.current({ type: "delete", id })
        return
      }
      const row = payload.new
      if (!row || typeof row.id !== "string" || typeof row.start_day !== "string"
        || typeof row.end_day !== "string" || typeof row.text !== "string") return
      onNoteChangeRef.current({
        type: "upsert",
        note: { id: row.id, startDay: row.start_day, endDay: row.end_day, text: row.text },
      })
    }

    // Initial subscribe
    const initialGen = ++generation
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || initialGen !== generation) return
      if (!session?.access_token) return
      supabase.realtime.setAuth(session.access_token)
      subscribe()
    })

    // Recovery: on every hidden→visible transition, re-fetch + re-subscribe
    const handleVisibilityChange = async () => {
      if (document.hidden || cancelled) return  // only act on visible transition
      const gen = ++generation
      const isStale = () => cancelled || gen !== generation

      // Step 1: tear down dead/paused channel (await so old channel is gone before re-subscribing)
      if (channel) {
        const old = channel
        channel = null
        await supabase.removeChannel(old)
      }
      if (isStale()) return

      // Step 2: re-fetch full schedule via Server Action
      const fresh = await getScheduleData(viewStart, viewEnd)
      if (isStale()) return
      onRefreshRef.current?.(fresh)  // silent update — no toast/spinner (D-05)

      // Step 3: get fresh session token and re-subscribe
      const { data: { session } } = await supabase.auth.getSession()
      if (isStale() || !session?.access_token) return
      supabase.realtime.setAuth(session.access_token)
      subscribe()
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
