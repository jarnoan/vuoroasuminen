"use client"

import { parseISO, startOfWeek, endOfWeek, format, differenceInCalendarDays } from "date-fns"
import { fi } from "react-day-picker/locale"
import { CalendarIcon, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { shiftViewRange } from "@/lib/schedule/view-range"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ScrollTarget } from "./schedule-table"

interface ViewToolbarProps {
  // Explicitly chosen bounds (undefined = server default)
  viewStart?: string
  viewEnd?: string
  // Actual resolved window bounds from the server (DateWindow.startDate/endDate) — always
  // defined, even when no explicit range is chosen, so the pickers can show the
  // real default range instead of appearing empty.
  resolvedStart: string
  resolvedEnd: string
  // Whether saved (assigned) days exist after the shown range — shows the "next range" button
  hasLaterDays?: boolean
  // scrollTo: where to scroll once the new range is shown (default: keep the scroll position)
  onChange: (next: { viewStart?: string; viewEnd?: string }, opts?: { scrollTo?: ScrollTarget }) => void
}

// Length of an inclusive date range as full weeks plus leftover days, e.g. "12 vk", "12 vk 3 pv"
export function formatPeriodLength(start: Date, end: Date): string {
  const days = Math.max(0, differenceInCalendarDays(end, start) + 1)
  const weeks = Math.floor(days / 7)
  const rest = days % 7
  const parts: string[] = []
  if (weeks > 0) parts.push(`${weeks} vk`)
  if (rest > 0 || weeks === 0) parts.push(`${rest} pv`)
  return parts.join(" ")
}

const groupClass = "inline-flex items-center bg-background border rounded-xl p-1 gap-1"
const ghostBtn = "h-9 rounded-lg hover:bg-muted aria-expanded:bg-muted transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 inline-flex items-center justify-center"

export function ViewToolbar({ viewStart: initialViewStart, viewEnd: initialViewEnd, resolvedStart, resolvedEnd, hasLaterDays = false, onChange }: ViewToolbarProps) {
  // updates: undefined = keep the current bound, null = reset it to the default
  function navigateTo(updates: { viewStart?: string | null; viewEnd?: string | null }, opts?: { scrollTo?: ScrollTarget }) {
    const pick = (u: string | null | undefined, current: string | undefined) =>
      u === undefined ? current : (u ?? undefined)
    onChange({
      viewStart: pick(updates.viewStart, initialViewStart),
      viewEnd: pick(updates.viewEnd, initialViewEnd),
    }, opts)
  }

  // Show the previous/next range of the same length
  function shiftRange(direction: -1 | 1) {
    navigateTo(shiftViewRange(initialViewStart ?? resolvedStart, initialViewEnd ?? resolvedEnd, direction))
  }

  function handleReset() {
    // Back to the default window — if the range changes, ScheduleTable remounts and its
    // mount effect scrolls to today; if it is already shown, just scroll there now.
    document.querySelector('[data-today="true"]')?.scrollIntoView({ behavior: "instant", block: "start" })
    navigateTo({ viewStart: null, viewEnd: null }, { scrollTo: "today" })
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    const updates: { viewStart: string; viewEnd?: null } = {
      viewStart: format(monday, "yyyy-MM-dd"),
    }
    // An explicitly chosen end date that would now precede the new start is no longer valid
    if (initialViewEnd && parseISO(initialViewEnd) <= monday) {
      updates.viewEnd = null
    }
    navigateTo(updates)
  }

  function handleEndDateSelect(date: Date | undefined) {
    if (!date) return
    const sunday = endOfWeek(date, { weekStartsOn: 1 })
    navigateTo({ viewEnd: format(sunday, "yyyy-MM-dd") })
  }

  function handleClearEndDate() {
    navigateTo({ viewEnd: null })
  }

  const selectedDate = parseISO(initialViewStart ?? resolvedStart)
  const selectedEndDate = parseISO(initialViewEnd ?? resolvedEnd)
  const isDefault = !initialViewStart && !initialViewEnd
  const periodLength = formatPeriodLength(selectedDate, selectedEndDate)

  const resetButton = (
    <button
      type="button"
      onClick={handleReset}
      disabled={isDefault}
      className="h-10 w-full rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
    >
      <RotateCcw className="size-4" aria-hidden="true" />
      Palaa tähän viikkoon
    </button>
  )

  return (
    <div className="flex items-center gap-2 min-w-0 max-sm:flex-1">
      <button
        type="button"
        onClick={() => shiftRange(-1)}
        aria-label="Edellinen jakso"
        className="size-11 shrink-0 rounded-xl border bg-background hover:bg-muted inline-flex items-center justify-center sm:hidden"
      >
        <ChevronLeft className="size-[18px]" aria-hidden="true" />
      </button>

      {/* Mobile: one range button; both dates (and the reset) live in its popover */}
      <Popover>
        <PopoverTrigger
          aria-label="Valitse näytettävä ajanjakso"
          className="sm:hidden flex-1 min-w-0 h-11 rounded-xl border bg-background px-3 inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap hover:bg-muted aria-expanded:bg-muted"
        >
          <CalendarIcon className="size-4 text-muted-foreground shrink-0 max-[400px]:hidden" aria-hidden="true" />
          <span className="truncate">{format(selectedDate, "d.M.")} – {format(selectedEndDate, "d.M.yyyy")}</span>
          <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">{periodLength}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-3 gap-3 rounded-xl">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Alkaen (maanantai)
            <input
              type="date"
              className="h-11 border rounded-lg px-3 text-sm text-foreground bg-background"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => {
                if (!e.target.value) return
                handleDateSelect(parseISO(e.target.value))
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Päättyen (sunnuntai)
            <input
              type="date"
              className="h-11 border rounded-lg px-3 text-sm text-foreground bg-background"
              value={format(selectedEndDate, "yyyy-MM-dd")}
              min={format(selectedDate, "yyyy-MM-dd")}
              onChange={(e) => {
                if (!e.target.value) return
                handleEndDateSelect(parseISO(e.target.value))
              }}
            />
          </label>
          {resetButton}
        </PopoverContent>
      </Popover>

      {hasLaterDays && (
        <button
          type="button"
          onClick={() => shiftRange(1)}
          aria-label="Seuraava jakso"
          className="size-11 shrink-0 rounded-xl border bg-background hover:bg-muted inline-flex items-center justify-center sm:hidden"
        >
          <ChevronRight className="size-[18px]" aria-hidden="true" />
        </button>
      )}

      {/* Desktop: ‹ start – end ✕ in one group */}
      <div className={`${groupClass} max-sm:hidden`}>
        <button type="button" onClick={() => shiftRange(-1)} aria-label="Edellinen jakso" className={`${ghostBtn} w-9`}>
          <ChevronLeft className="size-[18px]" aria-hidden="true" />
        </button>
        <Popover>
          <PopoverTrigger aria-label="Valitse aloituspäivä" className={`${ghostBtn} px-3 gap-2 text-sm font-semibold`}>
            <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {format(selectedDate, "d.M.yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 gap-0">
            <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} locale={fi} />
            <div className="border-t p-1.5">{resetButton}</div>
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground" aria-hidden="true">–</span>
        <Popover>
          <PopoverTrigger aria-label="Valitse loppupäivä" className={`${ghostBtn} px-3 text-sm font-semibold`}>
            {format(selectedEndDate, "d.M.yyyy")}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedEndDate}
              onSelect={handleEndDateSelect}
              disabled={{ before: selectedDate }}
              locale={fi}
            />
          </PopoverContent>
        </Popover>
        <span className="px-2 text-sm text-muted-foreground whitespace-nowrap" title="Jakson pituus">{periodLength}</span>
        {initialViewEnd && (
          <button type="button" onClick={handleClearEndDate} aria-label="Poista loppupäivän rajaus" className={`${ghostBtn} w-8 h-8 text-muted-foreground`}>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
        {hasLaterDays && (
          <button type="button" onClick={() => shiftRange(1)} aria-label="Seuraava jakso" className={`${ghostBtn} w-9`}>
            <ChevronRight className="size-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
