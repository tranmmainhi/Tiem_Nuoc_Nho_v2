/**
 * ORDERS.gs - Quản lý đơn hàng và tồn kho
 */

const LOCK_TIMEOUT = 10000; // 10 seconds

/**
 * Cập nhật trạng thái đơn hàng và hoàn kho nếu hủy
 */
function updateOrderStatus(orderId, status, paymentStatus) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(LOCK_TIMEOUT)) {
      return { status: "error", message: "Hệ thống đang bận, vui lòng thử lại sau." };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName("ORDERS");
    const inventorySheet = ss.getSheetByName("INVENTORY");
    
    if (!orderSheet) throw new Error("Không tìm thấy tab ORDERS");
    
    const data = orderSheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdIdx = headers.indexOf("Order_ID");
    const statusIdx = headers.indexOf("Order_Status");
    const paymentStatusIdx = headers.indexOf("Payment_Status");
    const itemsIdx = headers.indexOf("Items");

    let orderRow = -1;
    let orderData = null;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdIdx]) === String(orderId)) {
        orderRow = i + 1;
        orderData = data[i];
        break;
      }
    }

    if (orderRow === -1) throw new Error("Không tìm thấy đơn hàng: " + orderId);

    const oldStatus = orderData[statusIdx];
    
    // Cập nhật trạng thái mới
    orderSheet.getRange(orderRow, statusIdx + 1).setValue(status);
    if (paymentStatus) {
      orderSheet.getRange(orderRow, paymentStatusIdx + 1).setValue(paymentStatus);
    }

    // LOGIC HOÀN KHO: Nếu đơn hàng bị hủy (cancelled) và trước đó chưa hủy
    if (status.toLowerCase() === "cancelled" && oldStatus.toLowerCase() !== "cancelled") {
      const items = JSON.parse(orderData[itemsIdx]);
      handleStockReturn(inventorySheet, items);
    }
    
    // LOGIC GHI NHẬN TÀI CHÍNH: Nếu đơn hàng hoàn thành
    if (status.toLowerCase() === "completed") {
      logFinanceReport(ss, orderData, headers);
    }

    return { status: "success", message: "Cập nhật thành công" };

  } catch (e) {
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hoàn lại số lượng vào kho
 */
function handleStockReturn(inventorySheet, items) {
  if (!inventorySheet) return;
  
  const invData = inventorySheet.getDataRange().getValues();
  const invHeaders = invData[0];
  const nameIdx = invHeaders.indexOf("Item_Name");
  const stockIdx = invHeaders.indexOf("Stock");

  items.forEach(orderItem => {
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][nameIdx] === orderItem.name) {
        const currentStock = Number(invData[i][stockIdx] || 0);
        const returnQty = Number(orderItem.quantity || 0);
        inventorySheet.getRange(i + 1, stockIdx + 1).setValue(currentStock + returnQty);
        break;
      }
    }
  });
}
