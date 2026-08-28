"use client"

import { useState, useRef, useEffect } from "react"

import type { ParentId } from "@/lib/schedule/types"

interface ScheduleCellProps {
  entryId: string
  parentId: ParentId
  status: "draft" | "published"
  childName: string
  onToggle: (entryId: string, newParentId: ParentId) => void
  onClear: (entryId: string) => void
  parents: Array<{ id: ParentId; name: string }>
}

const colorMap: Record<ParentId, Record<"draft" | "published", string>> = {
  father: {
    published: "bg-blue-500 text-white hover:bg-blue-600",
    draft: "bg-blue-200 text-blue-800 hover:bg-blue-300",
  },
  mother: {
    published: "bg-rose-500 text-white hover:bg-rose-600",
    draft: "bg-rose-200 text-rose-800 hover:bg-rose-300",
  },
}

export function ScheduleCell({
  entryId,
  parentId,
  status,
  onToggle,
  onClear,
  parents,
}: ScheduleCellProps) {
  const displayName = parents.find((p) => p.id === parentId)?.name ?? parentId
  const newParentId: ParentId = parentId === "father" ? "mother" : "father"
  const colorClass = colorMap[parentId][status]

  const [isHolding, setIsHolding] = useState(false)
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startXRef = useRef<number>(0)
  const startYRef = useRef<number>(0)

  // Cleanup timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (armTimerRef.current !== null) clearTimeout(armTimerRef.current)
    }
  }, [])

  function handleCellPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    setIsHolding(true)
    armTimerRef.current = setTimeout(() => {
      onClear(entryId)
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(100)
      }
      setIsHolding(false)
    }, 2000)
  }

  function cancelHold() {
    if (armTimerRef.current !== null) {
      clearTimeout(armTimerRef.current)
      armTimerRef.current = null
    }
    setIsHolding(false)
  }

  function handleCellPointerUp() {
    cancelHold()
  }

  function handleCellPointerCancel() {
    cancelHold()
  }

  function handleCellPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const dx = Math.abs(e.clientX - startXRef.current)
    const dy = Math.abs(e.clientY - startYRef.current)
    if (dx > 8 || dy > 8) {
      cancelHold()
    }
  }

  return (
    <div className="relative group w-full h-full">
      <button
        type="button"
        className={[
          "w-full h-full rounded-md font-medium",
          `transition-colors ${colorClass}`,
        ].join(" ")}
        onClick={() => onToggle(entryId, newParentId)}
        title={`${displayName} (${status}) — klikkaa vaihtaaksesi`}
        onPointerDown={handleCellPointerDown}
        onPointerUp={handleCellPointerUp}
        onPointerCancel={handleCellPointerCancel}
        onPointerMove={handleCellPointerMove}
        style={{
          touchAction: "manipulation",
          minHeight: "var(--cell-min-h)",
          fontSize: "var(--cell-font)",
          ...(isHolding ? { opacity: 0, transition: "opacity 2s linear" } : { opacity: 1 }),
        }}
      >
        <span className="[@media(pointer:fine)]:hidden">{displayName}</span>
        <span className="[@media(pointer:coarse)]:hidden">{displayName}</span>
      </button>
      <button
        type="button"
        className="[@media(pointer:coarse)]:hidden absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-sm text-xs leading-none bg-black/20 hover:bg-black/40 text-white transition-opacity focus:opacity-100 focus-visible:opacity-100 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onClear(entryId)
        }}
        title="Tyhjennä tämä päivä"
        aria-label="Tyhjennä"
      >
        ×
      </button>
    </div>
  )
}
