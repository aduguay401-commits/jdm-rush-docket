# Issues

## Open

### 2026-07-03 - Migration 010 must be applied before Nurture Phase 1 runtime QA/merge

Nurture Engine Phase 1 dashboard code selects `dockets.customer_id`, `lead_source`, `lead_source_set_at`, and `lead_source_detail`. `customer_id` exists in live production, but the three lead-source columns do not yet. Adam must run `supabase/migrations/010_nurture_phase1_lead_source.sql` against production before this branch is merged/deployed, matching the Adam-run migration pattern.

### 2026-06-28 — Phase 2 agreement schema and buckets must be applied before runtime QA

The Phase 2 agreement engine code depends on Adam-run SQL for `agreement_signatures`, `document_access_log`, `dockets.agreement_sent_at`, and the private `customer-documents` / `signed-agreements` storage buckets. Codex did not run SQL or create buckets per dispatch. Runtime QA should wait until Adam applies the provided SQL.


### 2026-06-25 — Reviewer blocker: customers self-select policy missing

Reviewer found that `public.customers` RLS had no authenticated self-select policy, causing 008/009 ownership subqueries to return zero rows. Fixed in migration 009 with an idempotent `customers_select_self` policy at the top. Adam must run the added statement separately because the first 009 was already applied to production.


### 2026-06-25 — Migration 009 must be applied before runtime QA

Stage 0.4 customer portal child-table reads and message inserts depend on `supabase/migrations/009_customer_dashboard_child_rls.sql`. Codex wrote the migration but did not apply SQL to production. Adam must apply 009 before QA performs runtime verification of `/account/research`, `/account/messages`, and customer message posting.

## Resolved

### 2026-06-28 — Phase 2 pre-SQL portal safety rework

Reviewer/QA found that selecting `agreement_sent_at` in shared customer portal context made existing /account pages 500 before Adam applied the Phase 2 column. Fixed by removing it from the shared select and fetching it only in the document vault with a missing-column fallback.


None yet.
