# Architecture Explanation

> **Source of truth for the architecture is `knowledge/architecture.md`.**
> This file is the short version required by `agents.md` and must stay consistent with it.
> Last updated: 30/10/2026 — extracted invoices enter manual review before they appear in saved history.
> Validation status: manual approval was verified with a temporary local database record. Live Vision
> calls still require a configured API key and a real invoice upload.

## 1. System Overview

A single Next.js (App Router) fullstack prototype. The browser renders the upload dashboard and a
manual review page. The server validates and extracts uploads with local Tesseract OCR and configured
Gemini Vision model(s), stores each result as pending, then moves it to approved only after review.
MariaDB indexes the review status; MongoDB stores the extraction payload and original document.

| Layer | Implementation |
| --- | --- |
| Client | Dashboard and manual review UIs are served from `frontend/`; detail page shows approved invoice information only |
| Server | `app/api/extract/route.ts`, `app/api/reviews/route.ts`, `app/api/reviews/approve/route.ts`, `app/api/invoices/route.ts`, `app/api/invoices/[recordId]/document/route.ts` |
| Domain logic | `lib/documentPreprocessing.ts` (Sharp image preparation), `lib/documentOcr.ts` (local OCR/PDF rendering), `lib/geminiExtractor.ts` (dual branches), `lib/invoiceSchema.ts` (contract), `lib/uploadConfig.ts` (upload rules) |
| Storage | `lib/invoiceStore.ts` → MariaDB `Extracted_Invoice` index/status + MongoDB `Extraction_Records` payloads and `Invoice_Documents` originals |
| External APIs | Google Gemini API; only the Vision branch transmits documents. OCR runs locally; OCR language data may be downloaded on first use |

## 2. Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant P as Browser dashboard
    participant R as /api/extract
    participant S as Sharp preprocessing
    participant O as Local Tesseract OCR
    participant X as Gemini API
    participant Z as Zod schema
    participant M as MariaDB
    participant D as MongoDB
    participant F as MongoDB Invoice_Documents
    participant Q as Review Queue
    participant I as Invoice document API

    U->>P: chọn file (PDF/PNG/JPEG)
    P->>P: validateUploadFile() (type, size)
    P->>R: POST multipart/form-data (file)
    R->>R: size + magic-byte validation
    R->>S: prepare document after Gemini configuration check
    Note over S: PDF unchanged; images auto-oriented, resized to fit 2400×3200 without upscaling, flattened white and JPEG-encoded at quality 92
    S-->>R: prepared bytes + MIME type
    par Local OCR branch
        R->>O: prepared image or rendered PDF pages
        O-->>R: page text, word boxes and confidence
    and Gemini Vision branch(es)
        R->>X: prepared document + configured models
        X-->>R: invoice JSON per model
    end
    R->>Z: validate invoice and extraction evidence
    R->>M: save metadata with status=pending
    R->>D: save complete ExtractionResult payload
    R->>F: save original uploaded document
    R-->>P: 200 { ok: true, data }
    P->>Q: GET /api/reviews
    Q->>I: GET original document for comparison
    I->>F: load original bytes
    F-->>I: original PDF/image
    Q->>M: POST /api/reviews/approve with reviewed fields
    Q->>D: save reviewed invoice fields
    Q->>M: set status=approved
    P->>M: GET /api/invoices returns approved records only
```

## 3. Important Architectural Decisions

| Decision | Reason |
| --- | --- |
| Gemini extraction behind the Zod contract | Provider output is validated before storage; incomplete results are rejected instead of being guessed |
| Zod as the single response contract | Matches the "Structured Output Validation" goal in `project_details.md` |
| MariaDB status index + MongoDB payload | SQL filters pending versus approved invoices; MongoDB keeps extraction evidence and reviewed invoice data |
| Client-safe constants in `lib/uploadConfig.ts` | `lib/mockExtractor.ts` / `lib/invoiceStore.ts` use Node APIs and must stay server-only |
| Plain CSS (no Tailwind) | No extra build configuration for a prototype |

## 4. External APIs and Credentials

* `GEMINI_API_KEY` is stored in `.env.local` (gitignored) and is never sent to the browser.
* OCR runs locally. Uploaded PDF bytes and preprocessed PNG/JPEG bytes are transmitted to Google's Gemini API; check privacy, quota and pricing requirements before use.

## 5. Demo Flow

```text
git clone → open in DevContainer → npm install → npm run dev
 http://localhost:3000
 add GEMINI_API_KEY to .env.local → upload a readable invoice
 compare and optionally correct fields at /review.html → approve
 dashboard history and invoice details show approved records
```

Step-by-step manual tests: `features.md`. Environment: `knowledge/configuration.md`.
