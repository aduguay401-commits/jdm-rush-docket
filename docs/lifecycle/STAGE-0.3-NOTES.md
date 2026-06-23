# Stage 0.3 Notes — Dockets RLS and Email Claiming

## Corrected RLS Predicate

The Stage 0.2 live QA round-trip proved `public.profiles` is keyed by `id = auth.users.id` and has no `user_id` column. The Stage 0.3 migration therefore uses only `profiles.id = auth.uid()` in admin/agent policy predicates.

## Customer Route Client Classification

Routes that are already authenticated/session-based use `createServerAuthClient()` and honor RLS:

- `POST /api/customer/auth/magic-link` uses Supabase Auth OTP through the anon SSR client.
- `GET /auth/customer/callback` exchanges the login token through the anon SSR client, then performs server-only provisioning and claiming.

Existing token routes stay on `createServerClient()` service-role access in Stage 0.3 because they are token-gated dual-access routes and must keep working for unclaimed dockets:

- `POST /api/customer/approve/[token]`
- `POST /api/customer/questions/[token]`
- `POST /api/customer/questions/[token]/ask`
- `POST /api/customer/report/[token]/decision`
- `POST /api/customer/report/[token]/question`
- Token pages under `/questions/[token]` and `/report/[token]`

Moving those token routes to the anon RLS client now would break the explicit requirement that old token URLs continue to serve unclaimed dockets.

## Email Claiming

Customer provisioning now claims existing unclaimed dockets after the `customers` row is upserted. It uses the server-only service-role client because a new customer does not own the matching docket rows yet, so an anon RLS update would be blocked.

Claiming behavior:

1. Normalize the confirmed Supabase Auth email to lowercase.
2. Load unclaimed dockets where `customer_id IS NULL` with `id` and `customer_email`.
3. Match rows whose `customer_email` trims and lowercases to the customer email.
4. Update those dockets to the new `customer_id`.
