# JDM Rush Docket System — Codex Instructions

## Project Overview
This is a private lead qualification and customer reporting platform for JDM Rush Imports Inc.
It automates the flow from customer form submission → export agent research → import cost calculation → branded customer report → purchase approval.

## Tech Stack
- Framework: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- Database: Supabase (Postgres + Auth + Storage)
- Email: nodemailer (Gmail SMTP, lib/email.ts) — DEV_MODE=true routes all emails to admin
- Deployment: Vercel (auto-deploy on push to main)

## Build & Verify Commands
- npm run build — must pass with zero errors before every push
- npm run dev — local dev server
- npm test — vitest run (unit suite: lib/rush.test.ts; added ticket #8)

## Code Conventions
- Use App Router patterns (app/ directory, server components by default, use client only when needed)
- All API routes live in app/api/ using route.ts with Next.js Route Handlers
- Supabase server client: import from lib/supabase/server.ts
- Supabase browser client: import from lib/supabase/client.ts
- Use Supabase service role client for admin/system operations (bypasses RLS)
- Use Supabase anon client for user-facing authenticated operations

## Design System
- Background: #0d0d0d
- Accent/Primary: #E55125 (orange)
- Text: white
- Muted text: #888 or #666
- Font: Outfit (Google Fonts)
- Style: Dark, minimal, premium
- Customer-facing pages: max-width 680px centered
- Agent/Admin dashboards: full width

## File Structure Rules
- Agent (Marcus) pages: app/agent/
- Admin (Adam) pages: app/admin/
- Customer-facing pages: app/report/ and app/questions/
- API routes: app/api/system/, app/api/agent/, app/api/customer/, app/api/admin/
- Shared utilities: lib/

## Key Business Rules
- The export agent fee is labeled Export Agent Fee — NEVER Gemmy Fee
- All emails sign off as Adam & the JDM Rush Team / support@jdmrushimports.ca
- Customer-facing pages require NO login — they use URL tokens
- Agent and Admin pages require Supabase Auth login
- Logo URL: https://scfezjqjbzqbtfsveedl.supabase.co/storage/v1/object/public/docket-files/Assets/JDMRUSH_Imports_RGB_Colour-white_png.png

## Review Standards
- Agent write handlers start with `requireAdminOrAgent()` and return 403 JSON before parsing bodies, logging payloads, or using service-role clients. Auth regression tests mock the Supabase auth/profile boundary, not the authorization helper.

## Critical Paths
- Anonymous POST to `/api/agent/proceed`, `/api/agent/send-questions`, and `/api/agent/research/[id]` returns 403 JSON before business database, email, or SMS operations. Use a fixture UUID; authenticated behavior is tested with mocked dependencies unless live testing is explicitly authorized.

## Git Rules
- Always push to main branch
- Every push must have zero build errors
- Write clear commit messages describing what changed

Push to main with zero build errors."