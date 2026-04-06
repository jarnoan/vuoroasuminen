"use client"

import { useMemo } from "react"
import { computeStats } from "@/lib/schedule/stats"
import config from "@/config/app"
import type { ScheduleDay } from "@/lib/schedule/types"

interface StatsPanelProps {
  days: ScheduleDay[]
}

export function StatsPanel({ days }: StatsPanelProps) {
  const stats = useMemo(() => computeStats(days, config.parents), [days])

  const parentName = (id: string) =>
    config.parents.find((p) => p.id === id)?.name ?? id

  return (
    <div className="border rounded-lg p-3 mb-4 bg-muted/30 text-sm space-y-1">
      {stats.childStats.map((child) => (
        <div key={child.childName} className="flex items-center gap-4">
          <span className="font-medium w-16">{child.childName}:</span>
          <span className="text-blue-700">
            {parentName("father")} {child.father}d
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-rose-700">
            {parentName("mother")} {child.mother}d
          </span>
          <span className="text-muted-foreground ml-2">
            (solo: {parentName("father")} {child.soloFather}d /{" "}
            {parentName("mother")} {child.soloMother}d)
          </span>
        </div>
      ))}
      <div className="border-t pt-1 mt-1 flex items-center gap-4">
        <span className="font-medium w-16">Free:</span>
        {stats.parentFreeStats.map((ps) => (
          <span
            key={ps.parentId}
            className={ps.parentId === "father" ? "text-blue-700" : "text-rose-700"}
          >
            {ps.parentName} {ps.childFreeDays}d ({ps.childFreeWeekends}{" "}
            wknd{ps.childFreeWeekends !== 1 ? "s" : ""})
          </span>
        ))}
      </div>
    </div>
  )
}
