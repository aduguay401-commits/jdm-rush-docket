# JDM Rush Docket — Claude Code Instructions

## Project Overview
Private lead qualification and customer reporting platform for JDM Rush Imports Inc.
Automates the flow: customer form submission → export agent research → import cost calculation → branded customer report → purchase approval.

Deployment: Vercel (auto-deploy on push to main)

## Tech Stack
- Framework: Next.js 16 App Router + TypeScript
- Styling: Tailwind CSS 4 (CSS-first config via `@theme inline` in globals.css)
- Database: Supabase (Postgres + Auth + Storage)
- Email: Resend (DEV_MODE=true routes all emails to admin)
- SMS: Twilio (notification triggers)
- Font: Outfit (Google Fonts, served via next/font)
- No test suite exists in this project

## Build & Verify Commands
- `npm run dev` — local dev server
- `npm run build` — must pass with zero errors before every push
- `npm run lint` — ESLint check
- Never run `npm test` — no test suite exists

## Code Conventions

### App Router
- Use App Router patterns exclusively — `app/` directory (no `src/` wrapper)
- Server components by default, `'use client'` only when needed
- All API routes live in `app/api/` using `route.ts` with Next.js Route Handlers
- Dynamic routes: `[id]` for docket IDs, `[token]` for customer-facing pages

### Imports
- Root-level imports: `lib/`, `app/` — no `@/` alias needed
- Do not use `src/` — everything lives at project root

### Supabase (Database + Auth)
- Server client: `import { createClient } from '@/lib/supabase/server'` — for server components and API routes
- Browser client: `import { createClient } from '@/lib/supabase/client'` — for client components
- Service role client: use Supabase service key for admin/system operations (bypasses RLS)
- Anon client: for user-facing authenticated operations
- Auth: custom Supabase Auth (not NextAuth) — see `lib/supabase/server-auth.ts`

### API Routes
- Auth check pattern: parse session from Supabase auth cookie
- Always return proper JSON error responses, never raw HTML
- Rate-limit sensitive endpoints (customer intake, approval)

## Design System

### Colors
- Background: `#0d0d0d` (near-black)
- Accent/Primary: `#E55125` (orange)
- Text: white
- Muted text: `#888` or `#666`
- Font: Outfit (Google Fonts, variable weight)

### Style
- Dark, minimal, premium
- Customer-facing pages: max-width 680px centered
- Agent/Admin dashboards: full width
- Use Tailwind's dark color palette consistently

## File Structure Rules

### Pages (routes)
- Home/Dashboard: `app/page.tsx` (root redirect)
- Agent pages: `app/agent/dashboard/page.tsx`, `app/agent/docket/[id]/page.tsx`
- Admin pages: `app/admin/dashboard/page.tsx`, `app/admin/agents/page.tsx`, `app/admin/conversation/[id]/page.tsx`
- Customer-facing: `app/report/[token]/page.tsx`, `app/questions/[token]/page.tsx`
- Agent login: `app/agent/login/page.tsx`

### API Routes
- System: `app/api/system/intake/route.ts` (customer form submission endpoint)
- Admin: `app/api/admin/` (docket management, agent management)
- Agent: `app/api/agent/` (research triggers, question sending, rollback)
- Customer: `app/api/customer/` (questions, report viewing, approval decisions)
- Cron: `app/api/cron/follow-up/route.ts` (scheduled follow-up triggers)

### Shared Utilities (`lib/`)
- `lib/supabase/server.ts` — Supabase server client
- `lib/supabase/server-auth.ts` — auth helpers for server-side
- `lib/supabase/client.ts` — Supabase browser client
- `lib/email.ts` — Resend email sending
- `lib/emails/reportReadyAdmin.ts` — admin notification template
- `lib/sms.ts` — Twilio SMS utilities
- `lib/whatsapp.ts` — WhatsApp integration
- `lib/importCalculator.ts` — import cost calculation logic
- `lib/exchangeRate.ts` — JPY→CAD exchange rate
- `lib/invoiceStub.ts` — invoice summary generation
- `lib/urls.ts` — URL construction helpers
- `lib/dockets/dashboardDisplay.ts` — docket display logic
- `lib/dockets/activityFeed.ts` — activity feed aggregation
- `lib/customer/homeBaseStatusCopy.ts` — status copy templates
- `lib/admin/dockets.ts` — admin docket operations
- `lib/admin/auth.ts` — admin authorization
- `lib/admin/types.ts` — admin type definitions

## Key Business Rules

### Naming
- The export agent fee is labeled **Export Agent Fee** — NEVER "Gemmy Fee"
- All emails sign off as "Adam & the JDM Rush Team" / `support@jdmrushimports.ca`

### Access Control
- Customer-facing pages require NO login — they use URL tokens (e.g., `/report/[token]`)
- Agent and Admin pages require Supabase Auth login
- Admin pages additionally check admin role via `lib/admin/auth.ts`

### Workflow
1. Customer submits intake form (Wix form → webhook → `/api/system/intake`)
2. Docket created, assigned to an export agent
3. Agent researches the vehicle (Japan auctions)
4. Agent sends branded report to customer (email with `/report/[token]` link)
5. Customer views report, asks questions, approves or declines

### Email
- Transactional emails via Resend
- `DEV_MODE=true` routes all emails to admin for testing
- Customer reports include a direct link to `/report/[token]`
- System emails from `support@jdmrushimports.ca`

### Brand Assets
- Logo URL: `https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png`
- Font: Outfit (Google Fonts)

## Git Rules
- Always push to `main` branch
- Every push must pass `npm run build` with zero errors
- Write clear commit messages describing what changed
- Never commit `.env.local` — it contains Supabase service keys

## Quick Sanity Checks
1. `npm run build` — zero errors
2. Agent dashboard loads at `/agent/dashboard`
3. Admin dashboard loads at `/admin/dashboard`
4. API routes return proper JSON (not HTML error pages)
5. Customer report page works with a valid token
6. No hardcoded URLs — use `lib/urls.ts` helpers or env vars
