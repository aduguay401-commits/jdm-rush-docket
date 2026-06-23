# Customer Auth Setup

Stage 0.2 adds the Docket-owned Supabase Auth entrypoints for customer magic-link login.

## Routes

- `POST /api/customer/auth/magic-link` sends a Supabase Auth magic link for a customer email.
- `GET /auth/customer/callback` exchanges the Supabase callback code for a session, provisions the `customers` row, and redirects to the requested internal `next` path.

The magic-link API accepts this JSON body:

```json
{
  "email": "buyer@example.com",
  "firstName": "Buyer",
  "lastName": "Name",
  "phone": "204-555-0100",
  "next": "/account"
}
```

Only `email` is required. `next` must be an internal path; unsafe values fall back to `/account`.

## Supabase Dashboard Settings

Adam must configure these in the Supabase Dashboard before real email round-trip testing:

1. Authentication > Providers > Email: enabled.
2. Magic Link or email OTP: enabled; password login is not required for customers.
3. Authentication > URL Configuration > Site URL: `https://docket.jdmrushimports.ca`.
4. Authentication > URL Configuration > Redirect URLs: add the callback URL for every deployed environment that will send links.

Required redirect URLs for this implementation:

```text
https://docket.jdmrushimports.ca/auth/customer/callback
http://localhost:3000/auth/customer/callback
```

If Vercel preview deployments will send customer login links, also allow the preview callback pattern used by the Docket project, for example:

```text
https://*.vercel.app/auth/customer/callback
```

## Session and Provisioning Notes

- Customer-facing auth/session calls use `createServerAuthClient()` so Supabase cookies are set and RLS is honored.
- The callback provisions `public.customers` and the `profiles` customer role after Supabase confirms the user. That provisioning uses the service-role client as a server-only system operation because the Stage 0.2 migration enables RLS on `customers` before customer self-insert policies exist.
- Returning customers have `last_login_at` updated on each callback, but `deleted_at` is never cleared automatically. Soft-deleted customers must be restored deliberately by an admin flow.
- Stage 0.3 is where customer RLS policies on `dockets` are added.

## QA Split

Runtime-verifiable without real email:

- `POST /api/customer/auth/magic-link` rejects invalid email with `400`.
- `GET /auth/customer/callback` redirects to `/account?auth=error...` when no Supabase code is present.
- `npm run type-check` and `npm run build` pass.

Requires real Supabase email delivery:

- Submit a real email to `POST /api/customer/auth/magic-link`.
- Open the magic link from the email.
- Confirm the browser has a customer Supabase session and `public.customers.auth_user_id` matches the Supabase Auth user id.
