"use client"

import { useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { parseISO, startOfWeek, subDays, format } from "date-fns"
import { fi } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface ViewToolbarProps {
  initialViewStart?: string
}

export function ViewToolbar({ initialViewStart }: ViewToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateTo = useCallback(
    (dateStr: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (dateStr) {
        params.set("viewStart", dateStr)
        router.replace(pathname + "?" + params.toString())
      } else {
        params.delete("viewStart")
        router.replace(pathname + (params.size > 0 ? "?" + params.toString() : ""))
      }
    },
    [router, pathname, searchParams],
  )

  function handlePrevWeek() {
    const currentStart = parseISO(
      initialViewStart ??
        format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    )
    const prevMonday = startOfWeek(subDays(currentStart, 7), { weekStartsOn: 1 })
    navigateTo(format(prevMonday, "yyyy-MM-dd"))
  }

  function handleToday() {
    // Only clears viewStart — ScheduleTable's mount useEffect handles scroll after RSC re-render
    navigateTo(null)
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    navigateTo(format(monday, "yyyy-MM-dd"))
  }

  const selectedDate = initialViewStart ? parseISO(initialViewStart) : undefined

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      <Button
        variant="outline"
        size="sm"
        className="font-semibold"
        onClick={handlePrevWeek}
      >
        ‹ Prev week
      </Button>
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" size="sm" className="font-semibold" />}
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          Valitse päivä
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
