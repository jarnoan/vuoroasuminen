import React from "react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getAppConfig } from "@/config/app"
import { AccountMenu } from "./account-menu"

export default async function Header({ children }: { children?: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Käyttäjä"

  let parentName: string | null = null
  try {
    const config = await getAppConfig()
    parentName = config.parents.find((p) => p.email === user.email)?.name ?? null
  } catch {
    // No family config yet (setup flow) — the menu just omits the parent role
  }

  return (
    <header className="bg-background border-b">
      <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-4 px-4 py-2 sm:px-8 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, nothing for next/image to optimise */}
          <img src="/logo.svg" alt="" aria-hidden="true" className="size-8 sm:size-9" />
          <div className="flex flex-col">
            <span className="font-heading text-[17px] sm:text-lg font-bold tracking-tight leading-tight">Vuoroasuminen</span>
            <span className="hidden sm:block text-xs text-muted-foreground">Yhteinen aikataulu vanhemmille</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <AccountMenu fullName={fullName} avatarUrl={avatarUrl} parentName={parentName} />
        </div>
      </div>
    </header>
  )
}
