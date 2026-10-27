# Architecture Explanation

> **Source of truth for the architecture is `knowledge/architecture.md`.**
> This file is the short version required by `agents.md` and must stay consistent with it.
> Last updated: 26/10/2026 — preprocessing feeds local OCR and Gemini Vision branches.
> Validation status: Stage 2 implementation is being validated; live Vision calls require a user API key
> and approval to send a real document.

## 1. System Overview

A single Next.js (App Router) fullstack prototype. The browser renders one page with a submission box;
the server (Next.js API routes, Node runtime) validates the upload, preprocesses images, then runs
local Tesseract OCR and configured Gemini Vision model(s) concurrently. OCR evidence and structured
invoice JSON are validated with Zod and stored in a JSON file that stands in for the database.

| Layer | Implementation |
| --- | --- |
| Client | `app/page.tsx` displays the dashboard from `frontend/upload.html`, `frontend/upload.css` and `frontend/upload.js` full-screen at `/`; Next.js serves the source files at their matching root URLs |
| Server | `app/api/extract/route.ts`, `app/api/invoices/route.ts` |
| Domain logic | `lib/documentPreprocessing.ts` (Sharp image preparation), `lib/documentOcr.ts` (local OCR/PDF rendering), `lib/geminiExtractor.ts` (dual branches), `lib/invoiceSchema.ts` (contract), `lib/uploadConfig.ts` (upload rules) |
| Storage | `lib/invoiceStore.ts` → `data/invoices.json` (mock database) |
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
    participant D as data/invoices.json

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
    R->>D: append record (max 50)
    R-->>P: 200 { ok: true, data }
    P->>U: dashboard displays extraction status and saved history
    P->>R: GET /api/invoices
```

## 3. Important Architectural Decisions

| Decision | Reason |
| --- | --- |
| Gemini extraction behind the Zod contract | Provider output is validated before storage; incomplete results are rejected instead of being guessed |
| Zod as the single response contract | Matches the "Structured Output Validation" goal in `project_details.md` |
| JSON file store instead of Prisma/SQLite | Zero dependencies, no migration risk; Prisma/SQLite is the documented next step |
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
 Gemini extracts real document contents and saves invoice JSON
 dashboard history and statistics show the saved result
```

Step-by-step manual tests: `features.md`. Environment: `knowledge/configuration.md`.
