"use client"

import { useState, useEffect } from "react"
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
import { publishSchedule, syncCalendars } from "@/actions/schedule"
import type { ScheduleDay } from "@/lib/schedule/types"
import { format, parseISO } from "date-fns"

interface PublishButtonProps {
  days: ScheduleDay[]
  viewStart?: string
  viewEnd?: string
  onPublished?: () => void
}

function ProgressBar({ durationMs }: { durationMs: number }) {
  const [width, setWidth] = useState("0%")

  useEffect(() => {
    // Trigger the CSS transition on next frame so it animates from 0 to 100
    const raf = requestAnimationFrame(() => {
      setWidth("100%")
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-primary rounded-full"
        style={{
          width,
          transition: `width ${durationMs}ms linear`,
        }}
      />
    </div>
  )
}

export function PublishButton({ days, viewStart, viewEnd, onPublished }: PublishButtonProps) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "publishing" | "syncing">("idle")

  // Derive draft count directly from live days prop — no ratchet state needed
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
    ? `${format(parseISO(firstDraftDate), "d.M.")} \u2013 ${format(parseISO(lastDraftDate), "d.M.yyyy")}`
    : ""

  // estimate: each entry needs ~110ms throttle delay × 2 parents, plus 3s overhead, capped at 60s
  const estimatedSyncMs = Math.min(draftCount * 2 * 110 + 3000, 60000)

  async function handlePublish() {
    setPhase("publishing")
    try {
      const publishResult = await publishSchedule(viewStart, viewEnd)
      if (!publishResult.success) {
        toast.error(publishResult.error)
        setPhase("idle")
        return
      }
      const count = publishResult.count

      setPhase("syncing")
      const syncResult = await syncCalendars(viewStart, viewEnd)

      toast.success(`Julkaistu ${count} merkintää`)
      if (!syncResult.success) {
        const failedParents = syncResult.parentResults
          .filter(pr => pr.error)
          .map(pr => `${pr.parentId}: ${pr.error}`)
        if (failedParents.length > 0) {
          toast.warning(`Kalenterin synkronointi epäonnistui: ${failedParents.join("; ")}`, { duration: 10000 })
        }
      }
      onPublished?.()
      setOpen(false)
    } catch {
      toast.error("Julkaisu epäonnistui. Yritä uudelleen.")
    } finally {
      setPhase("idle")
    }
  }

  // Disabled when no draft entries exist
  if (draftCount === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        Julkaise
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default" size="sm" />}>
        Julkaise
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Julkaise aikataulu</DialogTitle>
          <DialogDescription>
            Julkaise {draftCount} luonnosta ({dateRangeLabel})?
            Tämä lukitsee aikataulun ja synkronoi Google Kalenteriin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {phase === "syncing" ? (
            <div className="w-full">
              <p className="text-sm text-muted-foreground mb-2">
                Synkronoidaan {draftCount} tapahtumaa Google Kalenteriin…
              </p>
              <ProgressBar durationMs={estimatedSyncMs} />
            </div>
          ) : (
            <>
              <DialogClose render={<Button variant="outline" disabled={phase === "publishing"} />}>
                Peruuta
              </DialogClose>
              <Button onClick={handlePublish} disabled={phase !== "idle"}>
                {phase === "publishing" ? "Julkaistaan..." : "Vahvista"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
