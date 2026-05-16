"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { generateInviteToken } from "@/actions/invite"

interface InviteSectionProps {
  initialToken: string
  initialExpiresAt: Date
  initialStatus: "active" | "expired" | "used"
  origin: string
}

export function InviteSection({
  initialToken,
  initialExpiresAt,
  initialStatus,
  origin,
}: InviteSectionProps) {
  const [token, setToken] = useState(initialToken)
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [status, setStatus] = useState(initialStatus)
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  const inviteUrl = token ? `${origin}/invite/${token}` : ""

  function renderStatus() {
    if (status === "used") {
      return (
        <p className="text-sm text-muted-foreground">
          Toinen vanhempi on liittynyt
        </p>
      )
    }
    if (status === "expired") {
      return (
        <p className="text-sm text-destructive">
          Linkki vanhentunut — luo uusi
        </p>
      )
    }
    // active — show hours remaining
    const hoursLeft = Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)),
    )
    return (
      <p className="text-sm text-muted-foreground">
        Linkki voimassa {hoursLeft} tuntia
      </p>
    )
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerate() {
    setIsRegenerating(true)
    setRegenError(null)
    try {
      const result = await generateInviteToken()
      if (result.success) {
        setToken(result.token)
        setExpiresAt(result.expiresAt)
        setStatus("active")
      } else {
        setRegenError(result.error)
      }
    } catch {
      setRegenError("Linkin luonti epäonnistui. Yritä uudelleen.")
    } finally {
      setIsRegenerating(false)
    }
  }

  const isLinkActive = status === "active" && !!token

  return (
    <div className="bg-card rounded-lg border p-6 max-w-lg space-y-4">
      <h2 className="text-base font-semibold">Kutsu toinen vanhempi</h2>

      {renderStatus()}

      <div className="flex gap-2">
        <Input
          readOnly
          value={inviteUrl}
          disabled={!isLinkActive}
          className="text-sm font-mono"
          aria-label="Kutsulinkki"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          disabled={!isLinkActive}
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

      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={isRegenerating}
      >
        {isRegenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Luo uusi linkki
      </Button>

      {regenError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{regenError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
