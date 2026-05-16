import { createSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getAppConfig } from "@/config/app"
import Header from "@/components/layout/header"
import { SetupWizard } from "./setup-wizard"

export const metadata = { title: "Asennus – Vuoroasuminen" }

export default async function SetupPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // D-11: any authenticated user can access /setup
  if (!user) redirect("/")

  // Per Interaction states: if family_config already exists, redirect to /dashboard.
  // This prevents an onboarded user from accidentally re-running the wizard via direct URL.
  try {
    await getAppConfig()
    redirect("/dashboard")
  } catch {
    // No config → proceed with wizard
  }

  const parentAEmail = user.email ?? ""
  const parentAName =
    (user.user_metadata?.full_name as string | undefined) ?? parentAEmail

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-12">
        <SetupWizard parentAEmail={parentAEmail} parentAName={parentAName} />
      </main>
    </div>
  )
}
