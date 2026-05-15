import { config } from "dotenv"

config({ path: ".env.local" })

const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PARENT_FATHER_EMAIL",
  "PARENT_MOTHER_EMAIL",
  "APP_CHILDREN",
  "APP_START_DATE",
] as const

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`)
  }
}
