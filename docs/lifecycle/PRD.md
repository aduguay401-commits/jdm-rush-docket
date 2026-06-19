# Product Requirements Document
## JDM Rush — Customer Lifecycle Platform

**Product:** Extend the JDM Rush Docket system into a full three-phase customer lifecycle platform
**Owner:** Adam Duguay
**Status:** Draft v1 — strategic vision. To be ground-truthed against the repos by Claude Code (see Section 12) before it is locked.
**Audience:** Claude Code (repo investigation + build), agentic coding team
**Repos in scope:**
- Docket: `aduguay401-commits/jdm-rush-docket` (live: `jdm-rush-docket.vercel.app`)
- JDM Rush website: the new Next.js site (replaces the old Wix site)
**Stack:** Next.js, Supabase (project ref: `scfezjqjbzqbtfsveedl`), Vercel, Cloudflare.

---

## 1. Vision (read this first)

Today the **docket** is where the *research* phase happens: a customer fills out the "Get Started" form on the JDM Rush website, a docket is created, and the export agent (Marcus) and Adam talk directly with the customer through the docket, gather requirements, pull vehicle options, and send reports — all to find the right car.

But the customer journey doesn't end at "I found the car." It continues through a **purchase/legal/payment** step and then a **10–14 week delivery** during which the customer currently has no visibility.

This PRD extends the docket so that **one docket carries a customer through the entire lifecycle** — research → purchase → delivery — as one continuous thread, one source of truth, one login experience. No separate apps. No fragile scraping infrastructure.

The three phases:

| Phase | Name | Status |
|-------|------|--------|
| **1** | **Research** | Already built. Stays exactly as-is. Not touched. |
| **2** | **Purchase Commitment** | NEW. Rebuilds the legal + deposit gate that was lost in the Wix → Next.js migration. |
| **3** | **Delivery Tracking** | NEW. A customer-facing portal showing the car's journey from Japan to the driveway, plus document access. |

---

## 2. Phase 1 — Research (existing, unchanged)

This phase is documented here only for context. **Do not modify this functionality.**

- Customer submits the "Get Started" form on the JDM Rush site → creates a docket.
- Adam + Marcus are notified.
- Agent and/or Adam communicate directly with the customer in the docket (chat), ask qualifying questions, and generate reports with photos, vehicle info, and options.
- This is the primary lead-generation engine.

Phase 2 begins when the customer decides to buy (via auction or dealer).

---

## 3. Phase 2 — Purchase Commitment (NEW)

This is the "missing middle" — the legal and payment gate that previously lived on Wix and was lost in the migration. It must be rebuilt natively inside the docket so the entire commitment step lives in one place.

### 3.1 Trigger
Inside the docket, when the customer decides to buy, the agent/Adam initiates the purchase step and selects the **sourcing path: Auction or Dealer**. This selection determines which purchase agreement is served (see 3.2).

### 3.2 Purchase Agreements (two templates, already in repo)
Located at `docs/agreements/` in the docket repo:
- `purchase-agreement-auctions.md` — Auction bidding. **All payments flow through JDM Rush regardless of price.**
- `purchase-agreement-dealer.md` — Dealer sourcing. **Contains a CAD $50,000 threshold (Section 5c): high-value purchases route payment directly to the export agent instead of through JDM Rush.**

Both are templated with merge fields (e.g. `{{customer_first_name}}`, `{{customer_email}}`, `{{vehicle_year}}`).

**Requirement:** The system must serve the correct template based on the sourcing path, populate it with the customer's and vehicle's data, and — critically — **respect the dealer agreement's $50K payment-routing branch.** The two agreements are NOT interchangeable and must not be flattened into one generic form. The payment-routing difference has real money-flow consequences and must carry through to how the deposit/payment logic behaves.

### 3.3 Native E-Signature (best-in-class, built in Next.js)
- The customer reads the populated agreement inside the docket and signs in the browser. No third-party e-sign service.
- "Best-in-class" here means a **legally sound, tamper-evident record**, not just a captured drawing:
  - Capture the signature **plus** a timestamp and the signer's IP address.
  - On signing, generate a **finalized, locked PDF** of the executed agreement that cannot be edited afterward.
  - Maintain an **audit trail**: when the agreement was viewed, by whom, and when it was signed.
- The finalized PDF is filed as part of the purchase packet (3.5).

### 3.4 Driver's License Upload (sensitive PII — lock it down)
- As part of signing, the customer uploads a valid driver's license.
- This is sensitive government ID and must be stored to a **stricter standard than shipment photos or general documents**:
  - Private storage bucket, **non-guessable (UUID) paths**.
  - **Never** reachable by any customer-facing query or public URL.
  - Viewable only by Adam/Marcus via **short-lived signed URLs that expire**.
  - **Access is logged** (who viewed it, when).
- *(Security rationale: an earlier investigation of an external partner portal found customer PDFs sitting at predictable, public URLs — exactly the failure mode we must avoid here.)*

### 3.5 The "Purchase Packet"
The signed agreement PDF, the driver's license, and the deposit record are linked together as **one legal record tied to the docket**, so it can be retrieved cleanly later for any legal reason.
- *Open policy question (not a build blocker): how long must a customer's ID be retained after delivery? To be confirmed with Adam's lawyer and wired in as a retention policy later.*

### 3.6 Deposit Invoice (CAD $1,500)
- A $1,500 deposit invoice is sent to the customer; they pay by credit card.
- **Accounting provider:** Adam is evaluating moving JDM accounting from QuickBooks Online to **FreshBooks** (better API access). 
  - **Build requirement:** the invoicing integration must be **provider-agnostic** — a thin abstraction layer where FreshBooks is the current plug-in, so the build is not welded to one vendor and can swap without a rewrite.
  - *Note: the QuickBooks → FreshBooks migration is a business/accounting decision for Adam and his accountant (Patrick), not a technical default. Keep JDM and Element Pictures books cleanly separated. This PRD does not assume the migration is complete.*

### 3.7 The Two-Part Gate
Phase 3 (Delivery) unlocks **only when both** are true:
1. **Agreement signed** (yes/no)
2. **Deposit paid** (yes/no)

The docket must show this as a clear two-part status. Only when both are green does the **"Move to Delivery"** action become available.

**How the system learns the deposit is paid (decided):**
- Adam receives a payment-confirmation email from the accounting software when the invoice is paid.
- Adam clicks a **"Deposit Received / Mark as Paid"** button in the docket to flip that half of the gate to green.
- This **human-verified manual confirmation is the launch behavior** — it keeps a human eye on every dollar before the next phase unlocks.
- *Future enhancement (not required at launch): a FreshBooks webhook that auto-flips "deposit paid" when the invoice is marked paid.*

Once both halves are green, Adam/Marcus proceed to actually purchase/secure the vehicle (auction or dealer). When the vehicle is secured, the docket moves to Phase 3.

---

## 4. Phase 3 — Delivery Tracking (NEW)

A customer-facing portal that shows the vehicle's journey and provides document access. **Manual updates only — no scraping/automation in this build** (decided; see Section 9).

### 4.1 The Handoff (docket → shipment)
A **"Move to Delivery"** action (unlocked by the 3.7 gate) does two things:
1. Creates a **shipment record** for that vehicle, **auto-populated** from the docket (customer contact, vehicle details — model, chassis, invoice number — purchase date, etc.) to minimize manual re-entry.
2. Transitions the docket to a **"Sold / In Delivery"** state.

The docket is **not** discarded — it remains the historical record of how the car was found. The shipment record **links back to the originating docket** so lineage is always traceable (delivered car ↔ the research conversation that produced it).

**Model:** one vehicle per docket/shipment. A repeat customer buying 2 cars = **2 dockets under 1 customer account** (see 5.2).

### 4.2 Shipment Stages (forward-only)
Stages advance in one direction and **never regress**. Adam and Marcus manually click the car forward as updates arrive (often via WhatsApp from Marcus).

Recommended stage sequence (to be confirmed/refined in repo investigation):
1. **Purchased**
2. **At port (Japan), awaiting vessel assignment** — *the only open-ended/variable wait in the pipeline. Show no promised date here; copy should set the expectation that loading times vary and the customer will be updated the moment a vessel is booked.*
3. **Vessel booked / departing** — show vessel name, ETD, ETA once known.
4. **Departed Japan / in transit**
5. **Arrived at Canadian port**
6. **Clearing customs**
7. **Cleared customs — awaiting transport**
8. **On transport truck**
9. **Delivered**

*(Note: stages 1–3 roughly correspond to the Japan side; stages 5–9 are the Canada side. All are driven by manual updates in this build.)*

### 4.3 Documents
- Documents (invoice, bill of lading, export certificates, etc.) are **uploaded manually** by Adam/Marcus as they become available.
- Each document has a **`visible_to_customer` toggle.**
- Suggested document types and default visibility:

| Document type | Default visible to customer |
|---|---|
| Invoice | ✅ |
| Export Certificate (EC) | ✅ |
| English Export Certificate | ✅ |
| Bill of Lading (BL) | ✅ |
| BL Draft | ❌ |
| Entry Document (ED) | ✅ |
| Other | ❌ (review before sharing) |

- Documents are stored in the platform's own storage (not hot-linked from any external source), served to customers via access-controlled signed URLs.

### 4.4 Live Ship Tracking (MarineTraffic)
- For the vessel-in-transit stages, provide a **simple outbound MarineTraffic link** built from the vessel name (URL-encoded). Opens in a new tab. No paid API at launch.
- *Future: evaluate a MarineTraffic API integration for embedded live position only if there's clear demand; it resolves by IMO/MMSI (not vessel name) and isn't worth the complexity at launch.*

---

## 5. Customer Portal & Accounts

### 5.1 Access
- After purchase, the customer is sent a **login link** to create an account (or logs in via the JDM Rush site).
- A logged-in customer sees **only their own vehicle(s)** — strict per-customer isolation.

### 5.2 Repeat customers
- **One customer account ↔ many dockets/vehicles.** 2 cars = 2 dockets under 1 account.
- **Claiming:** dockets are matched to a customer account by **email**. Dockets carrying that email auto-link to the account.

### 5.3 Stale accounts
- Accounts inactive for **~1 year are deleted** (Adam confirmed car history does not need to be retained at the customer-account level beyond that). *Investigation should confirm this doesn't conflict with any legal-record retention need for the purchase packet — the legal record may need a separate retention path from the customer login.*

### 5.4 Customer-facing surface vs internal
- Customer sees: their vehicle's progress tracker, customer-visible documents, vessel + MarineTraffic link, and clear calls-to-action.
- **CTAs:** **WhatsApp** (Adam's primary fast-close channel) and the **Find My JDM** page.
- Customer must **never** see internal/financial fields (deposit, balance, fees, payment links, margins) or internal documents.

---

## 6. Roles & Auth

The docket already has a two-tier login: **admin (Adam)** and **export agent (Marcus)**.

**Decisions:**
- **Agent (Marcus) gets one login that does everything**, in one interface: customer chat + report generation (Phase 1), purchase commitment (Phase 2), and shipment tracking (Phase 3) — as sections/tabs within the same docket. No separate logins for delivery.
- **Admin (Adam)** keeps the existing extra controls (creating agent accounts, archiving/deleting dockets, conversation tracking, account control). No new admin-specific shipment features are required at launch; an optional read-only "all active shipments across agents" overview can be Phase 2/later.
- **Customer** is a new role that sees only their own data.

### 6.1 Security requirement (critical)
The customer portal must enforce **true per-customer data isolation** (e.g. real row-level security keyed to the customer), and must **not** read customer-visible data through a service-role/RLS-bypassing client. *(An earlier docket investigation found that current customer-facing pages rely on opaque tokens with the service-role client bypassing RLS — that pattern must not be carried into the authenticated customer portal. This is the #1 security risk in the build.)*

---

## 7. Data Model (proposed — to be reconciled with the repo)

This is a starting proposal. Claude Code should reconcile it against the actual schema in Section 12.

- **`customers`** — `id`, `auth_user_id` (FK to Supabase Auth), `email`, `name`, `last_active_at`, plus account-deletion handling for the ~1yr rule. Add `customer_id` FK to `dockets`; backfill by email.
- **`dockets`** (existing) — extend with lifecycle state covering the Sold/In-Delivery transition. Keep the existing research/status flow intact.
- **Purchase / Phase-2 record** — the selected agreement type (auction/dealer), the finalized signed-agreement PDF reference, signature metadata (timestamp, IP), license file reference (locked-down), deposit status, and the agreement-signed / deposit-paid gate flags.
- **`shipments`** — one per vehicle, FK to `docket_id`; vehicle + shipping fields (customer-visible) and internal/financial fields (never customer-visible) clearly separated; `current_stage` (forward-only enum); `vessel_name`; `last_synced_at`/`updated_at`.
- **`shipment_documents`** — FK to shipment; `document_type`, storage path, `visible_to_customer`, `uploaded_by`, `uploaded_at`.

**Customer-visible vs internal split (must be enforced at the data layer, not just the UI):**
- **Customer-visible:** photo, model, chassis, ETD, ETA, POL, POD, vessel, BL number, invoice number, first registration date, purchase date, current stage, selected customer-visible documents.
- **Internal-only:** payment status, payment due date, total amount, deposit, FOB, balance, yard fees, payment links, memos, margins, license, BL draft, "other" docs.

---

## 8. Non-Functional Requirements
- **Security/privacy:** per-customer isolation (real RLS); license & legal docs locked down with expiring signed URLs and access logging; tamper-evident signed-agreement PDF.
- **Money safety:** human-verified deposit confirmation before the delivery gate unlocks; provider-agnostic invoicing layer.
- **Design:** clean, premium, consistent with the established Next.js design system across both customer and internal surfaces. Customer surface = simple and reassuring; internal surface = efficient control panel.
- **Deployment:** Vercel; Supabase; consistent with current docket infrastructure.
- **Reliability:** manual-update model means no external runtime dependency for stage data; the portal always reflects the last state Adam/Marcus set.

---

## 9. Explicitly Out of Scope (for this build)
- **Gemmy/JEMI portal scraping/automation.** Investigated and **deliberately deferred.** The partner portal is an older server-rendered PHP site with no API; a Playwright scraper is fragile to maintain. For this first build, **shipment stages and documents are updated manually.** (An optional one-time bulk-import helper to seed current in-transit cars may be considered, but it is not required and is not an ongoing automation.)
- **MarineTraffic API** (link-only at launch).
- **FreshBooks webhook auto-confirmation of deposits** (manual confirmation at launch; webhook is a later enhancement).
- **Full autonomy / removing the human-in-the-loop** anywhere in the flow.

---

## 10. Success Metrics
- Customers actively logging in to track their vehicle (engagement / reduced "where's my car?" support load).
- Phase-2 completion rate (agreements signed + deposits paid) and time-to-complete.
- Lead → purchase conversion now that the commitment step is rebuilt natively.
- Document self-service (customers downloading their own paperwork rather than emailing Adam).

---

## 11. Open Questions (carry into investigation)
1. Exact current docket schema, auth model, and storage setup — what's reusable vs. needs adding.
2. Where the JDM Rush website's "Get Started" form and customer login should connect to docket auth (single account experience across site + docket).
3. Legal-record retention vs. the 1-year account-deletion rule — do these need separate lifetimes?
4. Confirm the stage list against how the business actually tracks Canada-side milestones.
5. How the existing email system (investigation noted nodemailer/Gmail SMTP in practice, despite docs referencing Resend) should send the post-purchase login link and notifications.

---

## 12. Investigation Prompt for Claude Code (run this AFTER reading the full PRD above)

> **You have now read the complete vision for the JDM Rush Customer Lifecycle Platform (Sections 1–11). Before any code is written, perform a thorough investigation of the two repositories and reconcile this PRD against reality.**
>
> **Repos:**
> - Docket: `aduguay401-commits/jdm-rush-docket`
> - JDM Rush website: the new Next.js site repo (confirm the exact repo name/location).
>
> **Investigate and report on:**
> 1. **Current docket architecture** — auth model and existing roles (admin/agent), the Supabase schema (tables, relationships, how a docket is created and what it links to), API routes, the email/notification flow (confirm whether it's nodemailer/Gmail SMTP or Resend), existing file-storage setup, and how customer-facing vs. internal views are separated today (including any token-based pages that use a service-role/RLS-bypassing client).
> 2. **JDM Rush website repo** — where the "Get Started" form lives, how submissions create dockets today, and what exists (if anything) for customer auth/login — so we can design one seamless account experience across the site and the docket.
> 3. **Phase 2 fit** — how to natively build: agreement-template selection (auction vs. dealer, respecting the dealer $50K Section 5c payment-routing branch), the best-in-class native e-signature with tamper-evident locked PDF + audit trail, the locked-down license upload, and the provider-agnostic deposit-invoice integration (FreshBooks as current plug-in). Identify the cleanest way to slot these into the existing docket.
> 4. **Phase 3 fit** — how to add the shipment record (linked to docket), forward-only stage tracking with manual updates by admin+agent, document management with per-document customer visibility, and the MarineTraffic link.
> 5. **Customer portal & accounts** — how to add a `customers` layer (one account ↔ many dockets, email-based claiming, ~1yr deletion), and **how to enforce true per-customer isolation with real RLS** without reusing the service-role client for customer reads. Flag this as the top security item.
> 6. **Reuse vs. build** — explicitly call out what already exists and can be reused vs. what must be added, with an eye to avoiding bloat.
> 7. **Architectural decisions needing Adam's input** — surface any forks (schema, auth, account-linking, storage, retention) where a decision materially changes the build, and **field those back to Adam** with a clear recommendation for each.
>
> **Deliverable:** A findings document that (a) maps the current state of both repos, (b) proposes concrete adjustments to this PRD based on what's actually there, and (c) lists the decisions Adam needs to make before the PRD is locked.
>
> **Constraints:**
> - Investigation + recommendations only in this pass. **No application code changes.**
> - **For any SQL / schema change (now or later): do NOT run SQL yourself.** Pause, provide the exact SQL to copy-paste, include this link — `https://supabase.com/dashboard/project/scfezjqjbzqbtfsveedl/sql/new` — and wait for Adam to confirm **"SQL done"** before continuing.
>
> **Next step after this investigation:** once Adam reviews your findings and the PRD is locked, produce a **phased development roadmap** that breaks the full three-phase build into sequenced, dependency-aware stages.

---

*End of PRD v1. This document is the strategic source of truth; it will be revised after Claude Code's repo investigation (Section 12) before the build begins.*
