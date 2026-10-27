# TASK-STAGE2-26-10 State

## Metadata

- Task: TASK-STAGE2-26-10 — Implement configurable dual-branch extraction
- Assigned at: 26/10/2026
- Status: **IN_PROGRESS**

## Scope

- Run local Tesseract OCR and configurable Gemini Vision model(s) against the same
  preprocessed document.
- Return OCR text, per-page confidence, and word bounding boxes as an optional
  extension of `ExtractionResult`.
- Preserve existing required invoice fields and older stored records.
- Keep real-provider requests untested unless the user explicitly approves sending
  an actual document.

## Validation

- Pending implementation and focused local tests.
- No real invoice will be sent to Gemini during validation.
