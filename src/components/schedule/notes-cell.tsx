"use client"

import { useState } from "react"

interface NotesCellProps {
  entryId: string | null
  value: string
  onSave: (entryId: string, notes: string) => void
}

export function NotesCell({ entryId, value, onSave }: NotesCellProps) {
  const [localValue, setLocalValue] = useState(value)

  function handleBlur() {
    if (entryId && localValue !== value) {
      onSave(entryId, localValue)
    }
  }

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Add note..."
      disabled={entryId === null}
      className="w-full border-0 bg-transparent text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring rounded disabled:cursor-not-allowed disabled:opacity-50"
    />
  )
}
