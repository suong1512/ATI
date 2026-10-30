import { serveFrontendAsset } from "@/lib/frontendAssets";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return serveFrontendAsset("history.css");
}
