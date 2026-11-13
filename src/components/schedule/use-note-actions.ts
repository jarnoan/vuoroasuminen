"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { createNote, deleteNote, updateNote } from "@/actions/schedule"
import type { DayNote } from "@/lib/schedule/types"
import type { NoteInput } from "@/lib/schedule/notes"

export type SetNotes = Dispatch<SetStateAction<DayNote[]>>

// Optimistic create/update/delete for day notes. The server echo arrives twice (the action's
// return value and the realtime event); both paths upsert by id, so the order doesn't matter.
export function useNoteActions(setNotes: SetNotes) {
  const create = useCallback(async (input: NoteInput) => {
    const tempId = `tmp-${crypto.randomUUID()}`
    setNotes(prev => [...prev, { id: tempId, ...input }])
    try {
      const result = await createNote(input)
      if (!result.success) throw new Error(result.error)
      setNotes(prev => [...prev.filter(n => n.id !== tempId && n.id !== result.note.id), result.note])
    } catch (err) {
      setNotes(prev => prev.filter(n => n.id !== tempId))
      toast.error(err instanceof Error && err.message ? err.message : "Muistiinpanon tallennus epäonnistui.")
    }
  }, [setNotes])

  const update = useCallback(async (id: string, input: NoteInput) => {
    let prior: DayNote | undefined
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n
      prior = n
      return { ...n, ...input }
    }))
    try {
      const result = await updateNote(id, input)
      if (!result.success) throw new Error(result.error)
      setNotes(prev => prev.map(n => (n.id === id ? result.note : n)))
    } catch (err) {
      // Only roll back if nothing newer (e.g. a realtime update) replaced our optimistic value
      setNotes(prev => prev.map(n => (n.id === id && prior && n.text === input.text && n.startDay === input.startDay && n.endDay === input.endDay ? prior : n)))
      toast.error(err instanceof Error && err.message ? err.message : "Muistiinpanon tallennus epäonnistui.")
    }
  }, [setNotes])

  const remove = useCallback(async (id: string) => {
    let prior: DayNote | undefined
    setNotes(prev => prev.filter(n => {
      if (n.id === id) prior = n
      return n.id !== id
    }))
    try {
      const result = await deleteNote(id)
      if (!result.success) throw new Error(result.error)
      if (prior) {
        const { startDay, endDay, text } = prior
        toast("Muistiinpano poistettu", {
          action: { label: "Kumoa", onClick: () => { void create({ startDay, endDay, text }) } },
        })
      }
    } catch (err) {
      if (prior) {
        const restored = prior
        setNotes(prev => (prev.some(n => n.id === id) ? prev : [...prev, restored]))
      }
      toast.error(err instanceof Error && err.message ? err.message : "Muistiinpanon poistaminen epäonnistui.")
    }
  }, [setNotes, create])

  return { create, update, remove }
}
