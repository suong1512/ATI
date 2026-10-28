      const detailMessage = document.querySelector("#detail-message");
      const detailContent = document.querySelector("#detail-content");
      const downloadButton = document.querySelector("#download-json");
      const documentPreviewImage = document.querySelector("#document-preview-image");
      const documentPreviewPdf = document.querySelector("#document-preview-pdf");
      const documentPreviewMessage = document.querySelector("#document-preview-message");
      const openOriginalDocument = document.querySelector("#open-original-document");
      let currentRecord = null;
      let documentPreviewUrl = null;
      const missingValue = "Thiếu giá trị";

      function setText(id, value) {
        document.querySelector(`#${id}`).textContent =
          value === null || value === undefined || value === "" ? missingValue : String(value);
      }

      function formatMoney(amount) {
        if (amount === null || amount === undefined) return missingValue;
        return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)} VND`;
      }

      function missingInvoiceFields(invoice) {
        const fields = [
          ["Số hóa đơn", "invoice.invoiceNumber", invoice.invoiceNumber],
          ["Ký hiệu hóa đơn", "invoice.serialNumber", invoice.serialNumber],
          ["Ngày phát hành", "invoice.issueDate", invoice.issueDate],
          ["Tên người bán", "invoice.sellerName", invoice.sellerName],
          ["Mã số thuế người bán", "invoice.sellerTaxId", invoice.sellerTaxId],
          ["Địa chỉ người bán", "invoice.sellerAddress", invoice.sellerAddress],
          ["Tên người mua", "invoice.buyerName", invoice.buyerName],
          ["Mã số thuế người mua", "invoice.buyerTaxId", invoice.buyerTaxId],
          ["Tiền tệ", "invoice.currency", invoice.currency],
          ["Cộng tiền hàng", "invoice.subtotal", invoice.subtotal],
          ["Thuế suất", "invoice.taxRate", invoice.taxRate],
          ["Tiền thuế", "invoice.taxAmount", invoice.taxAmount],
          ["Tổng thanh toán", "invoice.totalAmount", invoice.totalAmount],
        ];
        const missing = fields
          .filter(([, path, value]) => value === null || value === undefined || value === "" || (path === "invoice.currency" && value === 0))
          .map(([label, path]) => `${label} (${path})`);

        if (invoice.lineItems === null || invoice.lineItems === undefined) {
          missing.push("Danh sách hàng hóa (invoice.lineItems)");
        } else if (invoice.lineItems.length === 0) {
          missing.push("Danh sách hàng hóa trống (invoice.lineItems)");
        } else {
          invoice.lineItems.forEach((item, index) => {
            [
              ["Tên hàng hóa", "name", item.name],
              ["Đơn vị", "unit", item.unit],
              ["Số lượng", "quantity", item.quantity],
              ["Đơn giá", "unitPrice", item.unitPrice],
              ["Thành tiền", "lineTotal", item.lineTotal],
            ].forEach(([label, key, value]) => {
              if (value === null || value === undefined || value === "") {
                missing.push(`${label} (invoice.lineItems[${index}].${key})`);
              }
            });
          });
        }
        return missing;
      }

      function zeroValuePaths(invoice) {
        const fields = [
          ["invoice.subtotal", invoice.subtotal],
          ["invoice.taxRate", invoice.taxRate],
          ["invoice.taxAmount", invoice.taxAmount],
          ["invoice.totalAmount", invoice.totalAmount],
        ];
        (invoice.lineItems ?? []).forEach((item, index) => {
          fields.push(
            [`invoice.lineItems[${index}].quantity`, item.quantity],
            [`invoice.lineItems[${index}].unitPrice`, item.unitPrice],
            [`invoice.lineItems[${index}].lineTotal`, item.lineTotal],
          );
        });
        return fields.filter(([, value]) => value === 0).map(([path]) => path);
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
        setText("invoice-date", invoice.issueDate === null || invoice.issueDate === "" ? missingValue : `Ngày phát hành: ${invoice.issueDate}`);
        setText("invoice-total", formatMoney(invoice.totalAmount));
        setText("invoice-tax", invoice.taxRate === null ? missingValue : `Thuế GTGT ${(invoice.taxRate * 100).toFixed(1)}%`);
        setText("invoice-confidence", `${(extraction.confidence * 100).toFixed(1)}%`);
        setText("invoice-model", `${extraction.provider} · ${extraction.model}`);
        setText("seller-name", invoice.sellerName);
        setText("seller-tax", invoice.sellerTaxId);
        setText("seller-address", invoice.sellerAddress);
        setText("buyer-name", invoice.buyerName);
        setText("buyer-tax", invoice.buyerTaxId);
        setText("invoice-serial", invoice.serialNumber);
        setText("source-format", record.source.kind.toUpperCase());
        setText("currency", invoice.currency);
        setText("subtotal", formatMoney(invoice.subtotal));
        setText("tax-rate", invoice.taxRate === null ? missingValue : `(${(invoice.taxRate * 100).toFixed(1)}%)`);
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
        setText("items-count", invoice.lineItems === null
          ? "Thiếu danh sách mặt hàng"
          : `${invoice.lineItems.length} mặt hàng được trích xuất từ hóa đơn`);

        const lineItems = document.querySelector("#line-items");
        lineItems.replaceChildren();
        (invoice.lineItems ?? []).forEach((item, index) => {
          const row = document.createElement("tr");
          [
            String(index + 1),
            item.name || missingValue,
            item.unit || missingValue,
            item.quantity === null ? missingValue : String(item.quantity),
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
        if (!invoice.lineItems?.length) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 6;
          cell.className = "empty-cell";
          cell.textContent = invoice.lineItems === null ? missingValue : "Không có mặt hàng được trích xuất.";
          row.append(cell);
          lineItems.append(row);
        }

        const warnings = document.querySelector("#warnings");
        warnings.replaceChildren();
        const missingFields = missingInvoiceFields(invoice);
        const zeroFields = zeroValuePaths(invoice);
        const warningMessages = [
          ...(missingFields.length ? [`Thiếu giá trị: ${missingFields.join(", ")}`] : []),
          ...(zeroFields.length ? [`Giá trị 0 cần đối chiếu: ${zeroFields.join(", ")}`] : []),
          ...(extraction.warnings ?? []),
        ];
        if (warningMessages.length) {
          const title = document.createElement("strong");
          title.textContent = missingFields.length ? "Giá trị cần đối chiếu" : "Lưu ý từ mô hình";
          const list = document.createElement("ul");
          warningMessages.forEach((warning) => {
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

      async function loadDocumentPreview(record) {
        const documentUrl = `/api/invoices/${encodeURIComponent(record.recordId)}/document`;
        try {
          const response = await fetch(documentUrl, { cache: "no-store" });
          if (!response.ok) {
            const message = response.status === 404
              ? "Không có tài liệu gốc được lưu cho hóa đơn này."
              : "Không thể tải tài liệu gốc. Vui lòng thử tải lại trang.";
            throw new Error(message);
          }

          documentPreviewUrl = URL.createObjectURL(await response.blob());
          openOriginalDocument.href = documentPreviewUrl;
          if (record.source.kind === "pdf") {
            documentPreviewPdf.src = documentPreviewUrl;
            documentPreviewPdf.hidden = false;
          } else {
            documentPreviewImage.src = documentPreviewUrl;
            documentPreviewImage.hidden = false;
            documentPreviewImage.addEventListener("error", () => {
              documentPreviewImage.hidden = true;
              documentPreviewMessage.textContent = "Không thể hiển thị ảnh hóa đơn gốc.";
              documentPreviewMessage.hidden = false;
            }, { once: true });
          }
        } catch (error) {
          documentPreviewMessage.textContent = error.message || "Không thể tải tài liệu gốc.";
          documentPreviewMessage.hidden = false;
          openOriginalDocument.hidden = true;
        }
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
          await loadDocumentPreview(currentRecord);
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

      window.addEventListener("beforeunload", () => {
        if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl);
      });

      loadInvoice();
