import sharp from "sharp";
import type { DocumentKind } from "./invoiceSchema";

const MAX_IMAGE_WIDTH = 2400;
const MAX_IMAGE_HEIGHT = 3200;
const MAX_INPUT_PIXELS = 40_000_000;
const JPEG_QUALITY = 92;

export class DocumentPreprocessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentPreprocessingError";
  }
}

export type PreparedDocument = {
  buffer: Buffer;
  mimeType: "application/pdf" | "image/jpeg";
};

export async function preprocessDocument(
  buffer: Buffer,
  kind: DocumentKind,
): Promise<PreparedDocument> {
  if (kind === "pdf") {
    return { buffer, mimeType: "application/pdf" };
  }

  try {
    const preparedBuffer = await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    return { buffer: preparedBuffer, mimeType: "image/jpeg" };
  } catch {
    throw new DocumentPreprocessingError(
      "Không thể đọc hoặc chuẩn bị ảnh. Hãy dùng ảnh PNG/JPEG hợp lệ và thử lại.",
    );
  }
}
