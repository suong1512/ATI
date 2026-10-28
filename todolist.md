# Todolist

Last updated: 28/10/2026 · Active task: **TASK-DOCUMENT-PREVIEW-28-10**

## TASK-DOCUMENT-PREVIEW-28-10 — Original invoice preview

- [x] Store uploaded originals separately in MongoDB.
- [x] Add an endpoint to retrieve a saved original document.
- [x] Preview uploaded images and PDFs on the invoice detail page.
- [x] Document the storage and API behavior.
- [x] Run typecheck, lint, build, frontend syntax validation and production HTTP smoke checks.

## TASK-STAGE2-26-10 — Dual-branch extraction

### Plan

- [x] Record the request and confirm local Tesseract OCR plus optional OCR JSON output.
- [x] Preserve the existing Gemini model setting while allowing a configurable model list.
- [ ] Implement OCR for prepared images and PDF pages with text, word boxes and confidence.
- [ ] Run OCR and configured Gemini Vision model(s) concurrently on the same prepared input.
- [ ] Keep the current invoice fields and older stored records compatible.
- [ ] Add focused tests for image/PDF OCR and configurable model branch output.
- [ ] Update architecture, API, configuration and feature documentation.
- [ ] Run typecheck, lint, build and local checks without sending an actual invoice to Gemini.
- [ ] Create a safe checkpoint only if task changes can be separated from the dirty worktree.

## TASK-PREPROCESS-26-10 — Stage 1 document preprocessing

## TASK-PREPROCESS-26-10 — Stage 1 document preprocessing

### Plan

- [x] Preserve the human request and create a task state file.
- [x] Read the extraction flow, JSON contract, storage, and project knowledge.
- [x] Add server-side image preprocessing while keeping PDF input unchanged.
- [x] Verify image transformations, PDF pass-through and explicit malformed-image error.
- [x] Run typecheck, lint, build and API error mapping checks without a live Gemini request.
- [x] Update architecture/API/environment/feature documentation with accurate behavior.
- [ ] Create a safe checkpoint if changes can be attributed without including unrelated work.

### Validation

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Focused tests for PNG/JPEG resize and JPEG output, PDF pass-through and invalid image.
- [x] No live Gemini request; transformations were validated with synthetic local images only.

## TASK-UI-26-10 — Align web UI with implemented features

### Plan

- [x] Read `frontend/`, `components/`, `knowledge/`, and related API/task documentation.
- [x] Record the request and create a task-state handoff file.
- [x] Remove or correct controls and claims for features that do not exist.
- [x] Make history search, upload states, navigation and record-detail links clear and usable.
- [x] Keep UI implementation changes focused in `frontend/`; only adjust wrapper titles and workflow documentation outside it.
- [x] Validate frontend scripts, typecheck, lint and production build.
- [x] Update `features.md`, `state/taskSummary.md`, and this checklist with results.
- [ ] Complete interactive browser checks; do not upload an invoice without explicit approval because it is sent to Google Gemini.
- [ ] Create a task checkpoint if changes are attributable without including unrelated work.

### Validation

- [x] `node --check frontend/upload.js`
- [x] `node --check frontend/detail.js`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Browser snapshot of dashboard and loaded invoice history.
- [ ] Interactive check of search, reset confirmation and history-to-detail navigation.

## TASK-GEMINI-25-10 — Gemini invoice extraction

### Done

- [x] Integrate server-side Gemini extraction for PDF/PNG/JPEG uploads.
- [x] Keep the Gemini API key server-only and return explicit errors without mock fallback.
- [x] Validate extracted invoice data with the shared Zod contract before saving.
- [x] Update the dashboard and project documentation.
- [x] Add the invoice detail page and history links.
- [x] Serve the dashboard/detail directly from `frontend/` through Next.js routes; remove duplicate `public/` assets.
- [x] Extract dashboard and detail scripts to `frontend/upload.js` and `frontend/detail.js`.

### Validation

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] Dashboard, upload, detail, and query-string detail routes return HTTP 200.
- [x] Dashboard, upload, detail, CSS, and JavaScript routes return HTTP 200.
- [x] Upload and detail JavaScript syntax checks pass.
- [x] API smoke test without a key returns HTTP 503 `GEMINI_NOT_CONFIGURED`, never mock data.
- [x] Mocked-provider checks: valid invoice parsing, PDF payload encoding, and incomplete-data rejection.
- [x] `npm run build`
- [ ] Verify populated invoice details by opening a saved record from history; creating a new record requires a user-provided key in `.env.local`.

### Human setup required

- [ ] Add `GEMINI_API_KEY` to `.env.local`, restart `npm run dev`, and upload a readable invoice.

## TASK-30-09 — Submission box + mock invoice data

### Done

- [x] Read request, `knowledge/`, `.devcontainer/`, `project_details.md`, `agents.md`
- [x] Scaffold Next.js 15 (App Router) + TypeScript app at the repository root
- [x] Zod contract `lib/invoiceSchema.ts`
- [x] Mock extractor `lib/mockExtractor.ts` (file-derived, deterministic)
- [x] MariaDB + MongoDB storage via `lib/database.ts` and `lib/invoiceStore.ts`
- [x] API routes `POST /api/extract`, `GET|DELETE /api/invoices`
- [x] UI: submission box, result dashboard, history
- [x] Sample invoice `samples/sample-invoice.pdf` (+ generator script)
- [x] Documentation: `knowledge/*`, `state/*`, `features.md`, `architecture_explanation.md`

### Validation (executed on 30/09/2026 — results in `state/task_30_09_state.md` §5)

- [x] `npm install` — completed (`added 308 packages in 8m`; `package-lock.json` created)
- [x] `npm run typecheck` — PASS (after fixing a syntax bug in `lib/mockExtractor.ts`)
- [x] `npm run lint` — PASS (the `EBADENGINE` warning is only a warning)
- [x] API tests with `curl` — 7 cases PASS; fixed the 500 → 400 bug in `app/api/extract/route.ts`
- [x] Page render check — `GET /` returns HTTP 200 containing the submission box
- [ ] `npm run build` to completion (slow on this ~3.7 GiB RAM container; the webpack compile passed in 56 s)
- [ ] Browser click-through on port 3000 (steps in `features.md`)
- [ ] Git checkpoint commit
- [ ] Then update `state/task_30_09_state.md` (status → COMPLETED) and this file

### Follow-up work

- [x] Choose Gemini as the provider; live testing still needs a local API key.
- [x] Replace the JSON file store with MariaDB invoice metadata + MongoDB extraction payloads
- [ ] Authentication + department RBAC
- [ ] Automated tests (no test runner configured yet)

## Notes

* `features.md` = what works / how to test it.
* `knowledge/` = stable project knowledge (architecture, API, environment, workflow).
* `state/` = task state and handoff.
