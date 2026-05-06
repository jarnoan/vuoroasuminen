"use client"

import config from "@/config/app"
import type { ParentId } from "@/lib/schedule/types"

interface ScheduleCellProps {
  entryId: string
  parentId: ParentId
  status: "draft" | "published"
  childName: string
  onToggle: (entryId: string, newParentId: ParentId) => void
  onClear: (entryId: string) => void
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
}: ScheduleCellProps) {
  const displayName = config.parents.find((p) => p.id === parentId)?.name ?? parentId
  const newParentId: ParentId = parentId === "father" ? "mother" : "father"
  const colorClass = colorMap[parentId][status]

  return (
    <div className="relative group w-full h-full">
      <button
        type="button"
        className={`w-full h-full min-h-[40px] rounded-md font-medium text-sm transition-colors ${colorClass}`}
        onClick={() => onToggle(entryId, newParentId)}
        title={`${displayName} (${status}) — klikkaa vaihtaaksesi`}
      >
        {displayName}
      </button>
      <button
        type="button"
        className="absolute top-0.5 right-0.5 h-5 w-5 flex items-center justify-center rounded-sm text-xs leading-none bg-black/20 hover:bg-black/40 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
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
