(() => {
  const reviewSelect = document.querySelector("#review-select");
  const queueCount = document.querySelector("#queue-count");
  const workspace = document.querySelector("#review-workspace");
  const emptyState = document.querySelector("#empty-state");
  const message = document.querySelector("#review-message");
  const formError = document.querySelector("#form-error");
  const form = document.querySelector("#invoice-form");
  const approveButton = document.querySelector("#approve-button");
  const image = document.querySelector("#document-image");
  const pdf = document.querySelector("#document-pdf");
  const openDocument = document.querySelector("#open-document");
  const previewMessage = document.querySelector("#preview-message");
  const invoiceFields = document.querySelector("#invoice-fields");
  const totalFields = document.querySelector("#total-fields");
  const lineItems = document.querySelector("#line-items");
  const addLineItem = document.querySelector("#add-line-item");
  const standalonePreviewPorts = ["4173", "5173", "5500", "5501"];
  const apiOrigin = standalonePreviewPorts.includes(location.port) || location.protocol === "file:"
    ? `${location.protocol === "https:" ? "https:" : "http:"}//${location.hostname || "localhost"}:3000`
    : location.origin;
  const textFields = [
    ["invoiceNumber", "Số hóa đơn"],
    ["serialNumber", "Ký hiệu hóa đơn"],
    ["issueDate", "Ngày phát hành"],
    ["sellerName", "Tên người bán"],
    ["sellerTaxId", "Mã số thuế người bán"],
    ["sellerAddress", "Địa chỉ người bán"],
    ["buyerName", "Tên người mua"],
    ["buyerTaxId", "Mã số thuế người mua"],
    ["currency", "Tiền tệ"],
  ];
  const numericFields = [
    ["subtotal", "Cộng tiền hàng"],
    ["taxRate", "Thuế suất (vd: 0.1 = 10%)"],
    ["taxAmount", "Tiền thuế"],
    ["totalAmount", "Tổng thanh toán"],
  ];
  const itemFields = [
    ["name", "Tên hàng hóa / dịch vụ", "text"],
    ["unit", "ĐVT", "text"],
    ["quantity", "Số lượng", "number"],
    ["unitPrice", "Đơn giá", "number"],
    ["lineTotal", "Thành tiền", "number"],
  ];
  let records = [];
  let currentRecord = null;
  let previewUrl = null;
  let documentLoaded = false;

  async function readJsonResponse(response, endpoint) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("json")) {
      throw new Error(
        `${endpoint} trả về HTML thay vì JSON (HTTP ${response.status}). Hãy chạy “npm run dev” và mở giao diện tại cổng 3000.`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${endpoint} trả về JSON không hợp lệ (HTTP ${response.status}).`);
    }
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function addField(container, key, label, value, type = "text") {
    const wrapper = document.createElement("div");
    wrapper.className = "field-control";
    const inputId = `invoice-${key}`;
    const labelElement = document.createElement("label");
    labelElement.htmlFor = inputId;
    labelElement.textContent = label;
    const input = document.createElement("input");
    input.id = inputId;
    input.name = key;
    input.type = type;
    input.value = value === null || value === undefined ? "" : String(value);
    if (type === "number") input.step = "any";
    wrapper.append(labelElement, input);
    container.append(wrapper);
  }

  function addItemRow(item = {}) {
    const row = document.createElement("tr");
    itemFields.forEach(([key, label, type]) => {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = type;
      input.step = "any";
      input.dataset.itemField = key;
      input.setAttribute("aria-label", label);
      input.value = item[key] === null || item[key] === undefined ? "" : String(item[key]);
      cell.append(input);
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "remove-line";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Xóa dòng hàng hóa");
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => row.remove());
    actionCell.append(removeButton);
    row.append(actionCell);
    lineItems.append(row);
  }

  function renderInvoice(record) {
    currentRecord = record;
    const invoice = record.invoice;
    invoiceFields.replaceChildren();
    totalFields.replaceChildren();
    lineItems.replaceChildren();
    textFields.forEach(([key, label]) => addField(invoiceFields, key, label, invoice[key]));
    numericFields.forEach(([key, label]) => addField(totalFields, key, label, invoice[key], "number"));
    (invoice.lineItems ?? []).forEach(addItemRow);
    if (!invoice.lineItems?.length) addItemRow();
    document.querySelector("#document-name").textContent = record.source.fileName;
    document.querySelector("#extraction-summary").textContent =
      `${record.extraction.provider} · ${record.extraction.model} · độ tin cậy ${(record.extraction.confidence * 100).toFixed(1)}%`;
    formError.hidden = true;
    workspace.hidden = false;
    emptyState.hidden = true;
    approveButton.disabled = true;
    documentLoaded = false;
    loadDocument(record);
  }

  async function loadDocument(record) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    image.hidden = true;
    pdf.hidden = true;
    openDocument.hidden = true;
    previewMessage.hidden = true;
    image.removeAttribute("src");
    pdf.removeAttribute("src");
    try {
      const response = await fetch(
        `${apiOrigin}/api/invoices/${encodeURIComponent(record.recordId)}/document`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(response.status === 404
          ? "Không tìm thấy tài liệu gốc của hóa đơn này."
          : `Không thể tải tài liệu gốc (HTTP ${response.status}).`);
      }
      previewUrl = URL.createObjectURL(await response.blob());
      documentLoaded = true;
      approveButton.disabled = false;
      openDocument.href = previewUrl;
      openDocument.hidden = false;
      if (record.source.kind === "pdf") {
        pdf.src = previewUrl;
        pdf.hidden = false;
      } else {
        image.src = previewUrl;
        image.hidden = false;
      }
    } catch (error) {
      documentLoaded = false;
      approveButton.disabled = true;
      previewMessage.textContent = error.message || "Không thể tải tài liệu gốc.";
      previewMessage.hidden = false;
    }
  }

  function renderQueue(selectedId) {
    reviewSelect.replaceChildren();
    records.forEach((record) => {
      const option = document.createElement("option");
      option.value = record.recordId;
      option.textContent = `${record.source.fileName} · ${record.invoice.invoiceNumber || "Chưa có số hóa đơn"}`;
      reviewSelect.append(option);
    });
    reviewSelect.disabled = records.length === 0;
    queueCount.textContent = `${records.length} hóa đơn chờ duyệt`;
    if (!records.length) {
      workspace.hidden = true;
      emptyState.hidden = false;
      reviewSelect.append(new Option("Không có hóa đơn chờ duyệt", ""));
      return;
    }
    const record = records.find((item) => item.recordId === selectedId) || records[0];
    reviewSelect.value = record.recordId;
    renderInvoice(record);
  }

  async function loadReviews(selectedId) {
    showMessage("");
    const response = await fetch(`${apiOrigin}/api/reviews`, { cache: "no-store" });
    const result = await readJsonResponse(response, "/api/reviews");
    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.error?.message || `Không tải được hàng đợi duyệt (HTTP ${response.status}).`);
    }
    records = result.data;
    renderQueue(selectedId || new URLSearchParams(location.search).get("id"));
  }

  function readFormInvoice() {
    const invoice = {};
    textFields.forEach(([key]) => {
      const value = form.elements.namedItem(key).value.trim();
      invoice[key] = value || null;
    });
    numericFields.forEach(([key]) => {
      const rawValue = form.elements.namedItem(key).value.trim();
      invoice[key] = rawValue === "" ? null : Number(rawValue);
    });
    invoice.lineItems = [...lineItems.rows].map((row) => {
      const item = {};
      row.querySelectorAll("[data-item-field]").forEach((input) => {
        const key = input.dataset.itemField;
        const value = input.value.trim();
        item[key] = input.type === "number"
          ? (value === "" ? null : Number(value))
          : (value || null);
      });
      return item;
    });
    return invoice;
  }

  reviewSelect.addEventListener("change", () => {
    const record = records.find((item) => item.recordId === reviewSelect.value);
    if (record) renderInvoice(record);
  });
  addLineItem.addEventListener("click", () => addItemRow());

  document.querySelector("#refresh-reviews").addEventListener("click", async () => {
    try {
      await loadReviews(currentRecord?.recordId);
    } catch (error) {
      showMessage(`Không thể làm mới hàng đợi: ${error.message}`);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentRecord) return;
    approveButton.disabled = true;
    approveButton.textContent = "Đang lưu...";
    formError.hidden = true;
    try {
      const response = await fetch(`${apiOrigin}/api/reviews/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: currentRecord.recordId, invoice: readFormInvoice() }),
      });
      const result = await readJsonResponse(response, "/api/reviews/approve");
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message || `Không thể duyệt hóa đơn (HTTP ${response.status}).`);
      }
      window.top.location.href = `/detail.html?id=${encodeURIComponent(currentRecord.recordId)}`;
    } catch (error) {
      formError.textContent = error.message || "Không thể duyệt hóa đơn.";
      formError.hidden = false;
      approveButton.disabled = !documentLoaded;
      approveButton.textContent = "Duyệt và lưu hóa đơn";
    }
  });

  window.addEventListener("beforeunload", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  loadReviews().catch((error) => {
    queueCount.textContent = "Không tải được hàng đợi";
    reviewSelect.disabled = true;
    showMessage(`Không thể tải hàng đợi duyệt: ${error.message}`);
  });
})();