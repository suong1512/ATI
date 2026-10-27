import { z } from "zod";

/**
 * Zod contract for the extracted invoice data.
 *
 * This schema is the single source of truth for the JSON shape returned by
 * `POST /api/extract`. Gemini output and legacy mock records use this contract.
 */

export const lineItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  serialNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sellerName: z.string().min(1),
  sellerTaxId: z.string().regex(/^\d{10}(-\d{3})?$/),
  sellerAddress: z.string().min(1),
  buyerName: z.string().min(1),
  buyerTaxId: z.string().regex(/^\d{10}(-\d{3})?$/),
  currency: z.literal("VND"),
  lineItems: z.array(lineItemSchema).min(1).max(10),
  subtotal: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
});

export const documentKindSchema = z.enum(["pdf", "png", "jpeg"]);

export const ocrWordSchema = z.object({
  text: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.object({
    x0: z.number().nonnegative(),
    y0: z.number().nonnegative(),
    x1: z.number().nonnegative(),
    y1: z.number().nonnegative(),
  }),
});

export const ocrPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  text: z.string(),
  words: z.array(ocrWordSchema),
});

export const extractionResultSchema = z.object({
  recordId: z.string().min(1),
  createdAt: z.string().min(1),
  source: z.object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    kind: documentKindSchema,
    estimatedPages: z.number().int().positive(),
    contentHash: z.string().length(16),
  }),
  invoice: invoiceSchema,
  extraction: z.object({
    provider: z.enum(["mock", "gemini"]),
    model: z.string().min(1),
    processingMs: z.number().nonnegative(),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
    ocr: z.object({
      provider: z.literal("tesseract"),
      languages: z.string().min(1),
      processingMs: z.number().nonnegative(),
      text: z.string(),
      pages: z.array(ocrPageSchema).min(1),
    }).optional(),
    visionModels: z.array(z.object({
      model: z.string().min(1),
      invoice: invoiceSchema,
      confidence: z.number().min(0).max(1),
      warnings: z.array(z.string()),
    })).optional(),
  }),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type DocumentKind = z.infer<typeof documentKindSchema>;
export type OcrPage = z.infer<typeof ocrPageSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
