"use client"

import { useState, useEffect, useRef } from "react"

interface NotesCellProps {
  value: string
  // Called on blur when the text changed (trimmed; "" means the note was cleared)
  onCommit: (text: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

// Inline single-day note input (desktop notes column)
export function NotesCell({ value, onCommit, placeholder = "Lisää muistiinpano…", ariaLabel, className = "" }: NotesCellProps) {
  const [localValue, setLocalValue] = useState(value)
  const isFocusedRef = useRef(false)
  const cancelRef = useRef(false)

  // Sync localValue when value changes from realtime updates,
  // but only when the input is not focused (to avoid overwriting active edits)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value)
    }
  }, [value])

  function handleBlur() {
    isFocusedRef.current = false
    if (cancelRef.current) {
      cancelRef.current = false
      setLocalValue(value)
      return
    }
    const next = localValue.trim()
    if (next !== value.trim()) onCommit(next)
    else if (localValue !== value) setLocalValue(value)
  }

  return (
    <input
      type="text"
      value={localValue}
      maxLength={500}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => { isFocusedRef.current = true }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") { cancelRef.current = true; e.currentTarget.blur() }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      className={`w-full h-8 rounded-lg border border-transparent bg-transparent px-2.5 text-sm placeholder:text-muted-foreground/60 hover:bg-muted/60 focus:bg-background focus:border-input focus:outline-none focus:ring-3 focus:ring-ring/30 ${className}`}
    />
  )
}
