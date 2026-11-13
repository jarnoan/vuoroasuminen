"use client"

import Image from "next/image"
import { ChevronDown, LogOut } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { signOutAction } from "@/actions/auth"

interface AccountMenuProps {
  fullName: string
  avatarUrl: string | null
  parentName?: string | null
}

function Avatar({ fullName, avatarUrl }: { fullName: string; avatarUrl: string | null }) {
  return avatarUrl ? (
    <Image src={avatarUrl} alt="" width={32} height={32} className="size-8 rounded-full" />
  ) : (
    <span
      aria-hidden="true"
      className="size-8 rounded-full bg-isi text-isi-fg flex items-center justify-center text-sm font-semibold select-none"
    >
      {fullName.charAt(0).toUpperCase()}
    </span>
  )
}

// Avatar + name open a small menu; sign-out lives inside it instead of a
// prominent header button.
export function AccountMenu({ fullName, avatarUrl, parentName }: AccountMenuProps) {
  const firstName = fullName.split(" ")[0]
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Tili: ${fullName}. Avaa valikko`}
        className="h-11 rounded-full pl-1.5 pr-1.5 sm:pr-2.5 inline-flex items-center gap-2 text-sm font-medium hover:bg-muted aria-expanded:bg-muted transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar fullName={fullName} avatarUrl={avatarUrl} />
        <span className="hidden sm:inline">{firstName}</span>
        <ChevronDown className="hidden sm:block size-3.5 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5 rounded-xl gap-0">
        <div className="px-3 pt-2.5 pb-2 flex flex-col gap-0.5">
          <span className="font-semibold">{fullName}</span>
          <span className="text-xs text-muted-foreground">
            Kirjautunut Googlella{parentName ? ` · ${parentName}` : ""}
          </span>
        </div>
        <div className="h-px bg-border mx-1.5 my-1" />
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full h-11 rounded-lg px-3 flex items-center gap-2.5 text-sm hover:bg-muted text-left"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Kirjaudu ulos
          </button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
