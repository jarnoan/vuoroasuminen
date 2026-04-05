"use client"

import config from "@/config/app"
import type { ParentId } from "@/lib/schedule/types"

interface ScheduleCellProps {
  entryId: string
  parentId: ParentId
  status: "draft" | "published"
  childName: string
  onToggle: (entryId: string, newParentId: ParentId) => void
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
}: ScheduleCellProps) {
  const displayName = config.parents.find((p) => p.id === parentId)?.name ?? parentId
  const newParentId: ParentId = parentId === "father" ? "mother" : "father"
  const colorClass = colorMap[parentId][status]

  return (
    <button
      type="button"
      className={`w-full h-full min-h-[40px] rounded-md font-medium text-sm transition-colors ${colorClass}`}
      onClick={() => onToggle(entryId, newParentId)}
      title={`${displayName} (${status}) — click to toggle`}
    >
      {displayName}
    </button>
  )
}
