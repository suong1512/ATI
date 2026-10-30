(() => {
  const rowsElement = document.querySelector("#history-rows");
  const searchElement = document.querySelector("#filter-search");
  const topSearchElement = document.querySelector("#history-search");
  const dateFromElement = document.querySelector("#date-from");
  const dateToElement = document.querySelector("#date-to");
  const typeElement = document.querySelector("#type-filter");
  const confidenceElement = document.querySelector("#confidence-filter");
  const pageSizeElement = document.querySelector("#page-size");
  const messageElement = document.querySelector("#history-message");
  const resultsSummary = document.querySelector("#results-summary");
  const pageButtonsElement = document.querySelector("#page-buttons");
  const exportButton = document.querySelector("#export-history");
  const refreshButton = document.querySelector("#refresh-history");
  const columnCount = 10;
  const standalonePreviewPorts = ["4173", "5173", "5500", "5501"];
  const apiOrigin = standalonePreviewPorts.includes(location.port) || location.protocol === "file:"
    ? `${location.protocol === "https:" ? "https:" : "http:"}//${location.hostname || "localhost"}:3000`
    : location.origin;
  let approvedRecords = [];
  let currentPage = 1;
  let filteredRecords = [];

  async function readJsonResponse(response, endpoint) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("json")) {
      throw new Error(`${endpoint} trả về HTML thay vì JSON (HTTP ${response.status}). Hãy chạy máy chủ Next.js.`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`${endpoint} trả về JSON không hợp lệ (HTTP ${response.status}).`);
    }
  }

  function showMessage(message) {
    messageElement.textContent = message;
    messageElement.hidden = false;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("vi");
  }

  function formatRecordId(recordId) {
    const [prefix, hash, timestamp] = recordId.split("_");
    if (prefix !== "inv" || !hash || !timestamp) return recordId;
    return `inv_${hash.slice(0, 8)}…_${timestamp}`;
  }

  function dateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function formatMoney(value, currency) {
    if (!Number.isFinite(value)) return "—";
    const formatted = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
    const unit = typeof currency === "string" && currency.trim() ? currency : "VND";
    return `${formatted} ${unit}`;
  }

  function appendCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
    return cell;
  }

  function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = appendCell(row, message, "empty-cell");
    cell.colSpan = columnCount;
    rowsElement.replaceChildren(row);
    resultsSummary.textContent = message;
    pageButtonsElement.replaceChildren();
    exportButton.disabled = true;
    ["first-page", "previous-page", "next-page", "last-page"].forEach((id) => {
      document.querySelector(`#${id}`).disabled = true;
    });
  }

  function currentFilters() {
    const query = normalize(searchElement.value.trim());
    const from = dateFromElement.value;
    const to = dateToElement.value;
    const type = typeElement.value;
    const minConfidence = Number(confidenceElement.value);

    return approvedRecords.filter((record) => {
      const source = record.source || {};
      const invoice = record.invoice || {};
      const created = dateKey(record.createdAt);
      const searchable = normalize([
        record.recordId,
        source.fileName,
        invoice.invoiceNumber,
        invoice.serialNumber,
        invoice.sellerName,
        invoice.buyerName,
        invoice.sellerTaxId,
        invoice.buyerTaxId,
      ].join(" "));

      return (!query || searchable.includes(query))
        && (!from || (created && created >= from))
        && (!to || (created && created <= to))
        && (!type || source.kind === type)
        && (Number.isFinite(record.extraction?.confidence) && record.extraction.confidence >= minConfidence);
    });
  }

  function renderPageNumbers(pageCount) {
    pageButtonsElement.replaceChildren();
    const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    for (let page = start; page <= end; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-number${page === currentPage ? " active" : ""}`;
      button.textContent = String(page);
      button.setAttribute("aria-label", `Trang ${page}`);
      if (page === currentPage) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        currentPage = page;
        renderTable();
      });
      pageButtonsElement.append(button);
    }
  }

  function renderTable() {
    filteredRecords = currentFilters();
    const pageSize = Number(pageSizeElement.value);
    const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    if (!filteredRecords.length) {
      renderEmpty(approvedRecords.length ? "Không tìm thấy hóa đơn phù hợp." : "Chưa có hóa đơn nào được lưu.");
      return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const pageRecords = filteredRecords.slice(startIndex, startIndex + pageSize);
    const fragment = document.createDocumentFragment();
    for (const record of pageRecords) {
      const row = document.createElement("tr");
      const codeCell = appendCell(row, "");
      const codeLink = document.createElement("a");
      codeLink.className = "record-code";
      codeLink.href = `/detail.html?id=${encodeURIComponent(record.recordId)}`;
      codeLink.target = "_top";
      codeLink.textContent = formatRecordId(record.recordId);
      codeLink.title = record.recordId;
      codeLink.setAttribute("aria-label", `Mã hóa đơn ${record.recordId}`);
      codeCell.append(codeLink);

      const nameCell = appendCell(row, record.source.fileName, "file-cell");
      nameCell.title = record.source.fileName;
      const numberCell = appendCell(row, record.invoice.invoiceNumber || "—");
      numberCell.className = "record-code";
      const sellerCell = appendCell(row, record.invoice.sellerName || "—", "seller-cell");
      sellerCell.title = record.invoice.sellerName || "";
      appendCell(row, formatMoney(record.invoice.totalAmount, record.invoice.currency), "amount-cell");
      appendCell(row, formatDate(record.createdAt), "date-cell");
      const typeCell = appendCell(row, record.source.kind.toUpperCase());
      typeCell.textContent = "";
      const typeBadge = document.createElement("span");
      typeBadge.className = "kind-badge";
      typeBadge.textContent = record.source.kind.toUpperCase();
      typeCell.append(typeBadge);

      const confidence = record.extraction.confidence;
      appendCell(row, Number.isFinite(confidence) ? `${(confidence * 100).toFixed(1)}%` : "—",
        `confidence ${confidence >= 0.9 ? "high" : "medium"}`);
      const statusCell = appendCell(row, "");
      const statusBadge = document.createElement("span");
      statusBadge.className = "status-badge";
      statusBadge.textContent = "Đã duyệt";
      statusCell.append(statusBadge);
      const detailCell = appendCell(row, "");
      const detailLink = document.createElement("a");
      detailLink.className = "detail-link";
      detailLink.href = `/detail.html?id=${encodeURIComponent(record.recordId)}`;
      detailLink.target = "_top";
      detailLink.textContent = "Chi tiết";
      detailCell.append(detailLink);
      fragment.append(row);
    }
    rowsElement.replaceChildren(fragment);
    const endIndex = Math.min(startIndex + pageSize, filteredRecords.length);
    resultsSummary.textContent = `Hiển thị ${startIndex + 1}–${endIndex} / ${filteredRecords.length} hóa đơn`;
    renderPageNumbers(pageCount);
    exportButton.disabled = false;
    document.querySelector("#first-page").disabled = currentPage === 1;
    document.querySelector("#previous-page").disabled = currentPage === 1;
    document.querySelector("#next-page").disabled = currentPage === pageCount;
    document.querySelector("#last-page").disabled = currentPage === pageCount;
  }

  function renderStats(pendingCount) {
    document.querySelector("#total-count").textContent = approvedRecords.length.toLocaleString("vi-VN");
    document.querySelector("#approved-count").textContent = approvedRecords.length.toLocaleString("vi-VN");
    document.querySelector("#pending-count").textContent = pendingCount.toLocaleString("vi-VN");
  }

  async function loadHistory() {
    refreshButton.disabled = true;
    showMessage("Đang tải dữ liệu lịch sử...");
    try {
      const invoiceResponse = await fetch(`${apiOrigin}/api/invoices?limit=all`, { cache: "no-store" });
      const invoiceResult = await readJsonResponse(invoiceResponse, "/api/invoices");
      if (!invoiceResponse.ok || !invoiceResult.ok || !Array.isArray(invoiceResult.data)) {
        throw new Error(invoiceResult.error?.message || `Không thể tải hóa đơn đã lưu (HTTP ${invoiceResponse.status}).`);
      }
      approvedRecords = invoiceResult.data;
      renderStats(0);
      currentPage = 1;
      renderTable();
      messageElement.hidden = true;
      try {
        const reviewResponse = await fetch(`${apiOrigin}/api/reviews`, { cache: "no-store" });
        const reviewResult = await readJsonResponse(reviewResponse, "/api/reviews");
        if (!reviewResponse.ok || !reviewResult.ok || !Array.isArray(reviewResult.data)) {
          throw new Error(reviewResult.error?.message || `Máy chủ trả về lỗi ${reviewResponse.status}.`);
        }
        renderStats(reviewResult.count);
      } catch (error) {
        document.querySelector("#pending-count").textContent = "—";
        showMessage(`Đã tải lịch sử, nhưng không lấy được số hóa đơn đang chờ duyệt: ${error.message}`);
      }
    } catch (error) {
      showMessage(`Không thể tải lịch sử hóa đơn: ${error.message}`);
      renderEmpty("Lịch sử chưa tải được. Hãy thử làm mới.");
    } finally {
      refreshButton.disabled = false;
    }
  }

  function exportCsv() {
    const columns = ["Mã hóa đơn", "Tên tài liệu", "Số hóa đơn", "Đối tác", "Ngày xử lý", "Loại tài liệu", "Tổng tiền", "Tiền tệ", "Độ tin cậy", "Trạng thái"];
    const values = filteredRecords.map((record) => [
      record.recordId,
      record.source.fileName,
      record.invoice.invoiceNumber || "",
      record.invoice.sellerName || "",
      formatDate(record.createdAt),
      record.source.kind.toUpperCase(),
      record.invoice.totalAmount ?? "",
      record.invoice.currency || "VND",
      `${(record.extraction.confidence * 100).toFixed(1)}%`,
      "Đã duyệt",
    ]);
    const csv = [columns, ...values]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.href = url;
    link.download = "lich-su-hoa-don.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const filterElements = [searchElement, dateFromElement, dateToElement, typeElement, confidenceElement];
  filterElements.forEach((element) => {
    element.addEventListener(element === searchElement ? "input" : "change", () => {
      currentPage = 1;
      renderTable();
      topSearchElement.value = searchElement.value;
    });
  });
  topSearchElement.addEventListener("input", () => {
    searchElement.value = topSearchElement.value;
    currentPage = 1;
    renderTable();
  });
  pageSizeElement.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });
  document.querySelector("#reset-filters").addEventListener("click", () => {
    searchElement.value = "";
    topSearchElement.value = "";
    dateFromElement.value = "";
    dateToElement.value = "";
    typeElement.value = "";
    confidenceElement.value = "0";
    currentPage = 1;
    renderTable();
  });
  document.querySelector("#first-page").addEventListener("click", () => { currentPage = 1; renderTable(); });
  document.querySelector("#previous-page").addEventListener("click", () => { currentPage -= 1; renderTable(); });
  document.querySelector("#next-page").addEventListener("click", () => { currentPage += 1; renderTable(); });
  document.querySelector("#last-page").addEventListener("click", () => {
    currentPage = Math.max(1, Math.ceil(filteredRecords.length / Number(pageSizeElement.value)));
    renderTable();
  });
  refreshButton.addEventListener("click", loadHistory);
  exportButton.addEventListener("click", exportCsv);

  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  searchElement.value = initialQuery;
  topSearchElement.value = initialQuery;
  loadHistory();
})();