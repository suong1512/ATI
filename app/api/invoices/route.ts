import { clearInvoices, InvoiceStoreError, listInvoices } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/invoices — list approved invoices from MariaDB and MongoDB. */
export async function GET(request: Request) {
  try {
    const invoices = await listInvoices();
    return withLocalFrontendCors(
      request,
      Response.json({ ok: true, count: invoices.length, data: invoices }),
    );
  } catch (error) {
    console.error("[GET /api/invoices]", error);
    const message = error instanceof InvoiceStoreError
      ? "Không thể đọc hóa đơn từ database. Hãy kiểm tra kết nối MariaDB và MongoDB."
      : "Không thể tải danh sách hóa đơn.";
    return withLocalFrontendCors(
      request,
      Response.json({ ok: false, error: { code: "DATABASE_UNAVAILABLE", message } }, { status: 503 }),
    );
  }
}

/** DELETE /api/invoices — remove pending and approved invoices (useful for demos). */
export async function DELETE(request: Request) {
  try {
    const deleted = await clearInvoices();
    return withLocalFrontendCors(request, Response.json({ ok: true, deleted }));
  } catch (error) {
    console.error("[DELETE /api/invoices]", error);
    return withLocalFrontendCors(
      request,
      Response.json(
        {
          ok: false,
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Không thể xoá hóa đơn khỏi database. Hãy kiểm tra kết nối MariaDB và MongoDB.",
          },
        },
        { status: 503 },
      ),
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
