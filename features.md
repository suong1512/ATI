# Features

> User-visible functionality of the project.
> Status vocabulary: **Working · Partial · Mocked · In-Progress · Blocked**.
> Architecture: `knowledge/architecture.md` · API details: `knowledge/apiDocs.md`
> Last updated: 30/10/2026.
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
* **Expected result:** PDFs pass through unchanged; PNG/JPEG images are oriented using EXIF, resized only when larger than 2400×3200, flattened on white and temporarily converted to JPEG quality 92. Saved source metadata/hash still describe the original file. Processing status appears, followed by extracted fields and a pending-review link. The invoice is not listed as saved until approved. Missing Gemini configuration shows an explicit error; unreadable images return `DOCUMENT_PREPROCESSING_FAILED`.
* **Status:** Partial — preprocessing is implemented; live Gemini upload requires a configured key.

## F-02 — Structured invoice data (Gemini extraction)

* **Description:** After preprocessing, local Tesseract OCR extracts page text, word positions and confidence while one or more configured Gemini Vision models analyze the same document concurrently. Zod validates results before storage. The first Vision result remains the legacy invoice; OCR evidence and all model results are returned as optional JSON sections. No automatic comparison or reconciliation is performed yet.
* **How to test:**
  1. Add `GEMINI_API_KEY=...` to `.env.local` (see `knowledge/configuration.md`) and restart `npm run dev`.
  2. Upload a readable invoice at <http://localhost:3000/> or run `curl -F "file=@samples/sample-invoice.pdf;type=application/pdf" http://localhost:3000/api/extract`.
  3. Check the returned seller, buyer, dates, line items and totals against the document.
* **Expected result:** invoice JSON that satisfies `lib/invoiceSchema.ts`, plus `extraction.ocr` (local OCR pages, word boxes and confidence) and `extraction.visionModels` (one result per configured Vision model). Invoice attributes must be present, but their values may be `null` or `0`; the detail page identifies null/empty values, flags zero values for review, and displays model warnings. A missing attribute is rejected with its exact JSON path. OCR language defaults to Vietnamese + English; model list uses `GEMINI_MODELS`, with the default model set to `gemini-2.5-flash` when no override is configured.
* **Status:** Partial — Gemini integration is implemented; a live API call requires a configured key and has not been verified in this environment.

## F-07 — Dual-branch extraction (Stage 2)

* **Description:** The prepared document is analyzed by local Tesseract OCR and the configured Gemini Vision model(s) concurrently. OCR evidence includes page text, word bounding boxes and confidence scores; model outputs follow the invoice schema.
* **How to test:** Configure `GEMINI_API_KEY`; optionally set `TESSERACT_LANGUAGES`, `TESSERACT_LANG_PATH`, and `GEMINI_MODELS` in `.env.local`; restart the app and upload a readable PDF/PNG/JPEG. OCR language data may be downloaded on first run, or supplied locally for offline environments.
* **Expected result:** the JSON API contains `extraction.ocr` and `extraction.visionModels`. The first configured Vision model continues to populate the existing invoice fields. No merge/reconciliation is claimed.
* **Status:** In-Progress — implementation and local OCR checks are pending; live Vision calls require a configured key and explicit approval to send a real invoice.

## F-03 — Invoice details page

* **Description:** `detail.html?id=<recordId>` shows the information for an approved invoice, including parties, amounts and line items. The original image/PDF is shown only in the manual review page.
* **How to test:** open an approved invoice using *Xem chi tiết* from the saved list.
* **Expected result:** the approved invoice details and JSON download are shown without the original image/PDF.
* **Status:** Partial — approved invoice details are loaded from the API; browser checks still require configured databases and an approved record.

## F-04 — Stored invoices (MariaDB + MongoDB) + reset

* **Description:** Extraction stores the pending invoice and original document in MongoDB and an index row in MariaDB. Only after manual approval is the invoice listed in saved history. Upload shows up to three newest approved records and links to `/history.html`, which loads all approved records and provides search, date/type/confidence filters, pagination and CSV export.
* **How to test:**
  1. `GET /api/reviews` returns invoices waiting for approval; `GET /api/invoices?limit=all` returns all approved invoices.
  2. Approve an invoice from `/review.html`; it appears among the three recent dashboard records and in the full `/history.html` list, and opens in the information-only detail page.
  3. Verify status and payload in MariaDB's `Extracted_Invoice` and MongoDB's `Extraction_Records`.
  4. Run `DELETE /api/invoices` to clear invoices for a demo.
* **Expected result:** records persist across reloads and can be reset for a demo.
* **Status:** Partial — the API and dashboard/history lists use MariaDB + MongoDB; the review workflow is implemented but needs end-to-end database/browser verification.

## F-05 — Sample invoice file for testing

* **Description:** `scripts/make-sample-pdf.mjs` regenerates `samples/sample-invoice.pdf`, a 2-page ASCII invoice used for manual testing (no dependencies).
* **How to test:** `node scripts/make-sample-pdf.mjs` → prints `Wrote .../samples/sample-invoice.pdf (1764 bytes, 2 pages)`.
* **Expected result:** the file exists and opens in a PDF viewer.
* **Status:** Working — the generator was executed successfully and the produced file was accepted by `POST /api/extract`.

## F-06 — Document upload dashboard

* **Description:** The home page at `/` displays the dashboard from `frontend/upload.html`, `frontend/upload.css` and `frontend/upload.js`. Uploading sends a file to `POST /api/extract`, which places the extraction into the review queue. Missing values in the extraction result display as `_`. The result offers a JSON report download without displaying the warning line; warning data remains available in the JSON report. The dashboard lists up to three newest approved invoices and offers only a link to the full `/history.html`; approved detail links show invoice information without the original document.
* **How to test:** Run `npm run dev`, upload a readable PDF/JPG/PNG (requires `GEMINI_API_KEY`), select *Kiểm tra & duyệt*, edit if needed, then approve. If using a standalone preview port, API requests target port 3000.
* **Expected result:** an extracted invoice remains out of saved history until it is approved; after approval it appears in the history and its detail page contains information only.
* **Status:** Partial — dashboard, search, history and detail navigation are implemented; live upload requires a Gemini API key.

## F-09 — Full invoice history

* **Description:** `/history.html` lists all approved invoices with text search, processing-date range, file-type and confidence filters, page-size controls and CSV export. Invoice IDs are shortened visually while retaining the complete ID on hover and for assistive technology; detail links retrieve a single approved record so older invoices remain accessible.
* **How to test:** Open *Lịch sử hóa đơn* from the upload sidebar or choose *Xem toàn bộ lịch sử* in the dashboard list. Search/filter records, move between pages, export the filtered result and open an older record.
* **Expected result:** the upload dashboard remains limited to the three newest approved invoices while the history page can navigate the complete approved record set.
* **Status:** Partial — implementation is in place; full database/browser validation depends on a running database and stored invoices.

## F-08 — Manual invoice review and approval

* **Description:** Extracted invoices are stored with `pending` status and appear at `/review.html`. The page places the original PDF/image beside editable extracted fields and line items. Approving saves the reviewed values and changes the status to `approved`; only approved invoices appear in saved history.
* **How to test:** Upload a document, open *Hàng đợi duyệt*, compare the original document with extracted data, optionally edit fields, and choose *Duyệt và lưu hóa đơn*. Confirm the invoice now appears under *Hóa đơn đã lưu* and that its detail page contains no preview image.
* **Expected result:** pending records remain out of `GET /api/invoices`; approved records are returned there and removed from `GET /api/reviews`.
* **Status:** Partial — workflow implementation is in place; end-to-end confirmation depends on a running database and Gemini configuration.

---

## Not implemented (do not claim these work)

| Feature | Notes |
| --- | --- |
| Other multimodal providers | Gemini is integrated; other providers are not |
| Authentication, users, departments, audit logs | Target architecture in `project_details.md` |
| Authentication and department-scoped RBAC | No login exists; all endpoints are open |
| Batch jobs / model selection per job | Mentioned in `project_details.md` |
| PDF/image preview in the submission box | Only file name/size are shown |
| Automated tests | No test runner is configured |
