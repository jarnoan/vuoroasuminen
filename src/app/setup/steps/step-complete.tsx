"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Info } from "lucide-react"

export function StepComplete() {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-semibold">Asennus valmis!</h1>
      <p className="text-muted-foreground">
        Perhetiedot on tallennettu. Voit nyt siirtyä aikatauluun.
      </p>
      <Alert className="text-left flex gap-3 items-start">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Toisen vanhemman kutsuminen on tulossa. Toistaiseksi aikataulua voi
          käyttää yksin.
        </span>
      </Alert>
      <Button size="lg" render={<Link href="/dashboard" />}>
        Siirry aikatauluun
      </Button>
    </div>
  )
}
