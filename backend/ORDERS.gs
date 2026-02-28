/**
 * ORDERS.gs - Quản lý đơn hàng và tồn kho
 */

const LOCK_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Xử lý tạo đơn hàng mới
 */
function handleCreateOrder(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName("ORDERS");
    const inventorySheet = ss.getSheetByName("NGUYEN_LIEU"); // Theo yêu cầu sử dụng sheet NGUYEN_LIEU

    if (!orderSheet) throw new Error("Không tìm thấy tab ORDERS");

    const ma_don = payload.ma_don;
    const items = payload.cart_items || [];
    
    // Ghi đơn hàng mới
    const row = [
      ma_don,
      new Date(),
      payload.ten_khach_hang || "Khách hàng",
      payload.so_dien_thoai || "",
      payload.so_ban || "",
      JSON.stringify(items),
      payload.tong_tien || 0,
      payload.ghi_chu || "",
      payload.thanh_toan || "Tiền mặt",
      "Chờ xử lý", // Trạng thái mặc định
      payload.thanh_toan === 'Chuyển khoản' ? 'Đã thanh toán' : 'Chưa thanh toán'
    ];
    orderSheet.appendRow(row);

    // Trừ kho khi tạo đơn
    if (inventorySheet) {
      deductStock(inventorySheet, items);
    }

    return { status: "success", message: "Tạo đơn thành công", orderId: ma_don };

  } catch (e) {
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cập nhật trạng thái đơn hàng và hoàn kho nếu hủy
 */
function handleUpdateOrderStatus(orderId, status, paymentStatus) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_TIMEOUT_MS);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName("ORDERS");
    const inventorySheet = ss.getSheetByName("NGUYEN_LIEU"); // Theo yêu cầu sử dụng sheet NGUYEN_LIEU
    
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
    
    // LOGIC GHI NHẬN TÀI CHÍNH
    logDailySummary(orderData, status); // Gọi hàm từ FINANCE.gs

    return { status: "success", message: "Cập nhật thành công" };

  } catch (e) {
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Trừ kho khi tạo đơn
 */
function deductStock(inventorySheet, items) {
  const invData = inventorySheet.getDataRange().getValues();
  const invHeaders = invData[0];
  const idIdx = 0; // Giả định cột A là ID
  const stockIdx = 3; // Cột D là index 3 (Cột số 4)

  items.forEach(orderItem => {
    const itemId = orderItem.ma_mon || orderItem.id;
    const qty = Number(orderItem.so_luong || orderItem.quantity || 0);

    for (let i = 1; i < invData.length; i++) {
      if (String(invData[i][idIdx]) === String(itemId)) {
        const currentStock = Number(invData[i][stockIdx] || 0);
        inventorySheet.getRange(i + 1, stockIdx + 1).setValue(currentStock - qty);
        break;
      }
    }
  });
}

/**
 * Hoàn lại số lượng vào kho (Cột D - Cột số 4)
 */
function handleStockReturn(inventorySheet, items) {
  if (!inventorySheet || !items || !Array.isArray(items)) return;
  
  const invData = inventorySheet.getDataRange().getValues();
  const idIdx = 0; // Giả định cột A là ID
  const stockIdx = 3; // Cột D là index 3 (Cột số 4)

  items.forEach(orderItem => {
    const itemId = orderItem.ma_mon || orderItem.id;
    const qty = Number(orderItem.so_luong || orderItem.quantity || 0);

    for (let i = 1; i < invData.length; i++) {
      if (String(invData[i][idIdx]) === String(itemId)) {
        const currentStock = Number(invData[i][stockIdx] || 0);
        inventorySheet.getRange(i + 1, stockIdx + 1).setValue(currentStock + qty);
        break;
      }
    }
  });
}
