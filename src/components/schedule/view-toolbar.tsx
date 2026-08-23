"use client"

import { useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { parseISO, startOfWeek, endOfWeek, subDays, format } from "date-fns"
import { fi } from "react-day-picker/locale"
import { CalendarIcon, ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ViewToolbarProps {
  initialViewStart?: string
  initialViewEnd?: string
  // Actual resolved window bounds from the server (DateWindow.startDate/endDate) — always
  // defined, even when viewStart/viewEnd aren't in the URL, so the pickers can show the
  // real default range instead of appearing empty.
  resolvedStart: string
  resolvedEnd: string
}

export function ViewToolbar({ initialViewStart, initialViewEnd, resolvedStart, resolvedEnd }: ViewToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateTo = useCallback(
    (updates: { viewStart?: string | null; viewEnd?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (updates.viewStart !== undefined) {
        if (updates.viewStart) params.set("viewStart", updates.viewStart)
        else params.delete("viewStart")
      }
      if (updates.viewEnd !== undefined) {
        if (updates.viewEnd) params.set("viewEnd", updates.viewEnd)
        else params.delete("viewEnd")
      }
      router.replace(pathname + (params.size > 0 ? "?" + params.toString() : ""))
    },
    [router, pathname, searchParams],
  )

  function handlePrevWeek() {
    const currentStart = parseISO(initialViewStart ?? resolvedStart)
    const prevMonday = startOfWeek(subDays(currentStart, 7), { weekStartsOn: 1 })
    // Quick navigation resets to the default 12-week window
    navigateTo({ viewStart: format(prevMonday, "yyyy-MM-dd"), viewEnd: null })
  }

  function handleToday() {
    // Clears viewStart/viewEnd — ScheduleTable's mount useEffect handles scroll after RSC re-render
    navigateTo({ viewStart: null, viewEnd: null })
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

  return (
    <div className="@container flex flex-wrap items-center gap-2 px-4 py-2 border-b">
      <Button
        variant="outline"
        size="sm"
        className="font-semibold"
        onClick={handlePrevWeek}
        aria-label="Edellinen viikko"
      >
        <ChevronLeft className="h-4 w-4 @sm:hidden" aria-hidden="true" />
        <span className="hidden @sm:inline">‹ Prev week</span>
      </Button>
      {/* Native date input — visible on mobile, hidden on desktop */}
      <input
        type="date"
        className="sm:hidden border rounded-md px-2 py-1 text-sm"
        value={format(selectedDate, "yyyy-MM-dd")}
        onChange={(e) => {
          if (!e.target.value) return
          handleDateSelect(parseISO(e.target.value))
        }}
        aria-label="Valitse aloituspäivä"
      />
      {/* Calendar Popover — hidden on mobile, visible on desktop */}
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" />}
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          {format(selectedDate, "d.M.yyyy")}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={fi}
          />
        </PopoverContent>
      </Popover>
      <span className="text-muted-foreground text-sm hidden @sm:inline" aria-hidden="true">
        &ndash;
      </span>
      {/* Native date input — visible on mobile, hidden on desktop */}
      <input
        type="date"
        className="sm:hidden border rounded-md px-2 py-1 text-sm"
        value={format(selectedEndDate, "yyyy-MM-dd")}
        min={format(selectedDate, "yyyy-MM-dd")}
        onChange={(e) => {
          if (!e.target.value) return
          handleEndDateSelect(parseISO(e.target.value))
        }}
        aria-label="Valitse loppupäivä"
      />
      {/* Calendar Popover — hidden on mobile, visible on desktop */}
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" />}
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
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
      {initialViewEnd && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleClearEndDate}
          aria-label="Poista loppupäivän rajaus"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        variant="default"
        size="sm"
        className="font-semibold ml-auto"
        onClick={handleToday}
      >
        Tänään
      </Button>
    </div>
  )
}
