/**
 * FINANCE.gs - Quản lý tài chính và báo cáo
 */

/**
 * Ghi log báo cáo tài chính khi đơn hàng hoàn thành
 */
function logFinanceReport(ss, orderData, headers) {
  const financeSheet = ss.getSheetByName("FINANCE_REPORT") || createFinanceReportTab(ss);
  
  const totalIdx = headers.indexOf("Total");
  const timestampIdx = headers.indexOf("Timestamp");
  const orderIdIdx = headers.indexOf("Order_ID");

  const total = Number(orderData[totalIdx] || 0);
  const vat = total * 0.08; // VAT 8%
  const netRevenue = total - vat; // Thuần
  const timestamp = orderData[timestampIdx] || new Date();
  const orderId = orderData[orderIdIdx];

  const row = [
    new Date(timestamp), // Ngày
    orderId,             // Mã đơn
    total,               // Tổng thu
    vat,                 // VAT 8%
    netRevenue           // Thuần
  ];

  financeSheet.appendRow(row);
}

/**
 * Tạo Tab FINANCE_REPORT nếu chưa có
 */
function createFinanceReportTab(ss) {
  const sheet = ss.insertSheet("FINANCE_REPORT");
  const headers = ["Ngày", "Mã đơn", "Tổng thu", "VAT 8%", "Thuần"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f0f0f0");
  sheet.setFrozenRows(1);
  return sheet;
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
