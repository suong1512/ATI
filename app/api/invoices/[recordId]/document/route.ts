import { getInvoiceDocument, InvoiceStoreError } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const withCors = (response: Response) => withLocalFrontendCors(_request, response);
  const { recordId } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(recordId)) {
    return withCors(new Response("Invalid invoice record ID.", { status: 400 }));
  }

  try {
    const document = await getInvoiceDocument(recordId);
    if (!document) {
      return withCors(new Response("Original invoice document not found.", { status: 404 }));
    }

    return withCors(
      new Response(new Uint8Array(document.data), {
        headers: {
          "Content-Type": document.mimeType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
    );
  } catch (error) {
    console.error("[GET /api/invoices/:recordId/document]", error);
    const message = error instanceof InvoiceStoreError
      ? "Không thể đọc hóa đơn gốc từ database."
      : "Không thể tải hóa đơn gốc.";
    return withCors(
      Response.json({ ok: false, error: { code: "DATABASE_UNAVAILABLE", message } }, { status: 503 }),
    );
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
