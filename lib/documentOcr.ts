import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";
import sharp from "sharp";
import type { DocumentKind, OcrPage } from "./invoiceSchema";
import type { PreparedDocument } from "./documentPreprocessing";

const MAX_PDF_OCR_PAGES = 50;
const MAX_PDF_RENDER_WIDTH = 2400;
const MAX_PDF_RENDER_HEIGHT = 3200;
const PDF_RENDER_SCALE = 2;
const standardFontDataUrl = pathToFileURL(
  `${join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")}/`,
).href;

export class OcrExtractionError extends Error {
  constructor(
    message: string,
    readonly status = 422,
    readonly code = "OCR_FAILED",
  ) {
    super(message);
    this.name = "OcrExtractionError";
  }
}

function getOcrLanguages(): string {
  const languages = process.env.TESSERACT_LANGUAGES?.trim() || "vie+eng";
  if (!/^[a-z]{3}(?:\+[a-z]{3})*$/.test(languages)) {
    throw new OcrExtractionError(
      "TESSERACT_LANGUAGES phải là mã ngôn ngữ Tesseract, ví dụ vie+eng.",
      500,
      "OCR_CONFIGURATION_INVALID",
    );
  }
  return languages;
}

function getPageWords(data: Tesseract.Page): OcrPage["words"] {
  return (data.blocks ?? [])
    .flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words)
    .filter((word) => word.text.trim().length > 0)
    .map((word) => ({
      text: word.text,
      confidence: Math.min(1, Math.max(0, word.confidence / 100)),
      bbox: word.bbox,
    }));
}

async function recognizePage(
  worker: Tesseract.Worker,
  image: Buffer,
  pageNumber: number,
): Promise<OcrPage> {
  const metadata = await sharp(image).metadata();
  if (!metadata.width || !metadata.height) {
    throw new OcrExtractionError("OCR không xác định được kích thước trang ảnh.");
  }

  const { data } = await worker.recognize(image, {}, { blocks: true });
  return {
    pageNumber,
    width: metadata.width,
    height: metadata.height,
    confidence: Math.min(1, Math.max(0, data.confidence / 100)),
    text: data.text.trim(),
    words: getPageWords(data),
  };
}

async function recognizePdf(
  worker: Tesseract.Worker,
  pdfBuffer: Buffer,
): Promise<OcrPage[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl,
  });
  let document: Awaited<typeof loadingTask.promise>;
  try {
    document = await loadingTask.promise;
  } catch {
    throw new OcrExtractionError(
      "Không thể đọc hoặc kết xuất PDF cho nhánh OCR.",
      422,
      "PDF_RENDER_FAILED",
    );
  }

  try {
    if (document.numPages > MAX_PDF_OCR_PAGES) {
      throw new OcrExtractionError(
        `OCR hiện hỗ trợ tối đa ${MAX_PDF_OCR_PAGES} trang PDF; tài liệu có ${document.numPages} trang.`,
        413,
        "OCR_PAGE_LIMIT_EXCEEDED",
      );
    }

    try {
      const pages: OcrPage[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(
          PDF_RENDER_SCALE,
          MAX_PDF_RENDER_WIDTH / baseViewport.width,
          MAX_PDF_RENDER_HEIGHT / baseViewport.height,
        );
        const viewport = page.getViewport({ scale });
        const width = Math.max(1, Math.ceil(viewport.width));
        const height = Math.max(1, Math.ceil(viewport.height));
        const canvas = createCanvas(width, height);
        const context = Object.assign(canvas.getContext("2d"), {
          drawFocusIfNeeded: () => undefined,
        });

        // PDF.js types its context as a DOM canvas; this is the equivalent native Node canvas context.
        await page.render({
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const image = canvas.toBuffer("image/png");
        pages.push(await recognizePage(worker, image, pageNumber));
        page.cleanup();
      }

      return pages;
    } catch (error) {
      if (error instanceof OcrExtractionError) throw error;
      throw new OcrExtractionError(
        "Không thể kết xuất đầy đủ các trang PDF cho nhánh OCR.",
        422,
        "PDF_RENDER_FAILED",
      );
    }
  } finally {
    await document.destroy();
  }
}

export async function extractDocumentOcr(
  preparedDocument: PreparedDocument,
  kind: DocumentKind,
): Promise<{
  provider: "tesseract";
  languages: string;
  processingMs: number;
  text: string;
  pages: OcrPage[];
}> {
  const startedAt = Date.now();
  const languages = getOcrLanguages();
  const workerOptions: Partial<Tesseract.WorkerOptions> = {};
  if (process.env.TESSERACT_LANG_PATH?.trim()) {
    workerOptions.langPath = process.env.TESSERACT_LANG_PATH.trim();
  }
  const cachePath = process.env.TESSERACT_CACHE_PATH?.trim()
    || join(tmpdir(), `ati-document-ocr-${process.getuid?.() ?? process.pid}`);
  await mkdir(cachePath, { recursive: true });
  workerOptions.cachePath = cachePath;
  workerOptions.workerPath = join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js",
  );

  let worker: Tesseract.Worker | undefined;
  try {
    worker = await Tesseract.createWorker(languages, Tesseract.OEM.LSTM_ONLY, workerOptions);
    const pages = kind === "pdf"
      ? await recognizePdf(worker, preparedDocument.buffer)
      : [await recognizePage(worker, preparedDocument.buffer, 1)];

    return {
      provider: "tesseract",
      languages,
      processingMs: Date.now() - startedAt,
      text: pages.map((page) => page.text).filter(Boolean).join("\n\n"),
      pages,
    };
  } catch (error) {
    if (error instanceof OcrExtractionError) throw error;
    console.error("[Document OCR] local OCR failed", {
      kind,
      languages,
      message: error instanceof Error ? error.message : "Unknown OCR error",
    });
    throw new OcrExtractionError(
      "Không chạy được OCR cục bộ. Kiểm tra kết nối tải dữ liệu ngôn ngữ OCR hoặc cấu hình TESSERACT_LANG_PATH.",
      503,
      "OCR_NOT_AVAILABLE",
    );
  } finally {
    if (worker) await worker.terminate();
  }
}
