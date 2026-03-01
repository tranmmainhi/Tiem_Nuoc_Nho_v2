export interface DashboardData {
  revenue: { today: number; thisWeek: number; thisMonth: number };
  orders: { today: number; thisWeek: number; thisMonth: number };
  topItems: { name: string; quantity: number; revenue: number }[];
  recentOrders: OrderData[];
}

export interface SoTayItem {
  id_thu_chi: string;
  so_tien: number;
  ghi_chu: string;
  danh_muc: string;
  thoi_gian: string;
  phan_loai: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isOutOfStock?: boolean;
  hasCustomizations?: boolean;
  inventoryQty?: number;
  variants?: {
    [key: string]: {
      id: string;
      price: number;
      isOutOfStock?: boolean;
    };
  };
}

export interface CartItem extends MenuItem {
  cartItemId: string;
  quantity: number;
  size: string;
  toppings: string[];
  unitPrice: number;
  temperature?: string;
  sugarLevel?: string;
  iceLevel?: string;
  note?: string;
}

export interface OrderData {
  orderId: string;
  customerName: string;
  phoneNumber: string;
  tableNumber: string;
  items: CartItem[];
  total: number;
  timestamp: string;
  notes?: string;
  paymentMethod: 'Tiền mặt' | 'Chuyển khoản';
  orderStatus: 'Chờ xử lý' | 'Đã nhận' | 'Đang làm' | 'Hoàn thành' | 'Đã hủy';
  paymentStatus: 'Chưa thanh toán' | 'Đã thanh toán';
}

export interface Expense {
  id_thu_chi: string;
  so_tien: number;
  ghi_chu: string;
  danh_muc: string;
  thoi_gian: string;
  phan_loai: string;
}

// New API Types
export interface APIMenuItem {
  ma_mon: string;
  ten_mon: string;
  gia_ban: number;
  danh_muc: string;
  co_san: boolean | string;
}

export interface APIPendingOrder {
  thoi_gian: string;
  so_luong: string | number;
  ten_mon: string;
  tong_tien: number;
  trang_thai: string;
  ma_don: string;
  ghi_chu: string;
}
