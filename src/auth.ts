import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import authConfig from "./auth.config"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: store tokens from OAuth account
      if (account) {
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        }
      }
      // Token not expired yet
      if (Date.now() < (token.expires_at as number) * 1000) {
        return token
      }
      // Token expired — refresh it (per D-06)
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refresh_token as string,
          }),
        })
        const newTokens = await response.json()
        if (!response.ok) throw new Error("Refresh failed")
        return {
          ...token,
          access_token: newTokens.access_token,
          expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
          refresh_token: newTokens.refresh_token ?? token.refresh_token,
        }
      } catch {
        return { ...token, error: "RefreshTokenError" }
      }
    },
    async session({ session, token }) {
      session.error = (token.error as string) ?? null
      return session
    },
  },
  ...authConfig,
})
