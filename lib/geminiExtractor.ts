import { createHash } from "node:crypto";
import { z } from "zod";
import { invoiceSchema, type DocumentKind, type ExtractionResult } from "./invoiceSchema";
import { detectDocumentKind, estimatePdfPages } from "./mockExtractor";
import {
  DocumentPreprocessingError,
  preprocessDocument,
  type PreparedDocument,
} from "./documentPreprocessing";
import { extractDocumentOcr } from "./documentOcr";

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60_000;

const INVOICE_EXTRACTION_PROMPT = `Read the attached invoice document and extract its actual contents.
Return only a JSON object with this exact shape:
{
  "invoice": {
    "invoiceNumber": "string",
    "serialNumber": "string",
    "issueDate": "YYYY-MM-DD",
    "sellerName": "string",
    "sellerTaxId": "10 or 13 digits, with an optional hyphen before the final 3 digits",
    "sellerAddress": "string",
    "buyerName": "string",
    "buyerTaxId": "10 or 13 digits, with an optional hyphen before the final 3 digits",
    "currency": "VND",
    "lineItems": [{"name":"string","unit":"string","quantity":0,"unitPrice":0,"lineTotal":0}],
    "subtotal": 0,
    "taxRate": 0,
    "taxAmount": 0,
    "totalAmount": 0
  },
  "confidence": 0.0,
  "warnings": []
}
Rules:
- Extract only information visible in the document. Never invent, guess, or fill missing values.
- Preserve Vietnamese names and text. Normalize dates to YYYY-MM-DD.
- Use numeric amounts without thousands separators; taxRate is a decimal (10% = 0.1).
- confidence is your 0-to-1 estimate of legibility and completeness, not a guarantee.
- If a required invoice field or line item is missing or unreadable, explain that in a "warnings" array and use an empty string for missing text fields, 0 for missing numbers, and [] for missing line items.
- Do not include markdown fences or any text outside the JSON object.`;

export class GeminiExtractionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "GeminiExtractionError";
  }
}

type GeminiInvoiceResponse = {
  invoiceNumber: string;
  serialNumber: string;
  issueDate: string;
  sellerName: string;
  sellerTaxId: string;
  sellerAddress: string;
  buyerName: string;
  buyerTaxId: string;
  currency: "VND";
  lineItems: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  confidence: number;
  warnings?: string[];
};

function mimeTypeForKind(kind: DocumentKind): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "png") return "image/png";
  return "image/jpeg";
}

function geminiError(status: number, message: string, code: string): GeminiExtractionError {
  return new GeminiExtractionError(message, status, code);
}

function readResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((part) => (part && typeof part === "object" ? (part as { text?: unknown }).text : null))
    .filter((part): part is string => typeof part === "string")
    .join("")
    .trim();
  return text || null;
}

function parseInvoiceResponse(text: string): GeminiInvoiceResponse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw geminiError(502, "Gemini trả về dữ liệu không phải JSON hợp lệ. Vui lòng thử lại.", "INVALID_GEMINI_RESPONSE");
  }

  if (!value || typeof value !== "object" || !("invoice" in value)) {
    throw geminiError(502, "Gemini trả về JSON không đúng cấu trúc hóa đơn.", "INVALID_GEMINI_RESPONSE");
  }

  const parsed = z.object({
    invoice: invoiceSchema,
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()).optional(),
  }).safeParse(value);
  if (!parsed.success) {
    throw geminiError(
      422,
      "Không trích xuất được đầy đủ các trường hóa đơn bắt buộc. Hãy dùng file rõ nét, đầy đủ thông tin rồi thử lại.",
      "INCOMPLETE_EXTRACTION",
    );
  }

  return { ...parsed.data.invoice, confidence: parsed.data.confidence, warnings: parsed.data.warnings };
}

async function extractWithGemini(
  preparedDocument: PreparedDocument,
  model: string,
  apiKey: string,
): Promise<GeminiInvoiceResponse> {
  const endpoint = `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: INVOICE_EXTRACTION_PROMPT },
            {
              inlineData: {
                mimeType: preparedDocument.mimeType,
                data: preparedDocument.buffer.toString("base64"),
              },
            },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw geminiError(504, "Gemini xử lý quá thời gian cho phép. Vui lòng thử lại.", "GEMINI_TIMEOUT");
    }
    throw geminiError(502, "Không kết nối được với Gemini. Kiểm tra mạng rồi thử lại.", "GEMINI_UNAVAILABLE");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw geminiError(429, "Gemini đang giới hạn yêu cầu hoặc đã hết quota. Vui lòng thử lại sau.", "GEMINI_RATE_LIMITED");
    }
    if (response.status === 401 || response.status === 403) {
      throw geminiError(502, "Gemini từ chối API key. Kiểm tra GEMINI_API_KEY và quyền truy cập Gemini API.", "GEMINI_AUTH_ERROR");
    }
    if (response.status === 400) {
      throw geminiError(422, "Gemini không chấp nhận tài liệu này. Hãy thử một file PDF hoặc ảnh khác.", "GEMINI_REJECTED_FILE");
    }
    console.error("[Gemini API] provider request failed", { status: response.status, model });
    throw geminiError(
      502,
      `Gemini trả về lỗi HTTP ${response.status}. Hãy thử lại; nếu lỗi tiếp diễn, kiểm tra cấu hình model hoặc trạng thái dịch vụ.`,
      "GEMINI_PROVIDER_ERROR",
    );
  }

  let responsePayload: unknown;
  try {
    responsePayload = await response.json();
  } catch {
    throw geminiError(502, "Gemini trả về phản hồi không đọc được. Vui lòng thử lại.", "INVALID_GEMINI_RESPONSE");
  }

  const responseText = readResponseText(responsePayload);
  if (!responseText) {
    throw geminiError(422, "Gemini không nhận diện được nội dung hóa đơn trong file này.", "GEMINI_NO_OUTPUT");
  }
  return parseInvoiceResponse(responseText);
}

function configuredGeminiModels(): string[] {
  const configured = process.env.GEMINI_MODELS;
  const models = configured
    ? configured.split(",").map((model) => model.trim()).filter(Boolean)
    : [process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL];
  if (!models.length || models.some((model) => !/^[a-zA-Z0-9._-]+$/.test(model))) {
    throw geminiError(
      500,
      "Cấu hình model Gemini không hợp lệ. Dùng GEMINI_MODELS với tên model phân tách bằng dấu phẩy.",
      "GEMINI_MODEL_CONFIGURATION_INVALID",
    );
  }
  return [...new Set(models)];
}

export async function geminiExtract(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ExtractionResult> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw geminiError(
      503,
      "Chưa cấu hình Gemini API key. Thêm GEMINI_API_KEY vào .env.local rồi khởi động lại server.",
      "GEMINI_NOT_CONFIGURED",
    );
  }

  const kind = detectDocumentKind(input.buffer, input.mimeType);
  if (!kind) {
    throw geminiError(415, "Chỉ hỗ trợ PDF, PNG hoặc JPEG.", "UNSUPPORTED_TYPE");
  }

  let preparedDocument: PreparedDocument;
  try {
    preparedDocument = await preprocessDocument(input.buffer, kind);
  } catch (error) {
    if (error instanceof DocumentPreprocessingError) {
      throw geminiError(422, error.message, "DOCUMENT_PREPROCESSING_FAILED");
    }
    throw error;
  }

  const models = configuredGeminiModels();
  const [visionResults, ocr] = await Promise.all([
    Promise.all(models.map(async (model) => ({
      model,
      result: await extractWithGemini(preparedDocument, model, apiKey),
    }))),
    extractDocumentOcr(preparedDocument, kind),
  ]);

  const primary = visionResults[0];
  const invoice = primary.result;
  const contentHash = createHash("sha256").update(input.buffer).digest("hex").slice(0, 16);
  const result: ExtractionResult = {
    recordId: `inv_${contentHash}_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    source: {
      fileName: input.fileName,
      mimeType: input.mimeType || mimeTypeForKind(kind),
      sizeBytes: input.sizeBytes,
      kind,
      estimatedPages: kind === "pdf" ? estimatePdfPages(input.buffer) : 1,
      contentHash,
    },
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      serialNumber: invoice.serialNumber,
      issueDate: invoice.issueDate,
      sellerName: invoice.sellerName,
      sellerTaxId: invoice.sellerTaxId,
      sellerAddress: invoice.sellerAddress,
      buyerName: invoice.buyerName,
      buyerTaxId: invoice.buyerTaxId,
      currency: invoice.currency,
      lineItems: invoice.lineItems,
      subtotal: invoice.subtotal,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
    },
    extraction: {
      provider: "gemini",
      model: primary.model,
      processingMs: Date.now() - startedAt,
      confidence: invoice.confidence,
      warnings: invoice.warnings ?? [],
      ocr,
      visionModels: visionResults.map(({ model, result: modelResult }) => ({
        model,
        invoice: {
          invoiceNumber: modelResult.invoiceNumber,
          serialNumber: modelResult.serialNumber,
          issueDate: modelResult.issueDate,
          sellerName: modelResult.sellerName,
          sellerTaxId: modelResult.sellerTaxId,
          sellerAddress: modelResult.sellerAddress,
          buyerName: modelResult.buyerName,
          buyerTaxId: modelResult.buyerTaxId,
          currency: modelResult.currency,
          lineItems: modelResult.lineItems,
          subtotal: modelResult.subtotal,
          taxRate: modelResult.taxRate,
          taxAmount: modelResult.taxAmount,
          totalAmount: modelResult.totalAmount,
        },
        confidence: modelResult.confidence,
        warnings: modelResult.warnings ?? [],
      })),
    },
  };

  return result;
}
