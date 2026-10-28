"use client";

import type { ExtractionResult } from "@/lib/invoiceSchema";
import { formatDateTime, formatVnd } from "@/lib/format";

type InvoiceHistoryProps = {
  invoices: ExtractionResult[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
};

export default function InvoiceHistory({ invoices, loading, onRefresh, onClear }: InvoiceHistoryProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>3. Hóa đơn đã lưu (MariaDB + MongoDB)</h2>
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
          <button type="button" className="btn-secondary" onClick={onClear} disabled={loading || invoices.length === 0}>
            Xoá tất cả
          </button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="empty">Chưa có hóa đơn nào. Hãy upload file ở khung số 1.</p>
      ) : (
        <ul className="history-list">
          {invoices.map((item) => (
            <li key={item.recordId}>
              <div>
                <strong>{item.invoice.invoiceNumber}</strong> — {item.invoice.sellerName}
                <div className="history-meta">
                  {item.source.fileName} · {item.source.kind.toUpperCase()} · {formatDateTime(item.createdAt)}
                </div>
              </div>
              <div>
                <strong>{formatVnd(item.invoice.totalAmount)}</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
