# Customer Auth Setup

Stage 0.5 changes the Docket-owned customer auth entrypoints from magic-link/email-OTP to Supabase-native email+password plus Google OAuth. The provider remains Supabase Auth, so customer RLS, the D8 portal-location decision, and D2 verified-email claiming remain unchanged.

## Routes

Customer auth routes for Stage 0.5:

- `GET /account/login` renders customer login with email+password and Google OAuth.
- `GET /account/signup` renders customer signup with email+password and Google OAuth.
- `POST /api/customer/auth/password/signup` creates a Supabase email+password customer account and provisions/claims by verified email.
- `POST /api/customer/auth/password/login` signs in an existing customer with email+password.
- `GET /auth/customer/callback` handles Google OAuth and other Supabase auth callbacks, provisions the `customers` row when needed, runs D2 email claiming, and redirects to the requested safe internal `next` path.
- `POST /api/customer/auth/password/reset/request` starts password reset for a customer email.
- `GET /account/reset-password` receives the Supabase recovery redirect and renders the password update form.
- `POST /api/customer/auth/password/reset/confirm` updates the password for the recovery session.
- `POST /api/customer/auth/logout` signs the customer out.

Magic-link/email-OTP customer login is removed for Stage 0.5. Existing magic-link customers do not receive a migration email; they can establish the new login method through password reset or Google OAuth using the same verified email.

Only safe internal `next` paths are accepted for redirects. Unsafe or external `next` values fall back to `/account`.

## Supabase Dashboard Settings

Adam must configure these in the Supabase Dashboard before real auth round-trip testing:

1. Authentication > Providers > Email: enabled.
2. Email provider: enable email+password signup/login for customers.
3. Magic Link / email OTP customer login: disabled/removed from the customer flow.
4. Authentication > Providers > Google: enabled with the production Google OAuth client ID and secret.
5. Authentication > URL Configuration > Site URL: `https://docket.jdmrushimports.ca`.
6. Authentication > URL Configuration > Redirect URLs: add the production, local, and preview URLs below.
7. Authentication > User Signups: enabled for the customer portal.
8. Identity linking: manual identity-linking disabled; rely only on Supabase verified-email auto-link behavior.

Required redirect URLs for this implementation:

```text
https://docket.jdmrushimports.ca/auth/customer/callback
https://docket.jdmrushimports.ca/account/reset-password
http://localhost:3000/auth/customer/callback
http://localhost:3000/account/reset-password
```

If Vercel preview deployments will send customer login or reset links, also allow the preview patterns used by the Docket project, for example:

```text
https://*.vercel.app/auth/customer/callback
https://*.vercel.app/account/reset-password
```

Google OAuth must be configured with matching authorized redirect URIs in the Google Cloud OAuth client for the Supabase project callback URL required by Supabase.

## Session and Provisioning Notes

- Customer-facing auth/session calls use `createServerAuthClient()` so Supabase cookies are set and RLS is honored.
- Sessions use the default Supabase refresh-token lifetime. Customers stay logged in under Supabase defaults until session expiry or explicit logout; Stage 0.5 adds no custom inactivity timeout.
- Verified email remains the D2 account-to-docket claiming key for password signup/login and Google OAuth.
- The callback/provisioning path creates or updates `public.customers` and the `profiles` customer role after Supabase confirms the user. Server-only provisioning may use the service-role client because RLS can prevent customer self-insert before policies exist.
- Returning customers have `last_login_at` updated on successful auth, but `deleted_at` is never cleared automatically. Soft-deleted customers are signed out and must be restored deliberately by an admin flow.
- Do not add an `auth_provider` column. Migration `010` for provider tracking is skipped.
- `/find-my-jdm` intake authentication is out of scope for Stage 0.5 and remains a follow-up.

## QA Split

Runtime-verifiable without real third-party auth:

- Password signup/login endpoints validate email and password input and reject invalid requests with friendly errors.
- `GET /auth/customer/callback` redirects to `/account?auth=error...` when no Supabase code is present.
- `GET /account/reset-password` handles missing or invalid recovery state with a friendly error.
- `npm run type-check` and the isolated build gate pass.

Requires real Supabase email / Google delivery:

- Sign up with email+password, confirm the browser has a customer Supabase session, and verify `public.customers.auth_user_id` matches the Supabase Auth user id.
- Log out and log back in with email+password; confirm the dashboard still shows only that customer's dockets.
- Start Google OAuth, return to `/account`, and confirm the same verified email claims/links the same customer data without manual identity linking.
- Request password reset, open the reset email, land on `/account/reset-password`, set a new password, and log in with it.
- Confirm no customer magic-link login path or copy remains.
- Soft-delete a test customer, attempt login/OAuth/reset as appropriate, and confirm the flow redirects to an auth error and clears the session.
