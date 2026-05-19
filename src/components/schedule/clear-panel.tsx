"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { clearRange } from "@/actions/schedule"

interface ClearPanelProps {
  childCount: number
}

export function ClearPanel({ childCount }: ClearPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pickedStart, setPickedStart] = useState<Date | undefined>(undefined)
  const [pickedEnd, setPickedEnd] = useState<Date | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Ref to the trigger button so we can return focus after collapse (UI-SPEC accessibility)
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const previewLabel = useMemo(() => {
    if (!pickedStart || !pickedEnd) return null
    const days = differenceInCalendarDays(pickedEnd, pickedStart) + 1
    if (days <= 0) return null
    return `Tyhjennetään: ${days} päivää (${childCount} lasta)`
  }, [pickedStart, pickedEnd, childCount])

  function resetPanel() {
    setIsOpen(false)
    setPickedStart(undefined)
    setPickedEnd(undefined)
    setErrorMsg(null)
    // Restore focus to the trigger button after collapse
    queueMicrotask(() => triggerRef.current?.focus())
  }

  async function handleConfirm() {
    if (!pickedStart || !pickedEnd) return
    setIsPending(true)
    setErrorMsg(null)
    try {
      const result = await clearRange({
        startDate: format(pickedStart, "yyyy-MM-dd"),
        endDate: format(pickedEnd, "yyyy-MM-dd"),
      })
      if (!result.success) {
        setErrorMsg(result.error)
        return
      }
      // D-09: no URL navigation; router.refresh() re-fetches server data so cleared cells update immediately
      resetPanel()
      router.refresh()
    } catch {
      setErrorMsg("Tyhjentäminen epäonnistui. Yritä uudelleen.")
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
          ref={triggerRef}
          variant="outline"
          size="sm"
          className="font-semibold"
          onClick={() => setIsOpen(true)}
        >
          × Tyhjennä päiväväli
        </Button>
      </div>
    )
  }

  // ----- Expanded state: inline panel -----
  return (
    <div className="px-4 pb-4">
      <div className="border rounded-lg p-3 bg-muted/30 text-sm space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm" htmlFor="clear-start-date">Alkaen:</label>
          {/* Native date input — mobile only */}
          <input
            id="clear-start-date"
            type="date"
            className="sm:hidden border rounded-md px-2 py-1 text-sm"
            value={pickedStart ? format(pickedStart, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              if (!e.target.value) return
              setPickedStart(parseISO(e.target.value))
            }}
            disabled={isPending}
          />
          {/* Calendar Popover — desktop only */}
          <Popover>
            <PopoverTrigger
              render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" disabled={isPending} />}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {pickedStart
                ? format(pickedStart, "EEEEEE d.M.yyyy", { locale: fiFormat })
                : "Valitse päivä"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={pickedStart}
                onSelect={(d) => {
                  if (!d) return
                  setPickedStart(d)
                }}
                locale={fiPicker}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm" htmlFor="clear-end-date">Päättyy:</label>
          {/* Native date input — mobile only */}
          <input
            id="clear-end-date"
            type="date"
            className="sm:hidden border rounded-md px-2 py-1 text-sm"
            value={pickedEnd ? format(pickedEnd, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              if (!e.target.value) return
              setPickedEnd(parseISO(e.target.value))
            }}
            disabled={isPending}
          />
          {/* Calendar Popover — desktop only */}
          <Popover>
            <PopoverTrigger
              render={<Button variant="outline" size="sm" className="font-semibold hidden sm:flex" disabled={isPending} />}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {pickedEnd
                ? format(pickedEnd, "EEEEEE d.M.yyyy", { locale: fiFormat })
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
            disabled={isPending || !previewLabel}
          >
            {isPending ? "Tyhjennetään..." : "Vahvista"}
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
