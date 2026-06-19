# DEVELOPMENT ROADMAP — JDM Rush Customer Lifecycle Platform

**Locked:** 2026-06-19  
**Basis:** PRD v1 (strategic vision), Phase-0 Investigation (`INVESTIGATION-FINDINGS.md`, Reviewer-verified SOUND), 9 locked decisions (`DECISIONS-LOCKED.md`)  
**Repo:** `aduguay401-commits/jdm-rush-docket` (primary), `aduguay401-commits/jdm-rush-next` (Stage 4.1 only)  
**Status:** PLANNING — no code written yet

---

## Dependency Order (read this first)

```
Phase 0: FOUNDATION (blocks everything)
  ├── 0.1 Migration Baseline
  ├── 0.2 Customers Table + Auth
  ├── 0.3 RLS on Dockets + Claiming Flow
  └── 0.4 Customer Dashboard Skeleton
        │
Phase 2: PURCHASE COMMITMENT
  ├── 2.1 Agreement Engine (template → filled PDF)
  ├── 2.2 E-Signature + Tamper-Evident PDF + Audit
  ├── 2.3 Driver's License Upload (locked-down)
  ├── 2.4 Deposit-Invoice Provider Interface
  └── 2.5 Two-Part Gate + Move to Delivery
        │
Phase 3: DELIVERY TRACKING
  ├── 3.1 Shipments Table + Docket Linking
  ├── 3.2 Stage Tracking (forward-only + history)
  ├── 3.3 Document Management (visibility toggle)
  └── 3.4 Customer Portal — Delivery View
        │
Phase 4: SITE CHANGE (jdm-rush-next)
  └── 4.1 Customer Login Link
```

**Every stage is one build-review-QA-gate loop.** Stages within a phase are sequential (each depends on the prior). Phases 0, 2, and 3 are sequential. Stage 4.1 can parallelize after Phase 0 completes (it only needs the customer auth flow to exist, not the full purchase/delivery build).

---

## Phase 0: Foundation

**Blocks everything that follows.** No purchase, delivery, or customer-facing code can ship until customers exist, auth works, and RLS isolates their data.

### Stage 0.1 — Migration Baseline (`vehicle_description` + `profiles`)

**What it builds:** A new tracked migration file that adds:
- `vehicle_description` to the `dockets` table (closing the gap where this column exists only via an ad-hoc ALTER recorded as a comment at `app/api/system/intake/route.ts` lines 1-4)
- `profiles` table (used by `lib/admin/auth.ts` for admin/agent role lookups; exists in the live DB but is NOT in any tracked migration — same gap as `vehicle_description`)

**Dependencies:** None.

**D-Decisions implemented:** None directly. Enables all future stages by making the schema reproducible from tracked migrations.

**Reuse vs build:** One new migration file. No application code.

**SQL Adam runs (copy-paste, do NOT execute from agent):**
```sql
-- Migration: vehicle_description column
-- Idempotent: safe to run even if column already exists.
ALTER TABLE public.dockets
  ADD COLUMN IF NOT EXISTS vehicle_description text;

-- Migration: profiles table (used by lib/admin/auth.ts for role lookups)
-- Idempotent: safe to run even if table already exists.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

**Verification:** `grep -l "vehicle_description\|profiles" supabase/migrations/*.sql` returns results. Fresh `npm run build` passes.

---

### Stage 0.2 — Customers Table + Supabase Auth Customer Role

**What it builds:**
- `customers` table: `id`, `auth_user_id` (FK to `auth.users`), `email`, `first_name`, `last_name`, `phone`, `created_at`, `last_login_at`, `deleted_at`
- `customer_id` column on `dockets` (nullable — existing dockets stay unclaimed)
- Supabase Auth configured for customer magic-link login (email OTP, no password)
- `customer` role added to the `profiles` table pattern (alongside existing `admin` and `agent`)
- A new `createServerAuthClient()` call pattern for customer routes (NOT the service-role client)

**Dependencies:** 0.1 (migration baseline).

**D-Decisions implemented:** **D1** (Supabase Auth customer role, magic-link/email-OTP), **D8** (auth lives in the docket app).

**Reuse vs build:**
- Reuse: `profiles` table pattern from `lib/admin/auth.ts`, `createServerAuthClient()` from `lib/supabase/server-auth.ts`, email.ts for magic-link delivery
- Build: `customers` table, customer registration API route, login callback, session management

**SQL Adam runs (copy-paste, do NOT execute from agent):**
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

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
```

**Verification:** Customer can sign up via magic link, session persists, `customers` row created with `auth_user_id` linked.

---

### Stage 0.3 — RLS on Dockets + Email Claiming Flow

**What it builds:**
- **⚠️ PRE-FLIGHT (before writing policies):** Confirm which column in the `profiles` table holds the auth user ID. The live code at `lib/admin/auth.ts` queries by `profiles.id` first and falls back to `profiles.user_id` — so the auth-link column is unconfirmed. Until confirmed, all admin/agent RLS policy predicates in this stage (and all subsequent stages) use the defensive form: `profiles.id = auth.uid() OR profiles.user_id = auth.uid()`. Once confirmed, simplify to the correct single column.
- RLS policies on `dockets` table: customers can SELECT/UPDATE only rows where `customer_id` matches their authenticated customer ID
- Email-based claiming flow: when a customer creates an account with an email matching unclaimed dockets, those dockets are auto-linked
- Dual-access: token URLs (`report_url_token` / `questions_url_token`) continue to work for unclaimed dockets; claimed dockets accessible via both token and session
- Customer API routes refactored: `app/api/customer/*` switches from `createServerClient()` (service-role, RLS bypass) to `createServerAuthClient()` (anon key, honors RLS) — **only for the docket read/write operations where customer_id now exists**

**Dependencies:** 0.2 (customers table + auth).

**D-Decisions implemented:** **D2** (dual-access + email claiming, optional ~90-day token sunset), **D3** (RLS on `dockets` first; child tables in follow-up PRs).

**Reuse vs build:**
- Reuse: existing customer API routes (refactor in place, not rewrite), existing token lookup logic
- Build: RLS policies, claiming flow on account creation, route refactoring

**SQL Adam runs (copy-paste, do NOT execute from agent):**
```sql
-- Allow customers to read their own dockets
CREATE POLICY "customers_read_own_dockets" ON dockets
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Allow customers to update their own dockets (for claiming)
CREATE POLICY "customers_update_own_dockets" ON dockets
  FOR UPDATE TO authenticated
  USING (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  WITH CHECK (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()));

-- Admin/agent can still read all dockets (defensive predicate — profiles auth-link column unconfirmed per pre-flight)
CREATE POLICY "admin_agent_read_all_dockets" ON dockets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (id = auth.uid() OR user_id = auth.uid())
      AND role IN ('admin', 'agent')
    )
  );
```

**Verification:** Customer logs in → sees only their claimed dockets. Customer visits old token URL for an unclaimed docket → still works. Customer claims a docket → appears in dashboard, token URL still works. Service-role client removed from customer routes.

> ⚠️ **⚠️ Highest-risk stage.** Touches every customer-facing route's database client. Review must verify: (a) no service-role client remains in customer routes, (b) RLS policies are not over-permissive, (c) token URLs still work, (d) admin/agent routes unaffected.

---

### Stage 0.4 — Customer Dashboard Skeleton

**What it builds:**
- `/account` route in the docket app (authenticated, customer role)
- Dashboard page: lists all claimed dockets with status, vehicle info, and a link to the report
- "My Account" header state (logged-in vs logged-out)
- Clean dark theme matching existing docket design (Outfit font, #0d0d0d bg, #E55125 accents)

**Dependencies:** 0.3 (RLS + claiming).

**D-Decisions implemented:** **D8** (customer portal in the docket app).

**Reuse vs build:**
- Reuse: existing docket dark theme, existing `ReportClient` components (can be linked from dashboard), `getCustomerHomeBaseUrl()` / `getCustomerReportUrl()` from `lib/urls.ts`
- Build: new `/account` route + dashboard component, Supabase Auth session check middleware

**No SQL this stage.**

**Verification:** Customer logs in → sees dashboard with their dockets. Empty state for new customers. Logged-in header state. Logout works.

---

## Phase 2: Purchase Commitment

**Depends on:** Phase 0 complete. Customer accounts exist, RLS isolates data, dashboard shows dockets.

### Stage 2.1 — Agreement Engine (Template → Filled PDF)

**What it builds:**
- Agreement template selection: if `selected_path === 'private_dealer'` → dealer template; else → auction template (matches existing approve route logic at `app/api/customer/approve/[token]/route.ts` lines 247-250)
- Variable filling engine: reads docket row, fills `{{customer_first_name}}`, `{{customer_last_name}}`, `{{customer_email}}`, `{{customer_phone}}`, `{{vehicle_year}}`, `{{vehicle_make}}`, `{{vehicle_model}}` into the template; `{{customer_address}}` placeholder kept (customer provides during signing)
- Server-side PDF rendering via `pdf-lib` (MIT, zero native deps): filled markdown → styled HTML → PDF. Respects dealer agreement Section 5c ($50,000 payment-routing branch is baked into the template — no code branching needed beyond template selection).
- "Send Agreement" action in the agent dashboard: agent triggers, customer receives email with a link to view + sign

**Dependencies:** 0.4 (customer dashboard skeleton — the signing link goes to an authenticated route).

**D-Decisions implemented:** **D5** (server-side PDF via pdf-lib, template selection respecting dealer $50K §5c).

**Reuse vs build:**
- Reuse: two agreement templates at `docs/agreements/` (reuse as-is), email.ts for the notification, docket data from existing queries
- Build: template variable filling engine, HTML→PDF rendering pipeline, agent "Send Agreement" UI element, customer email notification

**New dependency:** `pdf-lib` (npm install pdf-lib)

**No SQL this stage.**

**Verification:** Agent selects auction path for a docket → agreement email sent → customer clicks link → sees auction agreement with their name/vehicle filled in. Dealer path → dealer agreement served.

---

### Stage 2.2 — E-Signature + Tamper-Evident PDF + Audit Trail

**What it builds:**
- Customer-facing signing page at `/account/docket/[id]/sign` (authenticated, RLS-enforced)
- Signature capture: Canvas-based drawing + typed name + date
- On signing: server receives signature image, embeds it into the PDF via `pdf-lib`, stamps audit metadata (signer name, email, timestamp, IP address, user agent), hashes the final PDF (SHA-256), stores the locked PDF in Supabase Storage
- `agreement_signatures` table records the signing event
- Audit trail: when the agreement was sent, viewed, and signed
- The agreement PDF is served to the customer for download; admin/agent can access via signed URL

**Dependencies:** 2.1 (agreement engine — the filled PDF must exist before it can be signed).

**D-Decisions implemented:** **D5** (client-side signature capture + server-side PDF locking).

**Reuse vs build:**
- Reuse: `pdf-lib` from 2.1, Supabase Storage signed URL pattern from `app/report/[token]/page.tsx`
- Build: Canvas signature component, signing API route, PDF embedding + hashing + locking logic, `agreement_signatures` table, audit trail queries

**SQL Adam runs (copy-paste, do NOT execute from agent):**
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

ALTER TABLE agreement_signatures ENABLE ROW LEVEL SECURITY;
```

**Verification:** Customer signs → PDF is locked, hash stored, audit trail populated. Admin can view signed PDF. Attempt to re-sign shows "already signed" state.

---

### Stage 2.3 — Driver's License Upload (Locked-Down)

**What it builds:**
- License upload on the signing page (before or during signing)
- New Supabase Storage bucket: `customer-documents` (private, `public: false`)
- UUID-based file paths: `{docket_id}/{uuid}.{ext}` — never original filenames
- Short-lived signed URLs (5-minute TTL) generated only when admin/agent views the document
- Document access logging via `document_access_log` table
- License file reference stored on the docket (or on `agreement_signatures`)

**Dependencies:** 2.2 (signing page exists — license upload is part of the signing flow).

**D-Decisions implemented:** **D4** (Supabase Storage private bucket, UUID paths, short-lived signed URLs, access logging).

**Reuse vs build:**
- Reuse: Supabase Storage `createSignedUrl()` pattern from report page, agent file upload UI patterns from `app/agent/docket/[id]/page.tsx`
- Build: private bucket creation, UUID path generation, 5-min TTL signed URL generation, access log table + logging, admin/agent document viewer

**SQL Adam runs (copy-paste, do NOT execute from agent):**
```sql
CREATE TABLE IF NOT EXISTS document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_path text NOT NULL,
  accessed_by text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  docket_id uuid REFERENCES dockets(id) ON DELETE CASCADE
);

ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
```

**Verification:** Customer uploads license during signing → stored at UUID path in private bucket. Admin views → signed URL generated, access logged. Direct URL without token → 404/403. No public access possible.

---

### Stage 2.4 — Deposit-Invoice Provider Interface + Stub

**What it builds:**
- `InvoiceProvider` TypeScript interface: `createDepositInvoice(docket, amount)` + `createBalanceInvoice(docket, amount)`
- Stub implementation: logs to console, emails admin with deposit details (current `invoiceStub.ts` behavior, upgraded to the interface pattern)
- The approval flow calls the provider after customer signs + license is uploaded
- FreshBooks provider skeleton (interface implemented, FreshBooks API call commented out — wired in Stage 2.4b when the business decision is made)

**Dependencies:** 2.3 (license upload — deposit invoice is sent as part of the purchase packet, after all documents are collected).

**D-Decisions implemented:** **D6** (provider interface + stub now; FreshBooks wiring later).

**Reuse vs build:**
- Reuse: existing `lib/invoiceStub.ts` logic (upgrade in place), email.ts
- Build: `InvoiceProvider` interface, stub implementation, FreshBooks skeleton, integration point in approval flow

**No SQL this stage.**

**Verification:** Customer completes signing + license → admin receives "[INVOICE STUB] Deposit Required" email with docket details. FreshBooks skeleton compiles but produces no external API calls.

> 🔶 **Human follow-up (D6):** FreshBooks wiring requires Adam + Patrick (accountant) to finalize the QuickBooks → FreshBooks migration decision and provide API credentials. The stub unblocks the build; the FreshBooks provider is a drop-in replacement behind the interface.

---

### Stage 2.5 — Two-Part Gate + Move to Delivery

**What it builds:**
- `agreement_signed` boolean on dockets (already exists in schema — wire it to the signing event)
- `deposit_paid` boolean on dockets (already exists — wire to a manual "Mark as Paid" button for admin)
- Two-part gate UI in the agent/admin docket view: shows both conditions with status indicators
- "Move to Delivery" action: visible only when both gates are green; transitions docket status to a new `sold_in_delivery` status (add to the status enum)
- Deposit confirmed flow: admin receives payment confirmation from accounting software → clicks "Deposit Received / Mark as Paid" → gate flips green

**Dependencies:** 2.4 (deposit-invoice sent — the admin needs to know the invoice was sent before marking it paid).

**D-Decisions implemented:** **D6** (manual deposit confirmation — human-verified gate).

**Reuse vs build:**
- Reuse: existing `dockets` columns (`agreement_signed`, `deposit_paid`), existing status management pattern in agent docket page
- Build: gate UI component, "Mark as Paid" admin action, "Move to Delivery" action, `sold_in_delivery` status

**No SQL this stage (columns already exist).**

**Verification:** Admin sends agreement → customer signs → `agreement_signed = true`. Admin clicks "Mark as Paid" → `deposit_paid = true`. Both green → "Move to Delivery" button appears → click → docket status = `sold_in_delivery`, Phase 3 unlocked.

---

## Phase 3: Delivery Tracking

**Depends on:** Phase 2 complete. Docket has reached `sold_in_delivery` status.

### Stage 3.1 — Shipments Table + Docket Linking

**What it builds:**
- `shipments` table: one per vehicle, FK to `docket_id`; vehicle + shipping fields with customer-visible vs internal columns separated at the schema level; `current_stage` (text, default `pre-shipment`); `marine_traffic_url`; `customer_visible_notes` and `internal_notes` as separate columns
- `shipment_stage_history` table: audit trail of stage transitions (who, when, old→new)
- "Move to Delivery" action (from 2.5) wired: creates a `shipments` row, auto-populates from docket data (vehicle details, customer contact)
- RLS policies on `shipments`: customers SELECT only their own (via `customer_id` on the parent docket)

**Dependencies:** 2.5 (two-part gate + Move to Delivery action).

**D-Decisions implemented:** **D9** (manual-first tracking — data model supports future automation).

**Reuse vs build:** Build entirely. No existing shipment infrastructure.

**SQL Adam runs (copy-paste, do NOT execute from agent):**
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

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS: customers read only their own shipments
CREATE POLICY "customers_read_own_shipments" ON shipments
  FOR SELECT TO authenticated
  USING (
    docket_id IN (
      SELECT id FROM dockets WHERE customer_id = (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
      )
    )
  );

-- RLS: admin/agent read all shipments (defensive predicate per Stage 0.3 pre-flight)
CREATE POLICY "admin_agent_read_all_shipments" ON shipments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (id = auth.uid() OR user_id = auth.uid())
      AND role IN ('admin', 'agent')
    )
  );
```

**Verification:** Admin clicks "Move to Delivery" → `shipments` row created with auto-populated vehicle data, `docket.status = 'sold_in_delivery'`. Customer's dashboard shows the shipment.

---

### Stage 3.2 — Stage Tracking (Forward-Only + History)

**What it builds:**
- Admin/agent UI for advancing shipment stages: dropdown or button for next stage, with a notes field
- Forward-only enforcement: application-level guard prevents backward transitions; each transition writes to `shipment_stage_history`
- Shipment stage sequence (from PRD §4.2):
  1. Purchased
  2. At port (Japan), awaiting vessel assignment
  3. Vessel booked / departing
  4. Departed Japan / in transit
  5. Arrived at Canadian port
  6. Clearing customs
  7. Cleared customs — awaiting transport
  8. On transport truck
  9. Delivered
- `customer_visible_notes` field for each stage transition (admin/agent writes a note the customer can see)
- `marine_traffic_url` field: admin/agent pastes in the vessel's MarineTraffic URL; customer sees a clickable link

**Dependencies:** 3.1 (shipments table must exist).

**D-Decisions implemented:** **D9** (manual stage advancement — no automation).

**Reuse vs build:**
- Reuse: existing agent dashboard UI patterns, status management patterns from docket lifecycle
- Build: stage tracker UI (both admin and customer views), forward-only logic, stage history viewer, MarineTraffic link field

**No SQL this stage (schema from 3.1).**

**Verification:** Admin advances stage from "Purchased" → "At port" → "Vessel booked" → each writes history row. Attempting to go backward is rejected. Customer sees current stage + customer-visible notes + MarineTraffic link. History shows all transitions with timestamps.

---

### Stage 3.3 — Document Management (Visibility Toggle)

**What it builds:**
- `shipment_documents` table: FK to `shipment_id`, document_type, title, description, file_path (Supabase Storage), `customer_visible` boolean, uploaded_by, uploaded_at, file_size_bytes
- Admin/agent document upload UI: file picker, document type dropdown (Invoice, Export Certificate, Bill of Lading, etc.), visibility toggle, title/description fields
- Files stored in `docket-files` bucket (or a new `shipment-documents` bucket) with UUID paths
- Customer document list: shows only documents where `customer_visible = true`, with signed URLs for download
- Default visibility per document type (from PRD §4.3): Invoice ✅, Export Certificate ✅, Bill of Lading ✅, BL Draft ❌, Entry Document ✅, Other ❌

**Dependencies:** 3.2 (stage tracking — documents often correspond to stages, e.g., BL arrives at vessel booking stage).

**D-Decisions implemented:** **D9** (manual document upload — no scraping).

**Reuse vs build:**
- Reuse: agent file upload UI from `app/agent/docket/[id]/page.tsx`, Supabase Storage signed URL pattern
- Build: `shipment_documents` table, document upload with visibility toggle, customer document list view

**SQL Adam runs (copy-paste, do NOT execute from agent):**
```sql
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

ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;

-- RLS: customers see only visible documents for their shipments
CREATE POLICY "customers_read_visible_docs" ON shipment_documents
  FOR SELECT TO authenticated
  USING (
    customer_visible = true
    AND shipment_id IN (
      SELECT id FROM shipments WHERE docket_id IN (
        SELECT id FROM dockets WHERE customer_id = (
          SELECT id FROM customers WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- RLS: admin/agent see all documents (defensive predicate per Stage 0.3 pre-flight)
CREATE POLICY "admin_agent_all_docs" ON shipment_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (id = auth.uid() OR user_id = auth.uid())
      AND role IN ('admin', 'agent')
    )
  );
```

**Verification:** Admin uploads BL with `customer_visible = true` → customer sees it. Admin uploads BL Draft with `customer_visible = false` → customer does NOT see it. Direct URL without token → no access.

---

### Stage 3.4 — Customer Portal — Delivery View

**What it builds:**
- Customer dashboard extended: for dockets in `sold_in_delivery` status, show the delivery tracker instead of the research view
- Delivery tracker component: current stage with progress indicator, stage history timeline, customer-visible documents list with download links, MarineTraffic link, customer-visible notes
- CTAs: WhatsApp link (Adam's primary fast-close channel), Find My JDM link
- Customer must never see: internal notes, non-visible documents, deposit/payment fields, financial data

**Dependencies:** 3.3 (documents + stages must exist to display).

**D-Decisions implemented:** **D8** (portal in docket app), all RLS policies from prior stages enforce the customer-visible vs internal split at the data layer.

**Reuse vs build:**
- Reuse: existing customer dashboard from 0.4, dark theme components
- Build: delivery tracker UI, progress indicator, document download list, WhatsApp CTA

**No SQL this stage.**

**Verification:** Customer logs in → sees docket status "In Delivery" → clicks → sees stage progress, documents, MarineTraffic link. No internal data exposed. Admin view shows all fields including internal notes.

---

### Stage 3.5 — Account Deletion & Legal-Record Retention

**What it builds:**
- **Customer account soft-delete:** cron job (or admin-triggered) checks `customers.last_login_at` — accounts inactive for ~1 year are soft-deleted (`customers.deleted_at` set, `auth.users` session revoked, PII fields (first_name, last_name, phone) anonymized)
- **Legal-record retention split (per D7):** The legal purchase packet (signed agreement PDF, driver's license, deposit record) is retained on its own clock, independently of the customer account deletion. The `agreement_signatures` and related records are NOT deleted when the customer account is soft-deleted — they persist for the legal retention period. The exact retention duration is a configurable value set by Adam's lawyer.
- **Docket data preservation:** Dockets linked to a soft-deleted customer retain `customer_id = NULL` (unlinked) but remain in the system for business records. PII fields on dockets (`customer_first_name`, `customer_last_name`, `customer_email`, `customer_phone`) are anonymized.
- **Admin retention dashboard:** shows approaching-deletion accounts, recently-deleted accounts, and legal-packet retention status — so Adam has visibility into both clocks.

**Dependencies:** 3.4 (customer portal complete — deletion is the final lifecycle stage), Phase 2 (agreement signatures + license must exist for legal packet retention).

**D-Decisions implemented:** **D7** (separate lifetimes: ~1yr account soft-delete + independent legal-packet retention with lawyer-set clock).

**Reuse vs build:**
- Reuse: existing `customers.deleted_at` column, existing admin dashboard patterns
- Build: soft-delete cron job (or API endpoint), PII anonymization logic, legal-packet retention logic (query `agreement_signatures` where `docket_id` belongs to soft-deleted customer — skip deletion), admin retention dashboard

**No SQL this stage** (deletion works on existing columns). The legal retention number is a **config value** (`LEGAL_RECORD_RETENTION_DAYS` env var), not a schema change.

> 🔶 **Human follow-up (D7):** The exact legal-record retention number must come from Adam's lawyer. The build proceeds with a configurable default (e.g., 7 years = 2555 days, standard Canadian business record retention). Adam sets the real number via env var before production launch.

**Verification:** Customer account with `last_login_at` > 1 year ago → soft-deleted → PII anonymized, auth session revoked. Legal packet (agreement + license) for that customer's docket → still exists. Admin dashboard shows deletion status. Configurable retention value honored.

---

## Phase 4: Site Change (jdm-rush-next)

**Depends on:** Phase 0 complete (customer auth exists). Can run in parallel with Phase 2/3 build.

### Stage 4.1 — Customer Login Link

**What it builds:**
- A "Customer Login" or "My Account" link in the jdm-rush-next header (`src/components/layout/Header.tsx`, alongside existing `NAV_ITEMS`)
- Link points to `https://docket.jdmrushimports.ca/account` (the customer dashboard built in 0.4)
- No Supabase Auth client on jdm-rush-next (per D8 — all authed data access stays in the docket app)
- The site remains a no-auth marketing site with one outbound link to the docket portal

**Dependencies:** 0.4 (customer dashboard must exist at the target URL). Phase 2/3 not required — the login link works as soon as auth exists.

**D-Decisions implemented:** **D8** (customer portal in docket app; jdm-rush-next is the front door with a login link).

**Reuse vs build:**
- Reuse: existing `NAV_ITEMS` array in `Header.tsx`, existing Link component pattern
- Build: one navigation item addition (~5 lines of JSX)

**No SQL this stage.**

**Verification:** "Customer Login" link appears in site header → clicks → lands on `https://docket.jdmrushimports.ca/account` → customer can sign in/sign up.

---

## Stage Dependency Map (visual)

```
0.1 ──→ 0.2 ──→ 0.3 ──→ 0.4 ──→ 2.1 ──→ 2.2 ──→ 2.3 ──→ 2.4 ──→ 2.5
                                         │                                     │
                                         └──→ 3.1 ──→ 3.2 ──→ 3.3 ──→ 3.4 ──→ 3.5 ←──┘
                    │                                     │
                    └──→ 4.1 (parallel after 0.4)         │
                                                          │
                    Phase 2 (2.5) ────────────────────────┘ (3.5 needs agreements licenses for retention)
```

---

## Human Follow-Ups (non-blocking — do NOT gate any stage)

| Item | Owner | When needed | Stage unblocked by |
|------|-------|-------------|-------------------|
| **D7 — Legal-record retention number** | Adam's lawyer | Before Stage 3.5 ships (legal-packet retention) | Stage 3.5 proceeds with configurable default (7 years); lawyer sets the real number |
| **D6 — FreshBooks API credentials** | Adam + Patrick (accountant) | Before FreshBooks provider is wired (Stage 2.4b, post-launch) | Stage 2.4 ships with stub; FreshBooks wiring is a follow-up PR behind the provider interface |
| **QuickBooks → FreshBooks migration** | Adam + Patrick | Before FreshBooks provider goes live | Independent of build — stub handles deposits manually |
| **Site→docket intake auth** | Adam (security review) | When customer accounts exist (after 0.3) | The `/find-my-jdm` → `/api/system/intake` POST currently carries no auth token. With customer accounts, intake could optionally link submissions to logged-in customers. Not blocking — intake works without auth today and continues to work |
| **Stage list confirmation** | Adam | Before 3.2 build | PRD proposes 9 stages; Adam should confirm or adjust based on actual Canada-side milestones |

---

## SQL Master List (Adam runs, in order)

Each block is idempotent. Run at the start of its stage. Paste into the Supabase SQL Editor at: `https://supabase.com/dashboard/project/scfezjqjbzqbtfsveedl/sql/new`

| Stage | Block | What it creates |
|-------|-------|----------------|
| 0.1 | Migration baseline: vehicle_description + profiles | `vehicle_description` column on dockets, `profiles` table (both untracked gaps) |
| 0.2 | Customers + docket link | `customers` table, `customer_id` on dockets, RLS enable |
| 0.3 | RLS policies on dockets | 3 policies: customer read own, customer update own, admin/agent read all |
| 2.2 | Agreement signatures | `agreement_signatures` table, RLS enable |
| 2.3 | Document access log | `document_access_log` table, RLS enable |
| 3.1 | Shipments + stage history | `shipments` + `shipment_stage_history` tables, RLS policies |
| 3.3 | Shipment documents | `shipment_documents` table, RLS policies |

---

## Reuse vs Build Summary (across all phases)

**Reused from existing docket (10 items):**
- Supabase Auth infrastructure (profiles table, server-auth client, magic-link pattern)
- email.ts (Nodemailer + Gmail SMTP) — all customer notifications
- sms.ts (Twilio) — shipment arrival notification
- urls.ts (base URL + token URL helpers) — extended for dashboard URLs
- Agreement templates at `docs/agreements/` — template source
- Agent file upload UI patterns — license and document upload
- Signed URL generation pattern — document serving
- Dark theme + Outfit font — customer dashboard
- Docket status management pattern — stage transitions
- Dev mode pattern (DEV_MODE=true → admin routing) — all new emails

**Built new (13 items):**
- customers table + customer role in Supabase Auth
- RLS policies (dockets, shipments, shipment_documents)
- Customer claiming flow (email matching)
- Customer dashboard (/account)
- Agreement template engine (variable fill + HTML→PDF)
- E-signature (Canvas capture + PDF embedding + locking + hash)
- Driver's license upload (private bucket, UUID paths, access logging)
- Deposit-invoice provider interface + FreshBooks skeleton
- Two-part gate UI + "Move to Delivery" action
- shipments table + stage tracking (forward-only)
- shipment_documents table + visibility toggle
- Delivery tracker UI (customer + admin views)
- jdm-rush-next "Customer Login" header link

**New npm dependency:** `pdf-lib` (MIT, zero native deps, ~300KB). Added in Stage 2.1.

---

*End of ROADMAP.md. This document is the build-order authority. Stages are sized for single build-review-QA-gate loops. No stage should be combined with another.*
