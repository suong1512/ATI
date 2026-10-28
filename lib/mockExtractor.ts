import { createHash } from "node:crypto";
import type { DocumentKind, ExtractionResult, Invoice, LineItem } from "./invoiceSchema";

// Re-exported so server-side callers keep a single import path.
export { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "./uploadConfig";

/**
 * Legacy deterministic mock invoice extraction.
 *
 * The live upload API uses `geminiExtractor.ts`; this helper remains available
 * for legacy/demo use and shared document metadata detection.
 *
 * The mock is *derived from the uploaded file*:
 *  - magic bytes decide the real document kind (pdf / png / jpeg)
 *  - a SHA-256 hash of the bytes seeds a deterministic pseudo random generator
 *    => uploading the same file twice produces the same invoice numbers/amounts
 *  - the estimated page count of a PDF influences the generated warnings
 */

export const MOCK_MODEL_NAME = "mock-invoice-extractor-v1";

/** Detect the document kind from magic bytes first, reported mime type second. */
export function detectDocumentKind(buffer: Buffer, reportedMimeType: string): DocumentKind | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";

  const normalized = reportedMimeType.toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/png") return "png";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpeg";

  return null;
}

/** Best-effort page count for PDFs; falls back to 1 page. */
export function estimatePdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  const pages = matches ? matches.length : 0;
  return Math.min(Math.max(pages, 1), 50);
}

/** Deterministic PRNG (mulberry32) so the same file always yields the same mock data. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SELLERS = [
  { name: "CÔNG TY TNHH THƯƠNG MẠI AN PHÁT", address: "12 Nguyễn Trãi, Q. Thanh Xuân, Hà Nội" },
  { name: "CÔNG TY CỔ PHẦN ĐẦU TƯ MINH LONG", address: "88 Lê Lợi, TP. Đà Nẵng" },
  { name: "CÔNG TY TNHH DỊCH VỤ TIN HỌC SAO VIỆT", address: "45 Cách Mạng Tháng 8, Q.3, TP.HCM" },
  { name: "CÔNG TY CP VẬT TƯ KỸ THUẬT HÀ NỘI", address: "231 Trường Chinh, Q. Đống Đa, Hà Nội" },
  { name: "CÔNG TY TNHH SX & TM ĐẠI VIỆT", address: "96 Võ Văn Kiệt, TP. Cần Thơ" },
];

const BUYERS = [
  "CÔNG TY TNHH PHẦN MỀM ATI",
  "CÔNG TY CỔ PHẦN GIẢI PHÁP SỐ VNPT",
  "TRƯỜNG ĐẠI HỌC BÁCH KHOA HÀ NỘI",
  "CÔNG TY TNHH LOGISTICS TÂN CẢNG",
];

const CATALOG = [
  { name: "Bút bi Thiên Long TL-027", unit: "Cái", unitPrice: 5000 },
  { name: "Giấy in A4 Double A 70gsm", unit: "Ram", unitPrice: 85000 },
  { name: "Mực in HP 85A chính hãng", unit: "Hộp", unitPrice: 1250000 },
  { name: "Sổ tay bìa da A5", unit: "Quyển", unitPrice: 45000 },
  { name: "Bàn phím cơ Logitech K845", unit: "Bộ", unitPrice: 1490000 },
  { name: "Chuột không dây Rapoo M10", unit: "Chiếc", unitPrice: 190000 },
  { name: "Ghế văn phòng lưng lưới", unit: "Chiếc", unitPrice: 2100000 },
  { name: "Đèn bàn LED chống cận", unit: "Chiếc", unitPrice: 320000 },
  { name: "Dịch vụ bảo trì máy tính", unit: "Lần", unitPrice: 750000 },
];

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

function randomTaxId(random: () => number): string {
  return String(Math.floor(random() * 9000000000) + 1000000000);
}

function buildInvoice(random: () => number): Invoice {
  const seller = pick(random, SELLERS);
  const itemCount = 1 + Math.floor(random() * 4);
  const lineItems: LineItem[] = [];

  while (lineItems.length < itemCount) {
    const product = pick(random, CATALOG);
    if (lineItems.some((item) => item.name === product.name)) continue;
    const quantity = 1 + Math.floor(random() * 20);
    lineItems.push({
      name: product.name,
      unit: product.unit,
      quantity,
      unitPrice: product.unitPrice,
      lineTotal: product.unitPrice * quantity,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const taxRate = random() < 0.5 ? 0.08 : 0.1;
  const taxAmount = Math.round(subtotal * taxRate);

  const issueDate = new Date();
  issueDate.setDate(issueDate.getDate() - Math.floor(random() * 90));

  return {
    invoiceNumber: String(1 + Math.floor(random() * 999999)).padStart(6, "0"),
    serialNumber: `1C${String(20 + Math.floor(random() * 99)).padStart(2, "0")}TAA`,
    issueDate: issueDate.toISOString().slice(0, 10),
    sellerName: seller.name,
    sellerTaxId: randomTaxId(random),
    sellerAddress: seller.address,
    buyerName: pick(random, BUYERS),
    buyerTaxId: randomTaxId(random),
    currency: "VND",
    lineItems,
    subtotal,
    taxRate,
    taxAmount,
    totalAmount: subtotal + taxAmount,
  };
}

export type MockExtractionInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Produce a mock extraction result for an uploaded document.
 * Returns `null` when the document kind cannot be determined.
 */
export function mockExtract(input: MockExtractionInput): ExtractionResult | null {
  const startedAt = Date.now();
  const kind = detectDocumentKind(input.buffer, input.mimeType);
  if (!kind) return null;

  const contentHash = createHash("sha256").update(input.buffer).digest("hex").slice(0, 16);
  const random = createRandom(parseInt(contentHash.slice(0, 8), 16));
  const estimatedPages = kind === "pdf" ? estimatePdfPages(input.buffer) : 1;

  const warnings = ["Dữ liệu mô phỏng (mock) — chưa gọi Multimodal LLM thật."];
  if (kind === "pdf" && estimatedPages > 1) {
    warnings.push(`PDF có khoảng ${estimatedPages} trang; mock chỉ mô phỏng trích xuất trang đầu tiên.`);
  }

  return {
    recordId: `inv_${contentHash}_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    source: {
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: input.sizeBytes,
      kind,
      estimatedPages,
      contentHash,
    },
    invoice: buildInvoice(random),
    extraction: {
      provider: "mock",
      model: MOCK_MODEL_NAME,
      processingMs: Math.max(Date.now() - startedAt, 1),
      confidence: Number((0.72 + random() * 0.25).toFixed(2)),
      warnings,
    },
  };
}
