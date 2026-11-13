"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { computeStats, type ScheduleStats } from "@/lib/schedule/stats"
import type { ParentId, ScheduleDay } from "@/lib/schedule/types"

export function useScheduleStats(days: ScheduleDay[], parents: Array<{ id: ParentId; name: string }>) {
  return useMemo(() => computeStats(days, parents), [days, parents])
}

export function parentName(parents: Array<{ id: ParentId; name: string }>, id: ParentId) {
  return parents.find((p) => p.id === id)?.name ?? (id === "father" ? "Isi" : "Äiti")
}

// Isi/Äiti split bar. Empty (grey) when neither parent has days yet.
export function SplitBar({ father, mother, className = "h-1" }: { father: number; mother: number; className?: string }) {
  const total = father + mother
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-muted ${className}`} aria-hidden="true">
      {total > 0 && (
        <>
          <div className="bg-isi" style={{ width: `${(father / total) * 100}%` }} />
          <div className="bg-aiti-bar" style={{ width: `${(mother / total) * 100}%` }} />
        </>
      )}
    </div>
  )
}

function FreeDayCards({ stats }: { stats: ScheduleStats }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.parentFreeStats.map((ps) => (
        <div
          key={ps.parentId}
          className={`rounded-xl px-3 py-2.5 ${ps.parentId === "father" ? "bg-isi-tint text-isi" : "bg-aiti-tint text-aiti-ink"}`}
        >
          <div className="text-xs font-semibold">{ps.parentName} · vapaat</div>
          <div className="font-heading text-lg font-bold leading-tight tabular-nums">
            {ps.childFreeDays} pv
            <span className="text-sm font-semibold opacity-80"> · {ps.childFreeWeekends} vkl</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChildRows({ stats, parents }: { stats: ScheduleStats; parents: Array<{ id: ParentId; name: string }> }) {
  const isi = parentName(parents, "father")
  const aiti = parentName(parents, "mother")
  return (
    <ul className="flex flex-col gap-3.5">
      {stats.childStats.map((child) => (
        <li key={child.childName} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{child.childName}</span>
            <span className="text-xs tabular-nums">
              <span className="text-isi font-semibold">{isi} {child.father} pv</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-aiti-ink font-semibold">{aiti} {child.mother} pv</span>
            </span>
          </div>
          <SplitBar father={child.father} mother={child.mother} className="h-2" />
          <div className="text-xs text-muted-foreground tabular-nums">
            Ainoana lapsena: {isi} {child.soloFather} pv · {aiti} {child.soloMother} pv
          </div>
        </li>
      ))}
    </ul>
  )
}

function rangeLabel(days: ScheduleDay[]) {
  return days.length > 0
    ? `${format(parseISO(days[0].date), "d.M.")} – ${format(parseISO(days[days.length - 1].date), "d.M.yyyy")}`
    : ""
}

interface StatsProps {
  days: ScheduleDay[]
  parents: Array<{ id: ParentId; name: string }>
}

// Desktop sidebar card. Counts are scoped to exactly the displayed date range.
export function StatsCard({ days, parents }: StatsProps) {
  const stats = useScheduleStats(days, parents)
  return (
    <section className="bg-background border rounded-2xl p-5 flex flex-col gap-4" aria-labelledby="stats-card-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="stats-card-title" className="font-heading text-base font-bold">Yhteenveto</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{rangeLabel(days)}</span>
      </div>
      <ChildRows stats={stats} parents={parents} />
      <FreeDayCards stats={stats} />
    </section>
  )
}

// Mobile: panel that expands down from the sticky column header.
export function MobileSummaryPanel({
  days,
  parents,
  stats,
  onClose,
}: StatsProps & { stats: ScheduleStats; onClose: () => void }) {
  return (
    <div id="mobile-summary" className="flex flex-col gap-4 px-4 pt-3 pb-4 text-left font-normal">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-base font-bold">Yhteenveto</span>
        <span className="text-xs text-muted-foreground tabular-nums">{rangeLabel(days)}</span>
      </div>
      <ChildRows stats={stats} parents={parents} />
      <FreeDayCards stats={stats} />
      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-xl border bg-background text-sm font-semibold hover:bg-muted"
      >
        Sulje
      </button>
    </div>
  )
}
