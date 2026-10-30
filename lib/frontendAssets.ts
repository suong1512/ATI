import { readFile } from "node:fs/promises";
import { join } from "node:path";

const frontendAssets = {
  "upload.html": "text/html; charset=utf-8",
  "upload.css": "text/css; charset=utf-8",
  "upload.js": "text/javascript; charset=utf-8",
  "detail.html": "text/html; charset=utf-8",
  "detail.css": "text/css; charset=utf-8",
  "detail.js": "text/javascript; charset=utf-8",
  "review.html": "text/html; charset=utf-8",
  "review.css": "text/css; charset=utf-8",
  "review.js": "text/javascript; charset=utf-8",
  "history.html": "text/html; charset=utf-8",
  "history.css": "text/css; charset=utf-8",
  "history.js": "text/javascript; charset=utf-8",
} as const;

type FrontendAsset = keyof typeof frontendAssets;

export async function serveFrontendAsset(asset: FrontendAsset) {
  const content = await readFile(join(process.cwd(), "frontend", asset), "utf8");
  return new Response(content, {
    headers: { "content-type": frontendAssets[asset] },
  });
}
