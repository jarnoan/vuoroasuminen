"use client"

import { useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { fi } from "date-fns/locale"
import { CalendarIcon, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, mobileSheetClassName } from "@/components/ui/dialog"
import { MAX_NOTE_DAYS, MAX_NOTE_LENGTH, noteDayCount, type NoteInput } from "@/lib/schedule/notes"
import type { DayNote } from "@/lib/schedule/types"

export type NoteEditorTarget = { note: DayNote } | { newOn: string }

interface NoteEditorProps {
  target: NoteEditorTarget | null      // null = closed
  onClose: () => void
  onSave: (input: NoteInput, existing: DayNote | null) => void
  onDelete: (note: DayNote) => void
}

// Edits a note's text, start day and duration. Phones get a bottom sheet (the duration
// stepper replaces dragging there); desktop gets a centred dialog.
export function NoteEditor({ target, onClose, onSave, onDelete }: NoteEditorProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false} className={`text-sm ${mobileSheetClassName}`}>
        {target && (
          <NoteEditorForm
            // Fresh form state for every note that is opened
            key={"note" in target ? target.note.id : `new-${target.newOn}`}
            existing={"note" in target ? target.note : null}
            initialStart={"note" in target ? target.note.startDay : target.newOn}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function NoteEditorForm({
  existing,
  initialStart,
  onClose,
  onSave,
  onDelete,
}: {
  existing: DayNote | null
  initialStart: string
  onClose: () => void
  onSave: NoteEditorProps["onSave"]
  onDelete: NoteEditorProps["onDelete"]
}) {
  const [text, setText] = useState(existing?.text ?? "")
  const [startDay, setStartDay] = useState(initialStart)
  const [days, setDays] = useState(existing ? noteDayCount(existing) : 1)

  const start = parseISO(startDay)
  const endDay = format(addDays(start, days - 1), "yyyy-MM-dd")
  const fmt = (d: Date) => format(d, "EEEEEE d.M.", { locale: fi })
  const range = days === 1 ? fmt(start) : `${fmt(start)} – ${fmt(parseISO(endDay))}`
  const canSave = text.trim().length > 0

  function save() {
    if (!canSave) return
    onSave({ startDay, endDay, text: text.trim() }, existing)
    onClose()
  }

  return (
    <>
      <div className="sm:hidden mx-auto -mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
      <DialogTitle className="font-heading text-lg font-bold">
        {existing ? "Muistiinpano" : "Uusi muistiinpano"}
      </DialogTitle>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note-text" className="text-xs font-semibold text-muted-foreground">Teksti</label>
        <textarea
          id="note-text"
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save() }}
          autoFocus={!existing}
          className="rounded-xl border px-3 py-2.5 text-[15px] leading-snug resize-none bg-background focus:outline-none focus:ring-3 focus:ring-ring/30 focus:border-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note-start" className="text-xs font-semibold text-muted-foreground">Alkaa</label>
          <div className="relative">
            <CalendarIcon className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="note-start"
              type="date"
              value={startDay}
              onChange={(e) => { if (e.target.value) setStartDay(e.target.value) }}
              className="h-11 w-full rounded-xl border pl-9 pr-2 text-sm font-semibold bg-background"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="note-days-label" className="text-xs font-semibold text-muted-foreground">Kestää</span>
          <div role="group" aria-labelledby="note-days-label" className="h-11 flex items-center rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => setDays(d => Math.max(1, d - 1))}
              disabled={days <= 1}
              aria-label="Lyhennä päivällä"
              className="w-11 h-full inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span aria-live="polite" className="flex-1 text-center font-bold tabular-nums">{days} pv</span>
            <button
              type="button"
              onClick={() => setDays(d => Math.min(MAX_NOTE_DAYS, d + 1))}
              disabled={days >= MAX_NOTE_DAYS}
              aria-label="Pidennä päivällä"
              className="w-11 h-full inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <p className="rounded-xl bg-muted px-3 py-2.5">
        <span className="font-semibold">{range}</span>
        <span className="text-muted-foreground"> · {days === 1 ? "yksi päivä" : `näkyy ${days} päivällä`}</span>
      </p>

      <div className="flex gap-2">
        {existing && (
          <Button
            variant="ghost"
            className="h-11 rounded-xl px-3 text-destructive hover:text-destructive"
            onClick={() => { onDelete(existing); onClose() }}
          >
            Poista
          </Button>
        )}
        <Button variant="outline" className="h-11 rounded-xl px-4 ml-auto max-sm:flex-1" onClick={onClose}>
          Peruuta
        </Button>
        <Button className="h-11 rounded-xl px-4 font-semibold max-sm:flex-1" onClick={save} disabled={!canSave}>
          Tallenna
        </Button>
      </div>
    </>
  )
}
