"use client";

import type { ExtractionResult } from "@/lib/invoiceSchema";
import { formatBytes, formatDateTime, formatPercent, formatVnd } from "@/lib/format";

export default function InvoiceResult({ result }: { result: ExtractionResult }) {
  const { invoice, source, extraction } = result;

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${source.fileName.replace(/\.[^.]+$/, "")}.invoice.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>2. Dữ liệu trích xuất (JSON)</h2>
        <button type="button" className="btn-secondary" onClick={downloadJson}>
          Tải file JSON
        </button>
      </div>

      {extraction.warnings.map((warning) => (
        <p className="alert alert-warning" key={warning}>
          ⚠ {warning}
        </p>
      ))}

      <div className="invoice-grid">
        <Field label="Số hóa đơn" value={invoice.invoiceNumber} />
        <Field label="Ký hiệu" value={invoice.serialNumber} />
        <Field label="Ngày phát hành" value={invoice.issueDate} />
        <Field label="Đơn vị bán" value={invoice.sellerName} />
        <Field label="MST người bán" value={invoice.sellerTaxId} />
        <Field label="Địa chỉ" value={invoice.sellerAddress} />
        <Field label="Người mua" value={invoice.buyerName} />
        <Field label="MST người mua" value={invoice.buyerTaxId} />
      </div>

      <table>
        <thead>
          <tr>
            <th>Tên hàng hóa</th>
            <th>ĐVT</th>
            <th className="num">SL</th>
            <th className="num">Đơn giá</th>
            <th className="num">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.unit}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatVnd(item.unitPrice)}</td>
              <td className="num">{formatVnd(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <div>
          <span>Cộng tiền hàng</span>
          <span>{formatVnd(invoice.subtotal)}</span>
        </div>
        <div>
          <span>Thuế GTGT ({formatPercent(invoice.taxRate)})</span>
          <span>{formatVnd(invoice.taxAmount)}</span>
        </div>
        <div className="grand-total">
          <span>Tổng thanh toán</span>
          <span>{formatVnd(invoice.totalAmount)}</span>
        </div>
      </div>

      <div className="file-meta">
        File: {source.fileName} · {source.kind.toUpperCase()} · {formatBytes(source.sizeBytes)} · ~
        {source.estimatedPages} trang · hash {source.contentHash}
        <br />
        Model: {extraction.model} · độ tin cậy {formatPercent(extraction.confidence)} · xử lý{" "}
        {extraction.processingMs}ms · lưu lúc {formatDateTime(result.createdAt)}
      </div>

      <pre className="json">{JSON.stringify(result, null, 2)}</pre>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <dl className="invoice-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}
