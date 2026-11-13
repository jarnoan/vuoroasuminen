"use client"

import { useState, useEffect, useRef } from "react"

interface NotesCellProps {
  entryId: string | null
  value: string
  onSave: (entryId: string, notes: string) => void
}

export function NotesCell({ entryId, value, onSave }: NotesCellProps) {
  const [localValue, setLocalValue] = useState(value)
  const isFocusedRef = useRef(false)

  // Sync localValue when value changes from realtime updates,
  // but only when the input is not focused (to avoid overwriting active edits)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value)
    }
  }, [value])

  function handleFocus() {
    isFocusedRef.current = true
  }

  function handleBlur() {
    isFocusedRef.current = false
    if (entryId && localValue !== value) {
      onSave(entryId, localValue)
    }
  }

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="Lisää muistiinpano…"
      disabled={entryId === null}
      className="w-full h-8 rounded-lg border border-transparent bg-transparent px-2.5 text-sm placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-background focus:border-input focus:outline-none focus:ring-3 focus:ring-ring/30 max-sm:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}
