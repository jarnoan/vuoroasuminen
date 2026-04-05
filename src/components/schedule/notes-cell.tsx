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
      placeholder="Add note..."
      disabled={entryId === null}
      className="w-full border-0 bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring rounded disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}
