"use client"

import { useState, useEffect, type ReactNode } from "react"
import { toast } from "sonner"
import { Check, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  mobileSheetClassName,
} from "@/components/ui/dialog"
import { publishSchedule, syncCalendars } from "@/actions/schedule"
import type { ScheduleDay } from "@/lib/schedule/types"
import { format, parseISO } from "date-fns"

interface PublishButtonProps {
  days: ScheduleDay[]
  viewStart?: string
  viewEnd?: string
  onPublished?: (revertedEntryIds: string[]) => void
}

function ProgressBar({ durationMs }: { durationMs: number }) {
  const [width, setWidth] = useState("0%")

  useEffect(() => {
    // Trigger the CSS transition on next frame. Stop short of 100% so the bar
    // never looks finished while the sync (e.g. rate-limit retries) is still running.
    const raf = requestAnimationFrame(() => {
      setWidth("95%")
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-isi rounded-full"
        style={{
          width,
          transition: `width ${durationMs}ms ease-out`,
        }}
      />
    </div>
  )
}

function Step({ state, children }: { state: "done" | "active" | "pending"; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-2.5 text-sm ${state === "pending" ? "text-muted-foreground" : ""}`}>
      <span
        className={`size-5 shrink-0 rounded-full inline-flex items-center justify-center ${
          state === "done" ? "bg-isi text-isi-fg" : state === "active" ? "text-isi" : "border-2 border-border"
        }`}
        aria-hidden="true"
      >
        {state === "done" && <Check className="size-3" strokeWidth={3} />}
        {state === "active" && <Loader2 className="size-4 animate-spin" />}
      </span>
      {children}
    </li>
  )
}

function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center tabular-nums ${className}`}>
      {count}
    </span>
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
    ? `${format(parseISO(firstDraftDate), "d.M.")} – ${format(parseISO(lastDraftDate), "d.M.yyyy")}`
    : ""

  // Snapshot taken when publishing starts. Once publishSchedule commits, realtime
  // flips the cells to 'published' and the live draftCount drops to 0 — the dialog
  // must keep showing the original numbers (and stay mounted) until sync finishes.
  const [snapshot, setSnapshot] = useState<{ count: number; label: string } | null>(null)
  const shownCount = snapshot?.count ?? draftCount
  const shownLabel = snapshot?.label ?? dateRangeLabel
  const busy = phase !== "idle"

  // estimate: inserts are paced at ~125ms combined across parents, plus 3s overhead, capped at 60s
  const estimatedSyncMs = Math.min(shownCount * 125 + 3000, 60000)

  async function handlePublish() {
    setSnapshot({ count: draftCount, label: dateRangeLabel })
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

      const reverted = syncResult.revertedEntryIds.length
      if (syncResult.success) {
        toast.success(`Julkaistu ${count} merkintää`)
      } else {
        const failedParents = syncResult.parentResults
          .filter(pr => pr.error)
          .map(pr => `${pr.parentId}: ${pr.error}`)
        const published = Math.max(count - reverted, 0)
        toast.error(
          `Kalenterin synkronointi epäonnistui${failedParents.length > 0 ? `: ${failedParents.join("; ")}` : ""}. ` +
          (reverted > 0
            ? `${reverted} merkintää jäi luonnokseksi${published > 0 ? `, ${published} julkaistiin` : ""}. Yritä julkaista uudelleen.`
            : "Yritä julkaista uudelleen."),
          { duration: 10000 },
        )
      }
      onPublished?.(syncResult.revertedEntryIds)
      setOpen(false)
    } catch {
      toast.error("Julkaisu epäonnistui. Yritä uudelleen.")
    } finally {
      setPhase("idle")
      setSnapshot(null)
    }
  }

  const hasDrafts = draftCount > 0 || busy

  return (
    <>
      {/* Desktop: toolbar button, greyed out without drafts */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasDrafts}
        className="max-sm:hidden h-11 rounded-xl px-4 inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:border disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Upload className="size-4" aria-hidden="true" />
        Julkaise
        {draftCount > 0 && <CountBadge count={draftCount} className="bg-isi text-isi-fg" />}
      </button>

      {/* Mobile: small floating pill, only when there is something to publish */}
      {hasDrafts && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Julkaise ${draftCount} luonnosta`}
          className="sm:hidden fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] h-12 rounded-full pl-4 pr-3 inline-flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-black/20 active:scale-95 transition-transform"
        >
          <Upload className="size-4" aria-hidden="true" />
          Julkaise
          <CountBadge count={shownCount} className="bg-isi text-isi-fg" />
        </button>
      )}

      <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next) }}>
        <DialogContent showCloseButton={false} className={`gap-4 ${mobileSheetClassName}`}>
          <div className="sm:hidden mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="font-heading text-lg font-bold">
              {busy ? "Julkaistaan…" : "Julkaise aikataulu"}
            </DialogTitle>
            <DialogDescription>
              {shownCount} luonnosta · {shownLabel}
            </DialogDescription>
          </div>

          {busy ? (
            <div className="flex flex-col gap-4" role="status" aria-live="polite">
              <ProgressBar durationMs={estimatedSyncMs} />
              <ol className="flex flex-col gap-2.5">
                <Step state={phase === "publishing" ? "active" : "done"}>
                  {phase === "publishing" ? "Julkaistaan merkintöjä…" : "Merkinnät julkaistu"}
                </Step>
                <Step state={phase === "syncing" ? "active" : "pending"}>
                  Synkronoidaan {shownCount} tapahtumaa Google Kalenteriin…
                </Step>
              </ol>
              <p className="text-xs text-muted-foreground">
                Jos synkronointi epäonnistuu, kalenterista puuttuvat merkinnät palautetaan luonnoksiksi, ja voit julkaista ne uudelleen.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Luonnokset lukitaan ja synkronoidaan molempien vanhempien Google Kalentereihin.
              </p>
              <div className="flex gap-2 sm:justify-end">
                <DialogClose render={<Button variant="outline" className="h-11 rounded-xl px-4 max-sm:flex-1" />}>
                  Peruuta
                </DialogClose>
                <Button onClick={handlePublish} className="h-11 rounded-xl px-4 max-sm:flex-1">
                  Julkaise {shownCount}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
