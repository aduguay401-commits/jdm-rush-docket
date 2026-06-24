# Stage 0.3 Notes — Dockets RLS and Email Claiming

## Corrected RLS Predicate

The Stage 0.2 live QA round-trip proved `public.profiles` is keyed by `id = auth.users.id` and has no `user_id` column. The Stage 0.3 migration therefore uses only `profiles.id = auth.uid()` in admin/agent policy predicates.

## Existing Policy Cleanup

Live QA proved pre-existing broad policies defeat isolation because Postgres OR-combines permissive RLS policies. Migration `008_dockets_rls_customer_claiming.sql` now drops these legacy policies before creating the scoped Stage 0.3 policies:

- `Authenticated users can read dockets`
- `Authenticated users can update dockets`
- `Public can read docket by report token`
- `Public can update docket decision fields`

`Service role can insert dockets` is intentionally left in place. No authenticated or anonymous INSERT or DELETE policies are added.

## Customer Route Client Classification

Routes that are already authenticated/session-based use `createServerAuthClient()` and honor RLS:

- `POST /api/customer/auth/magic-link` uses Supabase Auth OTP through the anon SSR client.
- `GET /auth/customer/callback` exchanges the login token through the anon SSR client, then performs server-only provisioning and claiming.

Existing token flows are server-side service-role, not browser-anon Supabase access. The files checked were:

- `app/report/[token]/page.tsx`: server component uses `createServerClient()` and `report_url_token`.
- `app/report/[token]/ReportClient.tsx`: browser client only calls fetch endpoints; it does not create a Supabase client.
- `app/questions/[token]/page.tsx`: server component uses `createServerClient()` and `questions_url_token`.
- `app/questions/[token]/CustomerQuestionsClient.tsx`: browser client only calls fetch endpoints; it does not create a Supabase client.
- `app/api/customer/approve/[token]/route.ts`: server route uses `createServerClient()` and `report_url_token`.
- `app/api/customer/questions/[token]/route.ts`: server route uses `createServerClient()` and `questions_url_token`.
- `app/api/customer/questions/[token]/ask/route.ts`: server route uses `createServerClient()` and `questions_url_token`.
- `app/api/customer/report/[token]/decision/route.ts`: server route uses `createServerClient()` and `report_url_token`.
- `app/api/customer/report/[token]/question/route.ts`: server route uses `createServerClient()` and `report_url_token`.

Because every token docket read/write is server-side service-role, the anonymous token policies are vestigial and are dropped to close the public anon read/write hole. Old token URLs continue to work through the server routes.

## Email Claiming

Customer provisioning now claims existing unclaimed dockets after the `customers` row is upserted. It uses the server-only service-role client because a new customer does not own the matching docket rows yet, so an anon RLS update would be blocked.

Claiming behavior:

1. Normalize the confirmed Supabase Auth email to lowercase.
2. Load unclaimed dockets where `customer_id IS NULL` with `id` and `customer_email`.
3. Match rows whose `customer_email` trims and lowercases to the customer email.
4. Update those dockets to the new `customer_id`.

## QA Dry-Run Expectations

After migration `008` is applied:

- A random authenticated customer with no claimed dockets should see `0` dockets.
- A claimed customer should see only dockets where `dockets.customer_id` matches their `customers.id`.
- An admin or agent whose `profiles.id = auth.uid()` and role is `admin` or `agent` should read all dockets.
- Anonymous Supabase reads against `public.dockets` should return `0` rows.
- Anonymous Supabase updates against `public.dockets` should update `0` rows.
- Token pages and token POST APIs should still work because they use server-side service-role access.
