# Features

> User-visible functionality of the project.
> Status vocabulary: **Working · Partial · Mocked · In-Progress · Blocked**.
> Architecture: `knowledge/architecture.md` · API details: `knowledge/apiDocs.md`
> Last updated: 26/10/2026.
> `Working` = verified end-to-end at HTTP/data level · `Partial` = verified at API/data level, UI not
> click-tested in a browser yet · `Mocked` = works, but the data is simulated.
> Evidence: `state/task_30_09_state.md` §5 and `state/task_26_10_ui_state.md` §5.

---

## F-01 — Submission box (upload an invoice)

* **Description:** A box on the home page where the user drags & drops or picks a PDF/PNG/JPEG invoice (≤ 10 MB). The client checks type/size; the server validates the original file and prepares images before sending model input to Gemini.
* **How to test:**
  1. `npm run dev` → open <http://localhost:3000>.
  2. Drag `samples/sample-invoice.pdf` onto the box (or click it and pick the file).
  3. Choose a readable invoice PDF/JPG/PNG; valid files upload automatically.
  4. Drag a `.txt`/`.docx` file into the box to see the client-side rejection message.
* **Expected result:** PDFs pass through unchanged; PNG/JPEG images are oriented using EXIF, resized only when larger than 2400×3200, flattened on white and temporarily converted to JPEG quality 92. Saved source metadata/hash still describe the original file. Processing status appears, followed by extracted fields and a history row. Missing Gemini configuration shows an explicit error; unreadable images return `DOCUMENT_PREPROCESSING_FAILED`.
* **Status:** Partial — preprocessing is implemented; live Gemini upload requires a configured key.

## F-02 — Structured invoice data (Gemini extraction)

* **Description:** After preprocessing, local Tesseract OCR extracts page text, word positions and confidence while one or more configured Gemini Vision models analyze the same document concurrently. Zod validates results before storage. The first Vision result remains the legacy invoice; OCR evidence and all model results are returned as optional JSON sections. No automatic comparison or reconciliation is performed yet.
* **How to test:**
  1. Add `GEMINI_API_KEY=...` to `.env.local` (see `knowledge/configuration.md`) and restart `npm run dev`.
  2. Upload a readable invoice at <http://localhost:3000/> or run `curl -F "file=@samples/sample-invoice.pdf;type=application/pdf" http://localhost:3000/api/extract`.
  3. Check the returned seller, buyer, dates, line items and totals against the document.
* **Expected result:** invoice JSON that satisfies `lib/invoiceSchema.ts`, plus `extraction.ocr` (local OCR pages, word boxes and confidence) and `extraction.visionModels` (one result per configured Vision model). OCR language defaults to Vietnamese + English; model list uses `GEMINI_MODELS`.
* **Status:** Partial — Gemini integration is implemented; a live API call requires a configured key and has not been verified in this environment.

## F-07 — Dual-branch extraction (Stage 2)

* **Description:** The prepared document is analyzed by local Tesseract OCR and the configured Gemini Vision model(s) concurrently. OCR evidence includes page text, word bounding boxes and confidence scores; model outputs follow the invoice schema.
* **How to test:** Configure `GEMINI_API_KEY`; optionally set `TESSERACT_LANGUAGES`, `TESSERACT_LANG_PATH`, and `GEMINI_MODELS` in `.env.local`; restart the app and upload a readable PDF/PNG/JPEG. OCR language data may be downloaded on first run, or supplied locally for offline environments.
* **Expected result:** the JSON API contains `extraction.ocr` and `extraction.visionModels`. The first configured Vision model continues to populate the existing invoice fields. No merge/reconciliation is claimed.
* **Status:** In-Progress — implementation and local OCR checks are pending; live Vision calls require a configured key and explicit approval to send a real invoice.

## F-03 — Invoice details page

* **Description:** Selecting an invoice in the history opens `detail.html?id=<recordId>`, which fetches that saved extraction and shows the seller/buyer, invoice identifiers, line items, subtotal, tax, total, extraction confidence, warnings and JSON download.
* **How to test:** after F-02, use *Xem chi tiết* in the invoice history and compare the rendered values with the source document.
* **Expected result:** only the selected invoice is shown; a missing or deleted record displays an explicit message.
* **Status:** Partial — detail view and record lookup are implemented. A Gemini key is only required to create new invoices; existing saved records can be opened from history.

## F-04 — Stored invoices (local JSON store) + reset

* **Description:** Every successful extraction is appended to `data/invoices.json` (newest first, max 50 records) and listed in *Hóa đơn đã lưu*. The dashboard can search by filename, invoice number, seller/buyer or tax ID; *Làm mới* reloads the list; *Xóa tất cả* calls `DELETE /api/invoices` after confirmation.
* **How to test:**
  1. `curl -s http://localhost:3000/api/invoices` → `{"ok":true,"count":N,"data":[...]}`
  2. `cat data/invoices.json` → the same records on disk (persistence across server restarts).
  3. Use *Xóa tất cả* in the dashboard and confirm, or run `curl -X DELETE http://localhost:3000/api/invoices` → `{"ok":true,"deleted":N}`.
* **Expected result:** records persist across reloads and can be reset for a demo.
* **Status:** Partial — the API and dashboard list/search/reset controls are implemented; browser checks are recorded in `state/task_26_10_ui_state.md`.

## F-05 — Sample invoice file for testing

* **Description:** `scripts/make-sample-pdf.mjs` regenerates `samples/sample-invoice.pdf`, a 2-page ASCII invoice used for manual testing (no dependencies).
* **How to test:** `node scripts/make-sample-pdf.mjs` → prints `Wrote .../samples/sample-invoice.pdf (1764 bytes, 2 pages)`.
* **Expected result:** the file exists and opens in a PDF viewer.
* **Status:** Working — the generator was executed successfully and the produced file was accepted by `POST /api/extract`.

## F-06 — Document upload dashboard

* **Description:** The home page at `/` displays the Vietnamese dashboard from `frontend/upload.html`, `frontend/upload.css` and `frontend/upload.js`. The dashboard reads history from `GET /api/invoices`, supports history search, refresh and confirmed reset, uploads selected PDF/JPG/PNG files to `POST /api/extract`, shows extracted fields and raw JSON, and provides JSON download. History links open the matching invoice detail page.
* **How to test:** Run `npm run dev` and open <http://localhost:3000/>. Search the existing history, open a record's details, and try refresh/reset (reset asks for confirmation). For upload, choose a readable PDF/JPG/PNG; a live extraction requires `GEMINI_API_KEY`.
* **Expected result:** dashboard history and counts reflect API data; search filters by invoice/file/party fields; upload feedback is explicit; successful results show structured data and JSON download; detail links show the selected record.
* **Status:** Partial — dashboard, search, history and detail navigation are implemented; live upload requires a Gemini API key.

---

## Not implemented (do not claim these work)

| Feature | Notes |
| --- | --- |
| Other multimodal providers | Gemini is integrated; other providers are not |
| SQLite + Prisma storage, users, departments, audit logs | Target architecture in `project_details.md` |
| Authentication and department-scoped RBAC | No login exists; all endpoints are open |
| Batch jobs / model selection per job | Mentioned in `project_details.md` |
| PDF/image preview in the submission box | Only file name/size are shown |
| Automated tests | No test runner is configured |
