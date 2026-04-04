import { auth, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export default async function Header() {
  const session = await auth()
  if (!session?.user) return null

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">Vuoroasuminen</span>
      </div>
      <div className="flex items-center gap-4">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "User"}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm">{session.user.name}</span>
        <form
          action={async () => {
            "use server"
            await signOut()
          }}
        >
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  )
}
