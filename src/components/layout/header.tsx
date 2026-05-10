import React from "react"
import Image from "next/image"
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
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">Vuoroasuminen</span>
      </div>
      <div className="flex items-center gap-4">
        {children}
        {avatarUrl && (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm">{fullName}</span>
        <form action={signOutAction}>
          <Button variant="outline" size="sm" type="submit">
            Kirjaudu ulos
          </Button>
        </form>
      </div>
    </header>
  )
}
