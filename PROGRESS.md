# Progress

## 2026-06-25 — Stage 0.4 My JDM Garage real wiring

Summary: wired the locked v6 `/account` customer portal design to authenticated Supabase customer sessions, RLS-scoped owned dockets, real research/report data, real document availability where current tables support it, and a working Messages thread.

Files changed:
- `supabase/migrations/009_customer_dashboard_child_rls.sql` — adds customer-owned child-table RLS policies for report/research/message reads and customer message inserts. Adam must apply this SQL to production before QA runtime verification.
- `lib/customer/dashboard.ts` — centralizes customer session checks, owned docket loading, selected `?docket=` resolution, status mapping, research reads, and message thread shaping through the anon SSR client.
- `app/api/customer/auth/logout/route.ts` — signs out the customer Supabase session.
- `app/api/customer/messages/route.ts` — inserts customer messages into `customer_questions` through RLS after an owned-docket check.
- `app/account/_components/header.tsx` — hydrates customer name, latest-docket Messages link, unread count, and real sign-out while preserving the approved header styling.
- `app/account/login/page.tsx` and `app/account/login/LoginClient.tsx` — provides the magic-link login destination for unauthenticated account redirects.
- `app/account/page.tsx` — lists the authenticated customer's claimed dockets and renders an empty state when none are claimed.
- `app/account/car/page.tsx` — hydrates the approved journey shell with the selected owned docket, candidate count, purchase unlocks, and Phase 3 pending state.
- `app/account/research/page.tsx` — renders real dealer/auction research rows and links to the existing report token URL.
- `app/account/documents/page.tsx` — shows the real research report as available and keeps Phase 2/3 invoices/import/legal docs pending from current docket flags.
- `app/account/journey/page.tsx` — shows real vehicle context and a pending shipment setup state until Phase 3 shipment records exist.
- `app/account/messages/page.tsx` and `app/account/messages/MessagesClient.tsx` — reads real question/message rows and posts new customer messages.
- `docs/lifecycle/STAGE-0.4-NOTES.md` — documents the 009 migration, runtime prerequisite, and wiring behavior.
- `ISSUES.md` — records the runtime verification prerequisite for migration 009.

Decisions/deviations:
- Approved plan option 009 was used: add child-table RLS policies instead of using a service-role fallback for portal child reads.
- No production SQL was applied by Codex. Adam must apply migration 009 manually, matching the Stage 0.3 operating model.
- `?docket=<id>` routes were preserved to avoid changing the approved v6 visual design.
- Documents and journey surfaces show real data where Stage 0.4 tables exist and pending/locked placeholders where Phase 2/3 tables do not exist yet.
- Docket `.agents/state/` was not touched.

Status: implementation complete. Verification: npm run type-check PASS; npm run lint PASS with baseline warnings only; isolated Docket worktree gate PASS (lint/type-check/build), with the production build run outside the live checkout.


## 2026-06-26 — Stage 0.4.1 login confirmation polish

Summary: folded in Adam's approved login confirmation refinements on the same Stage 0.4.1 branch.

Files changed:
- `app/account/login/LoginClient.tsx` — keeps the `aria-live=polite` region mounted before status changes, moves focus to the confirmation heading after a successful send, preserves the submitted email for resend, hides the intro copy outside the form state, and aligns the error icon treatment with the amber banner.
- `app/account/login/page.tsx` — lets the client control the intro copy so it can be hidden in success and error states without changing the locked account-page shell.
- `app/api/customer/auth/magic-link/route.ts` — maps Supabase `over_email_send_rate_limit` / 429 responses to a friendly 429 error message.
- `PROGRESS.md` — records the polish pass and verification status.

Decisions/deviations:
- Kept the locked v6 visual language and limited the change to the login page and magic-link API route.
- No production SQL was changed or applied.

Status: implementation complete. Verification: npm run type-check PASS; npm run lint PASS with baseline warnings only; isolated Docket worktree gate PASS (lint/type-check/build), with the production build run outside the live checkout.


## 2026-06-25 — Stage 0.4 RLS self-select fix

Summary: fixed Reviewer blocker by making migration 009 self-contained for customer-owned joins.

Files changed:
- `supabase/migrations/009_customer_dashboard_child_rls.sql` — adds `customers_select_self` at the top so authenticated customers can resolve their own `customers` row inside docket/child-table RLS subqueries.
- `docs/lifecycle/STAGE-0.4-NOTES.md` — documents the self-select dependency and Adam's separate production statement after the first 009 application.
- `PROGRESS.md` and `ISSUES.md` — record the blocker and fix.

Decisions/deviations:
- No production SQL was applied by Codex. Adam already applied the first 009 and will run the added idempotent self-select statement separately.
- Non-blocking copy notes from Reviewer are deferred to Designer and are not included in this code fix.

Status: implementation complete. Verification: npm run type-check PASS; npm run lint PASS with baseline warnings only; isolated Docket worktree gate PASS (lint/type-check/build), with the production build run outside the live checkout.


## 2026-06-25 — Stage 0.4.1 login confirmation UX

Summary: refined the My JDM Garage login magic-link form so successful sends become an obvious confirmation state instead of leaving the submitted email in a pending-looking form.

Files changed:
- `app/account/login/LoginClient.tsx` — replaces the form with a prominent on-brand confirmation card after success, clears the email field state, adds a Use a different email / Resend affordance, and makes error/sending states more explicit with `aria-live=polite`.
- `PROGRESS.md` — records the code-only UX refinement and verification status.

Decisions/deviations:
- Kept the locked v6 visual language: dark surface, #E55125 accents, sharp card edges, compact Manrope-era account styling.
- Did not change other `/account` pages or production SQL.

Status: implementation complete. Verification: npm run type-check PASS; npm run lint PASS with baseline warnings only; isolated Docket worktree gate PASS (lint/type-check/build), with the production build run outside the live checkout.


## 2026-06-28 — Phase 2 Agreement Engine

Summary: built the authenticated customer purchase-agreement signing flow and guarded agent agreement-sending/document-access routes.

Files changed:
- `lib/agreements/templates.ts` — bundles the approved auction and dealer agreement markdown as TypeScript constants and selects dealer only for `private_dealer`.
- `lib/agreements/fillTemplate.ts` — fills the eight agreement variables, with customer address supplied by the signing form.
- `lib/agreements/renderPdf.ts` — renders the filled markdown into a flat pdf-lib PDF with headings, bullets, rules, wrapping, and pagination.
- `lib/agreements/sign.ts` — appends the signature image and audit stamp, then computes the SHA-256 hash of stored PDF bytes.
- `lib/storage/agreements.ts` and `lib/storage/licenses.ts` — upload signed PDFs and driver licenses to the private buckets, mint 300-second signed URLs, and log license access.
- `lib/emails/signedAgreement.ts` — adds branded signed-agreement confirmation email HTML/text for the customer attachment email.
- `lib/email.ts` — passes optional Nodemailer attachments through `sendEmail`.
- `app/account/docket/[id]/sign/page.tsx` and `SignClient.tsx` — add the mobile-first agreement review/signing UI with address fields, signature canvas, required license upload, checklist-gated submit, and confirmation/already-signed states.
- `app/api/customer/docket/[id]/sign/route.ts` — verifies customer ownership via the authenticated RLS client, rejects re-signs, uploads license/PDF, inserts `agreement_signatures`, marks the docket signed, and emails the signed PDF attachment.
- `app/api/customer/docket/[id]/agreement/route.ts` — verifies customer ownership and redirects to a short-lived signed agreement URL.
- `app/api/agent/send-agreement/route.ts` — guards with `requireAdminOrAgent()`, requires a chosen purchase path, stamps `agreement_sent_at`, and emails the signing link.
- `app/api/agent/documents/license/[id]/route.ts` — guards with `requireAdminOrAgent()`, logs document access, and redirects to a short-lived license URL.
- `app/agent/docket/[id]/page.tsx` — adds the Send Agreement action to approved dockets and selects agreement state fields.
- `app/account/documents/page.tsx` — links the Purchase Agreement vault row to signing when sent/unsigned and to the signed-PDF endpoint when signed.
- `lib/customer/dashboard.ts` — includes `agreement_sent_at` in customer docket context.
- `package.json` and `package-lock.json` — add the approved `pdf-lib` dependency.

Decisions/deviations:
- No SQL was run and no buckets were created by Codex. The code expects Adam to apply the Phase 2 schema/bucket SQL before runtime QA.
- The customer signed-PDF download endpoint was added because the vault row needs a guarded route for the private `signed-agreements` bucket.
- The stored PDF hash is calculated from the final stored PDF bytes and saved in `agreement_signatures.pdf_hash`; the visible audit page notes that the hash is stored in the database.
- The live checkout has stale `.next/types`; type-check was verified in a disposable clean worktree with this patch applied.

Status: implementation complete pending isolated nm-gate after commit/push. Verification so far: `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS.


## 2026-06-28 — Phase 2 Agreement Engine rework

Summary: applied consolidated Reviewer/QA fixes for deployment safety, legal correctness, idempotency, error hygiene, and signature image retention.

Files changed:
- `lib/customer/dashboard.ts` — removes `agreement_sent_at` from the shared customer portal `DOCKET_SELECT` so existing `/account` pages do not 500 before Adam applies the Phase 2 column.
- `app/account/documents/page.tsx` — fetches `agreement_sent_at` only for the document vault, tolerates the pre-SQL missing-column state, and fixes the stray literal template marker in banner copy.
- `app/account/docket/[id]/sign/page.tsx` — requires a chosen purchase path before rendering the dealer/auction agreement instead of defaulting to auction.
- `app/api/customer/docket/[id]/sign/route.ts` — rejects missing purchase path with 400, returns 413 for oversize licenses, returns JSON storage errors, catches unique `agreement_signatures.docket_id` conflicts as 409, and records a stored signature PNG path.
- `lib/storage/licenses.ts` — adds private-bucket upload support for drawn signature PNGs at UUID paths.

Decisions/deviations:
- The document vault is the only customer flow that selects `agreement_sent_at`; if the column is not applied yet it treats the agreement as unsent instead of breaking the portal.
- Signature PNGs are stored in the private `customer-documents` bucket alongside licenses, using UUID object paths and no original filenames.
- SQL and bucket creation remain Adam-run-only.

Status: rework complete pending commit and isolated gate. Verification so far: `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS. Full build will be verified by the isolated Docket gate with env symlinks after commit/push.
