"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateInviteToken } from "@/actions/invite"

interface StepCompleteProps {
  parent2Name: string
}

export function StepComplete({ parent2Name }: StepCompleteProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateInviteToken()
      .then((result) => {
        if (result.success) {
          setInviteUrl(`${window.location.origin}/invite/${result.token}`)
        } else {
          setGenerateError(result.error)
        }
      })
      .catch(() => {
        setGenerateError("Linkin luonti epäonnistui. Yritä uudelleen.")
      })
      .finally(() => setIsGenerating(false))
  }, [])

  async function handleCopy() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (no HTTPS, no focus, or permission denied).
      // Fail silently — the user can still copy the URL manually from the input.
    }
  }

  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-semibold">Asennus valmis!</h1>
      <p className="text-muted-foreground">Perhetiedot on tallennettu.</p>

      <div className="space-y-2 text-left">
        <p className="text-sm font-semibold">Kutsu {parent2Name} liittymään</p>

        {isGenerating && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Luodaan kutsulinkki...</span>
          </div>
        )}

        {generateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{generateError}</AlertDescription>
          </Alert>
        )}

        {inviteUrl && (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="text-sm font-mono"
                aria-label="Kutsulinkki"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={copied ? "Linkki kopioitu" : "Kopioi linkki leikepöydälle"}
                className="shrink-0 min-h-[44px] min-w-[44px]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Lähetä tämä linkki {parent2Name}:lle. Kun hän avaa sen ja kirjautuu
              Google-tilillään, hän pääsee aikatauluun.
            </p>
          </>
        )}
      </div>

      <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
        Siirry aikatauluun
      </Link>
    </div>
  )
}
