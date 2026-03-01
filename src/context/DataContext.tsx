import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OrderData, DashboardData, SoTayItem, MenuItem, OrderRow, CartItem } from '../types';

interface DataContextType {
  menuItems: MenuItem[];
  inventoryItems: MenuItem[];
  orders: OrderData[];
  financeData: OrderData[];
  dashboardData: DashboardData | null;
  soTayData: SoTayItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshInterval: number;
  autoSyncEnabled: boolean;
  lastUpdated: Date | null;
  isOnline: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  fetchAllData: (showFullLoader?: boolean) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string, additionalData?: any) => Promise<boolean>;
  createOrder: (orderData: any, showLoader?: boolean) => Promise<boolean>;
  fixAll: () => Promise<boolean>;
  addSoTay: (item: { phan_loai: string; danh_muc: string; so_tien: number; ghi_chu: string }) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode; appsScriptUrl: string }> = ({ children, appsScriptUrl }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('menu_data');
    return saved ? JSON.parse(saved) : [];
  });
  
  const inventoryItems = React.useMemo(() => menuItems.filter(item => item.inventoryQty !== undefined), [menuItems]);

  const [orders, setOrders] = useState<OrderData[]>(() => {
    const saved = localStorage.getItem('orders_data');
    return saved ? JSON.parse(saved) : [];
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [soTayData, setSoTayData] = useState<SoTayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshInterval, setRefreshIntervalState] = useState(() => {
    const saved = localStorage.getItem('refreshInterval');
    return saved ? Math.max(15, Number(saved)) : 30;
  });
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(() => {
    const saved = localStorage.getItem('autoSyncEnabled');
    return saved !== 'false';
  });

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const setRefreshInterval = (interval: number) => {
    const safeInterval = Math.max(15, interval);
    setRefreshIntervalState(safeInterval);
    localStorage.setItem('refreshInterval', String(safeInterval));
  };

  const setAutoSyncEnabled = (enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    localStorage.setItem('autoSyncEnabled', String(enabled));
  };

  const fetchAllData = useCallback(async (showFullLoader = false) => {
    if (!appsScriptUrl || isFetchingRef.current) return;
    
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 5000 && !showFullLoader) return;

    isFetchingRef.current = true;
    if (showFullLoader) setIsLoading(true);
    else setIsRefreshing(true);
    
    setError(null);

    try {
      const [menuRes, ordersRes, dashboardRes, soTayRes] = await Promise.all([
        fetch(`${appsScriptUrl}?action=getMenu`).then(r => r.json()).catch(() => null),
        fetch(`${appsScriptUrl}?action=getOrders`).then(r => r.json()).catch(() => null),
        fetch(`${appsScriptUrl}?action=getDashboard`).then(r => r.json()).catch(() => null),
        fetch(`${appsScriptUrl}?action=getSoTay`).then(r => r.json()).catch(() => null)
      ]);

      // Process Menu
      if (menuRes && menuRes.status === 'success' && Array.isArray(menuRes.data)) {
        const mappedMenu: MenuItem[] = menuRes.data.map((item: any) => ({
          id: item.ma_mon,
          name: item.ten_mon,
          price: Number(item.gia_ban),
          category: item.danh_muc,
          isOutOfStock: !item.co_san
        }));
        setMenuItems(mappedMenu);
        localStorage.setItem('menu_data', JSON.stringify(mappedMenu));
      }

      // Process Orders (Group by ORDER_ID)
      if (ordersRes && ordersRes.status === 'success' && Array.isArray(ordersRes.data)) {
        const rows: OrderRow[] = ordersRes.data;
        const ordersMap = new Map<string, OrderData>();

        rows.forEach(row => {
          if (!row.ORDER_ID) return;
          
          if (!ordersMap.has(row.ORDER_ID)) {
            ordersMap.set(row.ORDER_ID, {
              orderId: row.ORDER_ID,
              customerName: row.CUSTOMER_NAME,
              phoneNumber: row.PHONE,
              tableNumber: row.TABLE_NO,
              items: [],
              total: 0, // Will recalculate or use row.TOTAL if consistent
              timestamp: row.TIMESTAMP,
              notes: row.NOTES,
              paymentMethod: row.PAYMENT_METHOD,
              orderStatus: row.STATUS
            });
          }

          const order = ordersMap.get(row.ORDER_ID)!;
          if (row.ITEM_ID) {
            order.items.push({
              id: row.ITEM_ID,
              name: row.ITEM_NAME,
              price: Number(row.PRICE),
              quantity: Number(row.QTY),
              category: '', // Not needed for order display usually
              isOutOfStock: false,
              cartItemId: `${row.ORDER_ID}-${row.ITEM_ID}`,
              note: '',
              unitPrice: Number(row.PRICE)
            });
            // Recalculate total from items to be safe, or trust backend
            // order.total += Number(row.TOTAL); 
          }
          // Trust the total from the first row or accumulate? 
          // Backend usually sends total per row as line total or order total. 
          // Let's assume row.TOTAL is line total.
          order.total += Number(row.TOTAL || 0);
        });

        const groupedOrders = Array.from(ordersMap.values()).sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setOrders(groupedOrders);
        localStorage.setItem('orders_data', JSON.stringify(groupedOrders));
      }

      // Process Dashboard
      if (dashboardRes && dashboardRes.status === 'success') {
        setDashboardData(dashboardRes.data);
      }

      // Process So Tay
      if (soTayRes && soTayRes.status === 'success' && Array.isArray(soTayRes.data)) {
        setSoTayData(soTayRes.data);
      }

      setLastUpdated(new Date());
      setIsOnline(true);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error('Fetch error:', err);
      setIsOnline(false);
      setError('Lỗi kết nối máy chủ');
    } finally {
      if (showFullLoader) setIsLoading(false);
      else setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [appsScriptUrl]);

  useEffect(() => {
    if (!autoSyncEnabled) return;
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isFetchingRef.current) {
        fetchAllData(false);
      }
    }, refreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [fetchAllData, refreshInterval, autoSyncEnabled]);

  useEffect(() => {
    fetchAllData(true);
  }, [appsScriptUrl]);

  const updateOrderStatus = async (orderId: string, status: string, additionalData?: any) => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const payload = { 
        action: 'updateOrderStatus', 
        orderId, 
        status,
        ...additionalData 
      };
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createOrder = async (orderData: any, showLoader = true) => {
    if (!appsScriptUrl) return false;
    if (showLoader) setIsLoading(true);
    try {
      // Transform items to {id, qty} format as requested
      const itemsPayload = orderData.items.map((item: CartItem) => ({
        id: item.id,
        qty: item.quantity
      }));

      const payload = {
        action: 'createOrder',
        items: itemsPayload,
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        tableNumber: orderData.tableNumber,
        paymentMethod: orderData.paymentMethod,
        notes: orderData.notes
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const fixAll = async () => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'fixAll' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const addSoTay = async (item: { phan_loai: string; danh_muc: string; so_tien: number; ghi_chu: string }) => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'addSoTay', ...item }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DataContext.Provider value={{ 
      menuItems, 
      inventoryItems,
      orders, 
      financeData: orders,
      dashboardData,
      soTayData,
      isLoading, 
      isRefreshing, 
      error, 
      refreshInterval, 
      autoSyncEnabled,
      lastUpdated,
      isOnline,
      setAutoSyncEnabled,
      setRefreshInterval, 
      fetchAllData,
      updateOrderStatus,
      createOrder,
      fixAll,
      addSoTay
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
