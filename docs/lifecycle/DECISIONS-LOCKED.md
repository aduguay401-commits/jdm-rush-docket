# LOCKED DECISIONS — JDM Rush Customer Lifecycle Platform

**Locked by:** Adam Duguay, 2026-06-19 (walked through one-by-one with the orchestrator)
**Basis:** Phase-0 investigation (`docs/lifecycle/INVESTIGATION-FINDINGS.md`, verified SOUND by Reviewer).
**Status:** These 9 decisions LOCK the PRD. The phased roadmap (`ROADMAP.md`) is built on them.

---

| # | Decision | LOCKED choice | Why |
|---|----------|---------------|-----|
| **D1** | Customer auth provider | **Supabase Auth** (customer role, magic-link / email-OTP) | Native RLS with no custom auth bridge; lowest security surface; magic-link fits import buyers. (Adam initially leaned NextAuth; reverted once the Supabase-RLS coupling was made explicit.) |
| **D2** | Token → account migration | **Dual-access + email claiming**, optional ~90-day token sunset | Non-breaking: existing token URLs keep working; account creation claims matching-email dockets; clear path to the secured end-state. |
| **D3** | RLS rollout pace | **Gradual — `dockets` table first**, existing child tables in follow-up PRs | Smaller/safer changes, portal ships sooner. New sensitive tables (customers, signatures, license, shipments, documents) are RLS-native from birth regardless. |
| **D4** | Driver's-license storage | **Supabase Storage private bucket, done right** — UUID paths, short-lived signed URLs, access logging, encrypted at rest | Matches the PRD's strict-PII standard on existing infra. App-level encryption remains a no-migration future upgrade (UUID paths carry no PII). |
| **D5** | Agreement render / e-sign | **Server-side PDF (pdf-lib) + client-side signature capture** | Only path to true tamper-evidence: server fills + renders + embeds signature + stamps audit (timestamp, IP) + hashes + locks. No third-party e-sign (per PRD). |
| **D6** | Accounting provider | **Provider interface + stub now; wire FreshBooks later** | Phase 2 unblocked from the QuickBooks→FreshBooks business decision; swappable layer means no rewrite. Stub = admin emailed to send the deposit invoice (the D-3.7 gate is already human-verified). |
| **D7** | Retention | **Separate lifetimes** — customer account/login soft-deletes ~1yr after last activity; the legal purchase packet retained on its own longer, lawyer-set clock | The legal record (agreement, license, deposit) must NOT die with the login. Two independent retention paths. |
| **D8** | Customer-portal location | **In the docket app** (`docket.jdmrushimports.ca`); `jdmrushimports.ca` is the front door (adds a "Customer Login / My Account" link) | Keeps all authed data access behind the docket's RLS (no service-role bypass re-introduced on a second codebase). Biggest scope simplifier — ~90% of the build is in the docket repo; jdm-rush-next change is just the login link. |
| **D9** | Shipment tracking source | **Manual-first** (admin/agent advance stages, upload docs, paste MarineTraffic link) | Matches the PRD's out-of-scope decision on Gemmy/JEMI scraping (fragile, no API). Automation is a clean Phase-4 add-on later via the same fields/API. |

---

## Non-blocking human follow-ups (do NOT gate the build)
1. **Legal-record retention number** (D7) → Adam's lawyer. Build proceeds with a configurable retention value.
2. **QuickBooks → FreshBooks** (D6) → Adam + Patrick (accountant). Build proceeds on the stub; FreshBooks plug-in wired when settled. Keep JDM and Element Pictures books separate.
3. **Site→docket intake is currently unauthenticated** — note for when accounts exist (the `/find-my-jdm` → docket `/api/system/intake` POST carries no auth token today).

## Carried-forward build-critical note (from the findings doc, Reviewer-confirmed)
- `vehicle_description` is live on `dockets` in the DB but exists ONLY via an ad-hoc ALTER (comment at intake route line 2), NOT in any tracked migration. A from-scratch rebuild from `supabase/migrations/` would miss it. Any new migration baseline must include it.
