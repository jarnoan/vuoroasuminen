"use client"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function SignInButton() {
  return (
    <Button size="lg" onClick={() => signIn("google", { redirectTo: "/dashboard" })}>
      Kirjaudu sisään Googlella
    </Button>
  )
}
