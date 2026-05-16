"use client"

import { Check } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export type WizardStep = 1 | 2 | 3 | 4

const STEPS: Array<{ index: WizardStep; label: string }> = [
  { index: 1, label: "Perhetiedot" },
  { index: 2, label: "Kalenteri" },
  { index: 3, label: "Tarkista" },
  { index: 4, label: "Valmis" },
]

export function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <ol className="flex items-center justify-between gap-2 max-w-lg mx-auto mb-8">
      {STEPS.map((step, i) => {
        const isActive = step.index === current
        const isComplete = step.index < current
        return (
          <li key={step.index} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={
                "flex items-center justify-center rounded-full text-xs font-semibold transition-colors " +
                (isActive
                  ? "bg-primary text-primary-foreground h-8 w-8"
                  : isComplete
                  ? "bg-primary text-primary-foreground h-6 w-6"
                  : "border border-border text-muted-foreground h-6 w-6 bg-background")
              }
              aria-current={isActive ? "step" : undefined}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : step.index}
            </div>
            <span
              className={
                "text-sm " +
                (isActive ? "font-semibold" : "text-muted-foreground")
              }
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && <Separator className="flex-1" />}
          </li>
        )
      })}
    </ol>
  )
}
