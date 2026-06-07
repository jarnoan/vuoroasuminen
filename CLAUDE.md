## Project

**Vuoroasuminen**

A shared web application for co-parents to plan and track which children stay with which parent on each day. Both parents log in with their Google accounts, see and edit the same schedule, and the plan automatically syncs to dedicated Google Calendars — one per parent. The name "vuoroasuminen" is Finnish for alternating custody.

**Core Value:** Both parents always see the same up-to-date custody schedule, reflected in their Google Calendars, without manual coordination.

### Constraints

- **Auth**: Google OAuth only — no email/password auth; both parents need Google accounts
- **Calendar**: Google Calendar API — integration is a hard requirement, not optional
- **Collaboration**: Real-time shared data — both parents must see each other's changes promptly
- **Conflict resolution**: Last-write-wins — no complex merge UI needed

## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x | Full-stack React framework — UI, API routes, Server Actions | Standard choice in 2026 for full-stack React; App Router with Server Actions eliminates separate API layer boilerplate; built by Vercel, first-class deployment support; most adoption, largest ecosystem |
| TypeScript | 5.x | Type safety across the entire stack | Non-negotiable for a shared-data app; Drizzle schema types flow end-to-end to the UI without code generation |
| Auth.js (NextAuth) | v5.x | Google OAuth authentication; stores OAuth tokens (incl. refresh tokens) in DB | The canonical Next.js auth library; v5 integrates natively with App Router and Server Actions; official Drizzle adapter stores Google refresh tokens needed for Calendar API |
| Drizzle ORM | 0.41+ | Type-safe PostgreSQL queries and migrations | Lightweight (~7.4KB), SQL-first, generates direct SQL you can read and audit; Drizzle schema doubles as TypeScript types; official Auth.js adapter available; Relational Queries V2 (beta, 2025) matches Prisma's DX |
| Supabase | Platform (latest) | Managed PostgreSQL + real-time WebSocket subscriptions | Supabase Realtime listens to Postgres logical replication and broadcasts row-level changes to subscribed clients — this is exactly the "both parents see each other's edits immediately" requirement; avoids building a separate WebSocket server; generous free tier |
| Tailwind CSS | 4.x | Utility-first styling | v4 is stable since early 2025; CSS-native `@theme` configuration, no `tailwind.config.js` needed; shadcn/ui fully compatible |
| shadcn/ui | latest (canary for v4) | Accessible, composable UI primitives | Not a dependency — copies source into your project; Table, Dialog, Button, Popover all needed for the schedule grid; fully updated for Tailwind v4 + React 19 |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `googleapis` | 171.x | Official Google Calendar API client (TypeScript-native) | All Google Calendar read/write operations — listing events, creating all-day events per child per day, deleting stale events on republish |
| `@auth/drizzle-adapter` | latest | Persist Auth.js sessions and OAuth tokens (incl. refresh_token) in PostgreSQL via Drizzle | Required to store Google refresh tokens so the server can call Calendar API on behalf of users after login |
| `@supabase/supabase-js` | 2.x | Supabase client — real-time subscriptions in client components | Subscribe to Postgres Changes on the `schedule_cells` table; triggers UI re-render when either parent edits a cell |
| `@supabase/ssr` | latest | Supabase client utilities for Next.js App Router (server + client) | Handles cookie-based sessions correctly in Server Components, Route Handlers, and Middleware |
| `zod` | 3.x | Runtime schema validation | Validate Server Action inputs; share schemas between client and server |
| `next-safe-action` | 7.x | Typed Server Actions with input validation and optimistic update support | Wraps Server Actions with Zod validation and provides `useOptimisticAction` hook; reduces boilerplate for the many cell-edit mutations |
| `date-fns` | 3.x | Date arithmetic and formatting | Calculate the 12-week rolling window, format day labels, determine week boundaries for the alternating pattern |
| `pg` | 8.x | PostgreSQL driver used by Drizzle | Required by Drizzle when not using the Supabase client for queries |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit and integration tests | Default for new Next.js projects in 2025+; ESM-native, Jest-compatible API, faster than Jest |
| Playwright | End-to-end tests | Tests the full schedule edit → real-time update flow in a browser |
| Drizzle Kit | Schema migrations and introspection | `drizzle-kit push` for dev, `drizzle-kit migrate` for production |
| ESLint + Prettier | Linting and formatting | `next lint` ships a sensible default config; add Prettier for formatting |
## Installation
# Bootstrap
# Auth and database
# Supabase (DB host + realtime)
# Google Calendar API
# Server Actions, validation
# UI
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase (PostgreSQL + Realtime) | Neon (PostgreSQL only) + Ably | Choose Neon + Ably if you want pure serverless database scaling and are comfortable wiring a separate real-time service; Neon has better Vercel/edge integration but no built-in pub/sub — you pay for and maintain two services instead of one |
| Supabase (PostgreSQL + Realtime) | Neon + Pusher | Same tradeoff as above; Pusher is mature but adds another vendor and billing relationship |
| Supabase (PostgreSQL + Realtime) | Neon + custom WebSocket server (Socket.IO) | Only worthwhile at high scale with strict cost optimization; self-managed WebSockets add operational complexity that is not justified for a two-user app |
| Drizzle ORM | Prisma | Prisma has better docs and more beginner tutorials; choose it if the team already knows Prisma; Drizzle is preferred here for lighter bundle and direct SQL transparency |
| Auth.js v5 | Lucia | Lucia is more explicit and lower-level; Auth.js is the right default when Google OAuth + database token storage is the entire auth requirement |
| Vercel (Next.js deployment) | Railway | Railway (container-based, ~$5/mo Hobby plan) is the better choice if you want to colocate the Next.js app and PostgreSQL under one platform without Supabase; Vercel + Supabase is the slightly simpler path for this stack |
| shadcn/ui | Radix UI directly | Use Radix directly only if you want to write all your own styles; shadcn/ui IS Radix + Tailwind, so there is no meaningful reason to skip it |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Firebase Realtime Database / Firestore | Google vendor lock-in beyond Calendar; no SQL queries; pricing surprises at scale; poor TypeScript DX compared to Drizzle | Supabase (PostgreSQL + Realtime) |
| Socket.IO with a custom server | Requires managing WebSocket server, horizontal scaling with Redis adapter, and separate deployment; unjustified complexity for a two-user app | Supabase Realtime (CDC-backed pub/sub, fully managed) |
| Prisma Accelerate / PlanetScale | Extra cost layers; PlanetScale dropped free tier in 2024; Prisma Accelerate adds latency for a simple two-user app | Supabase + Drizzle direct |
| `@googleapis/calendar` subpackage (separate install) | `googleapis` monorepo package includes Calendar and handles OAuth2 client; the subpackage is appropriate only for edge runtimes with strict bundle size requirements, which do not apply here | `googleapis` (full package) |
| Separate Express/Fastify backend | Adds second deployment, CORS configuration, and context switching; Next.js Server Actions and Route Handlers cover all server-side logic needed here | Next.js App Router Server Actions |
| NextAuth v4 (legacy) | v4 is incompatible with Next.js 15 App Router in several edge cases; v5 is the stable target for App Router projects | Auth.js v5 (`next-auth@beta`) |
| Tailwind v3 | If starting fresh today, there is no reason to start on v3; shadcn/ui's canary supports v4 natively and the migration path from v3 is deliberately painful | Tailwind v4 |
## Stack Patterns by Variant
- Supabase Realtime Postgres Changes subscription on `schedule_cells` table in a Client Component
- Server Action mutates the DB row → Supabase CDC broadcasts the change → other parent's browser re-renders the cell
- No polling needed; no custom WebSocket server
- Store Google `access_token` and `refresh_token` in Auth.js `accounts` table via Drizzle adapter
- On publish, Server Action retrieves tokens from DB, constructs an OAuth2 client with refresh logic, then calls `googleapis` Calendar API to batch-upsert all-day events
- Refresh token rotation: implement in the Auth.js `jwt` callback to exchange expired access tokens automatically
- Vercel for Next.js (zero-config, preview deployments, edge CDN)
- Supabase for PostgreSQL + Realtime (managed, handles connection pooling via Supavisor)
- Both have free tiers that support a two-user app comfortably; Supabase free tier pauses after 1 week of inactivity on the free plan — upgrade to Pro ($25/mo) before sharing with real users
## Version Compatibility
| Package | Compatible With | Notes |
|---------|----------------|-------|
| `next-auth@beta` (v5) | Next.js 15.x, React 19 | v5 requires App Router; v4 and v5 are not interchangeable |
| `@auth/drizzle-adapter` | next-auth@beta, drizzle-orm 0.30+ | Schema must include `accounts` table with `refresh_token` column |
| `drizzle-orm` 0.41+ | pg 8.x, Node 18+ | Use Node 20+ for `crypto.randomUUID()` without polyfill |
| `@supabase/supabase-js` 2.x | Next.js 15, React 18/19 | Use `@supabase/ssr` alongside for cookie-based auth in App Router |
| `tailwindcss` v4 | shadcn/ui canary, React 19 | shadcn stable tracks Tailwind v3; use `npx shadcn@canary` for v4 |
| `googleapis` 171.x | Node 18+, TypeScript 5.x | Types included; no `@types/googleapis` needed |
## Sources
- SoftwareMill — Modern Full Stack Application Architecture using Next.js 15 (stack confirmation): https://softwaremill.com/modern-full-stack-application-architecture-using-next-js-15/
- Auth.js official docs — Google provider + refresh token config: https://authjs.dev/getting-started/providers/google
- Auth.js official docs — Drizzle adapter: https://authjs.dev/getting-started/adapters/drizzle
- Auth.js official docs — Refresh Token Rotation: https://authjs.dev/guides/refresh-token-rotation
- Supabase official docs — Realtime with Next.js: https://supabase.com/docs/guides/realtime/realtime-with-nextjs
- Supabase official docs — Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- npmjs.com — `googleapis` package, version 171.4.0: https://www.npmjs.com/package/googleapis
- shadcn/ui docs — Tailwind v4 support: https://ui.shadcn.com/docs/tailwind-v4
- Neon vs. Supabase comparison (Bytebase, 2025): https://www.bytebase.com/blog/neon-vs-supabase/
- Railway vs. Vercel comparison (Ritza, 2025): https://ritza.co/articles/gen-articles/cloud-hosting-providers/railway-vs-vercel/
- PkgPulse — Next.js Developer Ecosystem Guide 2026: https://www.pkgpulse.com/blog/nextjs-developer-ecosystem-guide-2026

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
