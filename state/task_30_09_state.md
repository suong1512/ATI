# TASK-30-09 State

## Metadata

- Task: TASK-30-09 — Submission box + mock invoice data generation
- Assigned at: 30/09/2026
- Device: DevContainer `ATI Next.js Vibe Coding Environment` (Debian 12, Node v20.18.0, npm 10.8.2, port 3000) — see `knowledge/configuration.md`
- Agent: Cline
- Status: **IN_PROGRESS** — implemented and validated at API level; browser click-through and a full `npm run build` remain
- Completed at: —

## 1. Original User Input

Source: `requestFromUsers/task_30_09.md` (verbatim)

```text
Hi, this request is an experiment

Goal: Make a submission box that users can upload, then generate the mock data about the invoice (which is about the pdf)

Guide human how to test that function at the end of the conversation

The instruction may be incomplete, vague (I meant the folder knowledge/)

So..you do the task, then try to document, then tell me at the end of the conversation, which file I should update

This request is just to explore your capability only
```

### Acceptance criteria used

1. A submission box where a user uploads a document (PDF/image).
2. The system generates **mock** invoice data related to the uploaded PDF.
3. The data is stored, so the `pdf → json → database` pipeline is real.
4. The work is documented inside the `knowledge/` documentation system.
5. The human is told how to test it and which documentation file to update next.

## 2. Problem Decomposition

- [x] Read the human request, `knowledge/`, `.devcontainer/`, `project_details.md`, `agents.md`, `state/`
- [x] Scaffold Next.js 15 (App Router) + TypeScript at the repository root
- [x] Zod contract `lib/invoiceSchema.ts`
- [x] Mock extractor derived from the uploaded file `lib/mockExtractor.ts`
- [x] Mock database `lib/invoiceStore.ts` → `data/invoices.json`
- [x] API routes `POST /api/extract`, `GET|DELETE /api/invoices`
- [x] UI: submission/upload box, result dashboard, history
- [x] Sample invoice `scripts/make-sample-pdf.mjs` → `samples/sample-invoice.pdf`
- [x] `npm install` (308 packages, `package-lock.json` created)
- [x] `npm run typecheck` — **PASS** (after fixing a bug, see §5)
- [x] `npm run lint` — **PASS**
- [~] `npm run build` — webpack compiled successfully; the build's lint/type phase was stopped deliberately (see §5)
- [x] API tests with `curl` — **7 cases PASS**, found + fixed 1 API bug
- [x] Page render check (`GET /` → 200, expected controls present)
- [ ] Browser click-through (drag & drop, buttons, JSON download)
- [x] Documentation updated (`knowledge/`, `state/`, `features.md`, `todolist.md`, `architecture_explanation.md`)
- [ ] Git checkpoint

## 3. Progress

### Completed

All application code, all documentation, dependency installation, type check, lint and API-level validation.

### In Progress

Final validation steps: browser click-through of the UI and a full production build.

### Blocked

Nothing. (The first session was stopped by the human to simulate a request-limit stop, while `npm install`
was still running in the background; it finished afterwards, so validation could be completed.)

## 4. Files Changed

### New application files

| File | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Scripts + dependencies (Next 15.5.26, React 19.1.0, Zod ^4.6.5, ESLint 9) |
| `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore` | Project configuration |
| `app/layout.tsx`, `app/globals.css` | Root layout + plain-CSS design system |
| `app/page.tsx` | Client page: upload flow, status, errors, history |
| `app/api/extract/route.ts` | `POST /api/extract` — validate upload → mock extract → Zod validate → store |
| `app/api/invoices/route.ts` | `GET /api/invoices` list, `DELETE /api/invoices` reset |
| `components/UploadBox.tsx` | Submission box (drag & drop, picker, status pill, buttons) |
| `components/InvoiceResult.tsx` | Invoice card, line items, totals, raw JSON, JSON download |
| `components/InvoiceHistory.tsx` | Stored invoices list, refresh, clear |
| `lib/invoiceSchema.ts` | Zod contract + types (source of truth for the JSON shape) |
| `lib/mockExtractor.ts` | Mock extraction (magic bytes, PDF page estimate, hash-seeded PRNG) |
| `lib/invoiceStore.ts` | Mock database on `data/invoices.json` |
| `lib/uploadConfig.ts` | Client-safe upload rules |
| `lib/format.ts` | VND / bytes / date / percent formatting |
| `scripts/make-sample-pdf.mjs`, `samples/sample-invoice.pdf` | Sample invoice generator + committed test fixture |
| `data/.gitkeep` | Keeps the mock-database directory (`data/invoices.json` is gitignored) |

### Documentation written or updated

| File | Change |
| --- | --- |
| `knowledge/projectOverview.md` | Filled in; original human note kept verbatim in an appendix |
| `knowledge/architecture.md` | Filled in (structure, stack, components, Mermaid flow, limitations, decisions, demo) |
| `knowledge/apiDocs.md` | Filled in (3 endpoints, payloads, error codes, examples, planned LLM integration) |
| `knowledge/configuration.md` | Filled in (current device, devcontainer, versions, commands, team machine table) |
| `state/task_30_09_state.md` | This file |
| `state/taskSummary.md` | Restored to its documented purpose (task table) |
| `features.md` | Feature inventory + how to test each feature |
| `todolist.md` | Current task checklist |
| `architecture_explanation.md` | Short architecture + demo flow (points to `knowledge/architecture.md`) |
| `request_this_time.md` | Pointer to the newest request file |

### Not changed

`agents.md`, `project_details.md` and `knowledge/workflows.md`, `knowledge/metaDocsExplain.md`, the templates
and `requestFromUsers/task_30_09.md` were left untouched (original input and directives are preserved).

## 5. Validation

Environment: DevContainer, Node v20.18.0, npm 10.8.2, port 3000. All commands were run in
`/workspaces/ATI_PhAnh_group` on 30/09/2026.

| Check | Command | Result |
| --- | --- | --- |
| Sample invoice generation | `node scripts/make-sample-pdf.mjs` | **PASS** — `Wrote .../samples/sample-invoice.pdf (1764 bytes, 2 pages)` |
| Dependency installation | `npm install` | **PASS** — `added 308 packages in 8m`, `package-lock.json` created |
| Type check (1st run) | `npm run typecheck` | **FAIL** — 10 syntax errors (`TS1005`/`TS1128`) in `lib/mockExtractor.ts` (a bad edit had split the `CATALOG` array) → fixed |
| Type check (final) | `npm run typecheck` | **PASS** (`EXIT=0`) |
| Lint | `npm run lint` | **PASS** (`EXIT=0`) |
| Production build | `npm run build` | **PARTIAL** — `✓ Compiled successfully in 56s`, then the built-in lint/type phase ran for >14 min without finishing; stopped deliberately. Cause: the container has only ~3.7 GiB RAM. Not an application error |
| Page render | `curl -s http://localhost:3000/` | **PASS** — HTTP 200, HTML contains `Chọn file hóa đơn` (submission box present) |
| API — happy path | `curl -F "file=@samples/sample-invoice.pdf;type=application/pdf" .../api/extract` | **PASS** — HTTP 200; valid `ExtractionResult`; `kind=pdf`, `estimatedPages=2`, both mock warnings; invoice `593475` |
| API — determinism | same file uploaded in two separate server runs | **PASS** — identical `contentHash=b7adbdefaa319f1e`, `invoiceNumber=593475`, same seller/items/amounts (only `recordId`/`createdAt` differ) |
| API — no multipart body | `curl -X POST .../api/extract` | **FAIL at first (HTTP 500)** → bug fixed → now **PASS** (HTTP 400 `NO_FILE`) |
| API — wrong field name | `curl -F "notfile=@samples/sample-invoice.pdf"` | **PASS** — HTTP 400 `NO_FILE` |
| API — unsupported type | `curl -F "file=@package.json;type=application/json"` | **PASS** — HTTP 415 `UNSUPPORTED_TYPE` + `details` |
| API — empty file | `curl -F "file=@/tmp/empty.pdf;type=application/pdf"` | **PASS** — HTTP 400 `EMPTY_FILE` |
| API — persistence | `curl .../api/invoices` after 2 uploads | **PASS** — HTTP 200, `count: 2`, matches `data/invoices.json` |
| API — reset | `curl -X DELETE .../api/invoices` | **PASS** — HTTP 200, `{"ok":true,"deleted":1}` |
| Browser click-through | manual in a real browser | **NOT DONE** |

### Bugs found and fixed during validation

1. **`lib/mockExtractor.ts`** — an incorrect edit split the `CATALOG` array (the last three entries ended up
after the closing brace) → syntax errors. Fixed by restoring the array.
2. **`app/api/extract/route.ts`** — a request without a `multipart/form-data` body threw inside
`request.formData()`, so the generic handler returned **500 INTERNAL_ERROR**. Fixed with an inner
`try/catch` returning **400 `NO_FILE`**; re-tested successfully.

### Environment caveat discovered

`next dev` in this container did **not** hot-reload the changed `app/api/extract/route.ts` (the old code kept
answering). **Restart the dev server after editing API routes.** Recorded in `knowledge/configuration.md` §6.

## 6. Handoff Notes

### What was completed

A working first vertical slice: submission box → mock extraction → Zod-validated JSON → stored record →
dashboard + history, verified at HTTP level (see §5), with documentation updated to match the code.

### What remains

1. Browser click-through: drag & drop `samples/sample-invoice.pdf`, click *Tải lên & trích xuất*, check the
   result card, *Tải file JSON*, *Làm mới* / *Xoá tất cả*.
2. A full `npm run build` (run it when nothing else needs RAM; several minutes).
3. Git commit of this slice.
4. Then set the status to `COMPLETED` and update `state/taskSummary.md` + `todolist.md`.

### Important implementation details

* The extraction is **mocked**: output derives from magic bytes, size, SHA-256 hash (deterministic seed) and
  a PDF page-count heuristic. The real LLM call replaces `mockExtract()` inside `app/api/extract/route.ts`;
  the Zod contract stays unchanged.
* `lib/uploadConfig.ts` must stay free of Node imports (imported by client components).
  `lib/mockExtractor.ts` (`node:crypto`) and `lib/invoiceStore.ts` (`node:fs`) are **server-only**.
* Mock database: `data/invoices.json` (gitignored, max 50 records, created on the first upload).
* `samples/sample-invoice.pdf` is committed so the feature can be tested without inventing a file.
* Port 3000 is forwarded by the devcontainer.

### Known problems

1. Production build is slow in this container (~3.7 GiB RAM).
2. `npm install` emits `npm warn EBADENGINE` for `eslint-visitor-keys@5` (needs Node ≥ 20.19.0 while the
   image pins 20.18.0). Lint still passes; fix options in `knowledge/configuration.md` §3.
3. The mock `issueDate` is anchored to "today", so results for the same file differ across days
   (`createdAt`/`processingMs` always differ).
4. No authentication: `DELETE /api/invoices` is open (fine for a local demo).
5. The UI shows file metadata only — there is no PDF/image preview in the submission box.

### Recommended next action

Do the browser click-through and the full build, then commit. The next functional decision (which
Multimodal LLM provider + API key) requires a human decision and is **out of scope** for TASK-30-09.

## 7. Remaining Work

- [ ] Browser click-through of the UI (see §6)
- [ ] Full `npm run build` to completion
- [ ] Git checkpoint commit; then status → COMPLETED
- [ ] Real Multimodal LLM extraction (needs provider + key — human decision)
- [ ] Replace the JSON file store with Prisma + SQLite (`project_details.md`)
- [ ] Authentication + department RBAC
- [ ] Automated tests (no test runner configured yet)
