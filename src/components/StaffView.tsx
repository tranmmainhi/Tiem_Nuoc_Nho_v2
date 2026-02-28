import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle2, Clock, XCircle, Coffee, DollarSign, AlertCircle, ChevronRight, Settings as SettingsIcon, Volume2, VolumeX, Package, User, MapPin, BarChart3, TrendingUp, TrendingDown, Plus, Trash2, Calendar, LayoutDashboard, ListOrdered, Wallet, Filter, ArrowUpRight, ArrowDownRight, Menu as MenuIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { OrderData, Expense } from '../types';
import { Link } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import { useData } from '../context/DataContext';

import { MenuManager } from './MenuManager';

interface StaffViewProps {
  appsScriptUrl: string;
}

type ViewMode = 'dashboard' | 'orders' | 'expenses' | 'inventory' | 'menu';
type TimeRange = 'day' | 'week' | 'month' | 'year';

const MATERIALS = [
  { code: 'NL01', name: 'Trà đen' },
  { code: 'NL02', name: 'Trà xanh' },
  { code: 'NL03', name: 'Sữa tươi' },
  { code: 'NL04', name: 'Bột béo' },
  { code: 'NL05', name: 'Trân châu đen' },
  { code: 'NL06', name: 'Trân châu trắng' },
  { code: 'NL07', name: 'Đường nước' },
  { code: 'NL08', name: 'Siro dâu' },
  { code: 'NL09', name: 'Siro đào' },
  { code: 'NL10', name: 'Thạch trái cây' },
  { code: 'NL11', name: 'Cà phê hạt' },
  { code: 'NL12', name: 'Kem béo' },
  { code: 'NL13', name: 'Bột cacao' },
  { code: 'NL14', name: 'Bột matcha' },
  { code: 'NL15', name: 'Đá viên' },
];

export function StaffView({ appsScriptUrl }: StaffViewProps) {
  const { setIsFabHidden } = useUI();
  const { orders, isLoading: isDataLoading, isRefreshing, error: dataError, fetchAllData, updateOrderStatus, refreshInterval, setRefreshInterval } = useData();
  
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('admin_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'status'>('time');
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('notificationVolume') || 80));
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('notificationMuted') === 'true');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Order filtering
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseCat, setExpenseCat] = useState('Nguyên liệu');
  const [expenseType, setExpenseType] = useState('Chi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Inventory form state
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [inventoryAmount, setInventoryAmount] = useState('');
  const [inventoryPrice, setInventoryPrice] = useState('');
  const [inventoryMaterial, setInventoryMaterial] = useState(MATERIALS[0].code);
  const [inventoryNote, setInventoryNote] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLogs, setInventoryLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('inventory_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [availableMaterials, setAvailableMaterials] = useState<any[]>(MATERIALS);

  const fetchInventory = async () => {
    if (!appsScriptUrl) return;
    setIsLoading(true);
    try {
      // 2. Load Inventory Data (Materials and Logs)
      const response = await fetch(`${appsScriptUrl}?action=getInventoryData`);
      const data = await response.json();
      
      if (data.materials && Array.isArray(data.materials)) {
        setAvailableMaterials(data.materials);
      }
      
      if (data.logs && Array.isArray(data.logs)) {
        const mappedLogs = data.logs.map((log: any) => ({
          ...log,
          materialName: (data.materials || MATERIALS).find((m: any) => (m.code || m.ma_nl) === log.ma_nl)?.name || log.ma_nl,
          timestamp: log.thoi_gian || log.timestamp
        })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setInventoryLogs(mappedLogs);
        localStorage.setItem('inventory_logs', JSON.stringify(mappedLogs));
      } else if (Array.isArray(data)) {
        // Fallback if it returns just an array of logs
        const mappedLogs = data.map((log: any) => ({
          ...log,
          materialName: MATERIALS.find(m => m.code === log.ma_nl)?.name || log.ma_nl,
          timestamp: log.thoi_gian || log.timestamp
        })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setInventoryLogs(mappedLogs);
      }
    } catch (err) {
      console.error('Failed to fetch inventory data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryAmount || !inventoryPrice) {
      setInventoryError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setIsSubmitting(true);
    setInventoryError('');

    // 2. Create Nhap Kho Payload
    const payload = {
      action: 'createNhapKho',
      ma_nl: inventoryMaterial,
      so_luong_nhap: Number(inventoryAmount),
      don_gia_nhap: Number(inventoryPrice),
      ghi_chu: inventoryNote
    };

    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        // 3. Sync data after success
        await fetchInventory(); 
        setShowInventoryForm(false);
        setInventoryAmount('');
        setInventoryPrice('');
        setInventoryNote('');
        alert('Đã tạo phiếu nhập kho thành công!');
      } else {
        setInventoryError(result.message || 'Lỗi khi lưu');
      }
    } catch (err) {
      setInventoryError('Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'inventory') {
      fetchInventory();
    }
  }, [viewMode, appsScriptUrl]);

  useEffect(() => {
    setIsFabHidden(showSettings || showExpenseForm || showInventoryForm);
    return () => setIsFabHidden(false);
  }, [showSettings, showExpenseForm, showInventoryForm, setIsFabHidden]);

  useEffect(() => {
    const handleStorageChange = () => {
      setVolume(Number(localStorage.getItem('notificationVolume') || 80));
      setIsMuted(localStorage.getItem('notificationMuted') === 'true');
    };
    
    // Listen for storage events (cross-tab)
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case of same-tab changes if not using a custom event
    const interval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const now = new Date().getTime();
    let hasNewOrder = false;
    const newNotifiedIds = new Set(notifiedOrderIds);

    orders.forEach(order => {
      const orderTime = new Date(order.timestamp).getTime();
      const isNew = (order.orderStatus === 'Đã nhận' || order.orderStatus === 'Chờ xử lý') && (now - orderTime) < 60000;
      
      if (isNew && !notifiedOrderIds.has(order.orderId)) {
        hasNewOrder = true;
        newNotifiedIds.add(order.orderId);
      }
    });

    if (hasNewOrder) {
      playNotificationSound();
      setNotifiedOrderIds(newNotifiedIds);
    }
  }, [orders]);

  const playNotificationSound = () => {
    if (isMuted) return;
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = volume / 100;
    audio.play().catch(e => console.log('Audio play failed:', e));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, appsScriptUrl]);

  const handleQuickUpdate = (order: OrderData) => {
    if (order.orderStatus === 'Đã nhận' || order.orderStatus === 'Chờ xử lý') updateStatus(order.orderId, 'Đang làm');
    else if (order.orderStatus === 'Đang làm') {
      if (window.confirm('Xác nhận đơn hàng này đã hoàn thành và thanh toán?')) {
        updateStatus(order.orderId, 'Hoàn thành', 'Đã thanh toán');
      }
    }
  };

  const updateStatus = async (orderId: string, status: string, paymentStatus?: string) => {
    try {
      // Update stock if completed or cancelled
      const order = orders.find(o => o.orderId === orderId);
      if (order) {
        // If marking as Completed, deduct stock
        if (status === 'Hoàn thành' && order.orderStatus !== 'Hoàn thành') {
          order.items.forEach(item => {
            fetch(appsScriptUrl, {
              method: 'POST',
              body: JSON.stringify({
                action: 'updateInventory',
                itemName: item.name,
                quantityChange: -item.quantity
              }),
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            }).catch(err => console.error('Failed to deduct inventory:', err));
          });
        }
        // If cancelling a Completed order, restore stock
        else if (status === 'Đã hủy' && order.orderStatus === 'Hoàn thành') {
          order.items.forEach(item => {
            fetch(appsScriptUrl, {
              method: 'POST',
              body: JSON.stringify({
                action: 'updateInventory',
                itemName: item.name,
                quantityChange: item.quantity
              }),
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            }).catch(err => console.error('Failed to restore inventory:', err));
          });
        }
      }

      const success = await updateOrderStatus(orderId, status, paymentStatus);
      if (!success) {
        alert('Lỗi cập nhật trạng thái');
      }
    } catch (err) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const fetchTransactions = async () => {
    if (!appsScriptUrl) return;
    try {
      const response = await fetch(`${appsScriptUrl}?action=getTransactions`);
      const data = await response.json();
      if (Array.isArray(data)) {
        const processed = data.map(item => ({
          id_thu_chi: item.id_thu_chi || item.Id_Thu_Chi,
          so_tien: Number(item.so_tien || item.So_Tien || 0),
          ghi_chu: item.ghi_chu || item.Ghi_Chu || '',
          danh_muc: item.danh_muc || item.Danh_Muc || '',
          thoi_gian: item.thoi_gian || item.Thoi_Gian || item.timestamp || new Date().toISOString(),
          phan_loai: item.phan_loai || item.Phan_Loai || 'Chi'
        }));
        setExpenses(processed);
        localStorage.setItem('admin_expenses', JSON.stringify(processed));
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách chi tiêu:', err);
    }
  };

  useEffect(() => {
    if (viewMode === 'expenses') {
      fetchTransactions();
    } else if (viewMode === 'inventory') {
      fetchInventory();
    }
  }, [viewMode, appsScriptUrl]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseDesc || !expenseCat || !appsScriptUrl) return;

    setExpenseError('');

    if (expenseType === 'Chi') {
      const today = new Date().toDateString();
      const todayExpenses = expenses
        .filter(exp => {
          const type = exp.phan_loai || exp.Phan_Loai || 'Chi';
          const time = exp.thoi_gian || exp.Thoi_Gian || exp.timestamp;
          return type === 'Chi' && new Date(time).toDateString() === today;
        })
        .reduce((sum, exp) => sum + Number(exp.so_tien || exp.So_Tien || 0), 0);

      if (todayExpenses + Number(expenseAmount) > 1000000) {
        alert("Cảnh báo: Chi tiêu trong ngày đã vượt ngưỡng 1,000,000đ.");
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Create Transaction Payload
      const payload = {
        action: "createTransaction",
        phan_loai: expenseType,
        danh_muc: expenseCat,
        so_tien: Number(expenseAmount),
        ghi_chu: expenseDesc
      };

      console.log('Sending transaction payload:', payload);

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });

      const text = await response.text();
      console.log('Server response:', text);
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ (không phải JSON)');
      }

      if (result.status === 'success' || result.success) {
        setExpenseAmount('');
        setExpenseDesc('');
        setShowExpenseForm(false);
        fetchTransactions();
        alert('Đã thêm giao dịch thành công!');
      } else {
        setExpenseError('Lỗi khi thêm giao dịch: ' + (result.message || 'Lỗi không xác định'));
      }
    } catch (err: any) {
      console.error('Add expense error:', err);
      setExpenseError('Không thể kết nối đến máy chủ: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteTransaction', id_thu_chi: id }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success' || result.success) {
        fetchTransactions();
      } else {
        // If API fails but returns a message, show it
        alert('Lỗi khi xóa: ' + (result.message || 'Lỗi không xác định'));
      }
    } catch (err) {
      // Fallback to local delete if API fails or not supported
      const updatedExpenses = expenses.filter(e => e.id_thu_chi !== id);
      setExpenses(updatedExpenses);
      localStorage.setItem('admin_expenses', JSON.stringify(updatedExpenses));
    }
  };

  // Statistics Calculation
  const stats = useMemo(() => {
    const now = new Date();
    
    // Helper to check if date is in range
    const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
    const isSameWeek = (d1: Date, d2: Date) => {
      const oneDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.round(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
      return diffDays <= 7; // Simple approximation
    };
    const isSameMonth = (d1: Date, d2: Date) => d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const isSameYear = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear();

    const filterByTime = (itemDate: Date, range: TimeRange) => {
      if (range === 'day') return isSameDay(itemDate, now);
      if (range === 'week') return isSameWeek(itemDate, now);
      if (range === 'month') return isSameMonth(itemDate, now);
      if (range === 'year') return isSameYear(itemDate, now);
      return true;
    };

    // Previous period filter
    const filterByPreviousTime = (itemDate: Date, range: TimeRange) => {
      const prev = new Date(now);
      if (range === 'day') prev.setDate(prev.getDate() - 1);
      if (range === 'week') prev.setDate(prev.getDate() - 7);
      if (range === 'month') prev.setMonth(prev.getMonth() - 1);
      if (range === 'year') prev.setFullYear(prev.getFullYear() - 1);

      if (range === 'day') return isSameDay(itemDate, prev);
      if (range === 'week') return isSameWeek(itemDate, prev); // Approximate
      if (range === 'month') return isSameMonth(itemDate, prev);
      if (range === 'year') return isSameYear(itemDate, prev);
      return false;
    };

    const filteredOrders = orders.filter(o => o.orderStatus === 'Hoàn thành' && filterByTime(new Date(o.timestamp), timeRange));
    const filteredExpenses = expenses.filter(e => filterByTime(new Date(e.thoi_gian), timeRange));
    
    const prevOrders = orders.filter(o => o.orderStatus === 'Hoàn thành' && filterByPreviousTime(new Date(o.timestamp), timeRange));
    const prevExpenses = expenses.filter(e => filterByPreviousTime(new Date(e.thoi_gian), timeRange));

    const revenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const cost = filteredExpenses.reduce((sum, e) => sum + Number(e.so_tien), 0);
    const profit = revenue - cost;
    const orderCount = filteredOrders.length;

    const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);
    const prevCost = prevExpenses.reduce((sum, e) => sum + Number(e.so_tien), 0);

    const growth = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : ((revenue - prevRevenue) / prevRevenue) * 100;
    const costGrowth = prevCost === 0 ? (cost > 0 ? 100 : 0) : ((cost - prevCost) / prevCost) * 100;

    // Expense Breakdown for Pie Chart
    const expenseBreakdown = filteredExpenses.reduce((acc, expense) => {
      acc[expense.danh_muc] = (acc[expense.danh_muc] || 0) + Number(expense.so_tien);
      return acc;
    }, {} as Record<string, number>);

    const expenseData = Object.keys(expenseBreakdown).map(key => ({
      name: key,
      value: expenseBreakdown[key],
    }));

    // Revenue Data for Chart
    const revenueDataMap: Record<string, number> = {};
    // Initialize map with empty values for better chart look if needed, or just map existing
    // For simplicity, map existing
    filteredOrders.forEach(order => {
      const date = new Date(order.timestamp);
      let key = '';
      if (timeRange === 'day') key = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      else if (timeRange === 'week' || timeRange === 'month') key = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      else key = date.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
      
      revenueDataMap[key] = (revenueDataMap[key] || 0) + order.total;
    });

    // Sort keys
    const sortedKeys = Object.keys(revenueDataMap).sort((a, b) => {
       // Simple string sort might fail for dates, but for 'day' (HH:mm) it works roughly. 
       // Ideally we parse back to date to sort.
       return a.localeCompare(b);
    });

    const revenueData = sortedKeys.map(key => ({
      name: key,
      revenue: revenueDataMap[key],
    }));

    return { revenue, cost, profit, orderCount, expenseData, revenueData, growth, costGrowth };
  }, [orders, expenses, timeRange]);

  const COLORS = ['#C9252C', '#B91C1C', '#991B1B', '#7F1D1D', '#450A0A'];

  if (!appsScriptUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-3xl flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-stone-800 dark:text-white mb-2">Chưa cấu hình</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-xs">Vui lòng thiết lập URL Apps Script trong phần Cài đặt để quản lý.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-md px-4 pt-3 pb-3 space-y-3 border-b border-stone-100 dark:border-stone-800 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex-grow flex bg-stone-100 dark:bg-stone-900/50 p-1 rounded-2xl border border-stone-200/50 dark:border-stone-800/50">
            {[
              { id: 'dashboard', label: 'Báo cáo', icon: LayoutDashboard },
              { id: 'orders', label: 'Đơn hàng', icon: ListOrdered },
              { id: 'menu', label: 'Menu', icon: MenuIcon },
              { id: 'expenses', label: 'Chi tiêu', icon: Wallet },
              { id: 'inventory', label: 'Nhập kho', icon: Package },
            ].map((tab) => {
              const isActive = viewMode === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as any)}
                  className={`flex-1 py-2 rounded-xl transition-all duration-300 flex flex-col items-center justify-center gap-0.5 tap-active ${
                    isActive 
                      ? 'bg-stone-800 dark:bg-white text-white dark:text-black shadow-md scale-[1.02] z-10' 
                      : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-400'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                  <span className="text-[8px] font-black uppercase tracking-tighter leading-none">
                    {tab.label.split(' ').map((word, i) => (
                      <React.Fragment key={i}>
                        {word}
                        {i === 0 && tab.label.includes(' ') && <br />}
                      </React.Fragment>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (viewMode === 'orders') fetchAllData(false);
              else if (viewMode === 'expenses') fetchTransactions();
              else if (viewMode === 'inventory') fetchInventory();
              else fetchAllData(false);
            }}
            disabled={isRefreshing}
            className={`flex-shrink-0 w-10 h-10 bg-stone-100 dark:bg-stone-900 text-stone-500 dark:text-stone-400 rounded-2xl flex items-center justify-center tap-active border border-stone-200/50 dark:border-stone-800/50 transition-all ${isRefreshing ? 'animate-spin opacity-50' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {viewMode === 'dashboard' && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'day', label: 'Hôm nay' },
              { id: 'week', label: '7 ngày' },
              { id: 'month', label: 'Tháng này' },
              { id: 'year', label: 'Năm nay' },
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id as TimeRange)}
                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all tap-active ${
                  timeRange === range.id
                    ? 'bg-[#C9252C] text-white shadow-lg shadow-red-100 dark:shadow-none'
                    : 'bg-white dark:bg-stone-900 text-stone-400 dark:text-stone-500 border border-stone-100 dark:border-stone-800'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-grow">
            <p className="text-sm font-bold text-red-800 dark:text-red-300">
              {error.includes('Rate Limit') 
                ? 'Hệ thống đang bận (Rate Limit). Vui lòng thử lại sau 1-2 phút.' 
                : error}
            </p>
          </div>
          <button 
            onClick={() => fetchAllData(true)}
            className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 hover:underline"
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="p-6 space-y-6">
        <AnimatePresence mode="wait">
          {viewMode === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-stone-900 p-6 rounded-[32px] border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow duration-300 space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-16 h-16 text-[#C9252C]" />
                  </div>
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">Doanh thu</p>
                    <p className="text-2xl font-black text-stone-800 dark:text-white leading-none tracking-tight">{stats.revenue.toLocaleString()}đ</p>
                  </div>
                  {Math.abs(stats.growth) > 0 && (
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full w-fit ${stats.growth >= 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                      {stats.growth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(stats.growth).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-stone-900 p-6 rounded-[32px] border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow duration-300 space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingDown className="w-16 h-16 text-stone-400" />
                  </div>
                  <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-2xl flex items-center justify-center">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">Chi tiêu</p>
                    <p className="text-2xl font-black text-stone-800 dark:text-white leading-none tracking-tight">{stats.cost.toLocaleString()}đ</p>
                  </div>
                  {Math.abs(stats.costGrowth) > 0 && (
                    <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full w-fit ${stats.costGrowth <= 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                      {stats.costGrowth > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(stats.costGrowth).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className={`p-8 rounded-[32px] shadow-xl space-y-4 col-span-2 transition-all duration-500 relative overflow-hidden ${stats.profit >= 0 ? 'bg-gradient-to-br from-[#C9252C] to-[#991B1B] shadow-red-200 dark:shadow-none' : 'bg-gradient-to-br from-stone-800 to-stone-900 shadow-stone-200 dark:shadow-none'}`}>
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                    </svg>
                  </div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm text-white rounded-2xl flex items-center justify-center border border-white/10">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full backdrop-blur-md border border-white/10 ${stats.profit >= 0 ? 'text-white bg-white/10' : 'text-white bg-white/10'}`}>
                      Lợi nhuận ròng
                    </span>
                  </div>
                  
                  <div className="relative z-10">
                    <p className="text-4xl font-black text-white leading-none tracking-tight mb-2">{stats.profit.toLocaleString()}đ</p>
                    <div className="flex items-center gap-2 text-white/80 text-xs font-bold">
                      <Package className="w-4 h-4" />
                      <span>{stats.orderCount} đơn hàng hoàn thành</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-stone-900 p-6 rounded-[24px] border border-stone-100 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none">
                  <h3 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-6">Phân bổ chi tiêu</h3>
                  <div className="h-64 relative">
                    {stats.expenseData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.expenseData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {stats.expenseData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', padding: '12px 16px', fontWeight: 'bold'}} 
                            itemStyle={{color: '#1c1917'}}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-300 dark:text-stone-600">
                        <Wallet className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs font-bold">Chưa có dữ liệu chi tiêu</span>
                      </div>
                    )}
                    {stats.expenseData.length > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-black text-stone-800 dark:text-white">{stats.expenseData.length}</span>
                        <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Danh mục</span>
                      </div>
                    )}
                  </div>
                  {stats.expenseData.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-6">
                      {stats.expenseData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 p-2 rounded-xl">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs font-bold text-stone-600 dark:text-stone-300 truncate flex-grow">{entry.name}</span>
                          <span className="text-[10px] font-black text-stone-400 dark:text-stone-500">{((entry.value / stats.cost) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity Summary */}
              <div className="bg-white dark:bg-stone-900 rounded-[24px] p-6 border border-stone-100 dark:border-stone-800 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-none space-y-5">
                <h3 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest">Tóm tắt hoạt động</h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-3 border-b border-stone-50 dark:border-stone-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500">
                        <ListOrdered className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-300">Đơn hàng mới</span>
                    </div>
                    <span className="text-sm font-black text-stone-800 dark:text-white">{orders.filter(o => o.orderStatus === 'Đã nhận' || o.orderStatus === 'Chờ xử lý').length}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-stone-50 dark:border-stone-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-300">Đang thực hiện</span>
                    </div>
                    <span className="text-sm font-black text-stone-800 dark:text-white">{orders.filter(o => o.orderStatus === 'Đang làm').length}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-stone-50 dark:border-stone-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-300">Giao dịch chi tiêu</span>
                    </div>
                    <span className="text-sm font-black text-stone-800 dark:text-white">{expenses.length}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center px-1">
                <h2 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest">Quản lý đơn hàng</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all tap-active ${
                      showSettings ? 'bg-stone-900 dark:bg-white text-white dark:text-black shadow-xl' : 'bg-white dark:bg-stone-900 text-stone-400 dark:text-stone-500 border border-stone-100 dark:border-stone-800 shadow-sm'
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => fetchAllData(false)}
                    className="w-10 h-10 bg-white dark:bg-stone-900 rounded-[14px] border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#C9252C]' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Status Filter Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scroll-smooth">
                  {[
                    { id: 'All', label: 'Tất cả', count: orders.length, color: 'bg-stone-500' },
                    { id: 'Chờ xử lý', label: 'Chờ xử lý', count: orders.filter(o => o.orderStatus === 'Chờ xử lý').length, color: 'bg-amber-500' },
                    { id: 'Đã nhận', label: 'Đã nhận', count: orders.filter(o => o.orderStatus === 'Đã nhận').length, color: 'bg-amber-500' },
                    { id: 'Đang làm', label: 'Đang làm', count: orders.filter(o => o.orderStatus === 'Đang làm').length, color: 'bg-blue-500' },
                    { id: 'Hoàn thành', label: 'Hoàn thành', count: orders.filter(o => o.orderStatus === 'Hoàn thành').length, color: 'bg-[#C9252C]' },
                    { id: 'Đã hủy', label: 'Đã hủy', count: orders.filter(o => o.orderStatus === 'Đã hủy').length, color: 'bg-red-500' },
                  ].map((status) => {
                    const isSelected = filterStatus === status.id;
                    return (
                      <button
                        key={status.id}
                        onClick={() => setFilterStatus(status.id)}
                        className={`px-4 py-2.5 rounded-[16px] whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all tap-active flex items-center gap-2 border ${
                          isSelected
                            ? `${status.color} text-white border-transparent shadow-[0_8px_20px_-4px_rgba(0,0,0,0.2)] scale-105 z-10`
                            : 'bg-white dark:bg-stone-900 text-stone-400 dark:text-stone-500 border-stone-100 dark:border-stone-800 shadow-sm hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        {status.color && (
                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : status.color}`} />
                        )}
                        {status.label}
                        <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                        }`}>
                          {status.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

              {showSettings && (
                <div className="card p-6 shadow-xl space-y-6 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Làm mới</label>
                      <select 
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20"
                      >
                        <option value={10}>10 giây</option>
                        <option value={30}>30 giây</option>
                        <option value={60}>1 phút</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Sắp xếp</label>
                      <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-stone-50 dark:bg-stone-800 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20"
                      >
                        <option value="time">Mới nhất</option>
                        <option value="status">Trạng thái</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="text-center py-20 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-[24px] flex items-center justify-center mb-4 text-stone-300 dark:text-stone-600">
                      <Package className="w-8 h-8" />
                    </div>
                    <p className="text-stone-400 dark:text-stone-500 font-bold">Chưa có đơn hàng nào</p>
                  </div>
                ) : (
                  orders
                    .filter(order => filterStatus === 'All' || order.orderStatus === filterStatus)
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((order, index) => {
                    const isNew = (order.orderStatus === 'Đã nhận' || order.orderStatus === 'Chờ xử lý') && 
                                  (currentTime.getTime() - new Date(order.timestamp).getTime()) < 60000;
                    
                    return (
                      <div 
                        key={`order-${order.orderId || 'unknown'}-${index}`}
                        className={`card p-5 space-y-4 relative overflow-hidden duration-500 bg-white dark:bg-stone-900 ${
                          isNew ? 'border-[#C9252C] ring-4 ring-[#C9252C]/10' : 'border-stone-100 dark:border-stone-800'
                        }`}
                      >
                        {/* Status Progress Bar */}
                        <div className="flex gap-1 mb-2">
                          {['Chờ xử lý', 'Đã nhận', 'Đang làm', 'Hoàn thành'].map((step, idx) => {
                            const currentIdx = ['Chờ xử lý', 'Đã nhận', 'Đang làm', 'Hoàn thành'].indexOf(order.orderStatus);
                            const isCompleted = currentIdx >= idx;
                            const isCancelled = order.orderStatus === 'Đã hủy';
                            
                            if (isCancelled) return null;

                            return (
                              <div 
                                key={step} 
                                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                                  isCompleted ? 'bg-[#C9252C]' : 'bg-stone-100 dark:bg-stone-800'
                                }`} 
                              />
                            );
                          })}
                          {order.orderStatus === 'Đã hủy' && <div className="h-1 flex-1 rounded-full bg-red-500" />}
                        </div>

                        <div className="flex justify-between items-start">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">#{order.orderId}</span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                                order.orderStatus === 'Hoàn thành' ? 'bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400' :
                                order.orderStatus === 'Đã hủy' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                                order.orderStatus === 'Đang làm' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                              }`}>
                                {order.orderStatus}
                              </span>
                            </div>
                            <h3 className="font-black text-stone-800 dark:text-white text-xl leading-none">{order.customerName}</h3>
                            <div className="flex items-center gap-3 text-stone-400 dark:text-stone-500 text-[11px] font-bold mt-1">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.tableNumber || 'Mang đi'}</span>
                              {order.phoneNumber && <span className="flex items-center gap-1"><User className="w-3 h-3" />{order.phoneNumber}</span>}
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(order.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[#C9252C] dark:text-red-400 font-black text-2xl leading-none mb-2">{order.total.toLocaleString()}đ</p>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${
                              order.paymentStatus === 'Đã thanh toán' ? 'border-red-100 dark:border-red-900/30 text-[#C9252C] dark:text-red-400 bg-red-50 dark:bg-red-900/20' : 'border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                            }`}>
                              {order.paymentStatus === 'Đã thanh toán' ? 'Đã trả' : 'Chưa trả'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-stone-50 dark:bg-stone-800 rounded-[18px] p-4 space-y-2 border border-stone-100/50 dark:border-stone-700/50">
                          {order.items.map((item: any, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[#C9252C] dark:text-red-400 font-black">{item.quantity}x</span>
                                <span className="text-stone-800 dark:text-white font-bold">{item.name}</span>
                              </div>
                              <span className="text-stone-400 dark:text-stone-500 font-bold text-[10px] uppercase bg-white dark:bg-stone-700 px-2 py-0.5 rounded-md border border-stone-100 dark:border-stone-600">{item.size}</span>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <button onClick={() => updateStatus(order.orderId, 'Đang làm')} className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 tap-active ${order.orderStatus === 'Đang làm' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'}`}>Làm món</button>
                          <button onClick={() => {
                            if (window.confirm('Xác nhận đơn hàng này đã hoàn thành và thanh toán?')) {
                              updateStatus(order.orderId, 'Hoàn thành', 'Đã thanh toán');
                            }
                          }} className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 tap-active ${order.orderStatus === 'Hoàn thành' ? 'border-[#C9252C] bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400' : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'}`}>Xong</button>
                          <button onClick={() => updateStatus(order.orderId, 'Đã hủy')} className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 tap-active ${order.orderStatus === 'Đã hủy' ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'}`}>Hủy</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {orders.filter(order => filterStatus === 'All' || order.orderStatus === filterStatus).length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 pb-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed tap-active"
                  >
                    Trang trước
                  </button>
                  <span className="text-stone-500 dark:text-stone-400 font-bold text-sm">
                    Trang {currentPage} / {Math.ceil(orders.filter(order => filterStatus === 'All' || order.orderStatus === filterStatus).length / ITEMS_PER_PAGE)}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(orders.filter(order => filterStatus === 'All' || order.orderStatus === filterStatus).length / ITEMS_PER_PAGE), prev + 1))}
                    disabled={currentPage === Math.ceil(orders.filter(order => filterStatus === 'All' || order.orderStatus === filterStatus).length / ITEMS_PER_PAGE)}
                    className="px-4 py-2 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed tap-active"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {viewMode === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <MenuManager appsScriptUrl={appsScriptUrl} />
            </motion.div>
          )}

          {viewMode === 'expenses' && (
            <motion.div
              key="expenses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center px-1">
                <h2 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest">Quản lý chi tiêu</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fetchTransactions()}
                    className="w-10 h-10 bg-white dark:bg-stone-900 rounded-[14px] border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowExpenseForm(true)}
                    className="w-12 h-12 bg-[#C9252C] text-white rounded-[16px] flex items-center justify-center shadow-lg shadow-red-100 dark:shadow-none tap-active hover:bg-[#a01d23] transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Expense List */}
              <div className="space-y-4">
                {expenses.length === 0 ? (
                  <div className="text-center py-20 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-[24px] flex items-center justify-center mb-4 text-stone-300 dark:text-stone-600">
                      <Wallet className="w-8 h-8" />
                    </div>
                    <p className="text-stone-400 dark:text-stone-500 font-bold">Chưa có khoản chi nào</p>
                  </div>
                ) : (
                  expenses.map((expense, index) => (
                    <div key={`${expense.id_thu_chi}-${index}`} className="card p-5 flex items-center justify-between bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 rounded-[16px] flex items-center justify-center border border-stone-100 dark:border-stone-800">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-800 dark:text-white text-lg leading-none mb-1">{expense.ghi_chu}</h4>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                            <span className="bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">{expense.danh_muc}</span>
                            <span>•</span>
                            <span>{new Date(expense.thoi_gian).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <p className={`${expense.phan_loai === 'Thu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} font-black text-lg`}>
                          {expense.phan_loai === 'Thu' ? '+' : '-'}{Number(expense.so_tien).toLocaleString()}đ
                        </p>
                        <button onClick={() => deleteExpense(expense.id_thu_chi)} className="w-8 h-8 flex items-center justify-center bg-stone-50 dark:bg-stone-800 rounded-xl text-stone-300 dark:text-stone-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 tap-active transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {viewMode === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center px-1">
                <h2 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest">Quản lý nhập kho</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => fetchInventory()}
                    className="w-10 h-10 bg-white dark:bg-stone-900 rounded-[14px] border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowInventoryForm(true)}
                    className="w-12 h-12 bg-emerald-600 text-white rounded-[16px] flex items-center justify-center shadow-lg shadow-emerald-100 dark:shadow-none tap-active hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {inventoryLogs.length === 0 ? (
                  <div className="text-center py-20 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-[24px] flex items-center justify-center mb-4 text-stone-300 dark:text-stone-600">
                      <Package className="w-8 h-8" />
                    </div>
                    <p className="text-stone-400 dark:text-stone-500 font-bold">Chưa có phiếu nhập kho nào</p>
                  </div>
                ) : (
                  inventoryLogs.map((log, idx) => (
                    <div key={`${log.id_nhap}-${idx}`} className="card p-5 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800">
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">{log.id_nhap}</span>
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-md">{log.ma_nl}</span>
                          </div>
                          <h4 className="font-bold text-stone-800 dark:text-white text-lg leading-none">{log.materialName}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-600 dark:text-emerald-400 font-black text-lg">+{log.so_luong_nhap}</p>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-stone-50 dark:border-stone-800">
                        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                          Đơn giá: {Number(log.don_gia_nhap).toLocaleString()}đ
                        </div>
                        <div className="text-[10px] font-black text-stone-800 dark:text-white uppercase tracking-widest">
                          Tổng: {(log.so_luong_nhap * log.don_gia_nhap).toLocaleString()}đ
                        </div>
                      </div>
                      {log.ghi_chu && (
                        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400 italic">"{log.ghi_chu}"</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expense Form Modal */}
      <AnimatePresence>
        {showExpenseForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-[60]">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white dark:bg-stone-900 rounded-t-[40px] w-full p-8 shadow-2xl space-y-6 border-t border-stone-100 dark:border-stone-800"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-stone-800 dark:text-white">Thêm giao dịch</h3>
                <button onClick={() => setShowExpenseForm(false)} className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={addExpense} className="space-y-4">
                {expenseError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold border border-red-100 dark:border-red-900/30">
                    {expenseError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Phân loại</label>
                  <select
                    value={expenseType}
                    onChange={(e) => setExpenseType(e.target.value)}
                    className="input-field font-bold"
                  >
                    <option value="Chi">Khoản chi</option>
                    <option value="Thu">Khoản thu</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Số tiền</label>
                  <input
                    type="number"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="input-field text-xl font-black"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Nội dung</label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="Ví dụ: Mua sữa, trà..."
                    className="input-field font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Danh mục</label>
                  <select
                    value={expenseCat}
                    onChange={(e) => setExpenseCat(e.target.value)}
                    className="input-field font-bold"
                  >
                    {[
                      "Nguyên liệu", "Bao bì & Dụng cụ", "Điện", "Nước", "Wifi", "Rác", 
                      "Mặt bằng", "Nhân viên", "Vận chuyển", "Phí nền tảng", "Sửa chữa & Bảo trì", 
                      "Trang thiết bị", "Marketing & In ấn", "Thu bán hàng", "Thanh lý", "Thu khác", "Khác"
                    ].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary mt-4 shadow-xl shadow-stone-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu giao dịch'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inventory Form Modal */}
      <AnimatePresence>
        {showInventoryForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-[60]">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white dark:bg-stone-900 rounded-t-[40px] w-full p-8 shadow-2xl space-y-6 border-t border-stone-100 dark:border-stone-800"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-stone-800 dark:text-white">Nhập kho nguyên liệu</h3>
                <button onClick={() => setShowInventoryForm(false)} className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={addInventory} className="space-y-4">
                {inventoryError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold border border-red-100 dark:border-red-900/30">
                    {inventoryError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Nguyên liệu</label>
                  <select
                    value={inventoryMaterial}
                    onChange={(e) => setInventoryMaterial(e.target.value)}
                    className="input-field font-bold"
                  >
                    {availableMaterials.map(m => (
                      <option key={m.code || m.ma_nl} value={m.code || m.ma_nl}>
                        {(m.code || m.ma_nl)} - {(m.name || m.ten_nl || m.ten_mon)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Số lượng</label>
                    <input
                      type="number"
                      required
                      value={inventoryAmount}
                      onChange={(e) => setInventoryAmount(e.target.value)}
                      placeholder="0"
                      className="input-field font-black"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Đơn giá</label>
                    <input
                      type="number"
                      required
                      value={inventoryPrice}
                      onChange={(e) => setInventoryPrice(e.target.value)}
                      placeholder="0"
                      className="input-field font-black"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Ghi chú</label>
                  <input
                    type="text"
                    value={inventoryNote}
                    onChange={(e) => setInventoryNote(e.target.value)}
                    placeholder="Nhà cung cấp, hạn sử dụng..."
                    className="input-field font-bold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-emerald-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-emerald-100 dark:shadow-none tap-active flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
