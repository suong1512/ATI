import { InvoiceStoreError, listPendingReviews } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const data = await listPendingReviews();
    return withLocalFrontendCors(request, Response.json({ ok: true, count: data.length, data }));
  } catch (error) {
    console.error("[GET /api/reviews]", error);
    const message = error instanceof InvoiceStoreError
      ? "Không thể đọc hàng đợi duyệt từ database. Hãy kiểm tra kết nối MariaDB và MongoDB."
      : "Không thể tải hàng đợi duyệt.";
    return withLocalFrontendCors(
      request,
      Response.json(
        { ok: false, error: { code: "DATABASE_UNAVAILABLE", message } },
        { status: 503 },
      ),
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
