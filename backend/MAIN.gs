/**
 * MAIN.gs - Entry points for Apps Script
 */

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    let data;
    switch (action) {
      case 'getMenu':
        data = ss.getSheetByName("MENU").getDataRange().getValues();
        break;
      case 'getOrders':
        data = ss.getSheetByName("ORDERS").getDataRange().getValues();
        break;
      case 'getInventoryData':
        data = ss.getSheetByName("INVENTORY").getDataRange().getValues();
        break;
      case 'getFinanceReport':
        data = getFinanceReport(); // From FINANCE.gs
        break;
      case 'getTransactions':
        data = ss.getSheetByName("TRANSACTIONS").getDataRange().getValues();
        break;
      default:
        return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Invalid action"}))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Convert sheet data to JSON objects if it's an array of arrays
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      const headers = data[0];
      const rows = data.slice(1);
      data = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success", data: data}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;
  
  try {
    let result;
    switch (action) {
      case 'createOrder':
        result = handleCreateOrder(payload); // From ORDERS.gs
        break;
      case 'updateOrderStatus':
        result = handleUpdateOrderStatus(payload.orderId, payload.orderStatus, payload.paymentStatus); // From ORDERS.gs
        break;
      case 'createTransaction':
        // From StaffView logic
        result = {status: "success"};
        break;
      case 'updateInventory':
        // Implementation for manual inventory update
        result = {status: "success"};
        break;
      default:
        result = {status: "error", message: "Invalid action"};
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
