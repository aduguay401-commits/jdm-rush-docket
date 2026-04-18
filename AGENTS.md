# JDM Rush Docket System — Codex Instructions

## Project Overview
This is a private lead qualification and customer reporting platform for JDM Rush Imports Inc.
It automates the flow from customer form submission → export agent research → import cost calculation → branded customer report → purchase approval.

## Tech Stack
- Framework: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- Database: Supabase (Postgres + Auth + Storage)
- Email: Resend (DEV_MODE=true routes all emails to admin)
- Deployment: Vercel (auto-deploy on push to main)

## Build & Verify Commands
- npm run build — must pass with zero errors before every push
- npm run dev — local dev server
- Never run npm test — no test suite exists in this project

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

## Git Rules
- Always push to main branch
- Every push must have zero build errors
- Write clear commit messages describing what changed

Push to main with zero build errors."