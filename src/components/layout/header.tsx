import React from "react"
import Image from "next/image"
import { LogOut } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { signOutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"

export default async function Header({ children }: { children?: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Käyttäjä"

  return (
    <header className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4 border-b">
      <div className="flex items-center gap-2">
        <span className="text-lg sm:text-xl font-semibold">Vuoroasuminen</span>
      </div>
      <div className="flex items-center gap-4">
        {children}
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold select-none"
            aria-label={fullName}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm hidden sm:inline">{fullName}</span>
        <form action={signOutAction}>
          <Button variant="outline" size="sm" type="submit" aria-label="Kirjaudu ulos">
            <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Kirjaudu ulos</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
