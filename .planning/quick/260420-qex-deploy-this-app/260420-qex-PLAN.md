---
phase: quick
plan: 260420-qex
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: [DEPLOY]
user_setup:
  - service: vercel
    why: "Next.js deployment platform"
    env_vars:
      - name: DATABASE_URL
        source: "Same Supabase connection string from .env.local"
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Same Supabase URL from .env.local"
      - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
        source: "Same Supabase anon key from .env.local"
      - name: AUTH_GOOGLE_ID
        source: "Same Google OAuth client ID from .env.local"
      - name: AUTH_GOOGLE_SECRET
        source: "Same Google OAuth client secret from .env.local"
      - name: AUTH_SECRET
        source: "Same Auth.js secret from .env.local"
  - service: google-cloud-console
    why: "Add production redirect URI to OAuth client"
    dashboard_config:
      - task: "Add https://<your-vercel-domain>/api/auth/callback/google to Authorized redirect URIs"
        location: "Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID"
      - task: "Add https://<your-vercel-domain> to Authorized JavaScript origins"
        location: "Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client ID"
must_haves:
  truths:
    - "App is accessible at a public Vercel URL"
    - "Google OAuth sign-in works on the deployed URL"
    - "Schedule page loads and shows data from Supabase"
  artifacts:
    - path: ".vercel/project.json"
      provides: "Vercel project link"
  key_links:
    - from: "Vercel deployment"
      to: "Supabase PostgreSQL"
      via: "DATABASE_URL env var"
      pattern: "DATABASE_URL"
    - from: "Vercel deployment"
      to: "Google OAuth"
      via: "AUTH_GOOGLE_ID + redirect URI"
      pattern: "callback/google"
---

<objective>
Deploy the vuoroasuminen Next.js app to Vercel so it is accessible at a public URL.

Purpose: Make the MVP available to both parents online instead of localhost only.
Output: Live Vercel deployment with working auth and database connectivity.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/config/app.ts
@next.config.ts
@.env.local (env var names only — do NOT commit values)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Vercel CLI and deploy</name>
  <files></files>
  <action>
1. Install the Vercel CLI globally: `npm i -g vercel`
2. Run `vercel` in the project root to link the project to a Vercel account (interactive prompts — follow defaults for Next.js framework detection).
3. After linking, set all required environment variables using the Vercel CLI. Read each value from `.env.local` and set it for production:
   ```
   vercel env add DATABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   vercel env add AUTH_GOOGLE_ID production
   vercel env add AUTH_GOOGLE_SECRET production
   vercel env add AUTH_SECRET production
   ```
4. Also set `AUTH_TRUST_HOST=true` (required by Auth.js v5 on Vercel).
5. Also set `NEXTAUTH_URL` to the production Vercel URL once known (or omit — Auth.js v5 auto-detects on Vercel when AUTH_TRUST_HOST=true).
6. Run `vercel --prod` to trigger a production deployment.
7. Note the deployment URL.

IMPORTANT: The Vercel CLI requires interactive login — if auth fails, this becomes a checkpoint for the user to run `vercel login` manually.
  </action>
  <verify>
    <automated>vercel ls --limit 1</automated>
  </verify>
  <done>Vercel production deployment exists and a public URL is returned.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Configure Google OAuth redirect URI and verify deployment</name>
  <what-built>Production Vercel deployment of vuoroasuminen</what-built>
  <how-to-verify>
1. Copy the Vercel production URL from Task 1 output.
2. Go to Google Cloud Console -> APIs and Services -> Credentials -> your OAuth 2.0 Client ID.
3. Add to "Authorized JavaScript origins": `https://YOUR-VERCEL-DOMAIN`
4. Add to "Authorized redirect URIs": `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`
5. Save the OAuth client.
6. Visit the Vercel URL in your browser.
7. Verify the app loads (you should see the sign-in page).
8. Click "Sign in with Google" and complete the OAuth flow.
9. Verify you land on the schedule page and can see data.

NOTE: If the app is in Google OAuth "Testing" mode, only test users added in the OAuth consent screen can sign in. Add the mother's email as a test user if not already done.
  </how-to-verify>
  <resume-signal>Type "approved" if sign-in and schedule work, or describe issues.</resume-signal>
</task>

</tasks>

<verification>
- `vercel ls` shows a production deployment
- Visiting the Vercel URL loads the app
- Google OAuth sign-in completes successfully
- Schedule data from Supabase displays correctly
</verification>

<success_criteria>
The app is live at a public Vercel URL. Google OAuth works. Both parents can sign in and see the shared schedule.
</success_criteria>

<output>
After completion, create `.planning/quick/260420-qex-deploy-this-app/260420-qex-SUMMARY.md`
</output>
