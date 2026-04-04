import "next-auth"

declare module "next-auth" {
  interface Session {
    error?: string | null
  }
}

import "next-auth/jwt"

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string
    expires_at?: number
    refresh_token?: string
    error?: string
  }
}
