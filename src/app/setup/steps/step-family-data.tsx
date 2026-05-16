"use client"

import { useState } from "react"
import { format, isMonday, parseISO } from "date-fns"
import { fi as fiPicker } from "react-day-picker/locale"
import { fi as fiFormat } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert } from "@/components/ui/alert"

export interface FamilyDataState {
  parent1Name: string
  parent2Name: string
  parent2Email: string
  children: string[]
  startDate: string // ISO yyyy-MM-dd, must be a Monday
  firstParent: "father" | "mother"
}

interface Props {
  state: FamilyDataState
  parentAName: string
  parentAEmail: string
  onChange: (next: FamilyDataState) => void
  onContinue: () => void
}

type FieldErrors = Partial<
  Record<
    | "parent1Name"
    | "parent2Name"
    | "parent2Email"
    | "children"
    | "startDate"
    | "firstParent",
    string
  >
>

export function StepFamilyData({
  state,
  parentAName: _parentAName,
  parentAEmail,
  onChange,
  onContinue,
}: Props) {
  const [errors, setErrors] = useState<FieldErrors>({})

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!state.parent1Name.trim()) errs.parent1Name = "Nimi ei voi olla tyhjä"
    if (!state.parent2Name.trim()) errs.parent2Name = "Nimi ei voi olla tyhjä"
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(state.parent2Email.trim())) {
      errs.parent2Email = "Syötä kelvollinen sähköpostiosoite"
    } else if (
      state.parent2Email.trim().toLowerCase() === parentAEmail.toLowerCase()
    ) {
      errs.parent2Email =
        "Toisen vanhemman sähköposti ei voi olla sama kuin omasi"
    }
    const trimmedChildren = state.children.map((c) => c.trim()).filter(Boolean)
    if (trimmedChildren.length === 0) {
      errs.children = "Lisää vähintään yksi lapsen nimi"
    } else {
      const lower = trimmedChildren.map((c) => c.toLowerCase())
      if (new Set(lower).size !== lower.length) {
        errs.children = "Tämä nimi on jo lisätty"
      }
    }
    if (!state.startDate) {
      errs.startDate = "Valitse aloituspäivä"
    } else if (!isMonday(parseISO(state.startDate))) {
      errs.startDate = "Aloituspäivän on oltava maanantai"
    }
    if (state.firstParent !== "father" && state.firstParent !== "mother") {
      errs.firstParent = "Valitse kumpi vanhempi aloittaa"
    }
    return errs
  }

  function handleContinue() {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length === 0) {
      onContinue()
    }
  }

  function updateChild(idx: number, value: string) {
    const next = [...state.children]
    next[idx] = value
    onChange({ ...state, children: next })
  }
  function addChild() {
    onChange({ ...state, children: [...state.children, ""] })
  }
  function removeChild(idx: number) {
    if (state.children.length <= 1) return
    onChange({ ...state, children: state.children.filter((_, i) => i !== idx) })
  }

  const startDateLabel = state.startDate
    ? format(parseISO(state.startDate), "EEEEEE d.M.yyyy", { locale: fiFormat })
    : "Valitse päivä"

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Perhetiedot</h2>

      <div className="space-y-2">
        <Label htmlFor="parent1Name">Sinun nimesi</Label>
        <Input
          id="parent1Name"
          value={state.parent1Name}
          onChange={(e) =>
            onChange({ ...state, parent1Name: e.target.value })
          }
          aria-describedby={
            errors.parent1Name ? "parent1Name-error" : undefined
          }
        />
        {errors.parent1Name && (
          <Alert variant="destructive" id="parent1Name-error">
            {errors.parent1Name}
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent2Name">Toisen vanhemman nimi</Label>
        <Input
          id="parent2Name"
          value={state.parent2Name}
          onChange={(e) =>
            onChange({ ...state, parent2Name: e.target.value })
          }
          aria-describedby={
            errors.parent2Name ? "parent2Name-error" : undefined
          }
        />
        {errors.parent2Name && (
          <Alert variant="destructive" id="parent2Name-error">
            {errors.parent2Name}
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent2Email">Toisen vanhemman Google-sähköposti</Label>
        <Input
          id="parent2Email"
          type="email"
          value={state.parent2Email}
          onChange={(e) =>
            onChange({ ...state, parent2Email: e.target.value })
          }
          aria-describedby={
            errors.parent2Email ? "parent2Email-error" : undefined
          }
        />
        {errors.parent2Email && (
          <Alert variant="destructive" id="parent2Email-error">
            {errors.parent2Email}
          </Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label>Lapset</Label>
        <div className="space-y-2">
          {state.children.map((name, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={name}
                placeholder="Lapsen nimi"
                onChange={(e) => updateChild(idx, e.target.value)}
                aria-label={`Lapsi ${idx + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0"
                onClick={() => removeChild(idx)}
                disabled={state.children.length <= 1}
                aria-label={`Poista ${name || `lapsi ${idx + 1}`}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addChild}>
          + Lisää lapsi
        </Button>
        {errors.children && (
          <Alert variant="destructive">{errors.children}</Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label>Aloituspäivä (maanantai)</Label>
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {startDateLabel}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={state.startDate ? parseISO(state.startDate) : undefined}
              onSelect={(d) => {
                if (!d) return
                onChange({ ...state, startDate: format(d, "yyyy-MM-dd") })
              }}
              disabled={(d) => !isMonday(d)}
              locale={fiPicker}
            />
          </PopoverContent>
        </Popover>
        {errors.startDate && (
          <Alert variant="destructive">{errors.startDate}</Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label>Kenellä lapset ovat ensimmäisellä viikolla?</Label>
        <RadioGroup
          value={state.firstParent}
          onValueChange={(v: string) =>
            onChange({
              ...state,
              firstParent: v === "mother" ? "mother" : "father",
            })
          }
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id="firstParent-father" value="father" />
            <Label htmlFor="firstParent-father">
              {state.parent1Name || "Sinä"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="firstParent-mother" value="mother" />
            <Label htmlFor="firstParent-mother">
              {state.parent2Name || "Toinen vanhempi"}
            </Label>
          </div>
        </RadioGroup>
        {errors.firstParent && (
          <Alert variant="destructive">{errors.firstParent}</Alert>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button type="button" onClick={handleContinue}>
          Jatka
        </Button>
      </div>
    </div>
  )
}
