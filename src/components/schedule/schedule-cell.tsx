"use client"

import { useState, useRef } from "react"

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

  const [isArmed, setIsArmed] = useState(false)
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startXRef = useRef<number>(0)
  const startYRef = useRef<number>(0)

  function handleCellPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    armTimerRef.current = setTimeout(() => {
      setIsArmed(true)
      // Auto-disarm after 2000ms
      disarmTimerRef.current = setTimeout(() => {
        setIsArmed(false)
      }, 2000)
    }, 1000)
  }

  function cancelArm() {
    if (armTimerRef.current !== null) {
      clearTimeout(armTimerRef.current)
      armTimerRef.current = null
    }
  }

  function handleCellPointerUp() {
    cancelArm()
  }

  function handleCellPointerCancel() {
    cancelArm()
  }

  function handleCellPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const dx = Math.abs(e.clientX - startXRef.current)
    const dy = Math.abs(e.clientY - startYRef.current)
    if (dx > 8 || dy > 8) {
      cancelArm()
    }
  }

  return (
    <div className="relative group w-full h-full">
      <button
        type="button"
        className={`w-full h-full min-h-[40px] rounded-md font-medium text-sm transition-colors ${colorClass}`}
        onClick={() => onToggle(entryId, newParentId)}
        title={`${displayName} (${status}) — klikkaa vaihtaaksesi`}
        onPointerDown={handleCellPointerDown}
        onPointerUp={handleCellPointerUp}
        onPointerCancel={handleCellPointerCancel}
        onPointerMove={handleCellPointerMove}
        style={{ touchAction: "manipulation" }}
      >
        {displayName}
      </button>
      <button
        type="button"
        className={`absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-sm text-xs leading-none bg-black/20 hover:bg-black/40 text-white transition-opacity focus:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${isArmed ? "max-sm:opacity-100" : "max-sm:opacity-0"}`}
        onClick={(e) => {
          e.stopPropagation()
          onClear(entryId)
          setIsArmed(false)
          if (disarmTimerRef.current !== null) {
            clearTimeout(disarmTimerRef.current)
            disarmTimerRef.current = null
          }
        }}
        title="Tyhjennä tämä päivä"
        aria-label="Tyhjennä"
      >
        ×
      </button>
    </div>
  )
}
