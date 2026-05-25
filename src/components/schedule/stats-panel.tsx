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

  return (
    <div className="border rounded-lg py-3 mt-4 bg-muted/30 text-sm">
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "104px" }} />
          {stats.childStats.map((child) => (
            <col key={child.childName} />
          ))}
          <col className="max-sm:w-8 sm:w-40" />
          <col className="max-sm:w-0" />
        </colgroup>
        <thead>
          <tr>
            <th className="text-left font-medium px-3 pb-1" />
            {stats.childStats.map((child) => (
              <th key={child.childName} className="text-left font-medium px-1 pb-1 min-w-[72px] sm:min-w-[90px]">
                {child.childName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Father row */}
          <tr>
            <td className="text-blue-700 font-medium px-3 py-1 align-top">
              {stats.parentFreeStats.find((p) => p.parentId === "father")?.parentName ?? "Isä"}
            </td>
            {stats.childStats.map((child) => (
              <td key={child.childName} className="px-1 py-1 align-top min-w-[72px] sm:min-w-[90px]">
                <div>{child.father} pv</div>
                <div className="text-xs text-muted-foreground">yksin {child.soloFather}</div>
              </td>
            ))}
          </tr>
          {/* Mother row */}
          <tr>
            <td className="text-rose-700 font-medium px-3 py-1 align-top">
              {stats.parentFreeStats.find((p) => p.parentId === "mother")?.parentName ?? "Äiti"}
            </td>
            {stats.childStats.map((child) => (
              <td key={child.childName} className="px-1 py-1 align-top min-w-[72px] sm:min-w-[90px]">
                <div>{child.mother} pv</div>
                <div className="text-xs text-muted-foreground">yksin {child.soloMother}</div>
              </td>
            ))}
          </tr>
          {/* Separator */}
          <tr>
            <td colSpan={stats.childStats.length + 3} className="py-1">
              <div className="border-t" />
            </td>
          </tr>
          {/* Vapaa rows */}
          {stats.parentFreeStats.map((ps) => (
            <tr key={ps.parentId}>
              <td
                colSpan={stats.childStats.length + 3}
                className={`py-0.5 ${ps.parentId === "father" ? "text-blue-700" : "text-rose-700"}`}
              >
                {ps.parentName} {ps.childFreeDays} pv ({ps.childFreeWeekends} vkl)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
