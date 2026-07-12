# Issues

## Open

### 2026-07-04 - Migration 012 must be applied before Nurture Phase 3B runtime QA/go-live

Nurture Engine Phase 3B writes to `nurture_email_sends`, which is created by `supabase/migrations/012_nurture_phase3_matching.sql`. Adam is applying this migration in production Supabase. Runtime QA of /api/cron/nurture-matches and final launch should wait until migration 012 is live.

### 2026-06-28 — Phase 2 agreement schema and buckets must be applied before runtime QA

The Phase 2 agreement engine code depends on Adam-run SQL for `agreement_signatures`, `document_access_log`, `dockets.agreement_sent_at`, and the private `customer-documents` / `signed-agreements` storage buckets. Codex did not run SQL or create buckets per dispatch. Runtime QA should wait until Adam applies the provided SQL.


### 2026-06-25 — Reviewer blocker: customers self-select policy missing

Reviewer found that `public.customers` RLS had no authenticated self-select policy, causing 008/009 ownership subqueries to return zero rows. Fixed in migration 009 with an idempotent `customers_select_self` policy at the top. Adam must run the added statement separately because the first 009 was already applied to production.


### 2026-06-25 — Migration 009 must be applied before runtime QA

Stage 0.4 customer portal child-table reads and message inserts depend on `supabase/migrations/009_customer_dashboard_child_rls.sql`. Codex wrote the migration but did not apply SQL to production. Adam must apply 009 before QA performs runtime verification of `/account/research`, `/account/messages`, and customer message posting.

## Resolved
### 2026-07-09 - Agreement engine could send a defaulted Auction contract on quote-only dockets

QA-confirmed on prod: a docket with only selected_path="quote-endpoint" (no customer path choice) showed an enabled Send Agreement button and, if sent, generated a legally-binding Auction agreement by default (pickTemplate defaulted everything non-private_dealer to Auction; the send/sign guards only checked for a truthy path). Fixed on fix/agreement-path-guard via a canonical resolveChosenPath() threaded through all five agreement path gates; quote-endpoint/null now resolve to no-path and are refused at the dashboard button, the send API, the customer sign API, and the sign page. Pending isolated gate + review + merge.

### 2026-07-09 - ReportClient real-chosen-path narrowing now uses the shared helper

The decision-state narrowing in app/report/[token]/ReportClient.tsx duplicated the real-chosen-path check inline. It now imports isRealChosenPath from lib/agreements/templates.ts (the single source of truth, derived from REAL_CHOSEN_PATHS), and resolveChosenPath was routed through the same predicate - so there is exactly one definition of what counts as a real path. Pure no-behavior-change (identical result for auction/private_dealer/quote-endpoint/null). The approve-route payload validation still inlines its own literal check by design (a request-boundary 400 guard, not the shared narrowing); left as-is intentionally.

### 2026-07-04 - Migration 011 applied for Nurture Phase 2

Checkpoint and Phase 3A runtime state confirm migration 011 is live: Docket marketing consent fields, `lead_consent_events`, and `lead_saved_searches` are available, and Phase 2 shipped successfully.


### 2026-07-04 - Migration 010 applied for Nurture Phase 1

Checkpoint/schema gate confirms production now has `dockets.lead_source`, `lead_source_set_at`, and `lead_source_detail`, and Phase 1 shipped on main. The earlier Adam-run prerequisite is no longer open.


### 2026-06-28 — Phase 2 pre-SQL portal safety rework

Reviewer/QA found that selecting `agreement_sent_at` in shared customer portal context made existing /account pages 500 before Adam applied the Phase 2 column. Fixed by removing it from the shared select and fetching it only in the document vault with a missing-column fallback.

### 2026-07-11 - Agent dashboard had no archiving and no triage

The agent dashboard (app/agent/dashboard/page.tsx) — where Adam actually works — listed every non-archived docket in one undifferentiated urgency-sorted scroll, with no way to archive stale quote leads (admin had archiving; the agent side did not) and no fast way to see "what needs me now". Fixed on feature/agent-triage: a dedicated agent-authed PATCH route (app/api/agent/docket/[id]/route.ts) for is_archived/is_flagged, manual archive only (no auto-archive; cron untouched), a Show-archived view with Unarchive, triage chips (Needs You / Working / Cold, default Needs You) derived from the existing urgency priority, a per-card buy-signal temperature badge (Hot/Warm/Cold), and a pin toggle (is_flagged) that floats dockets to the top of the current view. No schema changes (all columns already existed). Pending isolated gate + Reviewer/QA + merge.

### 2026-07-11 - One person's many dockets read as many hot leads

Every new search/quote spawns a new docket, so an engaged buyer (real case: Jordan Warwick, 5 active Hot-badged dockets) inflated the agent dashboard into what looked like 5 hot leads. Fixed on feature/docket-grouping (display-only, no schema/endpoint changes): dockets from the same person (customer_id, else normalized email) now stack into one expandable card with a single group temperature badge, docket count, summed unread, and a most-urgent-member summary on the collapsed header; expand shows each member as its full normal card with pin/archive intact. Groups form only among dockets passing the current filters; a single passing member stays a normal card. Pending isolated gate + Reviewer/QA + merge.

### 2026-07-11 - Public intake endpoints had no spam defense

/api/system/quote and /api/system/intake created dockets and sent real emails with no honeypot, rate limit, or per-address caps — a spam flood would clutter the pipeline and, worse, burn sender reputation so real customer mail lands in spam. The long-standing TODO in quote/route.ts ("add CAPTCHA + per-IP rate limiting to all public form endpoints") is now addressed. Fixed on feature/intake-guardrails with a 4-layer fail-open stack (L1 honeypot+fill-time silent discard, L2 per-IP 5/hr via new intake_events table, L3 per-email 4 dockets/24h with note-append, L4 welcome-email 2/24h cap) in lib/intake/guardrails.ts, wired into both endpoints. Genuine repeat interest is never hard-blocked; every layer degrades to today's behavior on any error. Requires Adam to run supabase/migrations/013_intake_events.sql (Layer 2 fails open until then). Pending gate + Reviewer/QA + SQL run + merge.

### 2026-07-12 - Agent dashboard mixed the quote-nurture funnel with the sales funnel

The agent dashboard listed unengaged exact-quote leads (a nurture audience the nurture engine already handles) alongside real working leads, inflating the sales view. Fixed on feature/funnel-split (display/classification only): new isWorkingLead helper (account holder OR find_my_jdm OR any engagement OR pinned OR status past "new"); default dashboard shows working leads only with triage/grouping/pins scoped to them; unengaged quote leads collapse into a quiet Quote Pool band (N leads · X conversions · Y this month, collapsed by default) that expands to the same grouped cards. Promotion is automatic/computed — any engagement signal moves a pool docket into the working list on next load; pin/archive still work from pool cards. Lead-view tabs removed (decluttering). No schema/endpoint/cron/nurture changes. Pending gate + Reviewer/QA + merge.
