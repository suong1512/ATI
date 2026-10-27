import { clearInvoices, listInvoices } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/invoices — list the invoices stored by the mock database. */
export async function GET(request: Request) {
  const invoices = await listInvoices();
  return withLocalFrontendCors(
    request,
    Response.json({ ok: true, count: invoices.length, data: invoices }),
  );
}

/** DELETE /api/invoices — reset the mock database (useful for demos). */
export async function DELETE(request: Request) {
  const deleted = await clearInvoices();
  return withLocalFrontendCors(request, Response.json({ ok: true, deleted }));
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
