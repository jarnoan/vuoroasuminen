"use client"

import { useState } from "react"
import { StepIndicator, type WizardStep } from "./step-indicator"
import { StepFamilyData, type FamilyDataState } from "./steps/step-family-data"
import { StepCalendars, type CalendarsState } from "./steps/step-calendars"
import { StepReview } from "./steps/step-review"
import { StepComplete } from "./steps/step-complete"
import { saveWizardConfig } from "@/actions/setup"

export interface SetupWizardProps {
  parentAEmail: string
  parentAName: string
}

export function SetupWizard({ parentAEmail, parentAName }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [familyData, setFamilyData] = useState<FamilyDataState>(() => ({
    parent1Name: parentAName,
    parent2Name: "",
    parent2Email: "",
    children: [""],
    startDate: "",
    firstParent: "father",
  }))
  const [calendars, setCalendars] = useState<CalendarsState>({
    parent1CalendarId: "",
    parent2CalendarId: "",
  })
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSave() {
    setIsPending(true)
    setErrorMsg(null)
    try {
      const result = await saveWizardConfig({
        parent1Name: familyData.parent1Name.trim(),
        parent1Email: parentAEmail,
        parent1CalendarId: calendars.parent1CalendarId.trim(),
        parent2Name: familyData.parent2Name.trim(),
        parent2Email: familyData.parent2Email.trim(),
        parent2CalendarId: calendars.parent2CalendarId.trim(),
        children: familyData.children.map((c) => c.trim()).filter(Boolean),
        startDate: familyData.startDate,
        firstParent: familyData.firstParent,
      })
      if (!result.success) {
        setErrorMsg(result.error)
        return
      }
      setStep(4)
    } catch (err) {
      console.error("[SetupWizard] save failed:", err)
      setErrorMsg("Tallennus epäonnistui. Tarkista tiedot ja yritä uudelleen.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <StepIndicator current={step} />
      <div
        className={
          step === 4
            ? "text-center space-y-6"
            : "bg-card rounded-lg border p-6 space-y-6"
        }
      >
        {step === 1 && (
          <StepFamilyData
            state={familyData}
            parentAName={parentAName}
            parentAEmail={parentAEmail}
            onChange={setFamilyData}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepCalendars
            state={calendars}
            parent2Name={familyData.parent2Name}
            onChange={setCalendars}
            onBack={() => setStep(1)}
            onContinue={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepReview
            familyData={familyData}
            calendars={calendars}
            parentAEmail={parentAEmail}
            isPending={isPending}
            errorMsg={errorMsg}
            onEdit={() => {
              setErrorMsg(null)
              setStep(1)
            }}
            onSave={handleSave}
          />
        )}
        {step === 4 && <StepComplete />}
      </div>
    </div>
  )
}
