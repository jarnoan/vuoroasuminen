"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { listCalendars } from "@/actions/setup"

export interface CalendarsState {
  parent1CalendarId: string
  parent2CalendarId: string
}

interface Props {
  state: CalendarsState
  parent2Name: string
  onChange: (next: CalendarsState) => void
  onBack: () => void
  onContinue: () => void
}

type ListItem = { id: string; summary: string }

export function StepCalendars({
  state,
  parent2Name,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [errors, setErrors] = useState<{ parent1?: string; parent2?: string }>({})
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    listCalendars()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setItems(res.calendars)
        } else {
          setLoadError(res.error)
          setItems([])
        }
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(String(e))
        setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function validate() {
    const errs: { parent1?: string; parent2?: string } = {}
    const bad = /[\s]|https?:\/\//
    if (!state.parent1CalendarId.trim()) {
      errs.parent1 = "Valitse tai syötä kalenterin tunnus"
    } else if (bad.test(state.parent1CalendarId)) {
      errs.parent1 = "Tarkista kalenterin tunnus — se ei näytä oikealta"
    }
    if (!state.parent2CalendarId.trim()) {
      errs.parent2 = "Syötä toisen vanhemman kalenterin tunnus"
    } else if (bad.test(state.parent2CalendarId)) {
      errs.parent2 = "Tarkista kalenterin tunnus — se ei näytä oikealta"
    }
    return errs
  }

  function handleContinue() {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length === 0) onContinue()
  }

  const selectedSummary =
    items?.find((it) => it.id === state.parent1CalendarId)?.summary ?? null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Kalenterit</h2>

      <div className="space-y-2">
        <Label>Oma Google-kalenteri</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
              />
            }
          >
            {items === null ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ladataan kalentereita…
              </>
            ) : selectedSummary ? (
              <>
                {selectedSummary}
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </>
            ) : (
              <>
                Valitse kalenteri...
                <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Etsi kalenteri…" />
              <CommandList>
                <CommandEmpty>
                  Kalentereita ei löytynyt. Liitä tunnus alla.
                </CommandEmpty>
                <CommandGroup>
                  {(items ?? []).map((cal) => (
                    <CommandItem
                      key={cal.id}
                      value={cal.summary + " " + cal.id}
                      onSelect={() => {
                        onChange({ ...state, parent1CalendarId: cal.id })
                        setPickerOpen(false)
                      }}
                    >
                      <Check
                        className={
                          "mr-2 h-4 w-4 " +
                          (state.parent1CalendarId === cal.id
                            ? "opacity-100"
                            : "opacity-0")
                        }
                      />
                      <span>{cal.summary}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Label
          htmlFor="parent1CalendarIdRaw"
          className="text-muted-foreground text-xs mt-2"
        >
          Kalenterin tunnus
        </Label>
        <Input
          id="parent1CalendarIdRaw"
          value={state.parent1CalendarId}
          onChange={(e) =>
            onChange({ ...state, parent1CalendarId: e.target.value })
          }
          placeholder="esim. you@gmail.com tai ...@group.calendar.google.com"
          className="text-muted-foreground text-sm"
        />
        {errors.parent1 && (
          <Alert variant="destructive">{errors.parent1}</Alert>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="parent2CalendarId">
          {parent2Name
            ? `${parent2Name}n Google-kalenteri`
            : "Toisen vanhemman Google-kalenteri"}
        </Label>
        <Input
          id="parent2CalendarId"
          value={state.parent2CalendarId}
          onChange={(e) =>
            onChange({ ...state, parent2CalendarId: e.target.value })
          }
          placeholder="Liitä tunnus"
        />
        {errors.parent2 && (
          <Alert variant="destructive">{errors.parent2}</Alert>
        )}
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowInstructions((v) => !v)}
        >
          <ChevronDown
            className={
              "mr-1 h-4 w-4 transition-transform " +
              (showInstructions ? "rotate-180" : "")
            }
          />
          Mistä löydät kalenterin tunnuksen?
        </Button>
        {showInstructions && (
          <ol className="text-sm text-muted-foreground list-decimal pl-6 mt-2 space-y-1">
            <li>
              Avaa{" "}
              <a
                className="underline"
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
              >
                Google Calendar
              </a>{" "}
              tietokoneella (ei mobiilisovelluksessa)
            </li>
            <li>Vie hiiri vasemmassa palkissa olevan kalenterin päälle</li>
            <li>
              Klikkaa kolmen pisteen valikkoa → &quot;Asetukset ja
              jakaminen&quot;
            </li>
            <li>
              Vieritä kohtaan &quot;Yhdistä kalenteri&quot; — Kalenterin tunnus
              näkyy siellä
            </li>
            <li>Kopioi tunnus ja liitä se yllä olevaan kenttään</li>
          </ol>
        )}
      </div>

      {loadError && (
        <Alert variant="default">
          Kalentereita ei voitu ladata. Liitä tunnus käsin yllä.
        </Alert>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onBack}>
          Takaisin
        </Button>
        <Button type="button" onClick={handleContinue}>
          Jatka
        </Button>
      </div>
    </div>
  )
}
