"use client"

import { format, parseISO } from "date-fns"
import { fi as fiFormat } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import type { FamilyDataState } from "./step-family-data"
import type { CalendarsState } from "./step-calendars"

interface Props {
  familyData: FamilyDataState
  calendars: CalendarsState
  parentAEmail: string
  isPending: boolean
  errorMsg: string | null
  onEdit: () => void
  onSave: () => void
}

function truncate(id: string, max = 40) {
  if (id.length <= max) return id
  return id.slice(0, max - 1) + "…"
}

export function StepReview({
  familyData,
  calendars,
  parentAEmail,
  isPending,
  errorMsg,
  onEdit,
  onSave,
}: Props) {
  const startLabel = familyData.startDate
    ? format(parseISO(familyData.startDate), "EEEE d.M.yyyy", {
        locale: fiFormat,
      })
    : "—"
  const firstParentName =
    familyData.firstParent === "father"
      ? familyData.parent1Name || "Sinä"
      : familyData.parent2Name || "Toinen vanhempi"
  const childrenList = familyData.children
    .map((c) => c.trim())
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Tarkista tiedot</h2>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">
          Sinä ({familyData.parent1Name || "—"})
        </dt>
        <dd>{parentAEmail}</dd>

        <dt className="text-muted-foreground">Toinen vanhempi</dt>
        <dd>
          {familyData.parent2Email || "—"}
          {familyData.parent2Name && (
            <span className="text-muted-foreground">
              {" "}
              ({familyData.parent2Name})
            </span>
          )}
        </dd>

        <dt className="text-muted-foreground">Lapset</dt>
        <dd>{childrenList || "—"}</dd>

        <dt className="text-muted-foreground">Aloituspäivä</dt>
        <dd>{startLabel}</dd>

        <dt className="text-muted-foreground">Ensimmäinen viikko</dt>
        <dd>{firstParentName}</dd>

        <dt className="text-muted-foreground">Kalenterit</dt>
        <dd className="space-y-1">
          <div className="font-mono text-xs">
            {truncate(calendars.parent1CalendarId)}
          </div>
          <div className="font-mono text-xs">
            {truncate(calendars.parent2CalendarId)}
          </div>
        </dd>
      </dl>

      {errorMsg && (
        <Alert variant="destructive" role="alert">
          {errorMsg}
        </Alert>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          disabled={isPending}
        >
          Muokkaa
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? "Tallennetaan…" : "Tallenna ja jatka"}
        </Button>
      </div>
    </div>
  )
}
