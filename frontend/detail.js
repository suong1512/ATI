      const detailMessage = document.querySelector("#detail-message");
      const detailContent = document.querySelector("#detail-content");
      const downloadButton = document.querySelector("#download-json");
      const standalonePreviewPorts = ["4173", "5173", "5500", "5501"];
      const apiOrigin = standalonePreviewPorts.includes(location.port) || location.protocol === "file:"
        ? `${location.protocol === "https:" ? "https:" : "http:"}//${location.hostname || "localhost"}:3000`
        : location.origin;
      let currentRecord = null;
      const missingValue = "Thiếu giá trị";

      async function readJsonResponse(response, endpoint) {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().includes("json")) {
          throw new Error(
            `${endpoint} trả về HTML thay vì JSON (HTTP ${response.status}). Hãy chạy máy chủ Next.js bằng “npm run dev” và mở giao diện tại cổng 3000.`,
          );
        }

        try {
          return await response.json();
        } catch {
          throw new Error(`${endpoint} trả về JSON không hợp lệ (HTTP ${response.status}).`);
        }
      }

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
          ["Số hóa đơn", "invoiceNumber", invoice.invoiceNumber],
          ["Ký hiệu hóa đơn", "serialNumber", invoice.serialNumber],
          ["Ngày phát hành", "issueDate", invoice.issueDate],
          ["Tên người bán", "sellerName", invoice.sellerName],
          ["Mã số thuế người bán", "sellerTaxId", invoice.sellerTaxId],
          ["Địa chỉ người bán", "sellerAddress", invoice.sellerAddress],
          ["Tên người mua", "buyerName", invoice.buyerName],
          ["Mã số thuế người mua", "buyerTaxId", invoice.buyerTaxId],
          ["Tiền tệ", "currency", invoice.currency],
          ["Cộng tiền hàng", "subtotal", invoice.subtotal],
          ["Thuế suất", "taxRate", invoice.taxRate],
          ["Tiền thuế", "taxAmount", invoice.taxAmount],
          ["Tổng thanh toán", "totalAmount", invoice.totalAmount],
        ];
        const missing = fields
          .filter(([, key, value]) => value === null || value === undefined || value === "" || (key === "currency" && value === 0))
          .map(([label]) => label);

        if (invoice.lineItems === null || invoice.lineItems === undefined) {
          missing.push("Danh sách hàng hóa");
        } else if (invoice.lineItems.length === 0) {
          missing.push("Danh sách hàng hóa trống");
        } else {
          invoice.lineItems.forEach((item, index) => {
            [
              ["Tên hàng hóa", "name", item.name],
              ["Đơn vị", "unit", item.unit],
              ["Số lượng", "quantity", item.quantity],
              ["Đơn giá", "unitPrice", item.unitPrice],
              ["Thành tiền", "lineTotal", item.lineTotal],
            ].forEach(([label, , value]) => {
              if (value === null || value === undefined || value === "") {
                missing.push(`${label} (mặt hàng ${index + 1})`);
              }
            });
          });
        }
        return missing;
      }

      function zeroValuePaths(invoice) {
        const fields = [
          ["Cộng tiền hàng", invoice.subtotal],
          ["Thuế suất", invoice.taxRate],
          ["Tiền thuế", invoice.taxAmount],
          ["Tổng thanh toán", invoice.totalAmount],
        ];
        (invoice.lineItems ?? []).forEach((item, index) => {
          fields.push(
            [`Số lượng (mặt hàng ${index + 1})`, item.quantity],
            [`Đơn giá (mặt hàng ${index + 1})`, item.unitPrice],
            [`Thành tiền (mặt hàng ${index + 1})`, item.lineTotal],
          );
        });
        return fields.filter(([, value]) => value === 0).map(([label]) => label);
      }

      function readableExtractionWarning(warning) {
        const invoiceLabels = {
          invoiceNumber: "Số hóa đơn",
          serialNumber: "Ký hiệu hóa đơn",
          issueDate: "Ngày phát hành",
          sellerName: "Tên người bán",
          sellerTaxId: "Mã số thuế người bán",
          sellerAddress: "Địa chỉ người bán",
          buyerName: "Tên người mua",
          buyerTaxId: "Mã số thuế người mua",
          currency: "Tiền tệ",
          subtotal: "Cộng tiền hàng",
          taxRate: "Thuế suất",
          taxAmount: "Tiền thuế",
          totalAmount: "Tổng thanh toán",
        };
        const itemLabels = {
          name: "Tên hàng hóa",
          unit: "Đơn vị",
          quantity: "Số lượng",
          unitPrice: "Đơn giá",
          lineTotal: "Thành tiền",
        };

        return warning
          .replace(/invoice\.lineItems\[(\d+)\]\.(\w+)/g, (_path, index, key) =>
            `${itemLabels[key] || "Thông tin mặt hàng"} (mặt hàng ${Number(index) + 1})`)
          .replace(/invoice\.(\w+)/g, (_path, key) => invoiceLabels[key] || "Thông tin hóa đơn");
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
        const modelWarnings = (extraction.warnings ?? [])
          .map(readableExtractionWarning)
          .filter((warning) => ![...missingFields, ...zeroFields].some((field) =>
            warning === field || warning.startsWith(`${field}:`) || warning.startsWith(`${field} `)));
        const warningMessages = [
          ...(missingFields.length ? [`Thiếu giá trị: ${missingFields.join(", ")}`] : []),
          ...(zeroFields.length ? [`Giá trị 0 cần đối chiếu: ${zeroFields.join(", ")}`] : []),
          ...modelWarnings,
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

        document.querySelector("#status-badge").textContent = "Đã duyệt";
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
          const endpoint = `${apiOrigin}/api/invoices/${encodeURIComponent(recordId)}`;
          const response = await fetch(endpoint, { cache: "no-store" });
          const payload = await readJsonResponse(response, "/api/invoices/:recordId");
          if (!response.ok || !payload.ok || !payload.data) {
            throw new Error(
              payload.error?.message ||
                `Không tải được hóa đơn (HTTP ${response.status}).`,
            );
          }
          currentRecord = payload.data;
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
