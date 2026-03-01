import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OrderData, Expense } from '../types';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isOutOfStock: boolean;
  hasCustomizations: boolean;
  inventoryQty?: number;
  variants?: Record<string, { id: string; price: number }>;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

interface DataContextType {
  menuItems: MenuItem[];
  orders: OrderData[];
  inventoryItems: InventoryItem[];
  financeData: any[];
  expenses: Expense[];
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
  updateOrderStatus: (orderId: string, status: string, paymentStatus?: string, additionalData?: any) => Promise<boolean>;
  createOrder: (orderData: any, showLoader?: boolean) => Promise<boolean>;
  syncDatabase: () => Promise<boolean>;
  setupDatabase: () => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode; appsScriptUrl: string }> = ({ children, appsScriptUrl }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [financeData, setFinanceData] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [refreshInterval, setRefreshIntervalState] = useState(() => {
    const saved = localStorage.getItem('refreshInterval');
    return saved ? Math.max(15, Number(saved)) : 15;
  });
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(() => {
    const saved = localStorage.getItem('autoSyncEnabled');
    return saved !== 'false'; // Default to true
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
    
    // Rate limit protection: don't fetch more than once every 5 seconds manually
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 5000 && !showFullLoader) return;

    isFetchingRef.current = true;
    if (showFullLoader) setIsLoading(true);
    else setIsRefreshing(true);
    
    setError(null);

    try {
      // Fetch Menu and Orders first (Critical data)
      let menuRes, ordersRes;
      try {
        [menuRes, ordersRes] = await Promise.all([
          fetch(`${appsScriptUrl}?action=getAllMenu`, { credentials: 'omit' }).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve(null) })),
          fetch(`${appsScriptUrl}?action=getOrders`, { credentials: 'omit' }).catch(e => ({ ok: false, statusText: e.message, json: () => Promise.resolve(null) }))
        ]);
      } catch (e: any) {
        console.warn('Initial fetch failed:', e);
        menuRes = { ok: false, json: () => Promise.resolve(null) };
        ordersRes = { ok: false, json: () => Promise.resolve(null) };
      }

      const menuJson = (menuRes as any).ok ? await (menuRes as any).json().catch(() => null) : null;
      const ordersJson = (ordersRes as any).ok ? await (ordersRes as any).json().catch(() => null) : null;

      // Handle new API structure: { status: "success", data: [...] }
      const menuData = (menuJson && typeof menuJson === 'object' && Array.isArray(menuJson.data)) 
        ? menuJson.data 
        : (Array.isArray(menuJson) ? menuJson : []);

      const ordersData = (ordersJson && typeof ordersJson === 'object' && Array.isArray(ordersJson.data))
        ? ordersJson.data
        : (Array.isArray(ordersJson) ? ordersJson : []);

      // Map and Deduplicate Orders
      const uniqueOrdersMap = new Map();
      if (Array.isArray(ordersData)) {
        ordersData.forEach((row: any) => {
          const id = row.orderId || row.ma_don || row.id;
          if (!id) return;

          if (!uniqueOrdersMap.has(id)) {
            // Initialize order if not exists
            uniqueOrdersMap.set(id, {
              orderId: String(id),
              customerName: row.customerName || row.ten_khach_hang || 'Khách hàng',
              phoneNumber: row.phoneNumber || row.so_dien_thoai || '',
              tableNumber: row.tableNumber || row.so_ban || '',
              items: [],
              total: Number(row.total || row.tong_tien || 0),
              timestamp: row.timestamp || row.thoi_gian || new Date().toISOString(),
              notes: row.notes || row.ghi_chu || '',
              paymentMethod: row.paymentMethod || row.thanh_toan || 'Tiền mặt',
              orderStatus: row.orderStatus || row.trang_thai || 'Chờ xử lý',
              paymentStatus: row.paymentStatus || (row.thanh_toan === 'Chuyển khoản' ? 'Đã thanh toán' : 'Chưa thanh toán'),
            });
          }

          // Add item to the order
          const order = uniqueOrdersMap.get(id);
          
          // Check if this row actually contains item data (it should, given it's a flat list of items)
          // Some rows might be just order headers if the backend joins differently, but assuming inner join style:
          if (row.ten_mon || row.name) {
             const item = {
                id: row.ma_mon || row.id || '',
                name: row.ten_mon || row.name || 'Món chưa đặt tên',
                quantity: Number(row.so_luong || row.quantity || 1),
                price: Number(row.don_gia || row.price || 0),
                // Add other item fields if available in the flat row
                cartItemId: `${id}-${order.items.length}`, // Generate a temporary ID
                unitPrice: Number(row.don_gia || row.price || 0),
                size: row.size || 'M',
                toppings: row.toppings ? (typeof row.toppings === 'string' ? JSON.parse(row.toppings) : row.toppings) : [],
                note: row.ghi_chu_mon || '',
             };
             order.items.push(item);
          } else if (row.items) {
             // Fallback: if the row still has an 'items' array (hybrid structure), use it
             let items = row.items;
             if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (e) { items = []; }
             }
             if (Array.isArray(items)) {
                order.items.push(...items);
             }
          }
        });
      }
      const uniqueOrders = Array.from(uniqueOrdersMap.values()) as OrderData[];

      // Try to fetch inventory, but don't block if it fails
      let inventoryData = [];
      try {
        const inventoryRes = await fetch(`${appsScriptUrl}?action=getInventoryData`, { credentials: 'omit' }).catch(() => null);
        if (inventoryRes && inventoryRes.ok) {
          const invJson = await inventoryRes.json().catch(() => null);
          
          // Handle various structures: 
          // 1. { status: "success", data: [...] }
          // 2. { status: "success", data: { materials: [...], logs: [...] } }
          // 3. [...]
          
          if (invJson && typeof invJson === 'object') {
            const rawData = invJson.data || invJson;
            if (Array.isArray(rawData)) {
              inventoryData = rawData;
            } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.materials)) {
              inventoryData = rawData.materials;
            } else {
              inventoryData = [];
            }
          }
        }
      } catch (invError) {
        console.warn('Failed to fetch inventory data:', invError);
      }

      let inventoryMap = new Map<string, number>();
      let mappedInventoryItems: InventoryItem[] = [];

      if (Array.isArray(inventoryData) && inventoryData.length > 0) {
        inventoryData.forEach((item: any) => {
          const keys = Object.keys(item);
          const findKey = (patterns: string[]) => keys.find(k => {
            const lowerK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return patterns.some(p => lowerK.includes(p.toLowerCase()));
          });
          const idKey = findKey(['ma nguyen lieu', 'ma_nguyen_lieu', 'id']) || 'Ma_Nguyen_Lieu';
          const qtyKey = findKey(['ton kho', 'ton_kho', 'inventory_qty', 'so luong']) || 'Ton_Kho';
          const nameKey = findKey(['ten nguyen lieu', 'ten_nguyen_lieu', 'name']) || 'Ten_Nguyen_Lieu';
          
          if (item[idKey] && item[qtyKey] !== undefined) {
            inventoryMap.set(String(item[idKey]), Number(item[qtyKey]));
            mappedInventoryItems.push({
              id: String(item[idKey]),
              name: String(item[nameKey] || item[idKey]),
              quantity: Number(item[qtyKey])
            });
          }
        });
        setInventoryItems(mappedInventoryItems);
      }

      // Fetch Finance Report
      try {
        const financeRes = await fetch(`${appsScriptUrl}?action=getFinanceReport`, { credentials: 'omit' }).catch(() => null);
        if (financeRes && financeRes.ok) {
          const finJson = await financeRes.json().catch(() => null);
          const finData = (finJson && typeof finJson === 'object' && Array.isArray(finJson.data))
            ? finJson.data
            : (Array.isArray(finJson) ? finJson : []);
          setFinanceData(finData);
          setExpenses(finData as Expense[]);
        }
      } catch (finError) {
        console.warn('Failed to fetch finance report:', finError);
      }

      if (Array.isArray(menuData)) {
        const mappedMenu = menuData.map((item: any) => {
          const keys = Object.keys(item);
          const findKey = (patterns: string[]) => keys.find(k => {
            const lowerK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return patterns.some(p => lowerK.includes(p.toLowerCase()));
          });

          const nameKey = findKey(['ten mon', 'ten_mon', 'name']) || 'Ten_Mon';
          const priceKey = findKey(['gia ban', 'gia_ban', 'price', 'don gia']) || 'Gia_Ban';
          const idKey = findKey(['ma mon', 'ma_mon', 'id']) || 'Ma_Mon';
          const stockKey = findKey(['co san', 'co_san', 'stock', 'trang thai']) || 'Co_San';
          const catKey = findKey(['danh muc', 'danh_muc', 'loai', 'nhom', 'category']) || 'Danh_Muc';
          const customKey = findKey(['has customizations', 'has_customizations', 'tuy chinh']) || 'Has_Customizations';

          const id = String(item[idKey] || '');
          const name = String(item[nameKey] || '');
          
          // Skip items without a name or ID
          if (!name || !id) return null;

          const inventoryQty = inventoryMap.has(id) ? inventoryMap.get(id) : undefined;
          let isOutOfStock = String(item[stockKey]) === 'false' || item[stockKey] === false;
          
          if (inventoryQty !== undefined && inventoryQty <= 0) {
            isOutOfStock = true;
          }

          return {
            id,
            name,
            price: Number(item[priceKey] || 0),
            category: String(item[catKey] || 'Khác'),
            isOutOfStock,
            hasCustomizations: String(item[customKey]) === 'true' || item[customKey] === true,
            inventoryQty
          };
        }).filter((item) => item !== null) as MenuItem[];
        
        // Deduplicate Menu Items
        const uniqueMenuMap = new Map();
        mappedMenu.forEach(item => {
          if (item.id) uniqueMenuMap.set(item.id, item);
        });
        const finalMenu = Array.from(uniqueMenuMap.values()) as MenuItem[];
        
        // Detect items that just went out of stock
        if (menuItems.length > 0) {
          finalMenu.forEach(newItem => {
            const oldItem = menuItems.find(i => i.id === newItem.id);
            if (oldItem && !oldItem.isOutOfStock && newItem.isOutOfStock) {
              // Trigger a custom event for components to listen to
              window.dispatchEvent(new CustomEvent('itemOutOfStock', { detail: newItem }));
            }
          });
        }

        setMenuItems(finalMenu);
      }

      if (uniqueOrders.length > 0) {
        setOrders(uniqueOrders);
      } else if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      }

      setLastUpdated(new Date());
      setIsOnline(true);
      lastFetchTimeRef.current = Date.now();
    } catch (err: any) {
      console.error('Data fetch error:', err);
      setIsOnline(false);
      if (err.message?.includes('Rate exceeded')) {
        setError('Hệ thống đang bận. Vui lòng đợi...');
      } else if (err.message?.includes('Failed to fetch')) {
        setError('Không thể kết nối. Vui lòng kiểm tra mạng hoặc URL.');
      } else {
        setError('Lỗi kết nối máy chủ');
      }
    } finally {
      if (showFullLoader) setIsLoading(false);
      else setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [appsScriptUrl]);

  // Smart Polling
  useEffect(() => {
    if (!autoSyncEnabled) return;

    const intervalId = setInterval(() => {
      // Only poll if tab is active and not already fetching
      if (document.visibilityState === 'visible' && !isFetchingRef.current) {
        fetchAllData(false);
      }
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [fetchAllData, refreshInterval, autoSyncEnabled]);

  // Initial Load
  useEffect(() => {
    fetchAllData(true);
  }, [appsScriptUrl]);

  const updateOrderStatus = async (orderId: string, status: string, paymentStatus?: string, additionalData?: any) => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'updateOrderStatus', 
          orderId, 
          orderStatus: status,
          paymentStatus: paymentStatus,
          ...additionalData
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }).catch(() => null);
      
      if (!response || !response.ok) return false;
      
      const result = await response.json().catch(() => null);
      if (result && result.status === 'success') {
        await fetchAllData(false); // Action-Triggered Refetch
        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createOrder = async (orderData: any, showLoader = true) => {
    if (!appsScriptUrl) return false;
    if (showLoader) setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'createOrder', ...orderData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }).catch(() => null);
      
      if (!response || !response.ok) return false;
      
      const result = await response.json().catch(() => null);
      if (result && result.status === 'success') {
        await fetchAllData(false); // Action-Triggered Refetch
        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const syncDatabase = async () => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'syncDatabase' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }).catch(() => null);
      
      if (!response || !response.ok) return false;
      
      const result = await response.json().catch(() => null);
      if (result && result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const setupDatabase = async () => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'setup' }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      }).catch(() => null);
      
      if (!response || !response.ok) return false;
      
      const result = await response.json().catch(() => null);
      if (result && result.status === 'success') {
        await fetchAllData(false);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DataContext.Provider value={{ 
      menuItems, 
      orders, 
      inventoryItems,
      financeData,
      expenses,
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
      syncDatabase,
      setupDatabase
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
