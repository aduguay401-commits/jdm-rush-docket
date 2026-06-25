# Stage 0.4 Notes — My JDM Garage Real Wiring

## Runtime Prerequisite

Migration `supabase/migrations/009_customer_dashboard_child_rls.sql` must be applied by Adam before runtime QA. Codex does not apply production SQL.

The migration adds customer-owned RLS policies joined through:

```sql
dockets.customer_id -> customers.id
customers.auth_user_id = auth.uid()
```

Policy coverage:
- `marcus_questions`: customer `SELECT` for owned dockets.
- `customer_questions`: customer `SELECT` and `INSERT` for owned dockets.
- `auction_research`: customer `SELECT` for owned dockets.
- `private_dealer_options`: customer `SELECT` for owned dockets.
- `auction_estimate`: customer `SELECT` for owned dockets.

## Auth and Data Access

The `/account` customer portal uses `createServerAuthClient()` and the existing Supabase Auth customer role. Docket ownership is enforced by Stage 0.3 `dockets` RLS policies, and child rows are enforced by the new Stage 0.4 migration. Token routes remain unchanged and continue to use server-side service-role access for legacy report/question URLs.

Unauthenticated account routes redirect to `/account/login`, which sends magic links through the existing Stage 0.2 `POST /api/customer/auth/magic-link` flow.

## Page Wiring

- `/account` lists claimed dockets for the logged-in customer.
- `/account/car?docket=<id>` loads one owned docket and drives the approved v6 journey shell.
- `/account/research?docket=<id>` reads real dealer options, auction research, and report token availability.
- `/account/documents?docket=<id>` exposes the current research report and keeps Phase 2/3 invoices/import/legal documents pending until those tables exist.
- `/account/journey?docket=<id>` shows real vehicle context and a pending shipment setup state until Phase 3 shipment records exist.
- `/account/messages?docket=<id>` reads `marcus_questions` plus `customer_questions` as one chronological thread and posts new customer messages to `customer_questions`.

## Visual Constraint

The signed-off v6 visual system was preserved. Changes hydrate data and handlers while keeping the approved dark shell, header, cards, journey spine, documents vault, and Messages slide-over styling.
