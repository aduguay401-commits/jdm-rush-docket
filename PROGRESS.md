# Progress

## 2026-07-04 - Nurture Engine Phase 2 consent ledger and opt-in

Summary: implemented the Docket-owned Phase 2 consent ledger, inactive quote saved-search seed, no-login opt-in confirmation, one-click unsubscribe suppression, and optional List-Unsubscribe email header support. Scope stayed additive: no matching engine, no weekly cron, no Garage upgrade, and no changes to Phase 1 lead_source stamping or selected_path behavior.

Pre-build live schema gate:
- Live Supabase `dockets` was inspected through the service-role PostgREST OpenAPI metadata before authoring migration 011.
- Confirmed Phase 1 columns are live: `lead_source`, `lead_source_set_at`, and `lead_source_detail`.
- Confirmed `gen_random_uuid()` is available on live because `dockets.id` defaults to `gen_random_uuid()`.
- Existing dockets indexes visible from applied tracked migrations: `dockets_pkey` and `idx_dockets_customer_id`. Supabase only exposes `public` and `graphql_public` via PostgREST, so `pg_catalog.pg_indexes` was not directly readable from this seat.

Files changed:
- `supabase/migrations/011_nurture_phase2_consent.sql` - adds Docket marketing consent fields, unique unsubscribe-token index, `lead_consent_events`, `lead_saved_searches`, checks, indexes, RLS enablement, and named `$fn$` trigger functions without SQL-editor-hostile `DO` or anonymous `$$` blocks.
- `app/api/system/quote/route.ts` - creates an inactive saved search for new exact-quote dockets, computes the anchor card estimate with the existing calculator helper, and adds the weekly-matches opt-in CTA plus concise consent language to the transactional quote email.
- `lib/nurture/consent.ts` - centralizes token shape validation, per-IP lookup throttling, non-enumerable exact-quote saved-search lookups, hashed IP/user-agent proof metadata, opt-in recording, unsubscribe recording, and simple anchor model-key generation.
- `app/nurture/opt-in/[token]/page.tsx` - adds the no-login confirmation page using the existing AuthPageShell/AuthUi styling, vehicle recap, consent card, full-width POST CTA, idempotent confirmed state, and invalid-link ErrorBanner state.
- `app/api/nurture/opt-in/[token]/route.ts` - records express consent via POST only, activates the saved search, inserts a consent event, and redirects back to the confirmation page.
- `app/nurture/unsubscribe/[token]/page.tsx` - adds the one-click suppression confirmation page with the neutral non-orange card and invalid-link ErrorBanner state.
- `app/api/nurture/unsubscribe/[token]/route.ts` - supports unsubscribe suppression from API GET/POST paths, including one-click List-Unsubscribe-Post style POST responses.
- `lib/email.ts` - adds optional custom headers plus List-Unsubscribe/List-Unsubscribe-Post support for future commercial sends.
- `lib/urls.ts` - adds canonical Docket opt-in and unsubscribe URL builders.
- `app/account/_components/AuthPageShell.tsx` - adds a backward-compatible optional `title` prop so the nurture pages can reuse the existing shell with their required headings.
- `ISSUES.md` - records migration 011 as Adam-run before runtime QA/merge and moves the now-live migration 010 item to Resolved.

Decisions/deviations:
- Migration 011 is authored but not run; Adam must paste the delivered SQL into production Supabase before runtime QA.
- The quote email remains transactional by default. The weekly-match CTA links to a confirmation page; no GET route grants consent.
- Existing dockets that receive generated unsubscribe tokens from migration 011 are not opt-in eligible unless they also have `lead_source = 'exact_quote'` and a Phase 2 `lead_saved_searches` row, preventing legacy-token enumeration or accidental marketing consent.
- CASL sender identity uses the locked address `JDM Rush Imports Inc., 11 Humboldt Ave, Winnipeg, MB R3B 0S5, Canada`; Adam still needs to confirm the postal address before broad marketing sends.

Verification so far:
- `git diff --check` PASS.
- `npx tsc --noEmit --pretty false` PASS.
- `npm run lint` PASS with 11 baseline warnings outside the Phase 2 changes.
- Full isolated nm-gate will run after commit and push.

Status: implementation complete pending commit and isolated gate.

## 2026-07-03 - Nurture Phase 1 All-view refinement

Summary: added an All dashboard view as the default on both admin and agent dashboards so legacy/pre-migration dockets remain reachable while the three marketable segment tabs stay available.

Files changed:
- `lib/dockets/leadSource.ts` - adds the `all` lead view, counts every docket for that tab, and keeps segment-only filtering explicit for My Garage, Quote Leads, and Find My JDM.
- `app/admin/dashboard/AdminDashboardClient.tsx` - defaults to All, renders four lead-view tabs, and preserves the existing search/status/flag/archived filters.
- `app/agent/dashboard/page.tsx` - mirrors the All-first four-tab layout for export agents.
- `PROGRESS.md` - records this review refinement.

Decisions/deviations:
- Migration 010, route stamping, and the lead-source immutability trigger were left unchanged.
- Null/legacy rows remain unclassified for marketing purposes, but they are visible in the operational All view.

Verification:
- Pending rerun: `git diff --check`, `npm run type-check`, and isolated nm-gate on the pushed branch.

Status: refinement complete pending commit and isolated gate.

## 2026-07-03 - Nurture Engine Phase 1 lead-source segmentation

Summary: added the Phase 1 immutable lead-source stamp and three-tab lead segmentation for admin and agent dashboards without changing selected_path, pricing, lifecycle, or site proxy behavior.

Pre-build gate:
- Verified the live production `dockets` schema through Supabase OpenAPI/sample reads before authoring the migration. Live columns include post-migration fields such as `is_archived`, `admin_notes`, `chosen_path`, agreement fields, and `vehicle_description`; `lead_source`, `lead_source_set_at`, and `lead_source_detail` do not exist yet.

Files changed:
- `supabase/migrations/010_nurture_phase1_lead_source.sql` - adds nullable `lead_source`, `lead_source_set_at`, non-null default `{}` `lead_source_detail`, v1 source-value check constraint, quote-endpoint-only backfill, and an immutability trigger for non-null lead sources.
- `app/api/system/quote/route.ts` - stamps new exact quote dockets with `lead_source='exact_quote'`, source timestamp, and Docket-owned detail metadata.
- `app/api/system/intake/route.ts` - stamps new intake dockets with `lead_source='find_my_jdm'`, source timestamp, and Docket-owned detail metadata.
- `lib/dockets/leadSource.ts` - centralizes the three marketable lead-view rules and labels so null/legacy rows stay out of marketable tabs.
- `lib/admin/types.ts` and `lib/admin/dockets.ts` - include `customer_id` and lead-source fields in admin dashboard records.
- `app/admin/dashboard/AdminDashboardClient.tsx` - adds My Garage, Quote Leads, and Find My JDM tabs with counts and lead-origin badges while preserving the existing status/search/flag filters.
- `app/agent/dashboard/page.tsx` - mirrors the same lead tabs and origin badges for export agents.
- `PROGRESS.md` and `ISSUES.md` - record the Phase 1 implementation and Adam-run migration prerequisite.

Decisions/deviations:
- The migration is additive only and does not mutate `selected_path` or lifecycle columns.
- Only `selected_path='quote-endpoint'` historical rows are backfilled to `exact_quote`; all other legacy/null rows remain unclassified and are excluded from marketable tabs.
- Docket owns both route stamps; no `jdm-rush-next` proxy changes were needed for Phase 1.
- The trigger permits a future controlled `NULL -> value` classification but rejects changes once `lead_source` is non-null.

Verification:
- `git diff --check` PASS.
- `npm run type-check` PASS.
- Full isolated nm-gate will run after this branch is committed and pushed.

Status: implementation complete pending commit and isolated gate.

## 2026-06-29 - Garage mobile sticky and completed-card mini-track follow-up

Summary: implemented two Adam-approved garage follow-ups: restored mobile sticky behavior by making the mobile root horizontal clip sticky-safe, and removed the misleading journey mini-track from completed purchase cards.

Files changed:
- `app/globals.css` - changes the mobile-only `html, body` media-query `overflow-x` value from `hidden` to `clip`, matching the base sticky-safe rule while preserving all width and touch guards.
- `app/account/_components/garage-ui.tsx` - adds an optional `showJourneyTrack` prop to `ImportCard`, defaulting to true so active import cards keep the existing track.
- `app/account/completed/page.tsx` - passes `showJourneyTrack={false}` for completed/delivered cards so the stale import-stage strip is hidden only in the archive.
- `PROGRESS.md` - records this follow-up and verification.

Decisions/deviations:
- No API, auth, Supabase, or data contracts were changed.
- The first-load horizontal lock guards added in the prior round were kept intact.
- The active imports card journey track remains unchanged.

Status: implementation complete. Verification: `git diff --check` PASS; `npm run type-check` PASS; `npm run build` PASS; 375px browser lock check kept `scrollWidth=375` with zero overflow offenders. Isolated nm-gate runs after push.

## 2026-06-29 - Garage prod cosmetic and layout fixes

Summary: folded Adam live-production garage feedback into a front-end-only account polish branch: centered and unclipped hub title, numeric-first hub stats, renamed garage spokes, and a stricter first-load horizontal layout lock.

Files changed:
- `app/account/_components/header.tsx` - adds opt-in centered hub title styling, restores descender-safe line-height/padding, constrains the mobile logo width, and clips the sticky header to the viewport.
- `app/account/_components/garage-ui.tsx` - makes the shared account page shell explicitly full-width/min-width-safe so child content cannot create viewport overflow.
- `app/account/page.tsx` - centers the hub header, changes the stage word stat into a real numeric count with a stage descriptor, and renames the import/completed spokes.
- `app/account/imports/page.tsx` and `app/account/completed/page.tsx` - updates page titles to My Active Imports and My Completed Purchases.
- `app/account/imports/[id]/*` - updates back labels and breadcrumbs to My Active Imports.
- `app/globals.css` - locks root/body width to the viewport with horizontal overflow hidden, no horizontal overscroll, and vertical touch panning.
- `app/layout.tsx` - makes the viewport contract explicit as `width=device-width, initial-scale=1`.
- `PROGRESS.md` - records this implementation and verification.

Decisions/deviations:
- The approved Sign your purchase agreement action-needed banner was left unchanged.
- Root cause for the mobile overflow risk was the unconstrained mobile header logo plus shell/header elements that did not explicitly enforce `min-width:0`/`max-width:100%`; the fix constrains that width and locks root/account shells to the viewport.
- N1 (hide the mini journey-track on completed Delivered cards) remains deferred and was not changed.
- No API, auth, Supabase, or data contracts were changed.

Status: implementation complete. Verification: `git diff --check` PASS; `npm run lint` PASS with baseline warnings only; `npm run type-check` PASS; `npm run build` PASS; Playwright 375px check confirmed `width=device-width, initial-scale=1`, `scrollWidth=375`, `clientWidth=375`, centered title, and no horizontal overflow offenders on the reachable account login surface. Authenticated hub browser login remains blocked by the known scripted Supabase login flake, so final acceptance relies on build plus isolated nm-gate.

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


## 2026-06-28 — Phase 2 Agreement Wizard front-end redesign

Summary: rebuilt `/account/docket/[id]/sign` as the approved 4-step front-end wizard while leaving the verified signing POST route and backend contract unchanged.

Files changed:
- `app/account/docket/[id]/sign/page.tsx` — simplified the server page to load the filled agreement and pass wizard data into the client while preserving authenticated ownership, missing-path, and already-signed states.
- `app/account/docket/[id]/sign/SignClient.tsx` — replaces the single-page form with the 4-step wizard: Review with scroll-to-bottom plus read checkbox gate, Sign with address/signature/legal-name/date gate, License upload with drag/drop/camera capture and validation, and Review/Submit with read-only summary and existing confirmation state.

Decisions/deviations:
- Front-end only: the existing sign POST route, PDF generation, signature embed, hash, private storage, email attachment, 409 handling, and RLS/server validation were not changed.
- Wizard back navigation preserves address, signature image, legal name, date, and license selection in client state until final submit.
- The final submit continues sending the existing POST fields and includes the composed `customer_address` value without changing the server contract.

Status: implementation complete pending commit and isolated gate. Verification so far: `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS.


## 2026-06-28 — Phase 2 Agreement Wizard final rework

Summary: applied the final combined fix-list for wizard accessibility, license upload choice, and Supabase SSR auth session refresh reliability.

Files changed:
- `app/account/docket/[id]/sign/SignClient.tsx` — makes the Step 1 agreement scroll region keyboard-focusable with an accessible label, auto-unlocks the scroll gate when content is not scrollable, and removes unconditional mobile camera capture so customers can choose camera or gallery/file picker.
- `middleware.ts` — adds Supabase SSR cookie-refresh middleware using the request/response cookie `getAll`/`setAll` pattern, calls `supabase.auth.getUser()` per request, copies Supabase no-cache headers, and excludes static/image assets from the matcher.

Decisions/deviations:
- The Step 1 scroll-plus-checkbox gate remains intact for scrollable agreements; non-scrollable agreements no longer block keyboard or small-content cases.
- Auth callbacks and route handlers are unchanged. The middleware only refreshes/persists SSR auth cookies before requests reach the existing Stage 0.5/0.5.1 flows.

Status: rework complete pending commit and isolated gate. Verification so far: `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS.


## 2026-06-28 — Phase 2 Agreement Wizard polish

Summary: implemented the approved polish pass for `/account/docket/[id]/sign` while keeping the backend signing route and submit contract unchanged.

Files changed:
- `app/account/docket/[id]/sign/SignClient.tsx` — changes Step 1 to a single page-scroll agreement with sentinel/window-bottom gating, adds compact mobile step progress, preserves instant scroll-to-top on step changes, redraws the signature canvas from its fluid container width, and updates the signed confirmation actions.
- `app/account/docket/[id]/sign/page.tsx` — clamps the sign page shell to the viewport width to prevent horizontal overflow.
- `app/globals.css` — applies global horizontal overflow protection on `html` and `body`.

Decisions/deviations:
- Front-end only: the existing POST payload fields, signing route, storage, email, PDF, hash, and server validation were not changed.
- Short agreements unlock the read-to-bottom gate when the end sentinel is already visible or the document does not require scrolling; longer agreements still require reaching the end plus the read checkbox.

Status: implementation complete pending commit and isolated gate. Verification so far: `git diff --check` PASS; `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS.


## 2026-06-28 — Dealer signed PDF sanitizer rework

Summary: fixed the dealer agreement PDF generation failure caused by non-WinAnsi characters in the dealer template.

Files changed:
- `lib/agreements/renderPdf.ts` — replaces the narrow dash-only cleanup with a reusable PDF text sanitizer that maps common typographic characters to safe ASCII, including `<=`, `>=`, curly quotes, ellipsis, bullets, and dashes, then falls back to `?` for any remaining codepoint above `0x00FF`.
- `lib/agreements/sign.ts` — applies the same sanitizer to audit-stamp values so customer name, address, user agent, and other submit-time text cannot trip pdf-lib StandardFont encoding.

Verification:
- Dealer signed PDF generation PASS using the real dealer template, template filler, and `signAgreementPdf` with a PNG signature. Output: `/tmp/dealer-signed-sanitize-check.pdf`, 11,138 bytes, SHA-256 `cd7b1fc60c4d30e3d6ddf2e323a82bce8026cdd07906255d11a3463a0aabe8e3`.
- Extracted PDF text confirms the 50K clause renders as `(<= CAD $50,000)` and guard text renders as `<= >= 'single' "double" ... - ?`.
- `git diff --check` PASS; `npm run lint` PASS with baseline warnings only; clean temporary worktree `npm run type-check` PASS.

Status: rework complete pending commit and isolated gate.


## 2026-06-28 — Wizard sticky sidebar and PDF control sanitizer rework

Summary: fixed the final sticky-sidebar regression and hardened PDF text sanitization for control characters.

Files changed:
- `app/globals.css` — removes desktop `html/body` horizontal overflow clipping and scopes root `overflow-x: hidden` to mobile widths only.
- `app/account/docket/[id]/sign/page.tsx` and `SignClient.tsx` — switches sign-page horizontal clipping wrappers from `overflow-x-hidden` to `overflow-x-clip`, preserving viewport clipping without creating sticky-breaking scroll ancestors.
- `lib/agreements/renderPdf.ts` — keeps existing typographic mappings and also replaces unsafe C0/C1 controls with `?`, while preserving tab, LF, and CR whitespace.

Verification:
- Browser QA via temporary uncommitted Next harness importing the real `SignClient` PASS.
- Desktop 1440x900 sticky sidebar PASS: aside top changed from initial `102` to pinned `96`, and stayed `96` after further scroll.
- Mobile 390x844 and 375x667 PASS on steps 1, 2, 3, and 4: `scrollX` stayed `0`, `documentElement.scrollWidth === clientWidth`, `body.scrollWidth === clientWidth`, and no overflowing elements were detected.
- Temporary QA route was removed before commit.

Status: rework complete pending commit and isolated gate.


## 2026-06-29 — My JDM Garage hub-and-spoke build

Summary: rebuilt `app/account` into the approved hub-and-spoke information architecture without API changes.

Files changed:
- `app/account/_components/header.tsx` — adds dynamic page titles, a 44px back control, and desktop breadcrumbs while keeping the customer/message/sign-out tools.
- `app/account/_components/garage-ui.tsx` — adds shared hub UI primitives: action banner, stat grid, chunky spoke rows, import cards, journey mini-track, status pills, and empty states.
- `app/account/page.tsx` — new hub with top action-needed banner, overview band, 2x2 stats, and the three clean spoke rows.
- `app/account/find/page.tsx` — real-data Find My JDM spoke using existing dockets/report tokens and message links.
- `app/account/imports/page.tsx` and `app/account/imports/[id]/page.tsx` — Active Imports list plus per-import sub-hub with honest journey placeholder and four sub-spokes.
- `app/account/imports/[id]/vehicle/page.tsx` — real-data Vehicle Info leaf using docket fields plus existing research option details/photos when available.
- `app/account/imports/[id]/agreement/page.tsx` — real Legal Agreement leaf linking to the existing sign flow or signed-agreement download endpoint.
- `app/account/imports/[id]/invoices/page.tsx` and `app/account/imports/[id]/documents/page.tsx` — clean coming-soon empty states for features without records today.
- `app/account/car/page.tsx`, `app/account/research/page.tsx`, `app/account/documents/page.tsx`, and `app/account/journey/page.tsx` — redirects from old flat routes into the new IA.
- `app/globals.css` — moves the horizontal lock to first-paint root CSS while preserving desktop sticky behavior by using desktop `overflow-x: clip` and mobile `overflow-x: hidden`.
- `lib/customer/dashboard.ts` — exports the existing safe `agreement_sent_at` lookup pattern for agreement links/action banners without adding it to the shared docket select.

Data honesty:
- Real leaf pages: Find My JDM reports, Vehicle Info, Legal Agreement.
- Empty-state leaves: Invoices & Receipts, Import Documents.
- Journey track: present as IA with a Purchased/default placeholder because no real shipping-stage record exists yet.

Status: implementation complete pending commit and isolated gate.


## 2026-06-29 — Customer login race fix

Summary: moved password login off the client-side router path and into a response-bound server route so successful sign-in sets Supabase auth cookies and redirects to the target route in the same 303 response.

Files changed:
- `app/account/login/LoginClient.tsx` — keeps Google OAuth unchanged, but posts password credentials with the normalized next path to the new server route instead of calling `signInWithPassword` in the browser followed by `router.push`/`router.refresh`.
- `app/account/login/page.tsx` — uses the shared customer next-path normalizer for the password flow target.
- `app/api/customer/auth/login/route.ts` — signs in with the Supabase SSR server client, provisions/blocks customer accounts with the existing soft-delete and linked-email rules, and redirects with cookies on the same response.

Verification:
- `npm run type-check` PASS.
- `npm run lint` PASS with existing warnings only.
- `npm run build` PASS.
- Local mobile-style browser reliability PASS: 5/5 fresh-context password logins landed on `/account` with no bounce back to `/account/login`; disposable auth/customer/profile test data was removed.

Status: implementation complete pending commit and isolated gate.


## 2026-06-29 — Customer login security rework

Summary: kept the race-free server POST login flow and closed the reviewer/QA security findings before merge.

Files changed:
- `app/api/customer/auth/login/route.ts` — rejects password-login POSTs unless `Origin` or fallback `Referer` matches the trusted `getAppBaseUrl()` origin; all redirects now use `getAppBaseUrl()` instead of request host or forwarded-host headers; production auth cookies are forced `Secure` while leaving the supabase-ssr JS-readable cookie default for browser SDK compatibility.

Verification:
- Cross-origin POST with `Origin: https://evil.example` returns 403 before sign-in.
- Missing Origin/Referer returns 403; trusted Referer fallback returns the normal 303.
- Forged `X-Forwarded-Host: evil.com` cannot influence Location; redirects stay under `https://docket.jdmrushimports.ca`.
- `npm run type-check` PASS.
- `npm run lint` PASS with existing warnings only.
- `npm run build` PASS.

Status: security rework complete pending commit and isolated gate.

## 2026-07-03 - PST/provincial-tax total erasure

Summary: removed the remaining PST/QST/provincial-tax scaffolding from the Docket import calculator contract, quote report normalizer, and report prop types without changing landed-cost math.

Files changed:
- lib/importCalculator.ts - removed pstRate/pstCAD from FeeBreakdown, deleted the dead PST rate constant, removed zero-valued PST locals and return fields, and cleaned the card-estimate comment.
- app/api/import-calculator/route.ts - stopped returning provincialTax, provincialTaxRate, and provincialTaxLabel from the calculator API.
- app/report/[token]/page.tsx - stopped reading stored pstCAD, pstProvince, and pstRate from historical quote snapshots.
- app/report/[token]/ReportClient.tsx - removed the type-only PST fields from the report fee breakdown prop shape.

Verification:
- npm run type-check PASS.
- Refined tax-term scan rg -n "\b(pst|qst)\b|provincialTax" lib app -i PASS with no hits.
- Sample calculator total unchanged before vs after: 1,250,000 JPY, Winnipeg, regular, duty-free, exchange rate 0.00935 -> totalDeliveredCAD stayed 20562.65.
- Full isolated nm-gate will run after this branch is committed and pushed.

Status: implementation complete pending commit and isolated gate.
