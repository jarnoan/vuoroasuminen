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

// Published = solid parent colour; draft = light tint with a dashed outline, so
// unpublished changes stand out at a glance (and differ by more than hue alone).
const colorMap: Record<ParentId, Record<"draft" | "published", string>> = {
  father: {
    published: "bg-isi text-isi-fg border-transparent hover:brightness-95",
    draft: "bg-isi-tint text-isi border-isi border-dashed hover:brightness-97",
  },
  mother: {
    published: "bg-aiti text-aiti-fg border-transparent hover:brightness-95",
    draft: "bg-aiti-tint text-aiti-ink border-aiti-line border-dashed hover:brightness-97",
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
          "w-full h-full rounded-[10px] border-[1.5px] font-semibold",
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
