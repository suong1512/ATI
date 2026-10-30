import { getApprovedInvoice, InvoiceStoreError } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ recordId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { recordId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(recordId)) {
    return withLocalFrontendCors(
      request,
      Response.json(
        { ok: false, error: { code: "INVALID_RECORD_ID", message: "Mã hóa đơn không hợp lệ." } },
        { status: 400 },
      ),
    );
  }

  try {
    const data = await getApprovedInvoice(recordId);
    if (!data) {
      return withLocalFrontendCors(
        request,
        Response.json(
          { ok: false, error: { code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hóa đơn đã duyệt." } },
          { status: 404 },
        ),
      );
    }
    return withLocalFrontendCors(request, Response.json({ ok: true, data }));
  } catch (error) {
    console.error("[GET /api/invoices/:recordId]", error);
    const message = error instanceof InvoiceStoreError
      ? "Không thể đọc hóa đơn từ database. Hãy kiểm tra kết nối MariaDB và MongoDB."
      : "Không thể tải hóa đơn.";
    return withLocalFrontendCors(
      request,
      Response.json({ ok: false, error: { code: "DATABASE_UNAVAILABLE", message } }, { status: 503 }),
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
