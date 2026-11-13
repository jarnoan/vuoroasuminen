"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addDays, addWeeks, differenceInCalendarWeeks, endOfWeek, format, parseISO } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { fi as fiPicker } from "react-day-picker/locale"
import { CalendarIcon, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogTitle, mobileSheetClassName } from "@/components/ui/dialog"
import { extendSchedule } from "@/actions/schedule"
import type { ParentId } from "@/lib/schedule/types"

interface ExtendFormProps {
  scheduleEndDate: string  // ISO YYYY-MM-DD — current schedule's last day (Sunday)
  lastWeekStartParent?: ParentId | null  // parent assigned on the last existing week's Monday
  parents: Array<{ id: ParentId; name: string }>
  onExtended: (newStartDate: string) => void  // show the first newly added week
  onCancel?: () => void  // shown as a Peruuta button when given (the mobile sheet)
}

type Mode = "weeks" | "date"

const MAX_WEEKS = 52

function otherParent(parentId: ParentId): ParentId {
  return parentId === "father" ? "mother" : "father"
}

const parentChip: Record<ParentId, { on: string; dot: string }> = {
  father: { on: "border-isi bg-isi-tint text-isi", dot: "bg-isi" },
  mother: { on: "border-aiti-line bg-aiti-tint text-aiti-ink", dot: "bg-aiti" },
}

export function ExtendForm({ scheduleEndDate, lastWeekStartParent, parents, onExtended, onCancel }: ExtendFormProps) {
  const router = useRouter()

  // Default to continuing the alternating pattern: the opposite of whoever started last week.
  const defaultFirstParent: ParentId = lastWeekStartParent
    ? otherParent(lastWeekStartParent)
    : (parents[0]?.id ?? "father")

  const [mode, setMode] = useState<Mode>("weeks")
  const [weeks, setWeeks] = useState<number>(12)
  const [pickedEnd, setPickedEnd] = useState<Date | undefined>(undefined)
  const [firstParent, setFirstParent] = useState<ParentId>(defaultFirstParent)
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
    if (mode === "date" && pickedEnd && pickedEnd >= rangeStart) {
      return endOfWeek(pickedEnd, { weekStartsOn: 1 })
    }
    return null
  }, [mode, weeks, pickedEnd, rangeStart])

  const weekCount = rangeEnd ? differenceInCalendarWeeks(rangeEnd, rangeStart, { weekStartsOn: 1 }) + 1 : 0

  function reset() {
    setMode("weeks")
    setWeeks(12)
    setPickedEnd(undefined)
    setFirstParent(defaultFirstParent)
    setErrorMsg(null)
  }

  async function handleConfirm() {
    if (!rangeEnd) return
    setIsPending(true)
    setErrorMsg(null)
    try {
      const input: { scheduleEndDate: string; weeks?: number; endDate?: string; firstParent?: ParentId } = {
        scheduleEndDate,
        firstParent,
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
      // D-09: show the first newly added week; refresh server props (scheduleEndDate etc.)
      onExtended(result.newStartDate)
      router.refresh()
      reset()
    } catch {
      setErrorMsg("Viikkojen lisääminen epäonnistui. Yritä uudelleen.")
    } finally {
      setIsPending(false)
    }
  }

  const segment = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => { setMode(m); setErrorMsg(null) }}
      disabled={isPending}
      className="flex-1 h-9 rounded-lg text-sm font-semibold text-muted-foreground aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm transition-colors"
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div role="tablist" aria-label="Lisäystapa" className="flex gap-1 p-1 rounded-xl bg-muted">
        {segment("weeks", "Viikkoja")}
        {segment("date", "Päättymispäivä")}
      </div>

      {mode === "weeks" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWeeks(w => Math.max(1, w - 1))}
            disabled={isPending || weeks <= 1}
            aria-label="Vähemmän viikkoja"
            className="size-11 rounded-xl border bg-background inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <label className="flex-1 flex items-baseline justify-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_WEEKS}
              value={weeks}
              onChange={(e) => {
                const v = Number(e.target.value)
                setWeeks(Number.isFinite(v) ? Math.min(MAX_WEEKS, v) : 1)
              }}
              aria-label="Viikkojen määrä"
              className="w-14 text-center font-heading text-2xl font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              disabled={isPending}
            />
            <span className="text-muted-foreground">viikkoa</span>
          </label>
          <button
            type="button"
            onClick={() => setWeeks(w => Math.min(MAX_WEEKS, w + 1))}
            disabled={isPending || weeks >= MAX_WEEKS}
            aria-label="Enemmän viikkoja"
            className="size-11 rounded-xl border bg-background inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Päättyy (viikon sunnuntaina)</span>
          {/* Native date input on phones, calendar popover on desktop */}
          <input
            type="date"
            aria-label="Päättymispäivä"
            className="sm:hidden h-11 border rounded-xl px-3 text-sm bg-background"
            min={format(rangeStart, "yyyy-MM-dd")}
            value={pickedEnd ? format(pickedEnd, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              if (!e.target.value) return
              setPickedEnd(parseISO(e.target.value))
            }}
            disabled={isPending}
          />
          <Popover>
            <PopoverTrigger
              disabled={isPending}
              className="max-sm:hidden h-11 border rounded-xl px-3 bg-background inline-flex items-center gap-2 font-semibold hover:bg-muted aria-expanded:bg-muted"
            >
              <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              {pickedEnd
                ? format(endOfWeek(pickedEnd, { weekStartsOn: 1 }), "EEEEEE d.M.yyyy", { locale: fiFormat })
                : "Valitse päivä"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={pickedEnd}
                defaultMonth={pickedEnd ?? rangeStart}
                disabled={{ before: rangeStart }}
                onSelect={(d) => {
                  if (!d) return
                  setPickedEnd(d)
                }}
                locale={fiPicker}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Ensimmäinen viikko alkaa</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Aloittava vanhempi">
          {parents.map(p => {
            const selected = firstParent === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFirstParent(p.id)}
                disabled={isPending}
                className={`flex-1 h-11 rounded-xl border-[1.5px] px-3 inline-flex items-center gap-2 font-semibold transition-colors ${
                  selected ? parentChip[p.id].on : "bg-background hover:bg-muted"
                }`}
              >
                <span className={`size-2.5 rounded-full ${parentChip[p.id].dot}`} aria-hidden="true" />
                {p.name}
                {p.id === defaultFirstParent && (
                  <span className="ml-auto text-[11px] font-medium opacity-70">vuorossa</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {rangeEnd && (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">
            {format(rangeStart, "EEEEEE d.M.", { locale: fiFormat })} – {format(rangeEnd, "EEEEEE d.M.yyyy", { locale: fiFormat })}
          </span>
          {" · "}luonnoksina, kunnes julkaiset
        </p>
      )}

      {errorMsg && (
        <p className="text-destructive" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button
            variant="outline"
            className="h-11 rounded-xl flex-1"
            onClick={() => { if (!isPending) { reset(); onCancel() } }}
            disabled={isPending}
          >
            Peruuta
          </Button>
        )}
        <Button
          className="h-11 rounded-xl flex-1 font-semibold"
          onClick={handleConfirm}
          disabled={isPending || !rangeEnd}
        >
          {isPending
            ? "Lisätään…"
            : weekCount > 0
              ? `Lisää ${weekCount} ${weekCount === 1 ? "viikko" : "viikkoa"}`
              : "Lisää viikkoja"}
        </Button>
      </div>
    </div>
  )
}

// Desktop sidebar card: the form is always visible.
export function ExtendCard(props: Omit<ExtendFormProps, "onCancel">) {
  return (
    <section className="bg-background border rounded-2xl p-5 flex flex-col gap-4" aria-labelledby="extend-card-title">
      <h2 id="extend-card-title" className="font-heading text-base font-bold">Lisää viikkoja</h2>
      <ExtendForm {...props} />
    </section>
  )
}

// Mobile bottom sheet (opened from the ⋯ menu or the end-of-schedule button).
export function ExtendSheet({
  open,
  onOpenChange,
  onExtended,
  ...props
}: Omit<ExtendFormProps, "onCancel"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className={mobileSheetClassName}>
        <div className="sm:hidden mx-auto -mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <DialogTitle className="font-heading text-lg font-bold">Lisää viikkoja</DialogTitle>
        <ExtendForm
          {...props}
          onExtended={(d) => { onOpenChange(false); onExtended(d) }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
