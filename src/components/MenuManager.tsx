import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, RefreshCw, AlertCircle, Check, ChevronRight, Package, Settings as SettingsIcon, Filter, MoreVertical, Power } from 'lucide-react';
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
  inventoryQty?: number;
}

export function MenuManager({ appsScriptUrl }: MenuManagerProps) {
  const { menuItems: rawMenuItems, isLoading: isDataLoading, isRefreshing, error: dataError, fetchAllData } = useData();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');

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
    has_customizations: false
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
      .filter(cat => cat !== 'Tất cả');
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

  // Quick Toggle Availability
  const handleToggleAvailability = async (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic update
    // Note: In a real app we'd update local state immediately. 
    // Here we rely on the API call then refresh.
    
    try {
      const payload = {
        action: 'editMenuItem',
        ma_mon: item.ma_mon,
        ten_mon: item.ten_mon,
        gia_ban: item.gia_ban,
        danh_muc: item.danh_muc,
        co_san: !item.co_san, // Toggle
        has_customizations: item.has_customizations
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      if (result.status === 'success') {
        await fetchAllData(); // Refresh list
      }
    } catch (err) {
      console.error("Failed to toggle availability", err);
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
        <div>
          <h1 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tight">Quản lý Menu</h1>
          <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-0.5">
            {menuItems.length} món ăn • {existingCategories.length} danh mục
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fetchAllData()}
            disabled={isLoading || isRefreshing}
            className="w-10 h-10 bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active shadow-sm hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin text-[#C9252C]' : ''}`} />
          </button>
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

      {/* Search & Filter */}
      <div className="px-6 py-4 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            type="text"
            placeholder="Tìm theo tên hoặc mã món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#C9252C]/20 border-none transition-all"
          />
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-6 px-6">
          {['Tất cả', ...existingCategories].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap text-[11px] font-black uppercase tracking-wide transition-all tap-active border ${
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
                  <div className="mb-4">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-stone-800 dark:text-white text-lg leading-tight line-clamp-2 mb-1 group-hover:text-[#C9252C] transition-colors">
                        {item.ten_mon}
                      </h4>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-black text-[#C9252C]">{item.gia_ban.toLocaleString()}đ</p>
                      <span className="text-[10px] font-mono text-stone-400 dark:text-stone-600 bg-stone-50 dark:bg-stone-800 px-1.5 rounded">
                        {item.ma_mon}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500 mt-1">{item.danh_muc}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-stone-50 dark:border-stone-800">
                    <button
                      onClick={(e) => handleToggleAvailability(item, e)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
                        item.co_san 
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' 
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {item.co_san ? 'Tắt' : 'Bật'}
                    </button>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="w-9 h-9 bg-stone-50 dark:bg-stone-800 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-white flex items-center justify-center transition-all tap-active border border-stone-100 dark:border-stone-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.ma_mon)}
                        className="w-9 h-9 bg-stone-50 dark:bg-stone-800 rounded-xl text-stone-400 hover:text-red-500 flex items-center justify-center transition-all tap-active border border-stone-100 dark:border-stone-700 hover:border-red-200 dark:hover:border-red-900/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
              className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border-t sm:border border-stone-100 dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-50 dark:border-stone-800 flex justify-between items-center bg-white dark:bg-stone-900 sticky top-0 z-10">
                <div>
                  <h2 className="text-xl font-black text-stone-800 dark:text-white leading-none mb-1">
                    {editingItem ? 'Sửa món' : 'Thêm món mới'}
                  </h2>
                  <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                    {editingItem ? `Đang sửa: ${editingItem.ten_mon}` : 'Nhập thông tin món ăn'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-grow scrollbar-hide">
                {/* Show ma_mon as read-only */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Mã món</label>
                  <input 
                    type="text" 
                    disabled
                    value={formData.ma_mon || ''}
                    className="w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-mono font-bold text-stone-400 dark:text-stone-600 border-none opacity-70 text-sm"
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
                    className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold text-base text-stone-800 dark:text-white border-none focus:ring-2 focus:ring-[#C9252C]/20 transition-all placeholder:font-medium"
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
                    className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-xl font-black text-xl text-[#C9252C] border-none focus:ring-2 focus:ring-[#C9252C]/20 transition-all placeholder:font-medium"
                    placeholder="0"
                  />
                  <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 italic ml-1">* Nhập 25 sẽ tự động chuyển thành 25.000đ</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Danh mục</label>
                  <div className="relative">
                    <input 
                      type="text"
                      list="category-list"
                      required
                      value={formData.danh_muc}
                      onChange={e => setFormData({...formData, danh_muc: e.target.value})}
                      className="w-full p-4 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold text-stone-800 dark:text-white border-none focus:ring-2 focus:ring-[#C9252C]/20 transition-all placeholder:font-medium"
                      placeholder="Chọn hoặc nhập mới..."
                    />
                    <datalist id="category-list">
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, co_san: !formData.co_san})}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 ${
                      formData.co_san 
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900/50' 
                        : 'bg-stone-50 border-stone-100 dark:bg-stone-800 dark:border-stone-700'
                    }`}
                  >
                    <div className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${formData.co_san ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${formData.co_san ? 'left-5' : 'left-1'}`} />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider ${formData.co_san ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}`}>
                      {formData.co_san ? 'Đang bán' : 'Tạm ngưng'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({...formData, has_customizations: !formData.has_customizations})}
                    className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 ${
                      formData.has_customizations 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50' 
                        : 'bg-stone-50 border-stone-100 dark:bg-stone-800 dark:border-stone-700'
                    }`}
                  >
                    <div className={`w-10 h-6 rounded-full relative transition-colors duration-300 ${formData.has_customizations ? 'bg-blue-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${formData.has_customizations ? 'left-5' : 'left-1'}`} />
                    </div>
                    <span className={`text-xs font-black uppercase tracking-wider ${formData.has_customizations ? 'text-blue-600 dark:text-blue-400' : 'text-stone-400'}`}>
                      {formData.has_customizations ? 'Có Option' : 'Cơ bản'}
                    </span>
                  </button>
                </div>

                <div className="pt-4 pb-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-[#C9252C] text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-red-100 dark:shadow-none tap-active flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#a01d23] transition-colors"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
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
