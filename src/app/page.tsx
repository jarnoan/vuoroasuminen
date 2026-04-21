import { auth } from "@/auth"
import { redirect } from "next/navigation"
import SignInButton from "@/components/sign-in-button"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Vuoroasuminen</h1>
        <p className="text-muted-foreground">Yhteinen vuoroasumisaikataulu vanhemmille</p>
        <SignInButton />
      </div>
    </main>
  )
}
