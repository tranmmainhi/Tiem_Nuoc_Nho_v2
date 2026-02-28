/**
 * FINANCE.gs - Quản lý tài chính và báo cáo
 */

/**
 * Khởi tạo cấu trúc Tab FINANCE_REPORT
 */
function initFinanceStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("FINANCE_REPORT");
  
  if (!sheet) {
    sheet = ss.insertSheet("FINANCE_REPORT");
    const headers = ["Mã Đơn", "Ngày", "Doanh Thu Trước Thuế", "VAT (8%)", "Doanh Thu Ròng", "Tiền Hủy Đơn"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f0f0f0");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Ghi log báo cáo tài chính hàng ngày
 */
function logDailySummary(orderData, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const financeSheet = ss.getSheetByName("FINANCE_REPORT") || initFinanceStructure();
  
  const headers = ss.getSheetByName("ORDERS").getDataRange().getValues()[0];
  const findCol = (patterns) => headers.findIndex(h => {
    const lowerH = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return patterns.some(p => lowerH.includes(p.toLowerCase()));
  });

  const totalIdx = findCol(['tong tien', 'total', 'amount']);
  const timestampIdx = findCol(['thoi gian', 'timestamp', 'date']);
  const orderIdIdx = findCol(['ma don', 'order id', 'id']);

  const total = totalIdx !== -1 ? Number(orderData[totalIdx] || 0) : 0;
  const timestamp = timestampIdx !== -1 ? orderData[timestampIdx] : new Date();
  const orderId = orderIdIdx !== -1 ? orderData[orderIdIdx] : "N/A";

  let row = [];
  if (status.toLowerCase() === "completed" || status.toLowerCase() === "hoàn thành") {
    const vat = total * 0.08;
    const netRevenue = total - vat;
    row = [
      orderId,
      new Date(timestamp),
      total,
      vat,
      netRevenue,
      0 // Tiền hủy đơn
    ];
  } else if (status.toLowerCase() === "cancelled" || status.toLowerCase() === "đã hủy") {
    row = [
      orderId,
      new Date(timestamp),
      0, // Doanh thu trước thuế
      0, // VAT
      0, // Doanh thu ròng
      total // Tiền hủy đơn
    ];
  }

  if (row.length > 0) {
    financeSheet.appendRow(row);
  }
}

/**
 * Lấy dữ liệu báo cáo tài chính
 */
function getFinanceReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("FINANCE_REPORT");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}
