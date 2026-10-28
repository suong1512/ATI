# API Documentation

> Internal API exposed by the Next.js App Router (`app/api/**`).
> `POST /api/extract` runs local OCR and sends prepared documents to Google's Gemini API; Vision requires `GEMINI_API_KEY`.
> Response contract source of truth: `lib/invoiceSchema.ts`.
> Last updated: 28/10/2026

---

## 1. General Conventions

| Item | Value |
| --- | --- |
| Base URL (dev) | `http://localhost:3000` |
| Authentication | **None** (no auth implemented) |
| Upload encoding | `multipart/form-data` |
| Response encoding | `application/json` |
| Runtime | Node.js (`runtime = "nodejs"`, routes read/write files) |
| Caching | `dynamic = "force-dynamic"` on both routes |
| Error message language | Vietnamese |

> **Verification status:** every endpoint and error code below was executed with `curl` against the
> dev server on 30/09/2026 (results in `state/task_30_09_state.md` §5).

### Response envelope

Success:

```json
{ "ok": true, "data": { }, "meta": { } }
```

Error:

```json
{ "ok": false, "error": { "code": "UNSUPPORTED_TYPE", "message": "...", "details": [] } }
```

---

## 2. `POST /api/extract`

Upload one invoice document; the server prepares the input, runs OCR and configured Gemini Vision model(s) concurrently, validates the combined extraction result, then stores its metadata in MariaDB and full payload in MongoDB.

### Request

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `file` | file | yes | `application/pdf`, `image/png`, `image/jpeg`; not empty; ≤ 10 MB (`MAX_FILE_SIZE_BYTES`) |

Server-side validation order:

1. field `file` must exist (`NO_FILE`)
2. size must be > 0 (`EMPTY_FILE`)
3. size must be ≤ 10 MB (`FILE_TOO_LARGE`)
4. magic bytes must be `%PDF-` / `89 50 4E 47` / `FF D8 FF`; otherwise the reported mime type is used as fallback (`UNSUPPORTED_TYPE`)
5. PDF bytes pass through unchanged; PNG/JPEG images are auto-oriented using EXIF, resized to fit 2400×3200 without upscaling, flattened on white and encoded as JPEG quality 92.
6. OCR runs locally using Tesseract (`TESSERACT_LANGUAGES`, default `vie+eng`). PDF pages are rendered locally for OCR (maximum 50 pages); each page includes text, word bounding boxes in pixels, and confidence scores.
7. The same prepared document is sent concurrently to each configured Gemini Vision model. `GEMINI_MODELS` is a comma-separated model list; if unset, the existing `GEMINI_MODEL` (or default) is used.
8. Each Vision result and OCR evidence are validated by `extractionResultSchema` before storage. All required invoice attributes must be present; unknown values may be `null` or `0` and are stored as returned. Missing attributes are rejected with their JSON paths. The first configured Vision result populates the existing `invoice` and `extraction` fields; `extraction.visionModels` preserves all model outputs and `extraction.ocr` contains OCR evidence. No consensus or reconciliation is performed in this stage.

The response's `source.fileName`, `source.mimeType`, `source.sizeBytes`, `source.kind`, `source.estimatedPages`,
and `source.contentHash` describe the **original upload**. Image conversion is temporary. OCR is local;
only the prepared PDF/image is sent to Gemini. `extraction.ocr` and `extraction.visionModels` are
optional additions, so existing records and required invoice fields remain compatible.

### Success response — `200`

```json
{
  "ok": true,
  "data": {
    "recordId": "inv_a1b2c3d4e5f60718_m9k2x1",
    "createdAt": "2026-09-30T05:02:11.482Z",
    "source": {
      "fileName": "sample-invoice.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1764,
      "kind": "pdf",
      "estimatedPages": 2,
      "contentHash": "a1b2c3d4e5f60718"
    },
    "invoice": {
      "invoiceNumber": "438219",
      "serialNumber": "1C31TAA",
      "issueDate": "2026-08-17",
      "sellerName": "CÔNG TY TNHH THƯƠNG MẠI AN PHÁT",
      "sellerTaxId": "3791765412",
      "sellerAddress": "12 Nguyễn Trãi, Q. Thanh Xuân, Hà Nội",
      "buyerName": "CÔNG TY TNHH PHẦN MỀM ATI",
      "buyerTaxId": "6123098477",
      "currency": "VND",
      "lineItems": [
        { "name": "Giấy in A4 Double A 70gsm", "unit": "Ram", "quantity": 7, "unitPrice": 85000, "lineTotal": 595000 }
      ],
      "subtotal": 595000,
      "taxRate": 0.1,
      "taxAmount": 59500,
      "totalAmount": 654500
    },
    "extraction": {
      "provider": "gemini",
      "model": "gemini-2.5-flash",
      "processingMs": 1200,
      "confidence": 0.93,
      "warnings": []
    }
  },
  "meta": { "processingMs": 12 }
}
```

> Example values are illustrative; actual results depend on the contents and legibility of the uploaded document.

The `data.extraction` object also has these Stage 2 fields:

```json
{
  "ocr": {
    "provider": "tesseract",
    "languages": "vie+eng",
    "processingMs": 4200,
    "text": "recognized page text",
    "pages": [{
      "pageNumber": 1,
      "width": 1600,
      "height": 2200,
      "confidence": 0.91,
      "text": "recognized page text",
      "words": [{ "text": "HÓA", "confidence": 0.96, "bbox": { "x0": 20, "y0": 30, "x1": 90, "y1": 70 } }]
    }]
  },
  "visionModels": [{
    "model": "gemini-2.5-flash",
    "invoice": { "...": "same invoice schema as data.invoice" },
    "confidence": 0.93,
    "warnings": []
  }]
}
```

Bounding-box coordinates are pixels in the rendered/prepared page. Older stored records may omit
`ocr` and `visionModels`; these fields are optional for backward compatibility.

### Error responses

| Status | Code | Cause |
| --- | --- | --- |
| 400 | `NO_FILE` | multipart body without a `file` field, **or** a request whose Content-Type is not `multipart/form-data` (both cases return 400, verified) |
| 400 | `EMPTY_FILE` | 0-byte file |
| 413 | `FILE_TOO_LARGE` | file > 10 MB |
| 415 | `UNSUPPORTED_TYPE` | not a PDF/PNG/JPEG |
| 422 | `DOCUMENT_PREPROCESSING_FAILED` | image bytes cannot be decoded or prepared |
| 413 | `OCR_PAGE_LIMIT_EXCEEDED` | PDF has more than 50 pages for OCR |
| 503 | `OCR_NOT_AVAILABLE` | Tesseract worker or local OCR language data could not be initialized |
| 422 | `PDF_RENDER_FAILED` | PDF cannot be read or rendered for the OCR branch |
| 500 | `OCR_CONFIGURATION_INVALID` / `GEMINI_MODEL_CONFIGURATION_INVALID` | invalid configured language or Vision model list |
| 422 | `INCOMPLETE_EXTRACTION` | Gemini returned malformed invoice data or omitted a required attribute; the error message lists affected JSON paths without exposing extracted values |
| 429 | `GEMINI_RATE_LIMITED` | Gemini quota or rate limit |
| 502 | `GEMINI_MODEL_NOT_FOUND` | configured Gemini model is unavailable to the API key or does not support `generateContent`; check `GEMINI_MODEL` / `GEMINI_MODELS` |
| 502 | `GEMINI_AUTH_ERROR` / `GEMINI_PROVIDER_ERROR` | invalid key or provider failure; unexpected provider HTTP status is included in the message and server log (status/model only) |
| 503 | `GEMINI_NOT_CONFIGURED` | `GEMINI_API_KEY` is not set |
| 504 | `GEMINI_TIMEOUT` | Gemini did not respond within 60 seconds |
| 500 | `INTERNAL_ERROR` | unexpected server error (logged to the server console) |

### cURL examples

```bash
# success
curl -i -F "file=@samples/sample-invoice.pdf;type=application/pdf" http://localhost:3000/api/extract

# unsupported type
curl -i -F "file=@README.md;type=text/markdown" http://localhost:3000/api/extract

# missing field
curl -i -X POST http://localhost:3000/api/extract
```

---

## 3. `GET /api/invoices`

Lists the newest 50 invoices indexed in MariaDB and loads their full payloads from MongoDB.

```bash
curl -s http://localhost:3000/api/invoices
```

```json
{ "ok": true, "count": 1, "data": [ /* ExtractionResult[] */ ] }
```

## 4. `GET /api/invoices/:recordId/document`

Returns the original uploaded PDF, PNG or JPEG with its detected media type for inline preview.
The original is stored separately from invoice extraction payloads in MongoDB's `Invoice_Documents`
collection. Records created before original-document storage was added return HTTP 404.

```bash
curl -i http://localhost:3000/api/invoices/<recordId>/document
```

---

## 5. `DELETE /api/invoices`

Deletes invoice records from MariaDB and their payloads from MongoDB. Intended for demos/tests.

```bash
curl -s -X DELETE http://localhost:3000/api/invoices
# { "ok": true, "deleted": 1 }
```

---

## 6. Response Object Reference (`ExtractionResult`)

| Field | Type | Notes |
| --- | --- | --- |
| `recordId` | string | `inv_<hash>_<base36 time>` |
| `createdAt` | string (ISO) | when extraction ran |
| `source.fileName` | string | original upload name |
| `source.mimeType` | string | reported mime type |
| `source.sizeBytes` | number | upload size |
| `source.kind` | `pdf` \| `png` \| `jpeg` | detected from magic bytes |
| `source.estimatedPages` | number | heuristic for PDFs, always 1 for images |
| `source.contentHash` | string(16) | first 16 hex chars of the SHA-256 of the bytes |
| `invoice.*` | object | invoice number, serial, issue date, seller/buyer, currency, `lineItems[]`, subtotal, taxRate, taxAmount, totalAmount |
| `extraction.provider` | `"gemini"` \| `"mock"` | new API results use Gemini; mock is retained for older records |
| `extraction.model` | string | Gemini model; default `gemini-2.5-flash` |
| `extraction.processingMs` | number | time spent extracting |
| `extraction.confidence` | number 0–1 | Gemini's estimate, not a calibrated guarantee |
| `extraction.warnings` | string[] | extraction caveats returned by Gemini |

The authoritative field list and constraints: `lib/invoiceSchema.ts`.

---

## 6. Limitations and Integration Notes

* **No authentication / authorization.** Any client can upload, read and delete stored records.
* **No rate limiting** and no file persistence of the uploaded document itself (only the extracted JSON is stored).
* Database connections require `MYSQL_*` and `MONGODB_URI` variables in `.env.local`; the invoice index table is created automatically when the API first connects.
* A database outage returns `503 DATABASE_UNAVAILABLE`; records are not silently replaced with mock or empty data.
* Uploaded invoice files are transmitted to Google's Gemini API. Review privacy, terms, quota and pricing before sending real invoices.

### Gemini integration

| Item | Value |
| --- | --- |
| Provider | Gemini multimodal `generateContent` |
| Model | `gemini-2.5-flash` by default; override with `GEMINI_MODEL` |
| Call site | `lib/geminiExtractor.ts`, called from `app/api/extract/route.ts` |
| Credentials | `GEMINI_API_KEY` in ignored `.env.local`; never commit or expose in frontend |
| Payload | Base64-encoded uploaded PDF/image; transmitted to Google |
| Validation | Shared Zod invoice contract is checked before storage |
