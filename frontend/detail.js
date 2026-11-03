      const detailMessage = document.querySelector("#detail-message");
      const detailContent = document.querySelector("#detail-content");
      const downloadButton = document.querySelector("#download-report");
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

      function wrapCanvasText(context, value, maxWidth) {
        const words = String(value).split(/\s+/);
        const lines = [];
        let line = "";

        words.forEach((word) => {
          const candidate = line ? `${line} ${word}` : word;
          if (context.measureText(candidate).width <= maxWidth || !line) {
            line = candidate;
          } else {
            lines.push(line);
            line = word;
          }
        });

        if (line) lines.push(line);
        return lines.length ? lines : [""];
      }

      function drawReportText(context, value, x, y, maxWidth, options = {}) {
        const {
          color = "#172033",
          font = "16px Arial, 'Segoe UI', sans-serif",
          lineHeight = 24,
          maxLines = Infinity,
        } = options;
        context.font = font;
        context.fillStyle = color;
        const lines = wrapCanvasText(context, value, maxWidth).slice(0, maxLines);
        lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
        return lines.length;
      }

      function drawReportPanel(context, x, y, width, height, fill = "#ffffff") {
        context.fillStyle = fill;
        context.fillRect(x, y, width, height);
        context.strokeStyle = "#e2e7f0";
        context.lineWidth = 1;
        context.strokeRect(x, y, width, height);
      }

      function reportValue(value) {
        return value === null || value === undefined || value === "" ? missingValue : String(value);
      }

      function createReportImage(record) {
        const invoice = record.invoice;
        const extraction = record.extraction;
        const width = 1280;
        const margin = 64;
        const contentWidth = width - margin * 2;
        const summaryGap = 16;
        const summaryWidth = (contentWidth - summaryGap * 2) / 3;
        const partyGap = 20;
        const partyWidth = (contentWidth - partyGap) / 2;
        const itemColumns = [52, 410, 120, 150, 200, 220];
        const lineItems = invoice.lineItems?.length ? invoice.lineItems : [{
          name: invoice.lineItems === null ? missingValue : "Không có mặt hàng được trích xuất.",
          unit: "",
          quantity: null,
          unitPrice: null,
          lineTotal: null,
        }];
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Trình duyệt không hỗ trợ tạo ảnh báo cáo.");

        context.font = "15px Arial, 'Segoe UI', sans-serif";
        const itemRows = lineItems.map((item, index) => {
          const cells = [
            String(index + 1),
            reportValue(item.name),
            reportValue(item.unit),
            item.quantity === null || item.quantity === undefined ? missingValue : String(item.quantity),
            formatMoney(item.unitPrice),
            formatMoney(item.lineTotal),
          ];
          const lineCount = Math.max(...cells.map((cell, cellIndex) =>
            wrapCanvasText(context, cell, itemColumns[cellIndex] - 20).length));
          return { cells, height: Math.max(48, lineCount * 22 + 20) };
        });

        const partyFields = [
          [
            ["Tên đơn vị", reportValue(invoice.sellerName)],
            ["Mã số thuế", reportValue(invoice.sellerTaxId)],
            ["Địa chỉ", reportValue(invoice.sellerAddress)],
          ],
          [
            ["Tên đơn vị", reportValue(invoice.buyerName)],
            ["Mã số thuế", reportValue(invoice.buyerTaxId)],
            ["Ký hiệu hóa đơn", reportValue(invoice.serialNumber)],
          ],
        ];
        context.font = "15px Arial, 'Segoe UI', sans-serif";
        const partyHeights = partyFields.map((fields) =>
          58 + fields.reduce((height, [, value]) =>
            height + Math.max(1, wrapCanvasText(context, value, partyWidth - 40).length) * 22 + 10, 0));
        const partyHeight = Math.max(...partyHeights);
        const tableHeight = 52 + 42 + itemRows.reduce((height, row) => height + row.height, 0) + 20;
        const metadataHeight = 142;
        const totalHeight = 52 + 64 + 24 + 116 + 24 + partyHeight + 24 + tableHeight + 24 + 182 + 24 + metadataHeight + 48;
        canvas.width = width;
        canvas.height = totalHeight;

        context.fillStyle = "#f5f7fc";
        context.fillRect(0, 0, width, totalHeight);
        drawReportText(context, "BÁO CÁO HÓA ĐƠN", margin, 68, contentWidth, {
          font: "bold 30px Arial, 'Segoe UI', sans-serif",
        });
        drawReportText(
          context,
          `Số hóa đơn: ${reportValue(invoice.invoiceNumber)}   ·   Ngày phát hành: ${reportValue(invoice.issueDate)}`,
          margin,
          98,
          contentWidth - 180,
          { color: "#68758d", font: "16px Arial, 'Segoe UI', sans-serif" },
        );
        drawReportText(context, "ĐÃ DUYỆT", width - margin - 150, 68, 150, {
          color: "#07875e",
          font: "bold 15px Arial, 'Segoe UI', sans-serif",
        });

        let y = 116;
        const summaryCards = [
          ["SỐ HÓA ĐƠN", reportValue(invoice.invoiceNumber), reportValue(invoice.issueDate)],
          ["TỔNG THANH TOÁN", formatMoney(invoice.totalAmount), invoice.taxRate === null ? missingValue : `Thuế GTGT ${(invoice.taxRate * 100).toFixed(1)}%`],
          ["ĐỘ TIN CẬY TRÍCH XUẤT", `${(extraction.confidence * 100).toFixed(1)}%`, `${extraction.provider} · ${extraction.model}`],
        ];
        summaryCards.forEach(([label, value, note], index) => {
          const x = margin + index * (summaryWidth + summaryGap);
          drawReportPanel(context, x, y, summaryWidth, 116);
          drawReportText(context, label, x + 18, y + 28, summaryWidth - 36, {
            color: "#68758d",
            font: "bold 12px Arial, 'Segoe UI', sans-serif",
          });
          drawReportText(context, value, x + 18, y + 62, summaryWidth - 36, {
            font: "bold 20px Arial, 'Segoe UI', sans-serif",
            maxLines: 2,
          });
          drawReportText(context, note, x + 18, y + 94, summaryWidth - 36, {
            color: "#68758d",
            font: "14px Arial, 'Segoe UI', sans-serif",
            maxLines: 1,
          });
        });
        y += 140;

        partyFields.forEach((fields, index) => {
          const x = margin + index * (partyWidth + partyGap);
          drawReportPanel(context, x, y, partyWidth, partyHeight);
          drawReportText(context, index === 0 ? "THÔNG TIN NGƯỜI BÁN" : "THÔNG TIN NGƯỜI MUA", x + 20, y + 30, partyWidth - 40, {
            font: "bold 16px Arial, 'Segoe UI', sans-serif",
          });
          let fieldY = y + 62;
          fields.forEach(([label, value]) => {
            drawReportText(context, label, x + 20, fieldY, partyWidth - 40, {
              color: "#68758d",
              font: "12px Arial, 'Segoe UI', sans-serif",
            });
            fieldY += 19;
            const lines = drawReportText(context, value, x + 20, fieldY, partyWidth - 40, {
              font: "15px Arial, 'Segoe UI', sans-serif",
            });
            fieldY += lines * 22 + 10;
          });
        });
        y += partyHeight + 24;

        drawReportPanel(context, margin, y, contentWidth, tableHeight);
        drawReportText(context, "HÀNG HÓA VÀ DỊCH VỤ", margin + 18, y + 30, contentWidth - 36, {
          font: "bold 17px Arial, 'Segoe UI', sans-serif",
        });
        drawReportText(context, `${invoice.lineItems?.length ?? 0} mặt hàng · ${record.source.kind.toUpperCase()}`, margin + 18, y + 51, contentWidth - 36, {
          color: "#68758d",
          font: "13px Arial, 'Segoe UI', sans-serif",
        });
        y += 64;
        context.fillStyle = "#f5f7fc";
        context.fillRect(margin, y, contentWidth, 42);
        const tableHeaders = ["#", "TÊN HÀNG HÓA / DỊCH VỤ", "ĐƠN VỊ", "SỐ LƯỢNG", "ĐƠN GIÁ", "THÀNH TIỀN"];
        let columnX = margin;
        tableHeaders.forEach((header, index) => {
          drawReportText(context, header, columnX + 10, y + 26, itemColumns[index] - 20, {
            color: "#68758d",
            font: "bold 11px Arial, 'Segoe UI', sans-serif",
            maxLines: 1,
          });
          columnX += itemColumns[index];
        });
        y += 42;
        itemRows.forEach((row) => {
          context.strokeStyle = "#e2e7f0";
          context.beginPath();
          context.moveTo(margin, y + row.height);
          context.lineTo(width - margin, y + row.height);
          context.stroke();
          let x = margin;
          row.cells.forEach((cell, index) => {
            drawReportText(context, cell, x + 10, y + 25, itemColumns[index] - 20, {
              font: "14px Arial, 'Segoe UI', sans-serif",
              lineHeight: 20,
            });
            x += itemColumns[index];
          });
          y += row.height;
        });
        y += 20;

        drawReportPanel(context, margin, y, contentWidth, 182);
        const totals = [
          ["Tiền tệ", reportValue(invoice.currency)],
          ["Cộng tiền hàng", formatMoney(invoice.subtotal)],
          [`Thuế GTGT ${invoice.taxRate === null ? "" : `(${(invoice.taxRate * 100).toFixed(1)}%)`}`, formatMoney(invoice.taxAmount)],
          ["TỔNG THANH TOÁN", formatMoney(invoice.totalAmount)],
        ];
        totals.forEach(([label, value], index) => {
          const rowY = y + 32 + index * 36;
          drawReportText(context, label, width - margin - 420, rowY, 220, {
            color: index === 3 ? "#172033" : "#68758d",
            font: index === 3 ? "bold 16px Arial, 'Segoe UI', sans-serif" : "14px Arial, 'Segoe UI', sans-serif",
          });
          drawReportText(context, value, width - margin - 190, rowY, 170, {
            font: index === 3 ? "bold 17px Arial, 'Segoe UI', sans-serif" : "bold 14px Arial, 'Segoe UI', sans-serif",
          });
        });
        y += 206;

        drawReportPanel(context, margin, y, contentWidth, metadataHeight);
        drawReportText(context, "THÔNG TIN XỬ LÝ", margin + 18, y + 30, contentWidth - 36, {
          font: "bold 16px Arial, 'Segoe UI', sans-serif",
        });
        const metadata = [
          `Tệp gốc: ${record.source.fileName} · ${record.source.mimeType} · ${Math.ceil(record.source.sizeBytes / 1024)} KB`,
          `Mô hình: ${extraction.provider} · ${extraction.model} · ${extraction.processingMs} ms`,
          `Thời điểm trích xuất: ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.createdAt))}`,
        ];
        metadata.forEach((value, index) => drawReportText(context, value, margin + 18, y + 58 + index * 23, contentWidth - 36, {
          color: "#68758d",
          font: "13px Arial, 'Segoe UI', sans-serif",
          maxLines: 1,
        }));

        return new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Không thể tạo ảnh PNG cho báo cáo."));
          }, "image/png");
        });
      }

      downloadButton.addEventListener("click", async () => {
        if (!currentRecord) return;

        downloadButton.disabled = true;
        downloadButton.textContent = "Đang tải...";
        detailMessage.hidden = true;
        try {
          const blob = await createReportImage(currentRecord);
          const fileName = currentRecord.source.fileName
            .split(/[\\/]/)
            .pop()
            .replace(/\.[^.]+$/, "")
            .replace(/[<>:"|?*\u0000-\u001f]/g, "_") || "bao-cao";
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${fileName}.report.png`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
          detailMessage.textContent = `Không thể tải báo cáo: ${error.message || "Đã xảy ra lỗi."}`;
          detailMessage.hidden = false;
        } finally {
          downloadButton.disabled = false;
          downloadButton.textContent = "Tải báo cáo";
        }
      });

      loadInvoice();
