import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, RefreshCw, AlertCircle, Check, ChevronRight, Package, Settings as SettingsIcon, Filter, MoreVertical, Power, TrendingUp, Calendar as CalendarIcon, Hash, Coffee, DollarSign, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Solar, Lunar } from 'lunar-javascript';
import { GoogleGenAI } from "@google/genai";
import { useData } from '../context/DataContext';

interface MenuManagerProps {
  appsScriptUrl: string;
}

interface MenuItem {
  ma_mon: string;
  ten_mon: string;
  gia_ban: number;
  danh_muc: string;
  co_san: boolean;
  has_customizations: boolean;
  inventoryQty?: number;
}

export function MenuManager({ appsScriptUrl }: MenuManagerProps) {
  const { menuItems: rawMenuItems, orders, isLoading: isDataLoading, isRefreshing, error: dataError, fetchAllData, lastUpdated } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [forecastDays, setForecastDays] = useState<7 | 14 | 30>(7);
  const [showForecast, setShowForecast] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isGeneratingSeasonal, setIsGeneratingSeasonal] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState<any[] | null>(null);
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [isUpdatingInventory, setIsUpdatingInventory] = useState(false);

  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastUpdated) {
        setTimeAgo('');
        return;
      }
      const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
      if (seconds < 60) setTimeAgo('Vừa xong');
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)} phút trước`);
      else setTimeAgo(`${Math.floor(seconds / 3600)} giờ trước`);
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Map rawMenuItems to local MenuItem format
  const menuItems = useMemo(() => {
    return rawMenuItems.map(item => ({
      ma_mon: item.id,
      ten_mon: item.name,
      gia_ban: item.price,
      danh_muc: item.category,
      co_san: !item.isOutOfStock,
      has_customizations: item.hasCustomizations,
      inventoryQty: item.inventoryQty
    }));
  }, [rawMenuItems]);
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null); // null means adding new
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    ten_mon: '',
    gia_ban: 0,
    danh_muc: '',
    co_san: true,
    has_customizations: false,
    inventoryQty: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Sync Mechanism: Handled by DataContext
  useEffect(() => {
    if (dataError) setError(dataError);
  }, [dataError]);

  // Derived State: Categories for dropdown
  const existingCategories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(i => i.danh_muc)))
      .filter(Boolean)
      .filter(cat => cat.trim().toLowerCase() !== 'tất cả');
    return cats.sort();
  }, [menuItems]);

  // Derived State: Grouped Items for UI
  const filteredItems = useMemo(() => {
    let items = menuItems;
    
    if (searchQuery) {
      items = items.filter(item => 
        item.ten_mon.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.ma_mon.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.danh_muc.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (activeCategory !== 'Tất cả') {
      items = items.filter(item => item.danh_muc === activeCategory);
    }
    
    return items;
  }, [menuItems, searchQuery, activeCategory]);

  // Inventory Forecast Logic
  const inventoryForecast = useMemo(() => {
    const now = new Date();
    const startTime = new Date(now.getTime() - forecastDays * 24 * 60 * 60 * 1000);
    
    // Filter orders in the selected period
    const periodOrders = orders.filter(o => new Date(o.timestamp) >= startTime && o.orderStatus === 'Hoàn thành');
    
    // Calculate consumption per item
    const consumptionMap: Record<string, number> = {};
    periodOrders.forEach(order => {
      order.items.forEach(item => {
        consumptionMap[item.name] = (consumptionMap[item.name] || 0) + item.quantity;
      });
    });

    // Forecast for each menu item
    return menuItems
      .filter(item => item.inventoryQty !== undefined)
      .map(item => {
        const consumptionInPeriod = consumptionMap[item.ten_mon] || 0;
        const dailyConsumption = consumptionInPeriod / forecastDays;
        
        // Predicted days until out of stock
        const daysLeft = dailyConsumption > 0 ? (item.inventoryQty || 0) / dailyConsumption : Infinity;
        
        // Suggested restock for the NEXT period of the same length
        const suggestedRestock = Math.max(0, Math.ceil(dailyConsumption * forecastDays) - (item.inventoryQty || 0));

        return {
          ...item,
          dailyConsumption,
          daysLeft,
          suggestedRestock,
          predictedOutOfStockDate: daysLeft === Infinity ? null : new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000)
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [menuItems, orders, forecastDays]);

  const generateAIInsights = async () => {
    if (isGeneratingInsights) return;
    setIsGeneratingInsights(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Prepare data for AI
      const salesData = inventoryForecast.map(item => ({
        name: item.ten_mon,
        dailySales: item.dailyConsumption.toFixed(2),
        stock: item.inventoryQty,
        daysLeft: item.daysLeft === Infinity ? 'N/A' : Math.ceil(item.daysLeft)
      }));

      const prompt = `Dựa trên dữ liệu bán hàng 7 ngày qua: ${JSON.stringify(salesData)}. 
      Hãy phân tích xu hướng:
      1. Món nào đang "hot" (tăng trưởng nhanh)?
      2. Món nào cần nhập hàng gấp hơn dự kiến?
      3. Gợi ý chiến lược tồn kho ngắn hạn.
      Trả về kết quả bằng tiếng Việt, ngắn gọn, súc tích, định dạng Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsights(response.text || "Không thể tạo phân tích lúc này.");
    } catch (err) {
      console.error("AI Insights Error:", err);
      setAiInsights("Lỗi khi kết nối với AI.");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const generateSeasonalAnalysis = async () => {
    if (isGeneratingSeasonal) return;
    setIsGeneratingSeasonal(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Prepare long-term data (last 90 days)
      const now = new Date();
      const solar = Solar.fromDate(now);
      const lunar = solar.getLunar();
      const lunarDateStr = `Ngày ${lunar.getDay()} tháng ${lunar.getMonth()} năm ${lunar.getYear()} (Âm lịch)`;
      const lunarLeStr = lunar.getFestivals().join(', ') || 'Không có lễ hội âm lịch';

      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const longTermOrders = orders.filter(o => new Date(o.timestamp) >= ninetyDaysAgo && o.orderStatus === 'Hoàn thành');
      
      const monthlySales: Record<string, Record<string, number>> = {};
      longTermOrders.forEach(order => {
        const month = new Date(order.timestamp).toLocaleString('vi-VN', { month: 'long' });
        if (!monthlySales[month]) monthlySales[month] = {};
        order.items.forEach(item => {
          monthlySales[month][item.name] = (monthlySales[month][item.name] || 0) + item.quantity;
        });
      });

      const prompt = `Dựa trên dữ liệu bán hàng 90 ngày qua: ${JSON.stringify(monthlySales)}. 
      Hôm nay là ngày ${now.toLocaleDateString('vi-VN')}.
      Thông tin lịch âm Việt Nam: ${lunarDateStr}. Các lễ hội âm lịch hôm nay: ${lunarLeStr}.
      Hãy phân tích mùa vụ và dự báo cho các dịp đặc biệt, ĐẶC BIỆT lưu ý các ngày lễ tết theo LỊCH ÂM của Việt Nam (như Tết Nguyên Đán, Rằm tháng Giêng, Giỗ tổ Hùng Vương, Giải phóng miền Nam 30/4, Quốc tế lao động 1/5, Rằm tháng Bảy, Trung Thu, v.v.) trong năm 2026:
      1. Xu hướng thay đổi theo tháng và theo các dịp lễ tết âm/dương lịch sắp tới?
      2. Dự báo nhu cầu cho các ngày lễ/sự kiện sắp tới dựa trên lịch sử và đặc thù văn hóa Việt Nam (sử dụng thông tin lịch âm đã cung cấp).
      3. Gợi ý các món nên đẩy mạnh hoặc chuẩn bị nguyên liệu sớm (ví dụ: món giải nhiệt mùa hè, món ấm nóng mùa đông, món quà tặng dịp lễ).
      Trả về kết quả bằng tiếng Việt, chuyên nghiệp, định dạng Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsights(response.text || "Không thể tạo phân tích mùa vụ.");
    } catch (err) {
      console.error("Seasonal Analysis Error:", err);
      setAiInsights("Lỗi khi kết nối với AI để phân tích mùa vụ.");
    } finally {
      setIsGeneratingSeasonal(false);
    }
  };

  const createPurchaseOrder = () => {
    const itemsToRestock = inventoryForecast.filter(item => item.suggestedRestock > 0);
    if (itemsToRestock.length === 0) {
      alert("Tất cả mặt hàng đều đủ tồn kho!");
      return;
    }
    setPurchaseOrder(itemsToRestock);
    alert(`Đã tạo đơn nhập hàng dự kiến với ${itemsToRestock.length} mặt hàng. Bạn có thể kiểm tra trong phần Chi tiết đơn nhập.`);
  };

  useEffect(() => {
    if (showForecast && !aiInsights && orders.length > 0) {
      generateAIInsights();
    }
  }, [showForecast, orders.length]);

  // 2. Add Flow
  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      ma_mon: `M${Date.now().toString().slice(-6)}`,
      ten_mon: '',
      gia_ban: 0,
      danh_muc: existingCategories[0] || 'Cà phê',
      co_san: true,
      has_customizations: false,
      inventoryQty: 0
    });
    setIsModalOpen(true);
  };

  // 3. Edit Flow
  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  // 4. Delete Flow
  const handleDelete = async (ma_mon: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa món này không? Hành động này không thể hoàn tác.')) return;

    setIsLoading(true);
    try {
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteMenuItem', ma_mon }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === 'success') {
        alert('Đã xóa món thành công!');
        await fetchAllData(); // Refresh list
      } else {
        throw new Error(result.message || 'Lỗi khi xóa món');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Toggle Availability
  const handleToggleAvailability = async (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const payload = {
        action: 'editMenuItem',
        ma_mon: item.ma_mon,
        ten_mon: item.ten_mon,
        gia_ban: item.gia_ban,
        danh_muc: item.danh_muc,
        co_san: !item.co_san,
        has_customizations: item.has_customizations,
        inventoryQty: item.inventoryQty
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData();
      }
    } catch (err) {
      console.error("Failed to toggle availability", err);
    }
  };

  const handleInventorySave = async (ma_mon: string) => {
    setIsUpdatingInventory(true);
    try {
      const item = menuItems.find(i => i.ma_mon === ma_mon);
      if (!item) return;

      const payload = {
        action: 'editMenuItem',
        ma_mon: item.ma_mon,
        ten_mon: item.ten_mon,
        gia_ban: item.gia_ban,
        danh_muc: item.danh_muc,
        co_san: item.co_san,
        has_customizations: item.has_customizations,
        inventoryQty: inventoryValue
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        setEditingInventoryId(null);
        await fetchAllData();
      } else {
        alert('Lỗi: ' + (result.message || 'Không thể cập nhật tồn kho'));
      }
    } catch (err) {
      console.error("Failed to update inventory", err);
      alert('Lỗi kết nối khi cập nhật tồn kho');
    } finally {
      setIsUpdatingInventory(false);
    }
  };

  // 5. Smart Form Logic
  const handlePriceBlur = () => {
    if (formData.gia_ban && formData.gia_ban > 0 && formData.gia_ban < 1000) {
      setFormData(prev => ({ ...prev, gia_ban: prev.gia_ban! * 1000 }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const finalCategory = formData.danh_muc;
      if (!finalCategory) throw new Error('Vui lòng chọn hoặc nhập danh mục');

      const payload: any = {
        action: editingItem ? 'editMenuItem' : 'addMenuItem',
        ma_mon: formData.ma_mon,
        ten_mon: formData.ten_mon,
        gia_ban: Number(formData.gia_ban),
        danh_muc: finalCategory,
        co_san: formData.co_san,
        has_customizations: formData.has_customizations,
        inventoryQty: Number(formData.inventoryQty || 0)
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        setIsModalOpen(false);
        alert(editingItem ? 'Đã cập nhật món thành công!' : 'Đã thêm món mới thành công!');
        await fetchAllData(); // Refresh list
      } else {
        throw new Error(result.message || 'Lỗi từ máy chủ');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-stone-100 dark:border-stone-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tight">Quản lý Menu</h1>
          <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-0.5">
            {menuItems.length} món ăn • {existingCategories.length} danh mục
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowForecast(!showForecast)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all tap-active shadow-sm ${
              showForecast 
                ? 'bg-emerald-500 text-white border-emerald-500' 
                : 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500'
            }`}
            title="Dự báo tồn kho"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <div className="flex flex-col items-center">
            <button 
              onClick={() => fetchAllData()}
              disabled={isLoading || isRefreshing}
              className="w-10 h-10 bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin text-[#C9252C]' : ''}`} />
            </button>
            {timeAgo && (
              <span className="text-[8px] font-bold text-stone-400 dark:text-stone-500 mt-1 whitespace-nowrap">
                {timeAgo}
              </span>
            )}
          </div>
          <button 
            onClick={handleAddNew}
            className="bg-[#C9252C] text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-100 dark:shadow-none tap-active hover:bg-[#a01d23] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm món</span>
            <span className="sm:hidden">Thêm</span>
          </button>
        </div>
      </div>

      {/* Forecast Section */}
      <AnimatePresence>
        {showForecast && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 overflow-hidden"
          >
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-stone-800 dark:text-white uppercase tracking-tight">Dự báo nhập hàng thông minh</h3>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Phân tích dựa trên dữ liệu bán hàng thực tế</p>
                </div>
                <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
                  {[7, 14, 30].map(days => (
                    <button
                      key={days}
                      onClick={() => setForecastDays(days as any)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        forecastDays === days
                          ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-white shadow-sm'
                          : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                      }`}
                    >
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventoryForecast.slice(0, 6).map((item, idx) => (
                  <div key={`forecast-item-${idx}`} className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700/50 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-grow">
                        <h4 className="font-bold text-stone-800 dark:text-white text-sm leading-tight line-clamp-1">{item.ten_mon}</h4>
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{item.danh_muc}</p>
                      </div>
                      {item.daysLeft <= 3 && (
                        <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md animate-pulse">Sắp hết</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-stone-400 uppercase tracking-widest">Tồn kho hiện tại:</span>
                        <span className="text-stone-800 dark:text-white">{item.inventoryQty} món</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-stone-400 uppercase tracking-widest">Tiêu thụ trung bình:</span>
                        <span className="text-stone-800 dark:text-white">{item.dailyConsumption.toFixed(1)} món/ngày</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-stone-400 uppercase tracking-widest">Dự kiến hết hàng:</span>
                        <span className={`${item.daysLeft <= 3 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {item.daysLeft === Infinity ? 'Không xác định' : 
                           item.daysLeft < 1 ? 'Hôm nay' : 
                           `Sau ${Math.ceil(item.daysLeft)} ngày`}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-200 dark:border-stone-700 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Gợi ý nhập thêm</span>
                        <span className={`text-sm font-black ${item.suggestedRestock > 0 ? 'text-[#C9252C]' : 'text-emerald-600'}`}>
                          {item.suggestedRestock > 0 ? `+${item.suggestedRestock} món` : 'Đã đủ hàng'}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleEdit(item)}
                        className="w-8 h-8 bg-white dark:bg-stone-700 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-800 dark:hover:text-white shadow-sm border border-stone-100 dark:border-stone-600 transition-all"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {inventoryForecast.length > 6 && (
                <p className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">Xem thêm trong báo cáo chi tiết</p>
              )}

              {/* AI Insights Section */}
              <div className="mt-8 p-6 bg-stone-50 dark:bg-stone-800/30 rounded-3xl border border-stone-100 dark:border-stone-700/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-100 dark:shadow-none">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black text-stone-800 dark:text-white uppercase tracking-widest">Phân tích xu hướng AI</h4>
                  </div>
                  <button 
                    onClick={generateAIInsights}
                    disabled={isGeneratingInsights}
                    className="text-[10px] font-black text-[#C9252C] uppercase tracking-widest tap-active disabled:opacity-50"
                  >
                    {isGeneratingInsights ? 'Đang phân tích...' : 'Làm mới phân tích'}
                  </button>
                </div>

                <div className="flex gap-2 mb-4">
                  <button 
                    onClick={generateSeasonalAnalysis}
                    disabled={isGeneratingSeasonal}
                    className="flex-1 py-2 bg-stone-100 dark:bg-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600 transition-all flex items-center justify-center gap-2"
                  >
                    {isGeneratingSeasonal ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CalendarIcon className="w-3 h-3" />}
                    Phân tích mùa vụ
                  </button>
                  <button 
                    onClick={createPurchaseOrder}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Package className="w-3 h-3" />
                    Tạo đơn nhập hàng
                  </button>
                </div>
                
                {aiInsights ? (
                  <div className="prose prose-stone dark:prose-invert prose-xs max-w-none">
                    <div className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-400 font-medium whitespace-pre-wrap">
                      {aiInsights}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-stone-400">
                    <RefreshCw className={`w-6 h-6 mb-2 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      {isGeneratingInsights ? 'AI đang xử lý dữ liệu...' : 'Nhấn làm mới để bắt đầu phân tích'}
                    </p>
                  </div>
                )}
              </div>

              {/* Purchase Order Details */}
              <AnimatePresence>
                {purchaseOrder && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mt-6 p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Đơn nhập hàng dự kiến (Draft)</h4>
                      <button onClick={() => setPurchaseOrder(null)} className="text-emerald-400 hover:text-emerald-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {purchaseOrder.map((item, idx) => (
                        <div key={`po-item-${idx}`} className="flex justify-between items-center text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <span>{item.ten_mon}</span>
                          <span className="bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-lg">+{item.suggestedRestock} món</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex gap-3">
                      <button className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none">
                        Gửi nhà cung cấp
                      </button>
                      <button className="flex-1 py-3 bg-white dark:bg-stone-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl font-black text-[10px] uppercase tracking-widest">
                        Lưu nháp
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filter */}
      <div className="px-4 py-2 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 space-y-2">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 group-focus-within:text-[#C9252C] transition-colors">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input 
            type="text"
            placeholder="Tìm theo tên hoặc mã món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 rounded-lg font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#C9252C]/20 border-none transition-all"
          />
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-4 px-4">
          {['Tất cả', ...existingCategories].map((cat, index) => (
            <button
              key={`cat-tab-${cat}-${index}`}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-[9px] font-black uppercase tracking-wide transition-all tap-active border ${
                activeCategory === cat
                  ? 'bg-stone-800 dark:bg-white text-white dark:text-black border-stone-800 dark:border-white'
                  : 'bg-white dark:bg-stone-900 text-stone-400 dark:text-stone-500 border-stone-100 dark:border-stone-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 pb-24 bg-stone-50 dark:bg-black">
        {isDataLoading && menuItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-4">
            <div className="w-12 h-12 border-4 border-stone-200 dark:border-stone-800 border-t-[#C9252C] rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-100 dark:border-red-900/30 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-red-800 dark:text-red-300 font-bold text-sm">{error}</p>
            <button onClick={() => fetchAllData()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors">Thử lại</button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center text-stone-300 dark:text-stone-700">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-xs">
              {searchQuery ? `Không tìm thấy món nào khớp với "${searchQuery}"` : 'Danh sách trống'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  key={`menu-manager-item-${idx}`} 
                  className={`group bg-white dark:bg-stone-900 p-5 rounded-[24px] border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden ${!item.co_san ? 'opacity-70 grayscale-[0.5]' : ''}`}
                >
                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border ${
                      item.co_san 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' 
                        : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30'
                    }`}>
                      {item.co_san ? 'Còn hàng' : 'Hết hàng'}
                    </span>
                    {item.inventoryQty !== undefined && item.inventoryQty <= 5 && (
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 uppercase tracking-wider border border-orange-100 dark:border-orange-900/30 animate-pulse">
                        Sắp hết ({item.inventoryQty})
                      </span>
                    )}
                    {item.has_customizations && (
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 uppercase tracking-wider border border-stone-200 dark:border-stone-700">
                        Tùy chỉnh
                      </span>
                    )}
                  </div>

                  {/* Main Info */}
                  <div className="mb-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-stone-800 dark:text-white text-base leading-tight line-clamp-2 mb-1 group-hover:text-[#C9252C] transition-colors">
                        {item.ten_mon}
                      </h4>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-black text-[#C9252C]">{item.gia_ban.toLocaleString()}đ</p>
                      <span className="text-[9px] font-mono text-stone-400 dark:text-stone-600 bg-stone-50 dark:bg-stone-800 px-1.5 rounded">
                        {item.ma_mon}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[9px] sm:text-[10px] font-bold text-stone-400 dark:text-stone-500">{item.danh_muc}</p>
                      {item.inventoryQty !== undefined && (
                        <div className="flex items-center gap-1">
                          {editingInventoryId === item.ma_mon ? (
                            <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                              <input 
                                type="number"
                                autoFocus
                                value={inventoryValue}
                                onChange={(e) => setInventoryValue(Number(e.target.value))}
                                className="w-10 bg-transparent text-[10px] font-black text-stone-800 dark:text-white border-none focus:ring-0 p-0 text-center"
                              />
                              <button 
                                onClick={() => handleInventorySave(item.ma_mon)}
                                disabled={isUpdatingInventory}
                                className="p-1 bg-emerald-500 text-white rounded-md tap-active disabled:opacity-50"
                              >
                                {isUpdatingInventory ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                              </button>
                              <button 
                                onClick={() => setEditingInventoryId(null)}
                                className="p-1 bg-stone-200 dark:bg-stone-700 text-stone-500 rounded-md tap-active"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingInventoryId(item.ma_mon);
                                setInventoryValue(item.inventoryQty || 0);
                              }}
                              className="text-[10px] font-black text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1"
                            >
                              Kho: {item.inventoryQty}
                              <Edit2 className="w-2 h-2 opacity-50" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-stone-50 dark:border-stone-800 mt-2">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleToggleAvailability(item, e)}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all tap-active border ${
                          item.co_san 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                            : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                        }`}
                        title={item.co_san ? 'Tạm ngưng bán' : 'Mở bán lại'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(item)}
                        className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-2xl text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center justify-center transition-all tap-active border border-stone-100 dark:border-stone-700"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => handleDelete(item.ma_mon)}
                      className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-2xl text-stone-400 hover:text-red-600 flex items-center justify-center transition-all tap-active border border-stone-100 dark:border-stone-700 hover:border-red-200 dark:hover:border-red-900/50"
                      title="Xóa món"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border-t sm:border border-stone-100 dark:border-stone-800"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-stone-50 dark:border-stone-800 flex justify-between items-center bg-white dark:bg-stone-900 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400 rounded-[22px] flex items-center justify-center border border-red-100 dark:border-red-900/30">
                    {editingItem ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-stone-800 dark:text-white leading-none mb-1">
                      {editingItem ? 'Sửa món' : 'Thêm món mới'}
                    </h2>
                    <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                      {editingItem ? `Đang sửa: ${editingItem.ten_mon}` : 'Nhập thông tin món ăn'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto flex-grow scrollbar-hide">
                {/* Mã món Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">Mã món định danh</label>
                    <span className="text-[9px] font-bold text-stone-300 uppercase tracking-widest">Read-only</span>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 dark:text-stone-600">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      disabled
                      value={formData.ma_mon || ''}
                      className="w-full pl-11 pr-4 py-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl font-mono font-black text-stone-400 dark:text-stone-600 border-2 border-transparent opacity-70 text-sm"
                    />
                  </div>
                </div>

                {/* Tên món Section */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Tên món ăn</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <input 
                      type="text" 
                      required
                      value={formData.ten_mon}
                      onChange={e => {
                        const newName = e.target.value;
                        if (!editingItem) {
                          const prefix = newName.split(' ').map(w => w.charAt(0).toUpperCase()).join('').substring(0, 3);
                          const suffix = Date.now().toString().slice(-4);
                          const generatedMaMon = newName ? `${prefix}-${suffix}` : `M-${suffix}`;
                          setFormData({...formData, ten_mon: newName, ma_mon: generatedMaMon});
                        } else {
                          setFormData({...formData, ten_mon: newName});
                        }
                      }}
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-lg text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all placeholder:font-medium shadow-inner"
                      placeholder="VD: Cà phê sữa đá"
                    />
                  </div>
                </div>

                {/* Giá bán Section */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Giá bán niêm yết</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C9252C]">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <input 
                      type="number" 
                      required
                      value={formData.gia_ban === 0 ? '' : formData.gia_ban}
                      onChange={e => setFormData({...formData, gia_ban: Number(e.target.value)})}
                      onBlur={handlePriceBlur}
                      className="w-full pl-12 pr-4 py-5 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-2xl text-[#C9252C] border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all placeholder:font-medium shadow-inner"
                      placeholder="0"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 font-black text-xl">đ</div>
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 italic ml-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Nhập 25 sẽ tự động chuyển thành 25.000đ
                  </p>
                </div>

                {/* Kho & Danh mục Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Số lượng tồn</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                        <Package className="w-5 h-5" />
                      </div>
                      <input 
                        type="number" 
                        value={formData.inventoryQty}
                        onChange={e => setFormData({...formData, inventoryQty: Number(e.target.value)})}
                        className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Danh mục</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                        <Tag className="w-5 h-5" />
                      </div>
                      <input 
                        type="text"
                        list="category-list"
                        required
                        value={formData.danh_muc}
                        onChange={e => setFormData({...formData, danh_muc: e.target.value})}
                        className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner"
                        placeholder="Chọn..."
                      />
                      <datalist id="category-list">
                        {existingCategories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Toggles Section */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, co_san: !formData.co_san})}
                    className={`p-6 rounded-[32px] border-2 transition-all duration-300 flex flex-col items-center gap-3 tap-active ${
                      formData.co_san 
                        ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' 
                        : 'bg-stone-50 border-stone-100 dark:bg-stone-800 dark:border-stone-700'
                    }`}
                  >
                    <div className={`w-12 h-7 rounded-full relative transition-colors duration-500 ${formData.co_san ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-500 ${formData.co_san ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${formData.co_san ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                      {formData.co_san ? 'Đang bán' : 'Tạm ngưng'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({...formData, has_customizations: !formData.has_customizations})}
                    className={`p-6 rounded-[32px] border-2 transition-all duration-300 flex flex-col items-center gap-3 tap-active ${
                      formData.has_customizations 
                        ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' 
                        : 'bg-stone-50 border-stone-100 dark:bg-stone-800 dark:border-stone-700'
                    }`}
                  >
                    <div className={`w-12 h-7 rounded-full relative transition-colors duration-500 ${formData.has_customizations ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-500 ${formData.has_customizations ? 'left-6' : 'left-1'}`} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${formData.has_customizations ? 'text-blue-600 dark:text-blue-400' : 'text-stone-400'}`}>
                      {formData.has_customizations ? 'Có Option' : 'Cơ bản'}
                    </span>
                  </button>
                </div>

                {/* Submit Button */}
                <div className="pt-4 pb-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-6 bg-gradient-to-r from-[#C9252C] to-[#991B1B] text-white rounded-[28px] font-black text-lg uppercase tracking-[0.2em] shadow-2xl shadow-red-200 dark:shadow-none tap-active flex items-center justify-center gap-3 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-6 h-6" />
                        {editingItem ? 'Lưu thay đổi' : 'Thêm món'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
