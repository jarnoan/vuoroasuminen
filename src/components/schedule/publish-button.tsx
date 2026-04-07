"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { publishDraft } from "@/actions/schedule"
import type { ScheduleDay } from "@/lib/schedule/types"
import { format, parseISO } from "date-fns"

interface PublishButtonProps {
  days: ScheduleDay[]
  onPublished?: () => void
}

export function PublishButton({ days, onPublished }: PublishButtonProps) {
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // Derive draft count directly from live days prop — no ratchet state needed
  // Derive draft count directly from live days prop
  const draftCells = days.flatMap(day =>
    day.cells.filter(cell => cell.status === "draft")
  )
  const draftCount = draftCells.length

  // Find date range of days that have at least one draft entry
  const draftDays = days.filter(day =>
    day.cells.some(cell => cell.status === "draft")
  )
  const firstDraftDate = draftDays[0]?.date
  const lastDraftDate = draftDays[draftDays.length - 1]?.date

  const dateRangeLabel = firstDraftDate && lastDraftDate
    ? `${format(parseISO(firstDraftDate), "d MMM")} \u2013 ${format(parseISO(lastDraftDate), "d MMM yyyy")}`
    : ""

  async function handlePublish() {
    setPublishing(true)
    try {
      const result = await publishDraft()
      if (result.success) {
        toast.success(`Published ${result.count} entries`)
        onPublished?.()
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to publish. Please try again.")
    } finally {
      setPublishing(false)
    }
  }

  // Per D-08: disabled when no draft entries exist
  // Disabled when no draft entries exist
  if (draftCount === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        Publish
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" size="sm" />}>
        Publish
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Publish Schedule</DialogTitle>
          <DialogDescription>
            Publish {draftCount} draft entries ({dateRangeLabel})?
            This will lock the schedule and sync to Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={publishing} />}>
            Cancel
          </DialogClose>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? "Publishing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
