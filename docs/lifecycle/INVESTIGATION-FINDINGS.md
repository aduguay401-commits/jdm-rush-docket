# INVESTIGATION FINDINGS — JDM Rush Customer Lifecycle PRD

**Date:** 2026-06-19  
**Repo:** jdm-rush-docket  
**Branch:** docs/lifecycle-investigation  
**Scope:** Read-only cross-repo investigation. No code changes, no SQL execution.

---

## 1. Current Docket Architecture

### 1.1 Stack & Dependencies

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router) |
| Database | Supabase (managed Postgres) |
| DB Client | `@supabase/supabase-js` v2.101.1 + `@supabase/ssr` v0.10 |
| Auth | Supabase Auth (agent + admin only) |
| Email | Nodemailer v8.0.5 + Gmail SMTP (`support@jdmrushimports.ca`) |
| SMS | Twilio v6.0.2 (`+12048139003`, Winnipeg 204) |
| File Storage | Supabase Storage (`docket-files` bucket) |
| Font | Outfit (Google Fonts) |
| CSS | Tailwind v4 |
| Deployment | Vercel (auto-deploy on push to `main`) |
| Accounting | **None** — invoiceStub.ts logs to email, QuickBooks "stubbed for now" |
| E-Signature | **None** |
| PDF Generation | **None** |
| Customer Auth | **None** — opaque URL tokens only |

### 1.2 Auth Model & Roles

**Internal users (Supabase Auth):**

| Role | User | Auth Method | View |
|------|------|------------|------|
| `admin` | Adam | Supabase Auth → `requireAdmin()` | `/admin/*` — full docket list, agent management, analytics |
| `agent` | Marcus | Supabase Auth → `requireAdminOrAgent()` | `/agent/*` — assigned dockets, research forms, file uploads |

Roles are stored in a `profiles` table queried by Supabase Auth user ID:
- `lib/admin/auth.ts` — `getCurrentUserRole()` checks `profiles.role` column
- `requireAdmin()` → checks `role === "admin"`
- `requireAdminOrAgent()` → checks `role === "admin" || role === "agent"`

**Customer users:**

NO authentication. Customer-facing pages (`/report/[token]`, `/questions/[token]`) use opaque URL tokens stored in the docket row:
- `report_url_token` (UNIQUE, UUID) — grants access to the customer report
- `questions_url_token` (UNIQUE, UUID) — grants access to the question-and-answer flow

There are no customer accounts, no login, no session management.

### 1.3 Supabase Client Tiers

| File | Key Used | RLS Behavior | Used By |
|------|---------|-------------|---------|
| `lib/supabase/server.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses ALL RLS** | ALL API routes (customer, agent, admin, system) |
| `lib/supabase/server-auth.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Honors RLS | `lib/admin/auth.ts` — `getCurrentUserRole()` (reads `profiles` table) |
| `lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Honors RLS | Browser client (`/agent/docket/[id]` page — file uploads) |

**Critical finding:** `server-auth.ts` is only used in ONE file (`lib/admin/auth.ts`) for role lookups. Every other server-side operation uses the **service-role client** that bypasses RLS entirely.

### 1.4 Supabase Schema & Relationships

**Core tables (all in `public` schema):**

```
dockets
├── id (uuid PK, gen_random_uuid)
├── created_at (timestamptz, default now())
├── status (text, default 'new')
│     Values: new → questions_sent → answers_received → research_in_progress →
│              report_sent → decision_made → cleared/lost/paused/unresponsive
├── customer_first_name, customer_last_name, customer_email, customer_phone
├── vehicle_year, vehicle_make, vehicle_model, vehicle_description
├── budget_bracket, destination_city, destination_province
├── vehicle_type (text, default 'regular'), duty_type (text, default 'duty-free')
├── timeline, additional_notes
├── selected_path, selected_private_dealer_option
├── deposit_paid (boolean, default false)
├── agreement_signed (boolean, default false)
├── exchange_rate_at_report (decimal), exchange_rate_date (date)
├── report_url_token (text UNIQUE, gen_random_uuid)
├── questions_url_token (text UNIQUE, gen_random_uuid)
│
├── marcus_questions (FK docket_id → dockets.id CASCADE)
│   id, created_at, question_text, answer_text, answered_at
│
├── customer_questions (FK docket_id → dockets.id CASCADE)
│   id, created_at, question_text, answer_text, answered_at,
│   molty_response_sent, read_at
│
├── auction_research (FK docket_id → dockets.id CASCADE)
│   id, created_at, hammer_price_low_jpy, hammer_price_high_jpy,
│   recommended_max_bid_jpy, sales_history_notes, auction_listings (jsonb)
│
├── private_dealer_options (FK docket_id → dockets.id CASCADE)
│   id, created_at, option_number (1-6), year, make, model, grade,
│   mileage, colour, transmission, trim, dealer_price_jpy, dealer_price_cad,
│   photos (jsonb), sales_sheet_url, marcus_notes,
│   calculated_fees (jsonb), total_delivered_cad (decimal)
│
├── auction_estimate (FK docket_id → dockets.id CASCADE)
│   id, created_at, midpoint_hammer_jpy, midpoint_hammer_cad,
│   calculated_fees (jsonb), total_delivered_estimate_cad (decimal)
│
├── follow_up_sequences (FK docket_id → dockets.id CASCADE)
│   id, created_at, sequence_type, emails_sent, last_sent_at, completed
│
├── email_log (FK docket_id → dockets.id CASCADE)
│   id, sent_at, email_type, recipient_email, subject, body_snapshot
│
├── docket_status_history (FK docket_id → dockets.id CASCADE)
│   id, old_status, new_status, changed_at, changed_by
│
└── docket_activity_events (FK docket_id → dockets.id CASCADE)
    id, event_type, event_category, actor_type, actor_id, actor_email,
    title, description, metadata (jsonb), created_at
```

**RLS State (critical):**

| Table | RLS Enabled | Has Policies |
|-------|-----------|-------------|
| dockets | YES | **NO** |
| marcus_questions | YES | **NO** |
| customer_questions | YES | **NO** |
| auction_research | YES | **NO** |
| private_dealer_options | YES | **NO** |
| auction_estimate | YES | **NO** |
| follow_up_sequences | YES | **NO** |
| email_log | YES | **NO** |
| docket_status_history | YES | YES (authenticated SELECT using true) |
| docket_activity_events | YES | YES (service_role ALL + authenticated SELECT) |

**Implication:** The seven core tables have RLS enabled but ZERO policies. This means NO queries succeed unless they use the service-role key. This is the current architectural reality: customer-facing pages authenticate via opaque URL tokens validated at the application layer, and all database access uses the service-role client. RLS is a **no-op** — it blocks everything, and the service-role key is the only way through.

### 1.5 How a Docket is Created and What It Links To

**Entry points:**
1. **Public site form** (`POST /api/system/intake`) — called from jdm-rush-next `/find-my-jdm` (see §7 Site Seam), and from Wix "Get Started" form
2. **Quote endpoint** (`POST /api/system/quote`) — called from Vehicle Detail "Get my exact quote" form
3. Both create a `dockets` row with status `new`, generate `report_url_token` and `questions_url_token`, send email #1 (customer welcome) and email #2 (agent notification)

**Lifecycle flow:**
```
Intake → Email#1 (customer welcome + Home Base URL)
      → Email#2 (agent notification + WhatsApp)

Agent sends questions → questions_sent
      → Email#3 (questions sent to customer) + SMS

Customer answers → answers_received
      → Email#4 (confirmation to customer) + WhatsApp

Agent submits research → research_in_progress
Agent sends report → report_sent
      → Email (customer report link)

Customer approves → decision_made
      → Email#5 (approval, agreement link, deposit instructions)
      → Deposit invoice stub (email to admin)
```

### 1.6 Customer-Facing vs Internal View Separation

**Today's separation is route-based, not data-layer-based:**

| Surface | Route Pattern | Auth | Client |
|---------|-------------|------|--------|
| Customer report | `/report/[token]` | Token in URL | service-role |
| Customer questions | `/questions/[token]` | Token in URL | service-role |
| Agent dashboard | `/agent/*` | Supabase Auth (agent role) | service-role + browser client |
| Admin dashboard | `/admin/*` | Supabase Auth (admin role) | service-role |
| System API | `/api/system/*` | None (public) | service-role |
| Customer API | `/api/customer/*` | Token in URL | service-role |
| Agent API | `/api/agent/*` | Supabase Auth | service-role |
| Admin API | `/api/admin/*` | Supabase Auth | service-role |

**There is no data-layer separation between customer-visible and internal fields.** All columns are returned to whoever queries the table, and filtering is done at the application layer by selecting only certain columns in the Supabase `.select()` call. There is no column-level security, no view, and no RLS policy that restricts which columns a customer can see vs an agent.

**File storage** uses a single public bucket (`docket-files`). Photos are accessed via 1-hour signed URLs generated server-side using the service-role client. There is no private bucket, no per-customer path partitioning, and no access logging beyond console.warn on signing failures.

### 1.7 Email Architecture

- **Transport:** Nodemailer → Gmail SMTP (host: `smtp.gmail.com`, port 465, secure: true)
- **Credentials:** `SMTP_USER` + `SMTP_PASS` (Gmail app password)
- **From:** `JDM Rush Imports <support@jdmrushimports.ca>`
- **Signature:** "Adam & the JDM Rush Team"
- **Dev mode:** `DEV_MODE=true` routes all customer emails to `ADMIN_EMAIL` instead, prepends `[DEV MODE]` banner
- **No Resend, no SendGrid, no Mailgun.** Pure Nodemailer + Gmail.

---

## 2. THE NUMBER ONE SECURITY ITEM — Service-Role Bypass of RLS

### 2.1 Finding: CONFIRMED — Real and Pervasive

Every customer-facing route in the Docket uses `createServerClient()` from `lib/supabase/server.ts`, which initializes the Supabase client with `SUPABASE_SERVICE_ROLE_KEY`. This key **completely bypasses Row Level Security**.

**Affected customer routes (all use service-role client):**

| Route | File | Line where client created |
|-------|------|--------------------------|
| Customer report page | `app/report/[token]/page.tsx` | Line 146: `const supabase = createServerClient()` |
| Customer questions page | `app/questions/[token]/page.tsx` | (same pattern) |
| POST customer answers | `app/api/customer/questions/[token]/route.ts` | Line 97: `const supabase = createServerClient()` |
| POST ask a question (questions flow) | `app/api/customer/questions/[token]/ask/route.ts` | Line 30: `const supabase = createServerClient()` |
| POST customer approval | `app/api/customer/approve/[token]/route.ts` | Line 126: `const supabase = createServerClient()` |
| POST customer decision | `app/api/customer/report/[token]/decision/route.ts` | Line 33: `const supabase = createServerClient()` |
| POST report question | `app/api/customer/report/[token]/question/route.ts` | Line 26: `const supabase = createServerClient()` |

**Additional public routes (also service-role):**

| Route | File |
|-------|------|
| Intake | `app/api/system/intake/route.ts` |
| Quote | `app/api/system/quote/route.ts` |
| Import calculator | `app/api/import-calculator/route.ts` |
| Pricing estimates | `app/api/pricing/estimates/route.ts` |

### 2.2 Why This Works Today

The current security model is:

1. Customer receives a URL with an opaque UUID token (`questions_url_token` or `report_url_token`)
2. Application code looks up the docket by token: `.eq("questions_url_token", token).maybeSingle()`
3. If found, the customer "owns" that docket — all subsequent operations filter by `docket.id`
4. Since the service-role client bypasses RLS, and the core tables have NO RLS policies anyway, this is the only access control mechanism

**The security boundary is the token, not the database.** A customer who knows another customer's token can access their docket. Tokens are UUIDs (128-bit random), which makes brute-forcing impractical, but:
- Tokens are in URLs (browser history, referrer headers, shared links, server logs)
- There is no token rotation, no expiration, no revocation
- There is no per-customer data isolation — the application layer must remember to `.eq("docket_id", docket.id)` on every query

### 2.3 What a Proper Customer Portal Must Do Instead

The PRD calls for an authenticated customer portal with true per-customer isolation. The target architecture:

1. **Real RLS policies on the `dockets` table** that restrict reads/writes to rows where `customer_id` matches the authenticated user's ID (or where a `customer_dockets` join table links them)
2. **Supabase Auth for customers** (email-based, no password — magic link or OTP)
3. **A `customer_id` column on `dockets`** (or a `customer_dockets` junction table for one-customer-to-many-dockets)
4. **The `server-auth.ts` client used for customer routes** (it honors RLS), NOT the service-role client
5. **Token-based access phased out** in favor of session-based access, or tokens used ONLY as a one-time claim mechanism to link an existing docket to a newly-registered customer account

**Critical design point:** The token-based model is not inherently wrong for Phase 1 (no-login customer pages). But the customer portal needs a fundamentally different auth layer. The two can coexist during migration: token URLs still work for unregistered customers; authenticated customers get a dashboard that lists their claimed dockets.

---

## 3. Phase 2 FIT — Agreement, Signature, Documents

### 3.1 Agreement Template Selection

**What exists:** Two complete markdown agreement templates at `docs/agreements/`:
- `purchase-agreement-auctions.md` — auction purchase agreement (17 sections, 116 lines)
- `purchase-agreement-dealer.md` — dealer purchase agreement (17 sections, 122 lines)

Both use `{{placeholder}}` variables: `{{customer_first_name}}`, `{{customer_last_name}}`, `{{customer_email}}`, `{{customer_phone}}`, `{{customer_address}}`, `{{vehicle_year}}`, `{{vehicle_make}}`, `{{vehicle_model}}`.

**Current fulfillment:** The approve route (`app/api/customer/approve/[token]/route.ts`, lines 247-250) links to Wix forms:
- Auction: `https://forms.wix.com/r/7191838185536618530`
- Dealer: `https://forms.wix.com/r/7211765470112776777`

**PRD requirement: Native template selection based on path (auction vs dealer), respecting the dealer CAD $50,000 Section 5c payment-routing branch.**

**FIT assessment:** The templates are production-ready text. What's needed is a **template engine** to fill variables from docket data and render to a signable PDF. The dealer agreement §5(c) (high-value >$50K = client pays export agent directly) is already present in the template. The application needs to:
- Detect `chosen_path` → select correct template
- Fill `{{variables}}` from docket row
- Render to HTML or PDF for signing

**Reuse:** Agreement templates (reuse as-is).
**Build:** Template variable filling engine + PDF rendering pipeline.

### 3.2 Native E-Signature with Tamper-Evident Locked PDF + Audit Trail

**What exists:** Nothing. No signature capture, no PDF locking, no audit trail for agreements.

**Build requirements:**
- **Signature capture:** Canvas-based drawing + typed name + date, captured as SVG/PNG
- **PDF generation:** Use a library like `@react-pdf/renderer` or `pdf-lib` to render the filled template as PDF
- **Tamper-evident locked PDF:** After signing, embed signature image + metadata, apply a digital hash and append it to the PDF. Use `pdf-lib` to add metadata (signer name, email, timestamp, IP, hash). A truly "locked" PDF (certified, no further edits) requires a digital certificate — for Phase 2, a hash-stamped PDF with audit metadata stored separately is sufficient
- **Audit trail:** New `agreement_signatures` table:
  ```sql
  CREATE TABLE agreement_signatures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE,
    agreement_type text NOT NULL,  -- 'auction' or 'dealer'
    signed_by_name text NOT NULL,
    signed_by_email text NOT NULL,
    signed_at timestamptz NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    signature_image_path text,     -- Supabase Storage path
    pdf_path text,                 -- Supabase Storage path (locked PDF)
    pdf_hash text,                 -- SHA-256 of the locked PDF
    metadata jsonb                 -- Full template variables at signing time
  );
  ```

**Build entirely.** No reusable components exist. Estimated dependency: `pdf-lib` (MIT, zero native deps).

### 3.3 Locked-Down Driver's License Upload

**What exists:** The agent docket page has file upload capability via Supabase Storage, but it uploads to the public `docket-files` bucket and has no access controls beyond the agent auth gate.

**PRD requirement:** Private bucket, UUID paths (never public), short-lived signed URLs, access logged.

**Build:**
1. Create a new Supabase Storage bucket `customer-documents` with `public: false`
2. Store files at paths like `{docket_id}/{uuid}.{ext}` — never use original filenames
3. Signed URLs with short TTL (5 minutes) generated only when the admin/agent views the document
4. Access log: a new `document_access_log` table:
   ```sql
   CREATE TABLE document_access_log (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     document_path text NOT NULL,
     accessed_by text NOT NULL,      -- user email or 'customer'
     accessed_at timestamptz NOT NULL DEFAULT now(),
     ip_address text,
     docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE
   );
   ```
5. RLS policy on `customer-documents` bucket: only authenticated admin/agent can read

**Build entirely.** Supabase Storage private buckets are a built-in feature; the access log and short-lived URL generation are application code.

### 3.4 Provider-Agnostic Deposit-Invoice Layer

**What exists:** `lib/invoiceStub.ts` — logs deposit details to console and emails admin. Its own text says: "QuickBooks integration is stubbed for now and will be wired in during the polish pass."

```typescript
// Current invoiceStub.ts (entire file):
export async function createDepositInvoice(input) {
  console.log("[invoice-stub] createDepositInvoice called", { ... });
  // Emails admin with "[INVOICE STUB] Deposit Required" subject
}
```

**PRD requirement:** FreshBooks as current plug-in, provider-agnostic so it can be swapped.

**Build:**
1. Define an `InvoiceProvider` interface:
   ```typescript
   interface InvoiceProvider {
     createDepositInvoice(docket: Docket, amount: number): Promise<InvoiceResult>;
     createBalanceInvoice(docket: Docket, amount: number): Promise<InvoiceResult>;
   }
   ```
2. Implement `FreshBooksProvider` using the FreshBooks API (requires `@freshbooks/api` or REST calls)
3. Fallback: if no provider is configured (no API key), fall back to the current stub behavior (admin email). This allows the system to work without the accounting integration wired
4. Wire `createDepositInvoice()` in the approval flow to use the provider

**Dependency:** FreshBooks API client (npm package or REST). No existing FreshBooks or QuickBooks integration exists in the codebase.

**Build entirely.** The stub is a placeholder, not a provider pattern.

---

## 4. Phase 3 FIT — Shipments & Delivery Tracking

### 4.1 Shipments Record

**What exists:** Nothing. No `shipments` table, no tracking model.

**Build — new `shipments` table:**

```sql
CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Internal fields (agent/admin only)
  vessel_name text,
  voyage_number text,
  bill_of_lading text,
  container_number text,
  port_of_loading text,
  port_of_discharge text,
  estimated_departure_date date,
  estimated_arrival_date date,
  actual_departure_date date,
  actual_arrival_date date,
  internal_notes text,

  -- Customer-visible fields
  current_stage text NOT NULL DEFAULT 'pre-shipment',
    -- Values: pre-shipment → at-port-japan → loaded → in-transit →
    --         arrived-port → customs-clearance → ready-pickup → delivered
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  customer_visible_notes text,
  marine_traffic_url text
);
```

**Data-layer separation is designed into the schema:** `internal_notes` and `customer_visible_notes` are separate columns. RLS policies (once implemented) can restrict which columns the customer can SELECT. No application-layer filtering needed — the database enforces it.

### 4.2 Forward-Only Stage Tracking

**Build — manual admin/agent updates via a status update endpoint:**

- Stage transitions enforced in application code (no backwards transitions)
- Each transition writes to a `shipment_stage_history` table (audit trail)
- Admin and agent can advance the stage via the dashboard
- Customer sees current stage + customer-visible notes only

```sql
CREATE TABLE shipment_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL,       -- 'admin' or 'agent'
  changed_by_email text,
  notes text
);
```

### 4.3 Per-Document Customer-Visibility Toggle

**Build — a `shipment_documents` table:**

```sql
CREATE TABLE shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by text NOT NULL,
  document_type text NOT NULL,     -- 'bill_of_lading', 'customs_release', 'inspection', 'photo', 'other'
  title text NOT NULL,
  description text,
  file_path text NOT NULL,         -- Supabase Storage path
  customer_visible boolean NOT NULL DEFAULT false,
  file_size_bytes bigint
);
```

RLS policies allow customers to SELECT only rows where `customer_visible = true`. Admin/agent see all.

### 4.4 MarineTraffic Link

**Build — single field `marine_traffic_url`** on the `shipments` table. Admin/agent enters the vessel's MarineTraffic.com URL. Customer sees a clickable link. No API integration needed — just a URL field.

---

## 5. Customer Portal & Accounts

### 5.1 What Exists

**Zero.** No customer accounts, no customer auth, no customer table.

### 5.2 Target Architecture

**One account to many dockets, email-based claiming:**

1. **`customers` table:**
   ```sql
   CREATE TABLE customers (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
     email text UNIQUE NOT NULL,
     first_name text,
     last_name text,
     phone text,
     created_at timestamptz NOT NULL DEFAULT now(),
     last_login_at timestamptz,
     deleted_at timestamptz  -- soft-delete, ~1 year retention after last activity
   );
   ```

2. **Docket-to-customer linking** — add a `customer_id` column to `dockets`:
   ```sql
   ALTER TABLE dockets ADD COLUMN customer_id uuid REFERENCES customers(id);
   ```
   Existing dockets have `customer_id = NULL` (unclaimed). Tokens still work for unclaimed dockets.

3. **Claiming flow:**
   - Customer visits a token URL (existing flow)
   - Page offers "Create an account to track all your vehicles in one place"
   - Customer enters email → Supabase magic link
   - On return: if a `customers` row exists with that email, link it; if not, create one
   - The docket's `customer_id` is set to the customer's ID
   - From then on, the customer can see all dockets with their `customer_id` in their dashboard

4. **Account dashboard** (new route: `/account` on the Docket, linked from the site header):
   - List all claimed dockets with status
   - Access any docket's report/questions
   - View shipment tracking for purchased dockets
   - Upload driver's license for active purchase agreements

### 5.3 RLS Implementation for Customer Portal

Once `customer_id` exists on `dockets`, true RLS policies can be added:

```sql
-- Allow customers to read their own dockets
CREATE POLICY "customers_read_own_dockets" ON dockets
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Allow customers to read questions for their dockets
CREATE POLICY "customers_read_own_questions" ON marcus_questions
  FOR SELECT TO authenticated
  USING (docket_id IN (
    SELECT id FROM dockets WHERE customer_id = (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  ));

-- (Similar policies for customer_questions, shipments, shipment_documents)
```

**The customer-facing API routes switch from `createServerClient()` (service role) to `createServerAuthClient()` (anon key, honors RLS).** The auth middleware extracts the JWT from the Supabase session cookie.

### 5.4 Account Deletion & Retention

- Soft-delete via `customers.deleted_at`
- ~1 year retention after last docket activity (GDPR-friendly, business-reasonable)
- On deletion: revoke all Supabase Auth sessions, anonymize PII fields, preserve docket data for business records

---

## 6. REUSE vs BUILD Summary

### 6.1 What Exists and is Reusable

| Component | Status | Reuse |
|-----------|--------|-------|
| Docket schema (dockets + children) | Production, live data | Reuse as-is, add `customer_id` column |
| Auth model (Supabase Auth + profiles) | Production | Extend with customer role |
| importCalculator.ts | Production, single-source calc | Reuse as-is |
| exchangeRate.ts | Production, BoC API | Reuse as-is |
| email.ts (Nodemailer + Gmail) | Production | Reuse as-is across all new emails |
| sms.ts (Twilio) | Production | Reuse as-is |
| urls.ts (base URL + token URLs) | Production | Extend with customer dashboard URL |
| Agreement templates (docs/agreements/) | Complete markdown | Reuse as template source, needs rendering engine |
| Customer report page UI pattern | Production | Reuse dark theme, component patterns |
| Dev mode pattern (DEV_MODE=true → admin routing) | Production | Apply to all new customer emails |
| Agent dashboard (research forms) | Production | Reuse UI patterns for admin shipment tracking |
| Admin dashboard (docket list + filters) | Production | Reuse for customer management view |

### 6.2 What Must Be Built (New)

| Component | Effort | Dependencies |
|-----------|--------|-------------|
| customers table + Supabase Auth for customers | Medium | Supabase Auth (built-in, no new deps) |
| RLS policies (7 tables minimum) | Medium | SQL only, no code deps |
| Customer auth migration from service-role to server-auth | High | Touches every customer route |
| Agreement template engine (variable fill → HTML → PDF) | Medium | `pdf-lib` (MIT, 0 native deps) |
| E-signature capture + audit trail | Medium | Canvas API (built-in), `pdf-lib` |
| Driver's license upload (private bucket + access log) | Small | Supabase Storage private buckets (built-in) |
| Deposit-invoice provider layer (FreshBooks) | Medium | `@freshbooks/api` or REST |
| shipments table + stage tracking | Medium | SQL + admin UI |
| shipment_documents + visibility toggle | Small | SQL + admin UI |
| Customer account dashboard | Medium | New route + UI |
| Docket claiming flow (token → account link) | Medium | New route + email flow |
| Customer-facing shipment tracking view | Small | New route + UI |

### 6.3 What Doesn't Exist and Would Be Bloat (Skip)

- **QuickBooks integration** — FreshBooks is the named provider. Build the FreshBooks plug-in, keep the interface swappable. Don't pre-build a QuickBooks provider.
- **Automated shipment scraping** — Gemmy/JEMI portal scraping exists as a reference document (`docs/references/gemmy-portal-recon.md`) but is not built. Phase 3 calls for manual admin/agent updates. Automated scraping can be a Phase 4 add-on.
- **Stripe/payment processing** — No payment processing exists in the Docket. The PRD does not call for it. The deposit-invoice layer sends invoices; payments are handled outside the system.
- **Sentry/error tracking** — Not configured anywhere. Low priority vs core lifecycle features.

---

## 7. Site Seam — jdm-rush-next Integration Points

### 7.1 Current Integration

**One lead form:** `Find My JDM` at route `/find-my-jdm` (component `src/app/find-my-jdm/FindMyJdmClient.tsx`). "Get Started" is NOT a separate form — it's CTA and eyebrow text linking to `/find-my-jdm`.

**18 fields collected:**
`customer_first_name`, `customer_last_name`, `customer_email` (required), `customer_phone`, `vehicle_description`, `vehicle_year`, `desired_mileage`, `intended_use`, `who_for`, `destination_city`, `budget`, `right_hand_drive`, `timeline`, `ready_to_purchase`, `imported_before`, `decision_factor`, `additional_notes`, `how_heard`

**Flow:**
1. Client POSTs JSON to `src/app/api/find-my-jdm/route.ts` (local Next.js route)
2. Server-side forwards ALL fields to `https://docket.jdmrushimports.ca/api/system/intake`
3. **No auth token or secret** on the fetch — intake is unauthenticated
4. Intake creates docket, sends welcome email

### 7.2 Site Auth Status

jdm-rush-next has **ZERO customer auth today:**
- No next-auth
- No Supabase Auth
- No login or account routes
- Middleware only does SEO noindex for Vercel preview deployments
- Pure no-auth marketing and lead site

### 7.3 Cleanest Future Attach Points

For the "one account experience" (PRD §5):

1. **Header CTA** — `src/components/layout/Header.tsx` ~line 212: add "My Account" link or replace "Find My JDM" button for authenticated users
2. **New `/account` route** — add to `NAV_ITEMS` in Header, guarded by middleware that checks for Supabase session
3. **Post-submit confirmation screen** — after Find My JDM submission, show "View Your Lead" link that goes to the Docket customer dashboard
4. **Authentication mode:** Supabase Auth (magic link) shared between Docket and site. The site uses Supabase Auth client-side; the Docket is the auth server. JWT can be shared cross-domain via cookie or passed as a query parameter to the Docket

**Architecture recommendation:** The Docket remains the auth authority. The site adds Supabase Auth client for login/signup UX. After login, the site redirects to `https://docket.jdmrushimports.ca/account` (or embeds via iframe, though cross-domain iframe has cookie issues — redirect is simpler). The site itself stays a no-auth marketing site + logged-in header state.

---

## 8. Decisions Needing Adam

Each decision includes a **clear recommendation** based on codebase reality.

### D1: Customer Auth Provider — Supabase Auth vs NextAuth vs Custom
**Context:** The Docket already uses Supabase Auth for agent/admin. Adding customer auth means either extending Supabase Auth (new `customer` role) or introducing a second auth system.

**Recommendation:** **Extend Supabase Auth** with a `customer` role. Single auth system, single user table, no cross-system token translation. The existing `profiles` table pattern (role lookup) extends cleanly. Supabase Auth supports magic link (email OTP) out of the box — no password management needed. The site can add `@supabase/ssr` for client-side login.

### D2: Token → Account Migration Strategy
**Context:** Existing dockets have no `customer_id`. Customers use token URLs. We need a path to migrate them to accounts without breaking existing links.

**Recommendation:** **Dual-access during migration.** Token URLs continue to work. When a customer creates an account with the same email as an existing docket, offer to claim it. Claimed dockets appear in the dashboard AND still work via token URL. This is non-breaking. Set a target date (e.g., 90 days post-launch) after which new dockets require account creation and old token URLs redirect to login.

### D3: RLS Policy Scope — All Tables vs Gradual
**Context:** Implementing RLS on 7+ tables with customer-facing policies is a large, high-risk change. Every customer route must be rewritten to use `server-auth` client.

**Recommendation:** **Gradual, starting with `dockets`.** Implement RLS on `dockets` first (the main customer-facing table). Ship the customer dashboard with only docket-level data. Add RLS to child tables (questions, shipments, documents) in subsequent PRs. This reduces blast radius and lets the customer portal ship faster.

### D4: Driver's License Storage — Supabase vs External
**Context:** Driver's licenses are PII (Personally Identifiable Information). Supabase Storage private buckets provide access control, but the data lives in Supabase's cloud.

**Recommendation:** **Supabase Storage private bucket with UUID paths.** This is the simplest and already uses the same infrastructure. The private bucket + short-lived signed URLs + access logging provides reasonable security for Phase 2. If compliance requirements increase later, migrate to a dedicated encrypted store. The UUID path pattern makes migration straightforward — paths don't contain PII.

### D5: Agreement Template Rendering — Client-Side vs Server-Side PDF
**Context:** The agreement must be rendered, signed, and locked as a tamper-evident PDF.

**Recommendation:** **Server-side PDF generation, client-side signature capture.** The template is filled server-side (variables from DB), rendered to PDF via `pdf-lib`. The PDF is presented to the customer in-browser. The customer draws/types their signature on a Canvas element (client-side). The signature image is sent to the server, which embeds it into the PDF, adds audit metadata, hashes the result, and stores it. The customer receives a copy via email. This keeps the PDF generation (complex) server-side while making the signature UX (interactive) client-side.

### D6: Accounting Provider — FreshBooks Now vs Later
**Context:** The PRD specifies FreshBooks as the current plug-in. The invoiceStub currently just emails admin.

**Recommendation:** **Ship the provider interface + stub first, then wire FreshBooks.** The interface pattern (see §3.4) lets the approval flow call `createDepositInvoice()` regardless of whether a real provider is configured. Ship Phase 2 with the stub working (admin gets an email). Wire FreshBooks in a follow-up PR. This decouples the deposit-invoice architecture from the accounting vendor choice.

### D7: Customer Account Deletion — 1 Year vs Shorter/Longer
**Context:** The PRD proposes ~1 year retention after deletion. This affects the soft-delete implementation and data retention policy.

**Recommendation:** **1 year from last docket activity, soft-delete with `deleted_at`.** One year covers a full import cycle (research → purchase → shipping → delivery ≈ 3-6 months) plus a reasonable post-delivery support window. Soft-delete preserves data for business records while preventing the customer from accessing it. A cron job can hard-delete rows older than 1 year.

### D8: Site Auth Integration — Shared Supabase vs Independent
**Context:** The site needs auth for the "My Account" header link and `/account` route. Should it share the Docket's Supabase project or use its own?

**Recommendation:** **Share the Docket's Supabase project for auth.** Single source of truth for customer accounts. The site adds `@supabase/ssr` and `@supabase/supabase-js` as dependencies (both are already in the Docket). The site's Supabase client is configured with the Docket's project URL and anon key. The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars are already public-safe. The Docket owns the database; the site only uses Supabase Auth + redirects.

### D9: Shipment Data Source — Manual vs Automated
**Context:** The PRD describes forward-only stage tracking with manual admin/agent updates and a MarineTraffic link. The Docket has reference docs for automated Gemmy/JEMI portal scraping but no implementation.

**Recommendation:** **Manual-first for Phase 3.** Build the admin UI for stage advancement, customer-visible notes, and document upload. The MarineTraffic URL is a simple text field. Automated scraping from the Gemmy portal can be added as a Phase 4 enhancement — the data model supports it (the fields exist), and the automation would just update those fields via the same API the admin uses manually.

---

## Appendix A: File Reference Index

| File | Purpose | Investigation Relevance |
|------|---------|------------------------|
| `lib/supabase/server.ts` | Service-role Supabase client (RLS bypass) | **Security audit — used everywhere** |
| `lib/supabase/server-auth.ts` | Auth-aware Supabase client (honors RLS) | **Only used in lib/admin/auth.ts** |
| `lib/supabase/client.ts` | Browser Supabase client | Agent docket page file uploads |
| `lib/admin/auth.ts` | Role-based auth (admin, agent) | Extend for customer role |
| `lib/importCalculator.ts` | Import cost calculation engine | Reuse as single source of truth |
| `lib/exchangeRate.ts` | Bank of Canada JPY→CAD rate | Reuse, note hardcoded fallback 0.0092 |
| `lib/email.ts` | Nodemailer Gmail SMTP transport | Reuse for all new email flows |
| `lib/sms.ts` | Twilio SMS + phone normalization | Reuse for shipment notifications |
| `lib/invoiceStub.ts` | Placeholder invoice (emails admin) | Replace with provider-agnostic layer |
| `lib/urls.ts` | Base URL + token URL helpers | Extend with customer dashboard URL |
| `supabase/migrations/001_initial_schema.sql` | Core schema (8 tables, RLS enabled, no policies) | **Source of truth for data model** |
| `supabase/migrations/002-005` | Status history, questions read_at, agent_recommendation, activity events | Incremental schema additions |
| `docs/agreements/purchase-agreement-auctions.md` | Auction agreement template | Reuse as PDF template source |
| `docs/agreements/purchase-agreement-dealer.md` | Dealer agreement template (includes §5c >$50K branch) | Reuse as PDF template source |
| `app/api/system/intake/route.ts` | Lead intake from Wix + site | Current unauthenticated entry point |
| `app/api/system/quote/route.ts` | Exact quote endpoint | Customer-facing, service-role |
| `app/api/customer/*` | 6 customer API routes | ALL use service-role client |
| `app/report/[token]/page.tsx` | Customer report page | Service-role client, token auth |

---

## Appendix B: SQL That Needs Adam to Run

All schema additions proposed in this document. Do NOT run these from this agent — Adam runs them in the Supabase SQL Editor. Each block is idempotent (uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

**Block 1: Customers table + dockets link**
```sql
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  deleted_at timestamptz
);

ALTER TABLE dockets ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_dockets_customer_id ON dockets(customer_id);
```

**Block 2: Agreement signatures**
```sql
CREATE TABLE IF NOT EXISTS agreement_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  agreement_type text NOT NULL,
  signed_by_name text NOT NULL,
  signed_by_email text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  signature_image_path text,
  pdf_path text,
  pdf_hash text,
  metadata jsonb
);
```

**Block 3: Shipments**
```sql
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id uuid NOT NULL REFERENCES dockets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  vessel_name text,
  voyage_number text,
  bill_of_lading text,
  container_number text,
  port_of_loading text,
  port_of_discharge text,
  estimated_departure_date date,
  estimated_arrival_date date,
  actual_departure_date date,
  actual_arrival_date date,
  internal_notes text,
  current_stage text NOT NULL DEFAULT 'pre-shipment',
  stage_updated_at timestamptz NOT NULL DEFAULT now(),
  customer_visible_notes text,
  marine_traffic_url text
);

CREATE TABLE IF NOT EXISTS shipment_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  old_stage text,
  new_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL,
  changed_by_email text,
  notes text
);

CREATE TABLE IF NOT EXISTS shipment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by text NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT false,
  file_size_bytes bigint
);
```

**Block 4: Document access log**
```sql
CREATE TABLE IF NOT EXISTS document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_path text NOT NULL,
  accessed_by text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE
);
```

**Block 5: RLS — enable on new tables + add policies (after migration)**
```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;

-- RLS policies defined in §5.3 and §4.3 of this document.
-- These are written inline above and should be executed after the
-- service-role→server-auth client migration in application code.
```
