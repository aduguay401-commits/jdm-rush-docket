# Issues

## Open

### 2026-06-25 — Reviewer blocker: customers self-select policy missing

Reviewer found that `public.customers` RLS had no authenticated self-select policy, causing 008/009 ownership subqueries to return zero rows. Fixed in migration 009 with an idempotent `customers_select_self` policy at the top. Adam must run the added statement separately because the first 009 was already applied to production.


### 2026-06-25 — Migration 009 must be applied before runtime QA

Stage 0.4 customer portal child-table reads and message inserts depend on `supabase/migrations/009_customer_dashboard_child_rls.sql`. Codex wrote the migration but did not apply SQL to production. Adam must apply 009 before QA performs runtime verification of `/account/research`, `/account/messages`, and customer message posting.

## Resolved

None yet.
