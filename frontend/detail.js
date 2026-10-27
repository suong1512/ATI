      const detailMessage = document.querySelector("#detail-message");
      const detailContent = document.querySelector("#detail-content");
      const downloadButton = document.querySelector("#download-json");
      let currentRecord = null;

      function setText(id, value) {
        document.querySelector(`#${id}`).textContent = value || "—";
      }

      function formatMoney(amount) {
        return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} VND`;
      }

      function showError(message) {
        detailMessage.textContent = message;
        detailMessage.hidden = false;
        detailContent.hidden = true;
        document.querySelector("#status-badge").textContent = "Không có dữ liệu";
        document.querySelector("#status-badge").classList.add("status-error");
      }

      function renderInvoice(record) {
        const invoice = record.invoice;
        const extraction = record.extraction;
        setText("document-name", record.source.fileName);
        setText("invoice-number", invoice.invoiceNumber);
        setText("invoice-date", `Ngày phát hành: ${invoice.issueDate}`);
        setText("invoice-total", formatMoney(invoice.totalAmount));
        setText("invoice-tax", `Thuế GTGT ${(invoice.taxRate * 100).toFixed(1)}%`);
        setText("invoice-confidence", `${(extraction.confidence * 100).toFixed(1)}%`);
        setText("invoice-model", `${extraction.provider} · ${extraction.model}`);
        setText("seller-name", invoice.sellerName);
        setText("seller-tax", invoice.sellerTaxId);
        setText("seller-address", invoice.sellerAddress);
        setText("buyer-name", invoice.buyerName);
        setText("buyer-tax", invoice.buyerTaxId);
        setText("invoice-serial", invoice.serialNumber);
        setText("source-format", record.source.kind.toUpperCase());
        setText("subtotal", formatMoney(invoice.subtotal));
        setText("tax-rate", `(${(invoice.taxRate * 100).toFixed(1)}%)`);
        setText("tax-amount", formatMoney(invoice.taxAmount));
        setText("total-amount", formatMoney(invoice.totalAmount));
        setText("source-file", record.source.fileName);
        setText(
          "source-type",
          `${record.source.mimeType} · ${Math.ceil(record.source.sizeBytes / 1024)} KB`,
        );
        setText("processing-time", `${extraction.processingMs} ms`);
        setText(
          "created-at",
          new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(record.createdAt)),
        );
        setText("items-count", `${invoice.lineItems.length} mặt hàng được trích xuất từ hóa đơn`);

        const lineItems = document.querySelector("#line-items");
        lineItems.replaceChildren();
        invoice.lineItems.forEach((item, index) => {
          const row = document.createElement("tr");
          [
            String(index + 1),
            item.name,
            item.unit,
            String(item.quantity),
            formatMoney(item.unitPrice),
            formatMoney(item.lineTotal),
          ].forEach((value, cellIndex) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (cellIndex >= 3) cell.className = "numeric";
            row.append(cell);
          });
          lineItems.append(row);
        });

        const warnings = document.querySelector("#warnings");
        warnings.replaceChildren();
        if (extraction.warnings.length) {
          const title = document.createElement("strong");
          title.textContent = "Lưu ý từ mô hình";
          const list = document.createElement("ul");
          extraction.warnings.forEach((warning) => {
            const item = document.createElement("li");
            item.textContent = warning;
            list.append(item);
          });
          warnings.append(title, list);
          warnings.hidden = false;
        } else {
          warnings.hidden = true;
        }

        document.querySelector("#status-badge").textContent = "Đã trích xuất";
        detailMessage.hidden = true;
        detailContent.hidden = false;
        downloadButton.disabled = false;
        document.title = `${invoice.invoiceNumber} — Chi tiết hóa đơn | Smart Document Processing`;
      }

      async function loadInvoice() {
        const recordId = new URLSearchParams(window.location.search).get("id");
        if (!recordId) {
          showError("Thiếu mã hóa đơn. Hãy quay lại danh sách và chọn hóa đơn cần xem.");
          return;
        }

        try {
          const response = await fetch("/api/invoices", { cache: "no-store" });
          const payload = await response.json();
          if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
            throw new Error(
              payload.error?.message ||
                `Không tải được danh sách hóa đơn (HTTP ${response.status}).`,
            );
          }
          currentRecord = payload.data.find((record) => record.recordId === recordId);
          if (!currentRecord) {
            showError("Không tìm thấy hóa đơn này. Có thể hóa đơn đã bị xóa khỏi danh sách.");
            return;
          }
          renderInvoice(currentRecord);
        } catch (error) {
          showError(`Không thể tải chi tiết hóa đơn: ${error.message}`);
        }
      }

      downloadButton.addEventListener("click", () => {
        if (!currentRecord) return;
        const blob = new Blob([JSON.stringify(currentRecord, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${currentRecord.source.fileName.replace(/\.[^.]+$/, "")}.invoice.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      });

      loadInvoice();
