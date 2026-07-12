# Progress

## 2026-07-05 - Opt-in price basis polish

Summary: folded Adam's copy polish into the opt-in price-basis branch after Reviewer and QA passed.

Files changed:
- `app/nurture/opt-in/[token]/page.tsx` - gates the explanatory footnote behind the same `quotedPrice` condition as the `Est. match price` row and updates the footnote wording to reference the quote email instead of a non-existent email block above it.
- `PROGRESS.md` - records the refinement and verification.

Decisions/deviations:
- Copy/presentational-only change on the same branch.
- The `quotedPrice` value still comes from `lead.savedSearch.anchor_card_estimate_cad`; no value binding, calculator, matching, or quote email code changed.
- `lib/importCalculator.ts`, `lib/nurture/matching.ts`, and `app/api/system/quote/route.ts` remain untouched.

Verification:
- `npm run type-check` PASS.
- `git diff --check` PASS.
- Protected-file diff check PASS: `lib/importCalculator.ts`, `lib/nurture/matching.ts`, and `app/api/system/quote/route.ts` have no changes.
- Full isolated `bash .agents/bin/nm-gate fix/opt-in-price-basis-label` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: refinement complete, pushed, and isolated gate PASS.

## 2026-07-05 - Opt-in price basis label

Summary: clarified the nurture opt-in confirmation price basis with copy-only changes so the saved-search card estimate is not confused with the quote email landed-cost total.

Files changed:
- `app/nurture/opt-in/[token]/page.tsx` - relabels the vehicle recap price row from `Quoted price` to `Est. match price` and adds the approved explanatory footnote below the recap card.
- `PROGRESS.md` - records the copy-only scope and verification.

Decisions/deviations:
- The value remains `lead.savedSearch.anchor_card_estimate_cad` formatted through the existing `formatCadAmount`; no calculation or saved-search data changed.
- `lib/importCalculator.ts`, `lib/nurture/matching.ts`, and `app/api/system/quote/route.ts` were not touched. The quote email landed-cost breakdown and TOTAL LANDED COST figure remain untouched.

Verification:
- `npm run type-check` PASS.
- `git diff --check` PASS.
- Protected-file diff check PASS: `lib/importCalculator.ts`, `lib/nurture/matching.ts`, and `app/api/system/quote/route.ts` have no changes.
- `bash .agents/bin/nm-gate --quick fix/opt-in-price-basis-label` PASS: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED.
- Full isolated `bash .agents/bin/nm-gate fix/opt-in-price-basis-label` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-05 - Follow-up cron hardening

Summary: hardened the schema-correct follow-up cron against future backlog blasts and duplicate step sends, and retired the dead legacy decision endpoint that could bypass Sequence C creation.

Files changed:
- `app/api/cron/follow-up/route.ts` - orders due rows by `next_send_at`, caps each daily cron run at 50 sequences, claims and advances the sequence before delivery, writes the step `email_log` before sending, and repairs rows that already have a step log without re-sending.
- `app/api/customer/report/[token]/decision/route.ts` - returns HTTP 410 so the old unused decision endpoint can no longer set `decision_made` without the canonical approve route's Sequence C insert.
- `PROGRESS.md` - records the hardening scope, rationale, and verification.

Decisions/deviations:
- The throttle is 50 because `/api/cron/follow-up` runs once daily at 14:00 UTC; that drains a backlog over days instead of blasting all due customers at once, while still allowing far more than normal daily follow-up volume.
- No migration was added. Idempotency is handled in route code by advancing the current guarded step before send, inserting `email_log` before send, and checking an existing `sequence_X_step_Y` log to heal a prior partial write without another email.
- Existing Sequence A and B timing remains untouched; those sequence types are intentionally reserved for the future nurture segmentation engine.
- The quote email and landed-cost breakdown were not touched.

Verification:
- `npm run type-check` PASS.
- `git diff --check` PASS.
- `bash .agents/bin/nm-gate --quick fix/followup-cron-hardening` PASS: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED.
- Full isolated `bash .agents/bin/nm-gate fix/followup-cron-hardening` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-05 - Follow-up cron schema fix

Summary: reproduced the production follow-up cron 500 against the real Supabase schema, confirmed `follow_up_sequences` has a `completed` boolean instead of `cancelled_at` / `completed_at` timestamps, and fixed the cron with a code-only schema adaptation.

Files changed:
- `app/api/cron/follow-up/route.ts` - removes nonexistent timestamp columns from the due-sequence select and terminal updates, filters active due rows with `completed` boolean, keeps `status='cancelled'` as the existing cancellation signal, and marks final-step sequences `completed=true`.
- `PROGRESS.md` - records the repro, schema decision, fix path, and harness verification.

Decisions/deviations:
- Code-only path taken. The existing schema is sufficient: `status` distinguishes active/cancelled/completed lifecycle and `completed` is the terminal boolean, so no Adam-run migration is required.
- The isolated harness used `/tmp/jdm-rush-docket-followup-repro` on port `3065` with `DEV_MODE=true`; no shared `:3005` server was touched.
- Throwaway docket `c063e9e0-f021-4dac-b2b9-d8d0527d63b3` and follow-up sequence `0e244e02-02c6-405f-b236-47866c433510` were deleted after verification; cascade cleanup left no docket, sequence, or email_log rows for that test data.

Verification:
- Repro PASS: current `main` route returned HTTP 500 with `column follow_up_sequences.cancelled_at does not exist`.
- Real schema PASS: Supabase OpenAPI reported `follow_up_sequences` columns `completed,created_at,docket_id,emails_sent,id,last_sent_at,next_send_at,sequence_type,status,step`.
- Fixed harness PASS: the cron returned HTTP 200 and `{"processed":1}` for a due Sequence A row; it wrote `email_log.sequence_A_step_1` to `ADMIN_EMAIL` under `DEV_MODE=true`, advanced the sequence to `step=2`, set `last_sent_at`, `emails_sent=1`, and moved `next_send_at` three days out.
- Idempotency PASS: immediate second cron run returned HTTP 200 with `processed:0` / no due follow-up sequences.
- `bash .agents/bin/nm-gate --quick fix/followup-cron-schema` PASS: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED.
- Full isolated `bash .agents/bin/nm-gate fix/followup-cron-schema` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-05 - On-ramp fast-follow confirmation card fold

Summary: folded Adam's gate note into the existing on-ramp fast-follow branch by changing only the post-submit confirmation card on the no-login connect page to first-person Adam voice.

Files changed:
- `app/questions/[token]/CustomerQuestionsClient.tsx` - rewrites the answer-submitted confirmation card from team voice to Adam first-person voice.

Decisions/deviations:
- No quote email code or landed-cost breakdown table rows were changed.
- The change is copy-only and limited to the confirmation card Adam flagged.

Verification:
- `git diff --check` PASS.
- Quote table grep PASS: the landed-cost breakdown markers remain present and the full-quote button remains absent.
- Full isolated `bash .agents/bin/nm-gate feature/onramp-nits-voice-escape` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-05 - On-ramp fast-follow voice and escape helper nits

Summary: folded two non-blocking Home Base rename nits into a narrow follow-up: made the connect page voice consistent with Adam's first-person heading and deduplicated the HTML escaping helper across the touched email/on-ramp modules.

Files changed:
- `app/questions/[token]/CustomerQuestionsClient.tsx` - rewrites the original-request and ask-anytime card copy to Adam first-person voice.
- `lib/html.ts` - adds one shared `escapeHtml` helper.
- `lib/customer/AccountUpsell.tsx` - imports the shared helper instead of defining its own copy.
- `app/api/system/intake/route.ts`, `app/api/system/quote/route.ts`, `app/api/agent/send-questions/route.ts`, and `app/api/cron/follow-up/route.ts` - import the shared helper and remove local duplicate definitions.

Decisions/deviations:
- No quote email layout or landed-cost breakdown table rows were changed.
- Unrelated existing `escapeHtml` helpers outside the just-merged email/on-ramp surface were left alone to keep this fast-follow narrow.

Verification:
- `git diff --check` PASS.
- Scoped helper grep PASS: the touched on-ramp/email files now have one `escapeHtml` definition in `lib/html.ts`.
- Quote table grep PASS: the landed-cost breakdown markers remain present and the full-quote button remains absent.
- `bash .agents/bin/nm-gate --quick feature/onramp-nits-voice-escape` PASS: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED.
- Full isolated `bash .agents/bin/nm-gate feature/onramp-nits-voice-escape` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-05 - Home Base copy cleanup and My Garage on-ramp

Summary: removed customer-facing Home Base branding from the token answer flow and Funnel A conversation emails, added a shared My Garage account upsell for emails/page panels, wired register email/next query params, and cleaned the quote email CTA stack without changing the landed-cost breakdown.

Files changed:
- `lib/customer/AccountUpsell.tsx` - adds shared register-link builders, email footer/panel renderers, and the post-answer My Garage page panel.
- `app/account/register/page.tsx` and `app/account/register/RegisterClient.tsx` - read `email`/`next` query params, prefill the register form, and carry `next` through password and Google auth callbacks.
- `app/questions/[token]/page.tsx` and `app/questions/[token]/CustomerQuestionsClient.tsx` - remove visible Home Base naming, restyle the no-login answer page with the account doorway aesthetic, keep answers primary, and show the My Garage panel only after answer submit.
- `app/api/system/intake/route.ts` - changes the intake welcome email to Adam's first-person voice with a plain `Answer these` link and the shared account footer.
- `app/api/agent/send-questions/route.ts` - changes the questions email to Adam's first-person voice with a plain `Answer these` link and the shared account footer.
- `app/api/cron/follow-up/route.ts` - changes Sequence A follow-ups to Adam's first-person voice with a plain answer link and shared account footer while leaving B/C report and purchase CTAs intact.
- `app/api/admin/remind/[id]/route.ts` - changes answer reminders to Adam's first-person voice with a plain answer link and shared account footer while preserving report/purchase reminder buttons.
- `app/api/system/quote/route.ts` - removes the misleading Home Base full-quote button and adds the My Garage account panel below the existing weekly-matches opt-in without touching the total or itemized landed-cost table.

Decisions/deviations:
- `lib/customer/homeBaseStatusCopy.ts` was intentionally left unchanged per dispatch because its customer-visible strings do not say Home Base.
- Internal route/helper names such as `/questions/[token]` and `getCustomerHomeBaseUrl` remain unchanged to avoid cosmetic symbol churn.
- The quote email stays branded/team-voice; only the bad full-quote CTA was removed and the Rung-2 My Garage panel was added.

Verification:
- Scoped grep PASS: no customer-facing `Home Base` / `JDM Home Base` strings remain in the touched Funnel A email, connect-page, or quote-email surfaces; no `View Your Full Quote` CTA remains in `app/api/system/quote/route.ts`.
- `git diff --check` PASS.
- `bash .agents/bin/nm-gate --quick feature/homebase-mygarage-onramp` PASS: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED.
- Full isolated `bash .agents/bin/nm-gate feature/homebase-mygarage-onramp` PASS on the pushed branch: lint advisory PASS, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-04 - Nurture Engine Phase 3B pre-go-live fixes

Summary: closed Adam's four pre-go-live fixes on the Phase 3B weekly send job without expanding scope beyond the cron/email path.

Files changed:
- `app/api/cron/nurture-matches/route.ts` - adds six-day sent-ledger dedupe independent of `last_sent_at`, skips real suppression timestamp updates in DEV_MODE, strips List-Unsubscribe mailto down to a bare email address, and records the original intended recipient in `nurture_email_sends` rows even when delivery reroutes to ADMIN_EMAIL.
- `PROGRESS.md` - records the pre-go-live fix pass.

Decisions/deviations:
- The sent ledger row is written immediately after a successful email send and before the non-DEV suppression timestamp updates, so a later partial write failure no longer permits a resend within six days.
- DEV_MODE idempotency now relies on the sent ledger row, not on `lead_saved_searches.last_sent_at`; this prevents test runs against shared data from suppressing real customer sends.
- `email_log.recipient_email` still reflects the actual delivery target for QA visibility, while `nurture_email_sends.recipient_email` reflects the original customer recipient.

Verification:
- `git diff --check` PASS.
- `npm run type-check` PASS.
- `npm run lint` PASS with 11 baseline warnings and 0 errors.
- `npm run build` PASS.
- Full isolated `bash .agents/bin/nm-gate nurture-p3b-sendjob` PASS on the pushed branch: lint PASS advisory, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported the same non-fatal harness error, and the gate result remained ALL PASS.

Status: fixes complete, pushed, and isolated gate PASS.

## 2026-07-04 - Nurture Engine Phase 3B weekly send job

Summary: implemented the weekly nurture send job that turns Phase 3A matches into customer emails while keeping launch controls off until Adam sets production env. The cron requires Bearer CRON_SECRET, supports DEV_MODE rerouting to ADMIN_EMAIL, fetches Japan Stock inventory once per run, sends at most three matched cars, records the nurture send ledger, updates the six-day idempotency timestamp, logs email_log weekly_matches rows, and includes List-Unsubscribe/List-Unsubscribe-Post headers.

Files changed:
- `lib/emails/weeklyMatches.ts` - adds the table-based single-column weekly 3-match email renderer with inline styles, card-estimate CAD pricing, live listing buttons, reply-to-contact CTA, CASL footer, and unsubscribe link via getNurtureUnsubscribeUrl.
- `app/api/cron/nurture-matches/route.ts` - adds the authenticated weekly cron route using the Phase 3A inventory loader and matcher, service-role Supabase, DEV_MODE recipient override, send/skip/failure ledger writes, last_sent_at and marketing_last_email_at updates, email_log insertion, and List-Unsubscribe headers.
- `vercel.json` - adds the Monday 15:00 UTC /api/cron/nurture-matches schedule while preserving the existing follow-up cron.
- `PROGRESS.md` - records this implementation.
- `ISSUES.md` - records migration 012 as an Adam-run prerequisite for Phase 3B runtime QA/go-live.

Decisions/deviations:
- Added both GET and POST handlers to the nurture cron so Vercel cron GETs and QA POST/curl checks use the same authenticated code path.
- The global CTA is Garage-independent for Phase 3B: reply/contact plus a Browse all Japan Stock link. No Garage Phase 4 behavior, scraper Phase 5 behavior, NURTURE_OPTIN_ENABLED flip, or secret changes were included.
- Skips for insufficient matches write nurture_email_sends but do not send email. Successful sends update lead_saved_searches.last_sent_at, which keeps same-week reruns from double-sending.
- Migration 012 is still Adam-run; this branch builds against the shipped schema but does not apply production SQL.

Verification:
- `git diff --check` PASS.
- `npm run type-check` PASS.
- `npm run lint` PASS with 11 baseline warnings and 0 errors.
- `npm run build` PASS.
- Full isolated `bash .agents/bin/nm-gate nurture-p3b-sendjob` PASS on the pushed branch: lint PASS advisory, typecheck PASS, build PASS, test SKIPPED. Mobile overflow check reported a non-fatal harness error, and the gate result remained ALL PASS.

Status: implementation complete, pushed, and isolated gate PASS.

## 2026-07-04 - Nurture Engine Phase 2 consent ledger and opt-in

Summary: implemented the Docket-owned Phase 2 consent ledger, inactive quote saved-search seed, no-login opt-in confirmation, one-click unsubscribe suppression, and optional List-Unsubscribe email header support. Scope stayed additive: no matching engine, no weekly cron, no Garage upgrade, and no changes to Phase 1 lead_source stamping or selected_path behavior.

Pre-build live schema gate:
- Live Supabase `dockets` was inspected through the service-role PostgREST OpenAPI metadata before authoring migration 011.
- Confirmed Phase 1 columns are live: `lead_source`, `lead_source_set_at`, and `lead_source_detail`.
- Confirmed `gen_random_uuid()` is available on live because `dockets.id` defaults to `gen_random_uuid()`.
- Existing dockets indexes visible from applied tracked migrations: `dockets_pkey` and `idx_dockets_customer_id`. Supabase only exposes `public` and `graphql_public` via PostgREST, so `pg_catalog.pg_indexes` was not directly readable from this seat.

Review fix round:
- B1: made the saved-search seed and opt-in CTA best-effort. Quote docket creation, transactional email send, and successful JSON response no longer depend on Phase 2 tables/columns being present or writable.
- S1: reordered opt-in writes so the consent ledger row is inserted before `dockets.marketing_consent` or `lead_saved_searches.active` are flipped.
- S2: made migration 011 explicitly idempotent/re-runnable and added a direct-delete prevention trigger for `lead_consent_events` while allowing parent docket purge cascades for right-to-erasure cleanup.

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


## 2026-07-09 - Agreement path guard: no defaulted Auction contract on quote-only dockets

Summary: fixed a QA-confirmed prod bug where a docket that only passed through the quote endpoint (selected_path="quote-endpoint", no customer path choice) presented an enabled Send Agreement button and, if sent, generated a legally-binding AUCTION agreement by default. Introduced a single canonical resolver and threaded it through every agreement path gate so only the two real customer-chosen paths (auction, private_dealer) count as a chosen path; everything else (quote-endpoint, null) is treated as no-path and refused end to end.

Files changed:
- lib/agreements/templates.ts - added REAL_CHOSEN_PATHS + RealChosenPath + resolveChosenPath() as the single source of truth; pickTemplate() now uses it and returns null for no-path instead of silently defaulting to the Auction template.
- app/api/agent/send-agreement/route.ts - send guard now rejects unless resolveChosenPath() returns a real path (was: any truthy chosen_path/selected_path, which quote-endpoint satisfied).
- app/agent/docket/[id]/page.tsx - dashboard chosenPath derived via resolveChosenPath(), so canSendAgreement and the Send Agreement button are disabled on quote-only dockets; the decision_made status line is unaffected (a genuinely approved docket always carries a real path).
- app/api/customer/docket/[id]/sign/route.ts - customer sign route guard now uses resolveChosenPath(); added a null-template guard after pickTemplate() so a no-path docket cannot be signed (defense in depth at the customer surface).
- app/account/docket/[id]/sign/page.tsx - sign page chosenPath via resolveChosenPath(); a null template renders the existing not-ready state (no crash, no error).

Decisions/deviations:
- Scope kept tight (guard/gate correctness, no redesign). Did NOT refactor the duplicate canonical path literals in app/api/customer/approve/[token]/route.ts and app/report/[token]/ReportClient.tsx to import the new constant - logged as a deferred DRY follow-up in ISSUES.md.
- Left the already-signed resend guard untouched (already correct).
- Did not change the quote endpoint selected_path="quote-endpoint" stamp; the fix changes how the gates INTERPRET it, not the stored value.

Verification: isolated nm-gate (build + typecheck) to run on the pushed branch; result reported with code_ready.

Status: implementation complete, pending isolated gate + review.


## 2026-07-09 - DRY: ReportClient real-chosen-path narrowing uses the shared helper

Summary: Reviewer-flagged DRY tidy on the agreement path-guard work. Replaced ReportClient's inline duplication of the real-chosen-path narrowing with the shared single-source definition. Added an isRealChosenPath type-guard predicate to lib/agreements/templates.ts (derived from REAL_CHOSEN_PATHS) and routed both resolveChosenPath and ReportClient through it, so there is exactly one definition of what counts as a real path. Pure no-behavior-change.

Files changed:
- lib/agreements/templates.ts - added isRealChosenPath(value) type guard (single source, derived from REAL_CHOSEN_PATHS); resolveChosenPath now delegates to it (output identical for all inputs).
- app/report/[token]/ReportClient.tsx - imported isRealChosenPath; the decisionState initializer selectedPath narrowing now uses it in place of the inline chosen_path/selected_path literal checks, keeping the exact two-field structure.

Equivalence: isRealChosenPath(x) is exactly (x === "private_dealer" || x === "auction"), so selectedPath is identical to before for every input - auction stays auction, private_dealer stays private_dealer, quote-endpoint and null stay not-real. Deliberately did NOT collapse to a bare resolveChosenPath(docket) swap: resolveChosenPath uses chosen_path ?? selected_path, which would differ from ReportClient's independent per-field narrowing in the (unreachable) case where chosen_path is a non-null non-real value while selected_path is real. The predicate approach preserves exact behavior.

Verification: docket nm-gate on the branch (typecheck + build); reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer static equivalence check.


## 2026-07-09 - Frictionless first-time agreement signing on-ramp

Summary: made the customer-facing agreement signing on-ramp work for a first-time customer with no My JDM Garage account (real case: Dennis Cunningham). The chain was broken at one hop (login Sign-up link dropped the return path) and the agreement email always linked to the account-only sign page. Two edits close it; the returning-customer path is unchanged.

Files changed:
- app/account/login/LoginClient.tsx - the Sign up link now carries next (the return path LoginClient already receives) and the entered email when present, so login -> Sign up -> register -> confirm -> callback claim -> back to the sign page is an unbroken loop. Built with URLSearchParams (auto-encoded).
- app/api/agent/send-agreement/route.ts - branch the email CTA by whether the customer already has an account. First-time (docket.customer_id null AND no customers row for the email) points the button at /account/register?email=<email>&next=<signPath> with create-account copy; a returning customer keeps the unchanged direct sign link + copy. Added customer_id to the docket select; the & in the register URL is escaped to &amp; in the HTML href; on a customers-lookup error it falls back to the direct-sign path so a DB hiccup never blocks sending.

Traced end to end: first-time (email -> register prefilled+next -> confirm -> callback claims docket -> lands on the sign page) and returning (direct sign link). normalizeCustomerNextPath still constrains next to internal paths (origin-checked, no open redirect). Agreement content, path-guard, and signing wizard untouched. New-customer email copy kept minimal; orchestrator to surface it to Adam at the gate.

Verification: docket nm-gate on the branch (typecheck + build); reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer/QA.


## 2026-07-11 - Agent dashboard triage: archive, triage chips, temperature, pin

Summary: the agent dashboard (Adam's daily working view) was one long undifferentiated scroll with no archiving. Added four things, all agent-side, no schema changes (is_archived, archived_at, is_flagged already exist), and MANUAL archive only — nothing auto-archives.

New file:
- app/api/agent/docket/[id]/route.ts — dedicated agent-authed PATCH for is_archived (+ archived_at stamp) and is_flagged. The admin PATCH route restricts agents to research_draft/vehicle_description, so archive/pin need their own path. Gated with requireAdminOrAgent() -> 403 (same pattern as send-agreement), then createServerClient() (service role). Only those two fields are writable; archived_at is set server-side (now on archive, null on unarchive) — the client never picks the timestamp.

Files changed:
- lib/dockets/dashboardDisplay.ts — added getDocketTriageBucket() and getDocketTemperature() (+ types). Buckets reuse the existing getDocketUrgencyPriority so chip filtering and the within-bucket urgency sort never disagree: priority 0/1/2/4 -> Needs You (action states), 3/5 -> Working (waiting states), 6 -> Cold (unresponsive/lost/paused/cleared). Temperature is client-only from already-loaded data: Hot = customer_id set (claimed a Garage account), Warm = ever answered/asked, Cold = zero customer activity.
- app/agent/dashboard/page.tsx — (1) triage chip row (Needs You / Working / Cold / All) with per-chip counts, composable with the existing lead-view tabs, default = Needs You; (2) temperature badge per card; (3) pin star per card (is_flagged) — pinned dockets float above everything within the current view/bucket; (4) Archive per card with a confirm dialog + a "Show Archived" toggle listing archived dockets with Unarchive. Refactored the docket fetch into fetchDockets(archived) so active and archived reuse one query + unread-enrichment. Pin is optimistic with rollback on error; archive/unarchive update local state then refresh.
- app/agent/docket/[id]/page.tsx — Pin and Archive/Unarchive controls in the detail header (next to Back to Dockets), wired to the same agent route; archiving redirects to the dashboard, pin is optimistic with rollback. Added is_flagged/is_archived/archived_at to the docket select + type.

Constraints honored: NO auto-archive anywhere; follow-up cron untouched; no schema changes; existing lead-view tabs, urgency sort, and unread counts unchanged; matched existing agent-dashboard styling (rounded-full pill badges, #E55125 accents, rounded-xl cards).

Verification: docket nm-gate on the branch (typecheck + build in an isolated worktree); reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer/QA.

### 2026-07-11 - agent-triage review fix (CHANGES_NEEDED -> resolved)

Reviewer blocker: a docket at status=questions_sent whose latest activity is a customer_answer is painted green ("Customer answered — respond or pull research") by getStatusDisplay, but getDocketUrgencyPriority let that case fall through to priority 5 (Working bucket), hiding a fresh answer from the default Needs You chip and sorting it below new leads. Fix: getDocketUrgencyPriority now maps (status questions_sent OR answers_received) + source_type customer_answer to priority 1, so it lands in Needs You and sorts with answered dockets. questions_sent without a customer answer still falls to priority 5 (Working), unchanged. This corrects the bucket and the urgency sort in one place.

Should-fix (done): cleared has a green status stripe but sits in the Cold bucket; the card was already dimmed (opacity-60). Muted the cleared card's stripe to neutral grey so a done docket no longer reads as an active green action. Chips/sort unchanged.

Verification: docket nm-gate re-run on the branch (typecheck + build). Reviewer's other findings were already PASS (route security, no auto-archive, no regressions); brand convention confirmed correct (docket = rounded-lg/white/10, not the marketplace rounded-none law).

## 2026-07-11 - Agent dashboard: group same-person dockets into stacked cards

Summary: one engaged person spawns many dockets (every new search/quote = another), so the dashboard read as e.g. "5 Hot leads" when it was one person (Jordan Warwick). Grouped dockets belonging to the same person into one stacked, expandable card. Pure display-layer change — no schema, no endpoint changes.

Grouping key (lib/dockets/dashboardDisplay.ts, new getDocketGroupKey/groupDocketsForDisplay): customer_id when set, else normalized (trim+lowercase) customer_email; a docket with neither is never grouped (singleton). groupDocketsForDisplay takes the ALREADY-ordered list (filtered + urgency-sorted + pinned-first) and buckets by key preserving first-appearance order, so each group lands at the position of its most-urgent/pinned-first member and members keep the list order — group placement and within-group order fall out of the existing ordering for free.

Files changed:
- lib/dockets/dashboardDisplay.ts — getDocketGroupKey, groupDocketsForDisplay, DocketGroup type.
- app/agent/dashboard/page.tsx — added customer_email to the docket select + type (existing column, not a schema change). Extracted the per-docket card into <DocketCard> and the archived card into <ArchivedDocketCard> (module-level, unchanged UI). New generic <GroupCard>: collapsed by default with a header (customer name + "N dockets" + one group temperature badge [Hot if any member Hot, else Warm if any, else Cold] + summed unread badge + a pinned-star if any member is pinned) and a one-line summary of the MOST URGENT member (its stripe + status line + latest activity) so nothing urgent is hidden; expanded, it renders each member as its full normal card (pins-first then urgency). Only groups with 2+ members in the CURRENT filtered view stack; a single passing member renders as a normal card. Grouping is applied to both the active list (visibleGroups) and the Show-Archived list (archivedGroups).

Invariants held: triage chip counts stay DOCKET counts (unchanged), lead-view composition, Show Archived, urgency sort, pin/archive/unarchive actions all still work from cards inside a group, unread counts unchanged (group header shows the sum). No docket is ever hidden — collapsed groups surface the most-urgent member and expand to all. Matched existing docket styling (rounded-lg/xl, white/10-12 borders, #E55125 accents).

Verification: docket nm-gate on the branch (typecheck + build in an isolated worktree); reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer/QA.

## 2026-07-11 - Intake spam guardrails (4 layers) — docket endpoints

Cross-repo task (site half in jdm-rush-next). The public intake surface (POST /api/system/quote + /api/system/intake) creates dockets and sends real emails; unchecked spam would clutter the pipeline and burn sender reputation. Added 4 defense layers, FAIL-OPEN everywhere — a guardrail error never blocks a real customer or 500s the endpoint, and genuine repeat interest (Jordan Warwick pattern) is never hard-blocked.

New: lib/intake/guardrails.ts — all logic + the tunable constants in ONE place (INTAKE_GUARDRAILS: IP_HOURLY=5, EMAIL_DAILY_DOCKETS=4, EMAIL_DAILY_WELCOME=2, MIN_FILL_SECONDS=3).

- Layer 1 (honeypot + fill-time): detectHoneypotOrTooFast — a filled company_website honeypot OR submit-minus-render < 3s => SILENT DISCARD (log + return the normal success shape, no docket, no email). Negative elapsed = client clock ahead (skew) => NOT discarded (fail-open on skew).
- Layer 2 (per-IP 5/rolling hour): isIpRateLimited against the new intake_events table => 429 polite JSON. IP via getIntakeClientIp (x-intake-client-ip forwarded by the site proxy, then x-forwarded-for first hop, then x-real-ip). Missing IP or missing table or any query error => skip (fail-open), never 500.
- Layer 3 (per-email 4 new dockets/rolling 24h): countRecentDocketsForEmail on the existing dockets table (normalized email, exact match in JS after an escaped ilike). Beyond 4 => do NOT create a docket; appendNoteToNewestDocketForEmail records the submission on the newest existing docket and returns the normal success shape. Count error => allow (fail-open).
- Layer 4 (welcome-email cap 2/rolling 24h): isUnderWelcomeEmailCap from the existing email_log (recipient_email + email_type in {email_1_customer_welcome, quote_exact_estimate} + sent_at). Beyond cap => docket still created, the customer welcome/quote email send is SKIPPED and logged (server log only — email_log has no skipped marker, no schema bending). Internal marcus/admin notifications are never capped. Check error => send (fail-open).

Endpoints wire the layers in order L1 -> L2 -> L3 -> create docket -> L4. Existing dedup, agreement engine, dashboard, and cron untouched.

SQL (Adam-run-only): supabase/migrations/013_intake_events.sql — intake_events(id, ip, email, endpoint, created_at) + (ip, created_at) index + created_at index + RLS enabled with a service_role policy (self-contained). NOT run by me. Endpoints fail-open until it exists, so deploy order cannot break intake.

Verification: docket nm-gate on the branch (typecheck + build). Reported with code_ready; Adam must run 013 before the change is fully active.

Status: implementation complete, pending isolated gate + Reviewer/QA + Adam SQL run.

### 2026-07-11 - intake-guardrails review fixes (docket) — indistinguishable discard + secret-gated IP

Reviewer CHANGES_NEEDED (1 blocker + 1 security), both resolved:

- BLOCKER (fingerprintable L1 discard): the silent-discard body now carries the SAME key set as a real success on both endpoints. Quote: the L1 check moved to AFTER the real breakdown is computed, so the discard returns the real totalDeliveredCAD plus a synthesized reportToken (randomUUID) — no docket, no lead, no email, no DB writes. The L3 note-append response on quote likewise returns the full success key set (real total + synthesized token; it did capture interest, so the computed quote is honest). Intake: L1 discard returns { success: true, docketId: randomUUID() }.
- SECURITY (spoofable x-intake-client-ip): getIntakeClientIp now trusts the forwarded client IP ONLY when x-intake-proxy-secret matches process.env.INTAKE_PROXY_SECRET. A forwarded header without a valid secret (our own proxy's shared egress) => Layer 2 skipped (return null, fail-open) so proxied users are never collectively 429d. A direct caller (no forwarded header) is keyed on x-real-ip, never x-forwarded-for.

New env INTAKE_PROXY_SECRET documented in .env.example (repo gitignores .env*, so .env.example is opted in via a !.env.example negation). Re-gated.

### 2026-07-11 - intake-guardrails re-review SHOULD-FIX — three-state IP trust close

Reviewer re-review: everything APPROVED, blocker closed; one residual SHOULD-FIX. Previously, when INTAKE_PROXY_SECRET was set but a request carried a junk x-intake-client-ip without a valid secret, getIntakeClientIp returned null and skipped L2 — so once the secret was live a direct attacker could disable L2 for themselves by sending any forwarded IP. Closed with a three-state resolution: (1) secret env UNSET + forwarded header present => null (bootstrap fail-open, unchanged); (2) secret SET + header secret VALID => trust the forwarded IP; (3) secret SET + header secret INVALID/MISSING while a forwarded header is present => IGNORE the forwarded header and key L2 on the direct caller's x-real-ip (a direct attacker can no longer opt out), plus a loud server warning (logs header presence only, no PII/secret) since it is an attack probe or a proxy misconfig. Accepted trade documented in-code: mismatched secrets across our own two apps would key legit proxied traffic on the shared egress IP and could collectively 429 at volume — detectable via the warning, verified live at deploy. Docket-only change; site unchanged. Re-gated.

## 2026-07-12 - Agent dashboard funnel split: working leads vs quote pool

Adam's strategy call: the agent dashboard mixed two funnels. Exact-quote leads with no engagement are a nurture audience (already served by the live nurture engine), not working leads. The default dashboard now shows only the sales funnel; unengaged quote leads collapse into a quieter Quote Pool band with automatic behavior-based promotion. Display/classification only — no schema, endpoints, cron, or nurture changes.

Classification (lib/dockets/dashboardDisplay.ts):
- New isWorkingLead(docket): working if ANY of customer_id set, lead_source === "find_my_jdm", is_flagged, status !== "new", or hasCustomerEngagement (any answered marcus_question or any customer_question). Everything else = quote pool.
- Factored hasCustomerEngagement out of getDocketTemperature (the Warm signal) so temperature and working-lead classification share one definition (getDocketTemperature refactored to call it — behavior identical).

Dashboard (app/agent/dashboard/page.tsx):
- DEFAULT view = working leads only. Split active dockets into workingDockets / poolDockets by isWorkingLead. Triage chips + counts, temperature badges, person-grouping, pins, Show Archived all operate on the working set exactly as before.
- Removed the lead-view tab row entirely (All/Garage/Quote/Find) — redundant under the split; Adam asked for decluttering.
- New QuotePoolBand below the working list: a single collapsed, visually quieter band — "Quote Pool — N leads · X became accounts · Y this month" (N = pool size; X = quote-origin non-find-my-jdm dockets with customer_id = conversions; Y = pool dockets created in the last 30 days), all client-side from loaded data. Collapsed on every load (unpersisted state). Expanded, it renders pool dockets with the SAME DocketCard + groupDocketsForDisplay grouping; pin/archive work from pool cards.
- PROMOTION is automatic + computed: pinning/replying/status-change/account-claim flips isWorkingLead, so the docket moves into the working list on the next computation (a pin from a pool card promotes it live via the optimistic state update). No stored state, no migration.
- Partition preserved: working + pool cover every active docket; archived stays its own view; pool expand shows everything in it — no docket is unreachable.

Verification: docket nm-gate on the branch (typecheck + build). Reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer/QA.

## 2026-07-12 - Stage 2.5 Purchase Close-Out gate + sold_in_delivery status

First real customer (Dennis) signed AND paid, but the roadmap's Stage 2.5 gate UI was never built. Built the two-part close-out gate and the new sold_in_delivery status, wired across every status map (agent + customer + admin) so nothing renders raw snake_case. No schema changes (agreement_signed + deposit_paid columns already exist; status is a text column). Task A of the purchase-closeout chain (B=vault invoices, C=delivery tracking not built here).

Agent close-out gate (app/agent/docket/[id]/page.tsx):
- New "Purchase Close-Out" section, visible once status is decision_made or later (isStatusAtOrAfter, with sold_in_delivery added to STATUS_ORDER after decision_made). Two indicators — Agreement signed (from agreement_signed) and Deposit paid (from deposit_paid) — each showing Done/Pending.
- "Mark Deposit Paid" with an undo ("Unmark Deposit Paid") via the existing agent PATCH route (app/api/agent/docket/[id]/route.ts) — whitelist extended with ONLY deposit_paid (kept the strict explicit-key discipline). deposit_paid added to the detail Docket type + select.
- "Move to Delivery" renders only when both gates are green; posts to a NEW dedicated endpoint app/api/agent/move-to-delivery/route.ts (mirrors the /api/agent/proceed pattern: requireAdminOrAgent, sets status=sold_in_delivery, inserts docket_status_history changed_by=agent) with a SERVER-SIDE re-check that both booleans are true (409 otherwise) so the transition can't be forced past the UI. Status changes stay out of the PATCH whitelist per the brief.

New sold_in_delivery status added everywhere it renders:
- lib/dockets/dashboardDisplay.ts: STATUS_LABELS ("In Delivery"), STATUS_LINE_CONTENT (distinct "🚚 Purchase complete — in delivery"), PROGRESS_STAGE_INDEX_BY_STATUS (index 5, reuses the final pipeline dot — no new visual stage, so the 6-col grid + all stage-count constants are untouched), CURRENT_STAGE_STYLES (sky), STATUS_STRIPE_COLORS (#38bdf8), and getDocketUrgencyPriority -> priority 5 = Working bucket (distinct "In delivery" line). NOT added to DIMMED_STATUS_SET or CLOSED_STATUS_PRIORITY (it is a live positive state).
- app/agent/dashboard/page.tsx + app/admin/dashboard/AdminDashboardClient.tsx (formatStatus switch) + lib/dockets/activityFeed.ts (STATUS_LABELS): label maps updated so no raw snake_case leaks.
- Customer side (positive wording): lib/customer/homeBaseStatusCopy.ts ("PURCHASE COMPLETE / Your JDM is on its way"), lib/customer/dashboard.ts getCardStatus (explicit "Purchase complete — moving to delivery" branch), app/report/[token]/ReportClient.tsx (recommendation gate now also passes sold_in_delivery).

Follow-up cron safety (CRITICAL): app/api/cron/follow-up/route.ts now cancels/skips any sequence for a sold_in_delivery docket AND for any docket with agreement_signed=true (a committed customer is never auto-sequenced), on top of the existing archived/cleared/lost skips. agreement_signed added to the cron docket select + DocketRow type.

Triage: sold_in_delivery is a working lead (status past new) and buckets as Working with the distinct "In delivery" status line; chip partition stays exact.

Verification: docket nm-gate on the branch (typecheck + build). Reported with code_ready.

Status: implementation complete, pending isolated gate + Reviewer/QA.

### 2026-07-12 - purchase-closeout review fix (blocker + 4 should-fixes)

Reviewer bounced chain A (full-auto discipline held). Blocker + 4 cheap should-fixes, all in one commit:
- BLOCKER: app/api/admin/dockets/[id]/customer-info/route.ts LOCKED_DESTINATION_STATUSES now includes sold_in_delivery, so destination edits stay frozen through delivery (they were briefly un-freezing after decision_made and re-freezing at cleared).
- (1) app/api/admin/remind/[id]/route.ts: a sold_in_delivery reminder branch (kind "delivery") with delivery-appropriate copy instead of the generic reply fallback.
- (2) detail page showCloseOut now renders only for decision_made / sold_in_delivery / cleared (not lost/paused/unresponsive, which isStatusAtOrAfter had been letting through).
- (3) detail page: the deposit Mark/Unmark toggle is disabled once status is sold_in_delivery (gate satisfied — frozen).
- (4) app/api/agent/move-to-delivery: an already-sold docket now returns 409 (double-submit guard) instead of a success that could race a duplicate history row.
Re-gated.

### 2026-07-12 - purchase-closeout review fix #2 (compare-and-set transition)

Reviewer re-review: 4 of 5 prior fixes closed; 1 NEW blocker from the showCloseOut narrowing — a cleared docket with both gates green still rendered the active Move to Delivery button, and the endpoint had no source-status guard, so clicking (or a direct API call on any gates-green status like lost/paused) could move it to sold_in_delivery — a backwards transition with no way back. Fixed atomically:
- app/api/agent/move-to-delivery: the transition is now a COMPARE-AND-SET — update status to sold_in_delivery WHERE id AND status='decision_made' AND agreement_signed AND deposit_paid, then branch on affected rows. Zero rows => 409 with NO history write (wrong source status, gate not green, already sold, or concurrent loser); the docket_status_history row is written only after a confirmed 1-row update. So only decision_made can transition, cleared/lost/paused are rejected server-side, and two concurrent submits can never double-write history (closes the earlier double-submit nit in the same move).
- Detail page: Move to Delivery button now renders only for decision_made + both gates green (canMoveToDelivery); on cleared the close-out shows a read-only completed summary (gates as done, "✅ Purchase complete", no action button, no deposit toggle); on sold_in_delivery the frozen in-delivery state stays.
Re-gated. B and C restacked onto the new A head.
## 2026-07-12 - chain B: docket_invoices ledger (agent + customer) [stacked on A]

Invoice ledger for dockets. No prerequisite migration (fail-open). Stacked on feature/purchase-closeout (rebased onto A head 1c4592f after the A review fix).

Data: supabase/migrations/014_docket_invoices.sql (Adam-run-only) — docket_invoices (id, docket_id FK cascade, invoice_type check deposit/balance/transport/other, label, amount_cad nullable, status check unpaid/paid/void default unpaid, issued_at, paid_at, file_path, timestamps), index (docket_id, created_at), RLS: service_role ALL + authenticated customer SELECT own via auth.uid->customers->dockets EXISTS (mirrors migration 009). Self-contained, idempotent.

Storage/D4: lib/invoices/storage.ts uploadInvoiceDocument -> customer-documents bucket, path <docketId>/invoices/<uuid>.<ext> (UUID names), PDF/image + 15MB fail-closed validation; reuses createLicenseSignedUrl + logDocumentAccess (document_access_log). isMissingInvoicesTable() drives fail-open. lib/invoices/types.ts = client-safe vocabulary/formatters.

Agent API (requireAdminOrAgent, service-role, strict whitelist):
- GET/POST /api/agent/invoices (list by ?docketId / create multipart w/ optional file; enabled:false when table absent).
- PATCH /api/agent/invoices/[id] (status only: unpaid/paid/void; marking a DEPOSIT invoice paid also sets dockets.deposit_paid=true and returns depositSynced; unmark never auto-clears the gate).
- GET /api/agent/invoices/[id]/file (signed URL + access log).
Customer: GET /api/customer/invoices/[id]/file (RLS ownership, void hidden, signed URL + access log).

UI: app/agent/docket/[id]/InvoiceLedger.tsx (client component mounted in the Purchase Close-Out area; list + Add Invoice form + Mark Paid/Unpaid/Void + View PDF; quiet not-enabled state; deposit-sync hint). app/account/imports/[id]/invoices/page.tsx now renders the real list (label/amount/status/paid date/Download signed-URL) via getDocketInvoicesForCustomer (RLS-scoped, fail-open, void hidden); empty state graceful.

Constraints: no quote/intake/nurture/cron changes; page never 500s if 014 unrun.

Status: B implementation complete; verified with nm-gate --quick (silent per single-track state protocol — formal start_impl/code_ready emits after A closes). Migration 014 is a deliverable for Adam (bundle with chain C SQL).

## 2026-07-12 - chain C: delivery tracking (shipments + stage history) [stacked on B]

Phase 3 (Stages 3.1 + 3.2) per the roadmap. Manual-first (D9), no automation/MarineTraffic scraping. Stacked on feature/vault-invoices (restacked onto A head 876192c after the A #2 fix). Fail-open on missing tables everywhere; no email this chain (roadmap 3.x has none).

Data: supabase/migrations/015_shipments.sql (Adam-run-only, bundle with 014) — shipments (roadmap shape: vessel/voyage/BL/container/ports/ETD-ETA estimated+actual, current_stage default pre-shipment, stage_updated_at, customer_visible_notes, internal_notes, marine_traffic_url) + UNIQUE(docket_id) (one per docket, also DB-level Move-to-Delivery idempotency) + shipment_stage_history (old->new/who/when/notes). RLS: service_role ALL; customer SELECT own (mirror-009 EXISTS); admin_agent read-all (profiles id=auth.uid). COLUMN SEPARATION: RLS is row-level only, so authenticated is GRANTed SELECT on every column EXCEPT internal_notes — internal notes are unreadable by customers even via a direct query. History table = service_role only. Self-contained/idempotent/SQL-editor-safe.

lib/shipments/stages.ts (client-safe 10-stage sequence pre-shipment..delivered + forward-only helpers). lib/shipments/server.ts (customer vs agent column lists, editable whitelist, isMissingShipmentsTable fail-open).

Move-to-Delivery wiring (app/api/agent/move-to-delivery): after the compare-and-set status transition, ALSO auto-creates the shipment row (current_stage pre-shipment) FAIL-OPEN + idempotent (checks existing + UNIQUE index + duplicate swallow); a missing shipments table or any error is logged and never blocks the transition A already ships.

Agent API (requireAdminOrAgent/getCurrentUserRole, service-role, strict whitelist): GET /api/agent/shipments?docketId (shipment + history; enabled:false when table absent); PATCH /api/agent/shipments/[id] (edit whitelisted fields only, never current_stage; marine_traffic_url http-validated); POST /api/agent/shipments/[id]/advance (FORWARD-ONLY guard via stage index + compare-and-set on current_stage so concurrent advances are safe; writes shipment_stage_history with agent email + optional customer-visible note).

UI: app/agent/docket/[id]/ShipmentPanel.tsx (mounted for sold_in_delivery): current stage + progress, forward-only advance dropdown (only later stages) + confirm + note, editable fields incl. separate customer-visible vs internal notes, stage history list. Customer app/account/imports/[id]/vehicle now renders a Delivery Tracking section: stage label + progress bar, vessel/voyage/ports/ETD/ETA, customer_visible_notes, MarineTraffic link — via getShipmentForCustomer which selects CUSTOMER-VISIBLE columns only (internal_notes never in the query; column-grant also blocks it). Graceful when no shipment / table absent.

Status: C implementation complete; verified nm-gate --quick (silent per single-track protocol). Formal start_impl/code_ready + full gate after B closes. Migration 015 is a deliverable (bundle 014+015 into one Adam paste). No intake/nurture/cron/quote changes.
