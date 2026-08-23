"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { extendSchedule } from "@/actions/schedule"

interface ExtendPanelProps {
  scheduleEndDate: string  // ISO YYYY-MM-DD — current schedule's last day (Sunday)
}

type Mode = "weeks" | "date"

export function ExtendPanel({ scheduleEndDate }: ExtendPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("weeks")
  const [weeks, setWeeks] = useState<number>(12)
  const [pickedEnd, setPickedEnd] = useState<Date | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Day after current schedule end = first new day (always a Monday)
  const rangeStart = useMemo(() => addDays(parseISO(scheduleEndDate), 1), [scheduleEndDate])

  // Derived range end based on current mode + input
  const rangeEnd: Date | null = useMemo(() => {
    if (mode === "weeks") {
      if (!Number.isInteger(weeks) || weeks < 1) return null
      return endOfWeek(addWeeks(rangeStart, weeks - 1), { weekStartsOn: 1 })
    }
    if (mode === "date" && pickedEnd) {
      return endOfWeek(pickedEnd, { weekStartsOn: 1 })
    }
    return null
  }, [mode, weeks, pickedEnd, rangeStart])

  const previewLabel = useMemo(() => {
    if (!rangeEnd) return null
    const startLabel = format(rangeStart, "EEEEEE d.M.", { locale: fiFormat })
    const endLabel = format(rangeEnd, "EEEEEE d.M.yyyy", { locale: fiFormat })
    return `Ajanjakso: ${startLabel} – ${endLabel}`
  }, [rangeStart, rangeEnd])

  const navigateTo = useCallback(
    (dateStr: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("viewStart", dateStr)
      // A viewEnd from before extending would describe a now-stale range
      params.delete("viewEnd")
      router.replace(pathname + "?" + params.toString())
    },
    [router, pathname, searchParams],
  )

  function resetPanel() {
    setIsOpen(false)
    setMode("weeks")
    setWeeks(12)
    setPickedEnd(undefined)
    setErrorMsg(null)
  }

  async function handleConfirm() {
    if (!rangeEnd) return
    setIsPending(true)
    setErrorMsg(null)
    try {
      const input: { scheduleEndDate: string; weeks?: number; endDate?: string } = {
        scheduleEndDate,
      }
      if (mode === "weeks") {
        input.weeks = weeks
      } else {
        input.endDate = format(rangeEnd, "yyyy-MM-dd")
      }
      const result = await extendSchedule(input)
      if (!result.success) {
        setErrorMsg(result.error)
        return
      }
      // D-09: auto-navigate to the first newly added week
      navigateTo(result.newStartDate)
      resetPanel()
    } catch {
      setErrorMsg("Viikkojen lisääminen epäonnistui. Yritä uudelleen.")
    } finally {
      setIsPending(false)
    }
  }

  function handleCancel() {
    if (isPending) return
    resetPanel()
  }

  // ----- Collapsed state: trigger only -----
  if (!isOpen) {
    return (
      <div className="px-4 pb-4">
        <Button
          variant="outline"
          size="sm"
          className="font-semibold"
          onClick={() => setIsOpen(true)}
        >
          + Lisää viikkoja
        </Button>
      </div>
    )
  }

  // ----- Expanded state: inline panel -----
  return (
    <div className="px-4 pb-4">
      <div className="border rounded-lg p-3 bg-muted/30 text-sm space-y-3">
        {mode === "weeks" ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor="extend-weeks">Lisätään:</label>
              <input
                id="extend-weeks"
                type="number"
                min={1}
                max={52}
                value={weeks}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setWeeks(Number.isFinite(v) ? v : 1)
                }}
                aria-label="Viikkojen määrä"
                className="w-16 border rounded px-2 py-1 text-sm"
                disabled={isPending}
              />
              <span>viikkoa</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("date")
                setErrorMsg(null)
              }}
              disabled={isPending}
              className="text-muted-foreground underline text-sm cursor-pointer self-start"
            >
              tai valitse päättymispäivä →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span>Päättyy:</span>
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline" size="sm" className="font-semibold" disabled={isPending} />}
                >
                  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                  {pickedEnd
                    ? format(endOfWeek(pickedEnd, { weekStartsOn: 1 }), "EEEEEE d.M.yyyy", { locale: fiFormat })
                    : "Valitse päivä"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={pickedEnd}
                    onSelect={(d) => {
                      if (!d) return
                      setPickedEnd(d)
                    }}
                    locale={fiPicker}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("weeks")
                setErrorMsg(null)
              }}
              disabled={isPending}
              className="text-muted-foreground underline text-sm cursor-pointer self-start"
            >
              tai määritä viikkoina ←
            </button>
          </div>
        )}

        {previewLabel && (
          <p className="text-muted-foreground" aria-live="polite">
            {previewLabel}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="font-semibold"
            onClick={handleConfirm}
            disabled={isPending || !rangeEnd}
          >
            {isPending ? "Lisätään..." : "Vahvista"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-semibold"
            onClick={handleCancel}
            disabled={isPending}
          >
            Peruuta
          </Button>
        </div>

        {errorMsg && (
          <p className="text-sm text-destructive" role="alert">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  )
}
