import { auth, signIn } from "@/auth"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Vuoroasuminen</h1>
        <p className="text-muted-foreground">Shared custody schedule for co-parents</p>
        <form
          action={async () => {
            "use server"
            await signIn("google")
          }}
        >
          <Button size="lg" type="submit">
            Sign in with Google
          </Button>
        </form>
      </div>
    </main>
  )
}
