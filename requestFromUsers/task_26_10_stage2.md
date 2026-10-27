# Stage 2 — Dual-Branch Extraction

## Original request

Implement the next document-processing stage:

> The processed document is passed to two complementary extraction branches.
> OCR extracts text and layout evidence such as bounding boxes and confidence.
> One or more configurable Vision AI models produce structured data according
> to the configured extraction schema. OCR implementation, provider, model and
> model count are configuration choices, not fixed architecture decisions.

## Decisions confirmed

- Use local Tesseract OCR with Vietnamese and English by default; OCR language
  and trained-data path are configurable.
- Keep OCR results in an optional section of the API/storage JSON so older
  records remain compatible.
- Keep Gemini as the configured Vision AI provider; support one or more models
  through environment configuration while retaining the existing single-model
  setting for compatibility.
- Run OCR and Vision branches concurrently over the same Stage 1 prepared input.
- Preserve the existing invoice JSON fields and select the first configured
  Vision result as the legacy top-level invoice; return all configured branch
  results as evidence without claiming reconciliation.
