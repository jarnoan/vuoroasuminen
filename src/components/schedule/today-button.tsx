"use client"

import { Button } from "@/components/ui/button"

interface TodayButtonProps {
  todayDate: string // ISO date string to find the row
}

export function TodayButton({ todayDate }: TodayButtonProps) {
  function handleClick() {
    const element = document.querySelector(`[data-date="${todayDate}"]`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="fixed bottom-6 right-6 z-50 shadow-lg"
      onClick={handleClick}
    >
      Today
    </Button>
  )
}
