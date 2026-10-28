      const fileInput = document.querySelector("#file-input");
      const dropzone = document.querySelector("#dropzone");
      const selectedFile = document.querySelector("#selected-file");
      const uploadAlert = document.querySelector("#upload-alert");
      const uploadAlertMessage = document.querySelector("#upload-alert-message");
      const queueContent = document.querySelector("#queue-content");
      const queueCount = document.querySelector("#queue-count");
      const invoiceHistory = document.querySelector("#invoice-history");
      const historySearch = document.querySelector("#history-search");
      const historyCount = document.querySelector("#history-count");
      const historyDescription = document.querySelector("#history-description");
      const clearHistoryButton = document.querySelector("#clear-history");
      const extractionResult = document.querySelector("#extraction-result");
      const extractionContent = document.querySelector("#extraction-content");
      const extractionSummary = document.querySelector("#extraction-summary");
      const extractionJson = document.querySelector("#extraction-json");
      const downloadExtractionButton = document.querySelector("#download-extraction-json");
      const invalidCount = document.querySelector("#stat-invalid");
      const navLinks = document.querySelectorAll(".nav-link");
      const historyColumnCount = 7;
      const maxFileSizeMb = 10;
      const maxFileSize = maxFileSizeMb * 1024 * 1024;
      const apiOrigin = location.port === "4173" || location.protocol === "file:"
        ? `${location.protocol === "https:" ? "https:" : "http:"}//${location.hostname || "localhost"}:3000`
        : location.origin;
      let rejectedThisSession = 0;
      let currentRecords = [];
      let currentExtraction = null;

      function updateActiveNav() {
        const target = window.location.hash || "#upload";
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.hash === target);
        });
      }

      navLinks.forEach((link) => {
        link.addEventListener("click", () => {
          navLinks.forEach((navLink) => navLink.classList.remove("active"));
          link.classList.add("active");
        });
      });
      window.addEventListener("hashchange", updateActiveNav);
      updateActiveNav();

      function incrementInvalidCount() {
        rejectedThisSession += 1;
        invalidCount.textContent = rejectedThisSession;
      }

      function renderHistoryMessage(message) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = historyColumnCount;
        cell.textContent = message;
        row.append(cell);
        invoiceHistory.replaceChildren(row);
      }

      function normalizeSearchText(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase("vi");
      }

      function createInvoiceLink(recordId, text, className = "") {
        const link = document.createElement("a");
        link.href = `/detail.html?id=${encodeURIComponent(recordId)}`;
        link.target = "_top";
        link.textContent = text;
        if (className) link.className = className;
        return link;
      }

      document.querySelectorAll("[data-open-picker]").forEach((button) => {
        button.addEventListener("click", () => fileInput.click());
      });

      function showFile(file) {
        if (!file) return;
        const acceptedType = ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
        const acceptedExtension = /\.(pdf|jpe?g|png)$/i.test(file.name);
        const isEmpty = file.size === 0;
        const isTooLarge = file.size > maxFileSize;
        selectedFile.textContent = "";
        selectedFile.classList.remove("file-error");
        extractionResult.hidden = true;
        if ((!acceptedType && !acceptedExtension) || isEmpty || isTooLarge) {
          incrementInvalidCount();
          uploadAlertMessage.textContent = isTooLarge
            ? `Tệp "${file.name}" vượt quá giới hạn ${maxFileSizeMb}MB. Vui lòng chọn tệp nhỏ hơn.`
            : isEmpty
              ? `Tệp "${file.name}" bị rỗng. Vui lòng chọn một tệp khác.`
            : `Tệp "${file.name}" không hợp lệ. Vui lòng chọn PDF, JPG hoặc PNG.`;
          uploadAlert.hidden = false;
          fileInput.value = "";
          return;
        }
        uploadAlert.hidden = true;
        selectedFile.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        uploadFile(file);
      }

      function formatMoney(amount) {
        if (amount === null || amount === undefined) return "Thiếu giá trị";
        return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
      }

      function renderExtraction(record) {
        currentExtraction = record;
        const invoice = record.invoice;
        const fields = [
          ["Số hóa đơn", invoice.invoiceNumber],
          ["Ký hiệu", invoice.serialNumber],
          ["Ngày phát hành", invoice.issueDate],
          ["Tên người bán", invoice.sellerName],
          ["Mã số thuế người bán", invoice.sellerTaxId],
          ["Địa chỉ người bán", invoice.sellerAddress],
          ["Tên người mua", invoice.buyerName],
          ["Mã số thuế người mua", invoice.buyerTaxId],
          ["Tiền tệ", invoice.currency],
        ];
        const fieldGrid = document.createElement("div");
        fieldGrid.className = "extraction-fields";
        fields.forEach(([label, value]) => {
          const field = document.createElement("div");
          field.className = "extraction-field";
          const heading = document.createElement("span");
          heading.textContent = label;
          const content = document.createElement("strong");
          content.textContent = value === null || value === undefined || value === "" ? "Thiếu giá trị" : String(value);
          field.append(heading, content);
          fieldGrid.append(field);
        });

        const itemSection = document.createElement("section");
        itemSection.className = "extraction-items";
        const itemHeading = document.createElement("h3");
        itemHeading.textContent = "Hàng hóa / dịch vụ";
        const tableScroll = document.createElement("div");
        tableScroll.className = "table-scroll";
        const table = document.createElement("table");
        const header = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Tên hàng hóa", "ĐVT", "Số lượng", "Đơn giá", "Thành tiền"].forEach((label) => {
          const cell = document.createElement("th");
          cell.textContent = label;
          headerRow.append(cell);
        });
        header.append(headerRow);
        const body = document.createElement("tbody");
        (invoice.lineItems ?? []).forEach((item) => {
          const row = document.createElement("tr");
          [
            item.name || "Thiếu giá trị",
            item.unit || "Thiếu giá trị",
            item.quantity ?? "Thiếu giá trị",
            formatMoney(item.unitPrice),
            formatMoney(item.lineTotal),
          ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
          });
          body.append(row);
        });
        if (!invoice.lineItems?.length) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 5;
          cell.textContent = invoice.lineItems === null ? "Thiếu danh sách mặt hàng" : "Không có mặt hàng được trích xuất.";
          row.append(cell);
          body.append(row);
        }
        table.append(header, body);
        tableScroll.append(table);
        itemSection.append(itemHeading, tableScroll);

        const totals = document.createElement("div");
        totals.className = "extraction-totals";
        [
          ["Cộng tiền hàng", formatMoney(invoice.subtotal)],
          [`Thuế GTGT (${invoice.taxRate === null ? "Thiếu giá trị" : `${(invoice.taxRate * 100).toFixed(1)}%`})`, formatMoney(invoice.taxAmount)],
          ["Tổng thanh toán", formatMoney(invoice.totalAmount)],
        ].forEach(([label, value], index) => {
          const row = document.createElement("div");
          if (index === 2) row.className = "extraction-grand-total";
          const name = document.createElement("span");
          name.textContent = label;
          const amount = document.createElement("strong");
          amount.textContent = `${value} VND`;
          row.append(name, amount);
          totals.append(row);
        });

        extractionContent.replaceChildren(fieldGrid, itemSection, totals);
        if (record.extraction.warnings?.length) {
          const warnings = document.createElement("p");
          warnings.className = "extraction-warning";
          warnings.textContent = record.extraction.warnings.join(" ");
          extractionContent.append(warnings);
        }
        extractionSummary.textContent = `${record.source.fileName} · ${record.extraction.model} · độ tin cậy ${(record.extraction.confidence * 100).toFixed(1)}%`;
        extractionJson.textContent = JSON.stringify(record, null, 2);
        extractionResult.hidden = false;
      }

      downloadExtractionButton.addEventListener("click", () => {
        if (!currentExtraction) return;
        const blob = new Blob([JSON.stringify(currentExtraction, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${currentExtraction.source.fileName.replace(/\.[^.]+$/, "")}.invoice.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      });

      function setQueue(fileName = "") {
        const active = Boolean(fileName);
        queueCount.textContent = `${active ? 1 : 0} tệp đang xử lý`;
        queueContent.replaceChildren();
        const message = document.createElement("p");
        message.className = active ? "queue-empty queue-active" : "queue-empty";
        message.textContent = active ? `Đang tải và trích xuất: ${fileName}` : "Chưa có tài liệu đang xử lý.";
        queueContent.append(message);
        document.querySelector("#stat-pending").textContent = active ? "1" : "0";
      }

      function renderInvoices(records) {
        currentRecords = records;
        historySearch.disabled = false;
        const dateKey = (date) =>
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const today = dateKey(new Date());
        const todayCount = records.filter((record) => {
          const created = new Date(record.createdAt);
          return !Number.isNaN(created.getTime()) && dateKey(created) === today;
        }).length;
        const confidenceValues = records
          .map((record) => record.extraction?.confidence)
          .filter((confidence) => Number.isFinite(confidence));

        document.querySelector("#stat-today").textContent = todayCount;
        document.querySelector("#stat-confidence").textContent = confidenceValues.length
          ? `${(confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length * 100).toFixed(1)}%`
          : "—";
        document.querySelector("#confidence-caption").textContent = confidenceValues.length ? "trung bình" : "";
        clearHistoryButton.disabled = records.length === 0;
        const query = normalizeSearchText(historySearch.value.trim());
        const visibleRecords = query
          ? records.filter((record) => normalizeSearchText([
            record.source?.fileName,
            record.invoice?.invoiceNumber,
            record.invoice?.serialNumber,
            record.invoice?.sellerName,
            record.invoice?.buyerName,
            record.invoice?.sellerTaxId,
            record.invoice?.buyerTaxId,
          ].join(" ")).includes(query))
          : records;
        historyCount.textContent = query
          ? `${visibleRecords.length} / ${records.length} hóa đơn`
          : `${records.length} hóa đơn`;
        historyDescription.textContent = query
          ? `Kết quả tìm kiếm cho “${historySearch.value.trim()}”.`
          : "Lịch sử lưu cục bộ, tối đa 50 bản ghi gần nhất.";
        invoiceHistory.replaceChildren();

        if (!records.length) {
          renderHistoryMessage("Chưa có hóa đơn nào được lưu.");
          return;
        }
        if (!visibleRecords.length) {
          renderHistoryMessage("Không tìm thấy hóa đơn phù hợp.");
          return;
        }

        visibleRecords.forEach((record) => {
          const row = document.createElement("tr");
          const values = [
            record.source?.fileName || "",
            (record.source?.kind || "").toUpperCase(),
            record.invoice?.sellerName || "",
            formatMoney(record.invoice?.totalAmount || 0),
            Number.isFinite(record.extraction?.confidence) ? `${(record.extraction.confidence * 100).toFixed(1)}%` : "",
            "Đã trích xuất",
          ];
          values.forEach((value, index) => {
            const cell = document.createElement("td");
            if (index === 0) {
              const name = document.createElement("span");
              name.className = "document-name";
              const link = createInvoiceLink(record.recordId, value);
              link.title = "Xem chi tiết hóa đơn";
              name.append(link);
              cell.append(name);
            } else {
              cell.textContent = value;
            }
            if (index === 3) cell.className = "amount";
            if (index === 4) {
              const confidence = record.extraction?.confidence;
              cell.className = `confidence ${Number.isFinite(confidence) && confidence >= 0.9 ? "high" : "medium"}`;
            }
            if (index === 5) {
              const status = document.createElement("span");
              status.className = "table-status success";
              status.textContent = value;
              cell.replaceChildren(status);
            }
            row.append(cell);
          });
          const detailCell = document.createElement("td");
          detailCell.append(createInvoiceLink(record.recordId, "Xem chi tiết", "detail-link"));
          row.append(detailCell);
          invoiceHistory.append(row);
        });
      }

      async function loadInvoices() {
        const response = await fetch(`${apiOrigin}/api/invoices`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Máy chủ trả về lỗi ${response.status}.`);
        const result = await response.json();
        if (!result.ok || !Array.isArray(result.data)) throw new Error("Dữ liệu hóa đơn từ máy chủ không hợp lệ.");
        renderInvoices(result.data);
      }

      async function uploadFile(file) {
        setQueue(file.name);
        try {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch(`${apiOrigin}/api/extract`, { method: "POST", body: formData });
          const result = await response.json();
          if (!response.ok || !result.ok || !result.data) {
            throw new Error(result.error?.message || `Máy chủ trả về lỗi ${response.status}.`);
          }
          renderExtraction(result.data);
          uploadAlert.hidden = true;
          selectedFile.textContent = `${file.name} · Đã trích xuất và lưu`;
          try {
            await loadInvoices();
          } catch (error) {
            uploadAlertMessage.textContent = `Đã trích xuất và lưu, nhưng không làm mới được lịch sử: ${error.message}`;
            uploadAlert.hidden = false;
          }
        } catch (error) {
          incrementInvalidCount();
          selectedFile.textContent = `Không thể tải hoặc trích xuất tệp: ${error.message}`;
          selectedFile.classList.add("file-error");
          uploadAlertMessage.textContent = error.message;
          uploadAlert.hidden = false;
        } finally {
          setQueue();
          fileInput.value = "";
        }
      }

      fileInput.addEventListener("change", () => showFile(fileInput.files[0]));
      dropzone.addEventListener("click", (event) => {
        if (event.target !== fileInput && !event.target.closest("button")) fileInput.click();
      });
      historySearch.addEventListener("input", () => renderInvoices(currentRecords));
      ["dragenter", "dragover"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          dropzone.classList.add("is-dragging");
        });
      });
      ["dragleave", "drop"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          dropzone.classList.remove("is-dragging");
        });
      });
      dropzone.addEventListener("drop", (event) => showFile(event.dataTransfer.files[0]));
      uploadAlert.querySelector(".dismiss-button").addEventListener("click", () => {
        uploadAlert.hidden = true;
      });
      document.querySelector("#refresh-button").addEventListener("click", async () => {
        try {
          await loadInvoices();
          uploadAlert.hidden = true;
        } catch (error) {
          uploadAlertMessage.textContent = `Không thể làm mới lịch sử: ${error.message}`;
          uploadAlert.hidden = false;
        }
      });

      clearHistoryButton.addEventListener("click", async () => {
        if (!currentRecords.length || !window.confirm("Xóa toàn bộ hóa đơn đã lưu? Thao tác này không thể hoàn tác.")) {
          return;
        }
        clearHistoryButton.disabled = true;
        try {
          const response = await fetch(`${apiOrigin}/api/invoices`, { method: "DELETE" });
          const result = await response.json();
          if (!response.ok || !result.ok) {
            throw new Error(result.error?.message || `Máy chủ trả về lỗi ${response.status}.`);
          }
          extractionResult.hidden = true;
          currentExtraction = null;
          extractionJson.textContent = "";
          selectedFile.textContent = "";
          historySearch.value = "";
          uploadAlert.hidden = true;
          await loadInvoices();
        } catch (error) {
          uploadAlertMessage.textContent = `Không thể xóa lịch sử: ${error.message}`;
          uploadAlert.hidden = false;
        } finally {
          clearHistoryButton.disabled = currentRecords.length === 0;
        }
      });

      loadInvoices().catch((error) => {
        renderHistoryMessage(
          `Không thể kết nối máy chủ: ${error.message}. Hãy nhấn Làm mới ở phần lịch sử để thử lại.`,
        );
      });
