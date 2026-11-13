"use client"

import { useMemo, useState } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
import { CalendarIcon, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogTitle, mobileSheetClassName } from "@/components/ui/dialog"
import { clearRange } from "@/actions/schedule"

function DateField({
  label,
  value,
  onChange,
  disabled,
  min,
}: {
  label: string
  value: Date | undefined
  onChange: (d: Date) => void
  disabled: boolean
  min?: Date
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {/* Native date input on phones, calendar popover on desktop */}
      <input
        type="date"
        aria-label={label}
        className="sm:hidden h-11 border rounded-xl px-3 text-sm bg-background"
        min={min ? format(min, "yyyy-MM-dd") : undefined}
        value={value ? format(value, "yyyy-MM-dd") : ""}
        onChange={(e) => {
          if (!e.target.value) return
          onChange(parseISO(e.target.value))
        }}
        disabled={disabled}
      />
      <Popover>
        <PopoverTrigger
          aria-label={label}
          disabled={disabled}
          className="max-sm:hidden h-11 border rounded-xl px-3 bg-background inline-flex items-center gap-2 font-semibold hover:bg-muted aria-expanded:bg-muted"
        >
          <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {value ? format(value, "EEEEEE d.M.yyyy", { locale: fiFormat }) : "Valitse päivä"}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value ?? min}
            disabled={min ? { before: min } : undefined}
            onSelect={(d) => {
              if (!d) return
              onChange(d)
            }}
            locale={fiPicker}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface ClearDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  childCount: number
  onCleared: () => void  // reload the currently displayed range
}

// Dialog on desktop, bottom sheet on phones.
export function ClearDialog({ open, onOpenChange, childCount, onCleared }: ClearDialogProps) {
  const [pickedStart, setPickedStart] = useState<Date | undefined>(undefined)
  const [pickedEnd, setPickedEnd] = useState<Date | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const dayCount = useMemo(() => {
    if (!pickedStart || !pickedEnd) return 0
    return Math.max(differenceInCalendarDays(pickedEnd, pickedStart) + 1, 0)
  }, [pickedStart, pickedEnd])

  function close() {
    onOpenChange(false)
    setPickedStart(undefined)
    setPickedEnd(undefined)
    setErrorMsg(null)
  }

  async function handleConfirm() {
    if (!pickedStart || !pickedEnd || dayCount === 0) return
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
      // D-09: no navigation; reload the displayed range so cleared cells update immediately
      close()
      onCleared()
    } catch {
      setErrorMsg("Tyhjentäminen epäonnistui. Yritä uudelleen.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (isPending) return; if (next) onOpenChange(true); else close() }}>
      <DialogContent showCloseButton={false} className={`text-sm ${mobileSheetClassName}`}>
        <div className="sm:hidden mx-auto -mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="font-heading text-lg font-bold">Tyhjennä päiväväli</DialogTitle>
          <DialogDescription>
            Poistaa valittujen päivien vanhempimerkinnät kaikilta lapsilta. Muutos on luonnos, kunnes julkaiset sen kalentereihin.
          </DialogDescription>
        </div>
        <div className="flex gap-2">
          <DateField
            label="Alkaen"
            value={pickedStart}
            onChange={(d) => {
              setPickedStart(d)
              if (pickedEnd && pickedEnd < d) setPickedEnd(undefined)
            }}
            disabled={isPending}
          />
          <DateField label="Päättyen" value={pickedEnd} onChange={setPickedEnd} disabled={isPending} min={pickedStart} />
        </div>

        {dayCount > 0 && (
          <p className="rounded-xl bg-destructive/10 text-destructive px-3 py-2.5 font-medium" aria-live="polite">
            Tyhjennetään {dayCount} {dayCount === 1 ? "päivä" : "päivää"} ({childCount} lasta)
          </p>
        )}

        {errorMsg && (
          <p className="text-destructive" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="flex gap-2 sm:justify-end">
          <Button variant="outline" className="h-11 rounded-xl px-4 max-sm:flex-1" onClick={close} disabled={isPending}>
            Peruuta
          </Button>
          <Button
            variant="destructive"
            className="h-11 rounded-xl px-4 max-sm:flex-1 font-semibold"
            onClick={handleConfirm}
            disabled={isPending || dayCount === 0}
          >
            {isPending ? "Tyhjennetään…" : "Tyhjennä"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Desktop sidebar card.
export function ClearCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="bg-background border rounded-2xl p-5 flex flex-col gap-3 text-sm" aria-labelledby="clear-card-title">
      <h2 id="clear-card-title" className="font-heading text-base font-bold">Tyhjennä päiväväli</h2>
      <p className="text-muted-foreground">Poista kaikkien lasten merkinnät valitulta ajalta, esimerkiksi suunnitelman muuttuessa.</p>
      <button
        type="button"
        onClick={onOpen}
        className="h-11 rounded-xl border-[1.5px] border-destructive/40 text-destructive font-semibold inline-flex items-center justify-center gap-2 hover:bg-destructive/5"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Valitse päivät…
      </button>
    </section>
  )
}
