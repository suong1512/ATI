import { NextRequest } from "next/server";
import { MAX_FILE_SIZE_BYTES, detectDocumentKind } from "@/lib/mockExtractor";
import { GeminiExtractionError, geminiExtract } from "@/lib/geminiExtractor";
import { OcrExtractionError } from "@/lib/documentOcr";
import { extractionResultSchema } from "@/lib/invoiceSchema";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";
import { InvoiceStoreError, saveInvoice } from "@/lib/invoiceStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, code: string, message: string, details: string[] = []) {
  return Response.json({ ok: false, error: { code, message, details } }, { status });
}

/**
 * POST /api/extract
 * multipart/form-data with a single field `file` (PDF / PNG / JPEG).
 * Runs local OCR and Gemini Vision branches, validates their combined result, and stores it pending review.
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const withCors = (response: Response) => withLocalFrontendCors(request, response);

  try {
    // A request without a multipart body (or without a Content-Type) throws here.
    // That is a client error, not a server error.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return withCors(jsonError(400, "NO_FILE", "Thiếu multipart/form-data với field tên `file`."));
    }

    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return withCors(jsonError(400, "NO_FILE", "Thiếu file. Hãy gửi multipart/form-data với field tên `file`."));
    }

    if (file.size === 0) {
      return withCors(jsonError(400, "EMPTY_FILE", "File rỗng."));
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return withCors(jsonError(413, "FILE_TOO_LARGE", `File vượt quá ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB.`));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentKind = detectDocumentKind(buffer, file.type);
    if (!documentKind) {
      return withCors(jsonError(
        415,
        "UNSUPPORTED_TYPE",
        "Chỉ hỗ trợ PDF, PNG hoặc JPEG.",
        [`Nhận được: type="${file.type || "unknown"}", name="${file.name}"`],
      ));
    }

    const result = await geminiExtract({
      buffer,
      fileName: file.name || "upload",
      mimeType: file.type,
      sizeBytes: file.size,
    });

    const parsed = extractionResultSchema.safeParse(result);
    if (!parsed.success) {
      return withCors(jsonError(500, "SCHEMA_MISMATCH", "Kết quả trích xuất không khớp schema.", parsed.error.issues.map(String)));
    }

    await saveInvoice(parsed.data, buffer);

    return withCors(Response.json(
      { ok: true, data: parsed.data, meta: { processingMs: Date.now() - startedAt } },
      { status: 200 },
    ));
  } catch (error) {
    if (error instanceof GeminiExtractionError) {
      return withCors(jsonError(error.status, error.code, error.message));
    }
    if (error instanceof OcrExtractionError) {
      return withCors(jsonError(error.status, error.code, error.message));
    }
    if (error instanceof InvoiceStoreError) {
      console.error("[POST /api/extract] Database write failed.", error);
      return withCors(jsonError(
        503,
        "DATABASE_UNAVAILABLE",
        "Đã trích xuất hóa đơn nhưng không thể lưu vào database. Hãy kiểm tra kết nối MariaDB và MongoDB.",
      ));
    }
    console.error("[POST /api/extract]", error);
    return withCors(jsonError(500, "INTERNAL_ERROR", "Không xử lý được file. Xem log server."));
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
