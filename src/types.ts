export interface DashboardData {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  orders: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  topItems?: { name: string; quantity: number }[];
}

export interface SoTayItem {
  id?: string;
  id_thu_chi?: string;
  thoi_gian: string;
  phan_loai: 'Thu' | 'Chi';
  danh_muc: string;
  so_tien: number;
  ghi_chu: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  description?: string;
  isOutOfStock?: boolean;
  inventoryQty?: number;
  hasCustomizations?: boolean;
}

export interface CartItem extends MenuItem {
  cartItemId: string;
  quantity: number;
  unitPrice: number;
  note?: string;
  size?: string;
  temperature?: string;
  sugarLevel?: string;
  iceLevel?: string;
  toppings?: any[];
  hasCustomizations?: boolean;
}

export interface OrderRow {
  ORDER_ID: string;
  CUSTOMER_NAME: string;
  PHONE: string;
  TABLE_NO: string;
  ITEM_ID: string;
  ITEM_NAME: string;
  QTY: number;
  PRICE: number;
  TOTAL: number;
  STATUS: string;
  PAYMENT_METHOD: string;
  NOTES: string;
  TIMESTAMP: string;
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
  paymentMethod: string;
  orderStatus: string;
  paymentStatus?: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'expense' | 'income';
}
