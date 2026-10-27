# TASK-PREPROCESS-26-10 State

## Metadata

- Task: TASK-PREPROCESS-26-10 — Add Stage 1 document preprocessing before Gemini extraction
- Assigned at: 26/10/2026
- Agent: Copilot SDK in VS Code
- Status: **IN_PROGRESS** (implementation and local validation complete; safe Git checkpoint remains pending)
- Completed at: —

## 1. Original User Input

Source: `requestFromUsers/task_26_10_preprocessing.md`

```text
vậy hãy triển khai các bước làm như trên
```

The requested implementation follows the preceding agreed approach: keep PDF bytes unchanged;
rotate PNG/JPEG using EXIF orientation, resize without enlargement, flatten transparency to white,
convert images to high-quality JPEG, and keep original file metadata/hash and the invoice JSON output.

## 2. Problem Decomposition

- [x] Read current extraction, schema, storage, project knowledge and workflow.
- [x] Preserve the request and create a task state file.
- [x] Add Sharp as a direct server-side dependency.
- [x] Implement image preprocessing before the Gemini request; pass PDFs through unchanged.
- [x] Test image resize/format conversion, PDF pass-through and malformed-image errors.
- [x] Run typecheck, lint and production build.
- [x] Update API, architecture, feature and task documentation with verified behavior.
- [ ] Create a Git checkpoint only if changes can be attributed safely.

## 3. Progress

### Completed

- Added `lib/documentPreprocessing.ts` using Sharp.
- `preprocessDocument()` leaves PDFs unchanged. For PNG/JPEG it applies EXIF orientation, white
  flattening, resize-to-fit within 2400×3200 without upscaling, then JPEG encoding at quality 92.
- Integrated preprocessing into `geminiExtract()` after key/type checks and before the Gemini API call.
- Preserved original buffer for hash, size, source MIME type, and PDF metadata; only the model payload
  uses the prepared image and matching MIME type.
- Malformed/unsupported-to-decode images produce an explicit `422 DOCUMENT_PREPROCESSING_FAILED`.

### Completed

- Synthetic Sharp checks passed for PDF byte pass-through, PNG-to-JPEG conversion, no upscaling,
  resize bounds, white flattening of transparent pixels, EXIF orientation, and invalid-image errors.
- Verified malformed-image failures map to HTTP 422 / `DOCUMENT_PREPROCESSING_FAILED` before any
  Gemini request.
- `npm run typecheck`, `npm run lint`, and `npm run build` all passed.
- Updated architecture, API, configuration, overview, feature, and workflow documentation.

### Blocked

- Live extraction cannot be validated without a human-provided Gemini API key; no files will be sent
  to Google as part of local preprocessing verification.

## 4. Files Changed

- `package.json`, `package-lock.json` — direct Sharp dependency.
- `lib/documentPreprocessing.ts` — new preprocessing implementation.
- `lib/geminiExtractor.ts` — send prepared image bytes to Gemini, preserve original source metadata.
- `requestFromUsers/task_26_10_preprocessing.md` — preserved request/context.
- `request_this_time.md`, `todolist.md`, `state/taskSummary.md`, this state file — workflow tracking.
- `knowledge/apiDocs.md`, `knowledge/architecture.md`, `knowledge/configuration.md`,
  `knowledge/projectOverview.md`, `architecture_explanation.md`, `features.md` — describe preprocessing behavior.

## 5. Validation

- Focused preprocessing checks: PASS (synthetic local images/PDF; no live provider call).
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `git diff --check`: reports CRLF line terminators as trailing whitespace in touched documentation (the files retain their existing CRLF format); no repository-wide line-ending conversion was made.
- Live Gemini request: intentionally not run.

## 6. Handoff Notes

Image preparation happens server-side only, after upload size/type checks and after confirming that
Gemini is configured. PDFs remain byte-for-byte unchanged. The database result still describes the
original upload; the converted JPEG is transient and is only used as Gemini input.

## 7. Remaining Work

- [x] Verify image orientation/resize/JPEG output, PDF pass-through, and malformed-image errors.
- [x] Run lint, typecheck and production build.
- [x] Update and verify documentation.
- [x] Keep existing documentation line endings; avoid unrelated repository-wide normalization.
- [ ] Create a safe Git checkpoint; the worktree contains unrelated existing changes, so no commit was made.
- [ ] Live Gemini verification requires a user-configured key and approval to send a real document.
