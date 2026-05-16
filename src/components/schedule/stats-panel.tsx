"use client"

import { useMemo } from "react"
import { computeStats } from "@/lib/schedule/stats"
import type { ParentId, ScheduleDay } from "@/lib/schedule/types"

interface StatsPanelProps {
  days: ScheduleDay[]
  parents: Array<{ id: ParentId; name: string }>
}

export function StatsPanel({ days, parents }: StatsPanelProps) {
  const stats = useMemo(() => computeStats(days, parents), [days, parents])

  const parentName = (id: string) =>
    parents.find((p) => p.id === id)?.name ?? id

  return (
    <div className="border rounded-lg p-3 mb-4 bg-muted/30 text-sm space-y-1">
      {stats.childStats.map((child) => (
        <div key={child.childName} className="flex items-center gap-4">
          <span className="font-medium w-16">{child.childName}:</span>
          <span className="text-blue-700">
            {parentName("father")} {child.father} pv
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-rose-700">
            {parentName("mother")} {child.mother} pv
          </span>
          <span className="text-muted-foreground ml-2">
            (yksin: {parentName("father")} {child.soloFather} pv /{" "}
            {parentName("mother")} {child.soloMother} pv)
          </span>
        </div>
      ))}
      <div className="border-t pt-1 mt-1 flex items-center gap-4">
        <span className="font-medium w-16">Vapaa:</span>
        {stats.parentFreeStats.map((ps) => (
          <span
            key={ps.parentId}
            className={ps.parentId === "father" ? "text-blue-700" : "text-rose-700"}
          >
            {ps.parentName} {ps.childFreeDays} pv ({ps.childFreeWeekends}{" "}
            vkl)
          </span>
        ))}
      </div>
    </div>
  )
}
