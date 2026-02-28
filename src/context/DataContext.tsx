import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OrderData } from '../types';

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

interface DataContextType {
  menuItems: MenuItem[];
  orders: OrderData[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  fetchAllData: (showFullLoader?: boolean) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string, paymentStatus?: string) => Promise<boolean>;
  createOrder: (orderData: any) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode; appsScriptUrl: string }> = ({ children, appsScriptUrl }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshIntervalState] = useState(() => {
    const saved = localStorage.getItem('refreshInterval');
    return saved ? Math.max(15, Number(saved)) : 30;
  });

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const setRefreshInterval = (interval: number) => {
    const safeInterval = Math.max(15, interval);
    setRefreshIntervalState(safeInterval);
    localStorage.setItem('refreshInterval', String(safeInterval));
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
      const [menuRes, ordersRes] = await Promise.all([
        fetch(`${appsScriptUrl}?action=getMenu`),
        fetch(`${appsScriptUrl}?action=getOrders`)
      ]);

      const [menuData, ordersData] = await Promise.all([
        menuRes.json(),
        ordersRes.json()
      ]);

      // Try to fetch inventory, but don't block if it fails
      let inventoryData = [];
      try {
        const inventoryRes = await fetch(`${appsScriptUrl}?action=getInventoryData`);
        if (inventoryRes.ok) {
          const data = await inventoryRes.json();
          if (Array.isArray(data)) {
            inventoryData = data;
          }
        }
      } catch (invError) {
        console.warn('Failed to fetch inventory data:', invError);
        // Continue without inventory data
      }

      let inventoryMap = new Map<string, number>();
      if (Array.isArray(inventoryData) && inventoryData.length > 0) {
        inventoryData.forEach((item: any) => {
          const keys = Object.keys(item);
          const findKey = (patterns: string[]) => keys.find(k => {
            const lowerK = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return patterns.some(p => lowerK.includes(p.toLowerCase()));
          });
          const idKey = findKey(['ma nguyen lieu', 'ma_nguyen_lieu', 'id']) || 'Ma_Nguyen_Lieu';
          const qtyKey = findKey(['ton kho', 'ton_kho', 'inventory_qty', 'so luong']) || 'Ton_Kho';
          
          if (item[idKey] && item[qtyKey] !== undefined) {
            inventoryMap.set(String(item[idKey]), Number(item[qtyKey]));
          }
        });
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
          const inventoryQty = inventoryMap.has(id) ? inventoryMap.get(id) : undefined;
          let isOutOfStock = String(item[stockKey]) === 'false' || item[stockKey] === false;
          
          if (inventoryQty !== undefined && inventoryQty <= 0) {
            isOutOfStock = true;
          }

          return {
            id,
            name: String(item[nameKey] || ''),
            price: Number(item[priceKey] || 0),
            category: String(item[catKey] || 'Khác'),
            isOutOfStock,
            hasCustomizations: String(item[customKey]) === 'true' || item[customKey] === true,
            inventoryQty
          };
        });
        setMenuItems(mappedMenu);
      }

      if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      }

      lastFetchTimeRef.current = Date.now();
    } catch (err: any) {
      console.error('Data fetch error:', err);
      if (err.message?.includes('Rate exceeded')) {
        setError('Hệ thống đang bận. Vui lòng đợi...');
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
    const intervalId = setInterval(() => {
      // Only poll if tab is active and not already fetching
      if (document.visibilityState === 'visible' && !isFetchingRef.current) {
        fetchAllData(false);
      }
    }, refreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [fetchAllData, refreshInterval]);

  // Initial Load
  useEffect(() => {
    fetchAllData(true);
  }, [appsScriptUrl]);

  const updateOrderStatus = async (orderId: string, status: string, paymentStatus?: string) => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'updateOrderStatus', 
          orderId, 
          orderStatus: status,
          paymentStatus: paymentStatus
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
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

  const createOrder = async (orderData: any) => {
    if (!appsScriptUrl) return false;
    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'createOrder', ...orderData }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
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

  return (
    <DataContext.Provider value={{ 
      menuItems, 
      orders, 
      isLoading, 
      isRefreshing, 
      error, 
      refreshInterval, 
      setRefreshInterval, 
      fetchAllData,
      updateOrderStatus,
      createOrder
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
