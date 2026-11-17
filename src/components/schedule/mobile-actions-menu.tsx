"use client"

import { useState } from "react"
import { CalendarPlus, Ellipsis, Minus, Plus, Rows3, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "./row-zoom"

interface MobileActionsMenuProps {
  onExtend: () => void
  onClear: () => void
  zoom: number
  onStepZoom: (delta: number) => void
}

// Mobile-only "⋯" menu: the less frequent actions that have their own cards on desktop.
export function MobileActionsMenu({ onExtend, onClear, zoom, onStepZoom }: MobileActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const item = "h-12 w-full rounded-lg px-3 flex items-center gap-3 text-sm font-medium text-left hover:bg-muted"
  const zoomButton = "size-10 rounded-lg border inline-flex items-center justify-center hover:bg-muted disabled:opacity-40"
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Lisää toimintoja"
        className="sm:hidden size-11 shrink-0 rounded-xl border bg-background inline-flex items-center justify-center hover:bg-muted aria-expanded:bg-muted aria-expanded:border-foreground"
      >
        <Ellipsis className="size-[18px]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5 gap-0 rounded-xl">
        {/* Zoom stays open between taps so the rows can be resized step by step */}
        <div className="h-12 w-full px-3 flex items-center gap-3 text-sm font-medium">
          <Rows3 className="size-[18px]" aria-hidden="true" />
          <span className="flex-1">Rivikoko</span>
          <button
            type="button"
            onClick={() => onStepZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Loitonna (pienemmät rivit)"
            className={zoomButton}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onStepZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Lähennä (suuremmat rivit)"
            className={zoomButton}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={item} onClick={() => { setOpen(false); onExtend() }}>
          <CalendarPlus className="size-[18px]" aria-hidden="true" />
          Lisää viikkoja
        </button>
        <div className="h-px bg-border mx-1.5 my-1" />
        <button type="button" className={`${item} text-destructive`} onClick={() => { setOpen(false); onClear() }}>
          <Trash2 className="size-[18px]" aria-hidden="true" />
          Tyhjennä päiväväli…
        </button>
      </PopoverContent>
    </Popover>
  )
}
