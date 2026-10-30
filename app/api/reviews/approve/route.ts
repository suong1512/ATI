import { invoiceSchema } from "@/lib/invoiceSchema";
import { InvoiceStoreError, approveInvoice } from "@/lib/invoiceStore";
import { handleLocalFrontendOptions, withLocalFrontendCors } from "@/lib/localFrontendCors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(request: Request, status: number, code: string, message: string, details: string[] = []) {
  return withLocalFrontendCors(
    request,
    Response.json({ ok: false, error: { code, message, details } }, { status }),
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(request, 400, "INVALID_JSON", "Nội dung yêu cầu phải là JSON hợp lệ.");
  }

  if (!body || typeof body !== "object" || !("recordId" in body) || !("invoice" in body)) {
    return jsonError(request, 400, "INVALID_REQUEST", "Thiếu mã hóa đơn hoặc thông tin hóa đơn.");
  }
  const { recordId, invoice: submittedInvoice } = body;
  if (typeof recordId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(recordId)) {
    return jsonError(request, 400, "INVALID_RECORD_ID", "Mã hóa đơn không hợp lệ.");
  }

  const parsedInvoice = invoiceSchema.safeParse(submittedInvoice);
  if (!parsedInvoice.success) {
    return jsonError(
      request,
      400,
      "INVALID_INVOICE",
      "Thông tin hóa đơn không hợp lệ.",
      parsedInvoice.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  try {
    const result = await approveInvoice(recordId, parsedInvoice.data);
    if (result === "not-found") {
      return jsonError(request, 404, "REVIEW_NOT_FOUND", "Không tìm thấy hóa đơn trong hàng đợi duyệt.");
    }
    if (result === "not-pending") {
      return jsonError(request, 409, "REVIEW_ALREADY_PROCESSED", "Hóa đơn này không còn ở trạng thái chờ duyệt.");
    }
    return withLocalFrontendCors(request, Response.json({ ok: true, recordId, status: "approved" }));
  } catch (error) {
    console.error("[POST /api/reviews/approve]", error);
    const message = error instanceof InvoiceStoreError
      ? "Không thể duyệt và lưu hóa đơn. Hãy kiểm tra kết nối MariaDB và MongoDB."
      : "Không thể duyệt hóa đơn.";
    return jsonError(request, 503, "DATABASE_UNAVAILABLE", message);
  }
}

export async function OPTIONS(request: Request) {
  return handleLocalFrontendOptions(request);
}
