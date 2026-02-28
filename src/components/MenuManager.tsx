import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, RefreshCw, AlertCircle, Check, ChevronRight, Package, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
}

export function MenuManager({ appsScriptUrl }: MenuManagerProps) {
  const { menuItems: rawMenuItems, isLoading: isDataLoading, isRefreshing, error: dataError, fetchAllData } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Map rawMenuItems to local MenuItem format
  const menuItems = useMemo(() => {
    return rawMenuItems.map(item => ({
      ma_mon: item.id,
      ten_mon: item.name,
      gia_ban: item.price,
      danh_muc: item.category,
      co_san: !item.isOutOfStock,
      has_customizations: item.hasCustomizations
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
    has_customizations: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Sync Mechanism: Handled by DataContext
  useEffect(() => {
    if (dataError) setError(dataError);
  }, [dataError]);

  // Derived State: Categories for dropdown
  const existingCategories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map(i => i.danh_muc))).filter(Boolean);
    return cats.sort();
  }, [menuItems]);

  // Derived State: Grouped Items for UI
  const groupedItems = useMemo(() => {
    const filtered = menuItems.filter(item => 
      item.ten_mon.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ma_mon.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return filtered.reduce((acc, item) => {
      const cat = item.danh_muc || 'Khác';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems, searchQuery]);

  // 2. Add Flow
  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      ma_mon: `M${Date.now().toString().slice(-6)}`,
      ten_mon: '',
      gia_ban: 0,
      danh_muc: existingCategories[0] || 'Cà phê',
      co_san: true,
      has_customizations: false
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
        has_customizations: formData.has_customizations
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 text-[#C9252C] rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-stone-800 dark:text-white uppercase tracking-tight">Quản lý Menu</h1>
            <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Đồng bộ Google Sheets</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchAllData()}
            disabled={isLoading}
            className="w-10 h-10 bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleAddNew}
            className="bg-[#C9252C] text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-100 dark:shadow-none tap-active"
          >
            <Plus className="w-4 h-4" />
            Thêm món
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            type="text"
            placeholder="Tìm theo tên hoặc mã món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-stone-50 dark:bg-stone-800 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#C9252C]/20 border-none"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-8 pb-24">
        {isDataLoading && menuItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400 space-y-4">
            <RefreshCw className="w-10 h-10 animate-spin opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div className="p-8 bg-red-50 dark:bg-red-900/20 rounded-[32px] border border-red-100 dark:border-red-900/30 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-red-800 dark:text-red-300 font-bold">{error}</p>
            <button onClick={() => fetchAllData()} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm">Thử lại</button>
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center text-stone-300 dark:text-stone-700">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest text-xs">
              {searchQuery ? `Không tìm thấy món nào khớp với từ khóa "${searchQuery}"` : 'Không có món nào'}
            </p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([category, items]: [string, MenuItem[]]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3 px-1">
                <h3 className="text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                  {category}
                </h3>
                <div className="h-px flex-grow bg-stone-100 dark:bg-stone-800" />
                <span className="text-[10px] font-black text-stone-300 dark:text-stone-600 bg-stone-50 dark:bg-stone-900 px-2 py-0.5 rounded-full border border-stone-100 dark:border-stone-800">
                  {items.length}
                </span>
              </div>
              <div className="grid gap-3">
                {items.map((item) => (
                  <div 
                    key={item.ma_mon} 
                    className={`bg-white dark:bg-stone-900 p-5 rounded-[28px] border border-stone-100 dark:border-stone-800 shadow-sm flex justify-between items-center transition-all duration-300 ${!item.co_san ? 'opacity-60' : ''}`}
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-black bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md text-stone-500 font-mono border border-stone-200 dark:border-stone-700">
                          {item.ma_mon}
                        </span>
                        {!item.co_san && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 uppercase tracking-wider border border-red-100 dark:border-red-900/30">
                            Hết hàng
                          </span>
                        )}
                        {item.has_customizations && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30">
                            Có Tùy Chỉnh
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-stone-800 dark:text-white text-lg leading-tight truncate mb-1">{item.ten_mon}</h4>
                      <p className="text-base font-black text-[#C9252C]">{item.gia_ban.toLocaleString()}đ</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="w-11 h-11 bg-stone-50 dark:bg-stone-800 rounded-2xl text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center justify-center transition-all tap-active border border-stone-100 dark:border-stone-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.ma_mon)}
                        className="w-11 h-11 bg-red-50 dark:bg-red-900/10 rounded-2xl text-red-400 hover:text-red-600 flex items-center justify-center transition-all tap-active border border-red-100 dark:border-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
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
              <div className="p-8 border-b border-stone-50 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-stone-800 dark:text-white leading-none mb-1">
                    {editingItem ? 'Sửa món ăn' : 'Thêm món mới'}
                  </h2>
                  <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Thông tin thực đơn</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-grow scrollbar-hide">
                {/* Show ma_mon as read-only */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Mã món (Hệ thống)</label>
                  <input 
                    type="text" 
                    disabled
                    value={formData.ma_mon || ''}
                    className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-mono font-bold text-stone-400 dark:text-stone-600 border-none opacity-70"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Tên món ăn</label>
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
                    className="w-full p-5 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-lg text-stone-800 dark:text-white border-none focus:ring-2 focus:ring-[#C9252C]/20"
                    placeholder="VD: Cà phê sữa đá"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Giá bán (đ)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.gia_ban === 0 ? '' : formData.gia_ban}
                    onChange={e => setFormData({...formData, gia_ban: Number(e.target.value)})}
                    onBlur={handlePriceBlur}
                    className="w-full p-5 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-2xl text-[#C9252C] border-none focus:ring-2 focus:ring-[#C9252C]/20"
                    placeholder="VD: 25000"
                  />
                  <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 italic ml-1">* Nhập 25 sẽ tự động chuyển thành 25.000đ</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Danh mục</label>
                  <input 
                    type="text"
                    list="category-list"
                    required
                    value={formData.danh_muc}
                    onChange={e => setFormData({...formData, danh_muc: e.target.value})}
                    className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-bold text-stone-800 dark:text-white border-none focus:ring-2 focus:ring-[#C9252C]/20"
                    placeholder="Chọn hoặc nhập danh mục mới..."
                  />
                  <datalist id="category-list">
                    {existingCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="flex items-center justify-between p-5 bg-stone-50 dark:bg-stone-800 rounded-[28px] border border-stone-100 dark:border-stone-700">
                    <div className="space-y-0.5">
                      <h4 className="font-black text-stone-800 dark:text-white text-sm">Còn hàng</h4>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Hiển thị trên menu khách</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, co_san: !formData.co_san})}
                      className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${formData.co_san ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-stone-700'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 ${formData.co_san ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-stone-50 dark:bg-stone-800 rounded-[28px] border border-stone-100 dark:border-stone-700">
                    <div className="space-y-0.5">
                      <h4 className="font-black text-stone-800 dark:text-white text-sm">Tùy chỉnh</h4>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Cho phép chọn Đường/Đá</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, has_customizations: !formData.has_customizations})}
                      className={`w-14 h-8 rounded-full relative transition-colors duration-300 ${formData.has_customizations ? 'bg-[#C9252C]' : 'bg-stone-200 dark:bg-stone-700'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 ${formData.has_customizations ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-5 bg-[#C9252C] text-white rounded-[28px] font-black text-lg shadow-xl shadow-red-100 dark:shadow-none tap-active flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-6 h-6" />
                        {editingItem ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
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
