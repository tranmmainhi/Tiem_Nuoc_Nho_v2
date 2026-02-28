import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Save, X, Search, RefreshCw, AlertCircle, Check, ArrowLeft, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface MenuManagementProps {
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

const CATEGORIES = ['Cà phê', 'Trà', 'Nước ngọt', 'Sinh tố', 'Đồ ăn', 'Khác'];

export function MenuManagement({ appsScriptUrl }: MenuManagementProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, [appsScriptUrl]);

  const fetchMenu = async () => {
    if (!appsScriptUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${appsScriptUrl}?action=getMenu`);
      const data = await response.json();
      if (Array.isArray(data)) {
        // Map API response to our internal format
        // Assuming API returns keys like Ma_Mon, Ten_Mon etc. or similar to what Menu.tsx handles
        // But for Management we need strict keys for the form
        const mappedItems = data.map((item: any) => ({
          ma_mon: item.ma_mon || item.Ma_Mon || item.id || '',
          ten_mon: item.ten_mon || item.Ten_Mon || item.name || '',
          gia_ban: Number(item.gia_ban || item.Gia_Ban || item.price || 0),
          danh_muc: item.danh_muc || item.Danh_Muc || item.category || 'Khác',
          co_san: String(item.co_san || item.Co_San || item.isOutOfStock) === 'true' || String(item.co_san || item.Co_San) === 'TRUE' || item.co_san === true, 
          // Note: In Menu.tsx isOutOfStock is true if OUT of stock. Here co_san is true if IN stock. 
          // Let's assume API returns 'TRUE'/'FALSE' for Co_San.
          // If the API returns isOutOfStock (from Menu.tsx logic), we need to invert it?
          // The prompt says: co_san (Toggle): Label "Còn hàng".
          // Let's assume the API returns a field `Co_San` which is boolean-like.
          has_customizations: String(item.has_customizations || item.Has_Customizations) === 'true' || item.has_customizations === true
        }));
        setItems(mappedItems);
      }
    } catch (err) {
      setError('Không thể tải danh sách món');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    try {
      const payload = {
        action: 'saveMenuItem',
        ...editingItem
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      
      if (result.status === 'success' || result.success) {
        await fetchMenu(); // Refresh list
        setIsEditing(false);
        setEditingItem(null);
        alert('Đã lưu thành công!');
      } else {
        alert('Lỗi: ' + (result.message || 'Không thể lưu'));
      }
    } catch (err) {
      alert('Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem({ ...item });
    setIsEditing(true);
  };

  const startAdd = () => {
    setEditingItem({
      ma_mon: '',
      ten_mon: '',
      gia_ban: 0,
      danh_muc: 'Khác',
      co_san: true,
      has_customizations: false
    });
    setIsEditing(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.ten_mon.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.ma_mon.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.danh_muc === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-black text-stone-900 dark:text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border-b border-stone-100 dark:border-stone-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/staff" className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-black uppercase tracking-tight">Quản lý Menu</h1>
        </div>
        <button 
          onClick={startAdd}
          className="bg-[#C9252C] text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-200 dark:shadow-none tap-active"
        >
          <Plus className="w-4 h-4" />
          Thêm món
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-4 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input 
            type="text"
            placeholder="Tìm theo tên hoặc mã..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#C9252C]/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === 'All' ? 'bg-stone-800 text-white dark:bg-white dark:text-black' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}
          >
            Tất cả
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-stone-800 text-white dark:bg-white dark:text-black' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-stone-400" /></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-10 text-stone-400 font-medium">Không tìm thấy món nào</div>
        ) : (
          filteredItems.map((item, index) => (
            <div key={`${item.ma_mon}-${index}`} className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-500">{item.ma_mon}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.co_san ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {item.co_san ? 'Còn hàng' : 'Hết hàng'}
                  </span>
                </div>
                <h3 className="font-bold text-stone-800 dark:text-white">{item.ten_mon}</h3>
                <p className="text-sm font-medium text-[#C9252C]">{item.gia_ban.toLocaleString()}đ</p>
              </div>
              <button 
                onClick={() => startEdit(item)}
                className="p-3 bg-stone-50 dark:bg-stone-800 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-white transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
                <h2 className="text-xl font-black text-stone-800 dark:text-white">
                  {editingItem.ma_mon ? 'Sửa món' : 'Thêm món mới'}
                </h2>
                <button onClick={() => setIsEditing(false)} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-grow">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase">Mã món</label>
                    <input 
                      type="text" 
                      required
                      disabled={!!editingItem.ma_mon && items.some(i => i.ma_mon === editingItem.ma_mon)} // Disable if editing existing
                      value={editingItem.ma_mon}
                      onChange={e => setEditingItem({...editingItem, ma_mon: e.target.value})}
                      className="w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold disabled:opacity-50"
                      placeholder="VD: CF01"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase">Giá bán</label>
                    <input 
                      type="number" 
                      required
                      value={editingItem.gia_ban}
                      onChange={e => setEditingItem({...editingItem, gia_ban: Number(e.target.value)})}
                      className="w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase">Tên món</label>
                  <input 
                    type="text" 
                    required
                    value={editingItem.ten_mon}
                    onChange={e => setEditingItem({...editingItem, ten_mon: e.target.value})}
                    className="w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold"
                    placeholder="VD: Cà phê sữa đá"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase">Danh mục</label>
                  <select 
                    value={editingItem.danh_muc}
                    onChange={e => setEditingItem({...editingItem, danh_muc: e.target.value})}
                    className="w-full p-3 bg-stone-50 dark:bg-stone-800 rounded-xl font-bold"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                    <div>
                      <h4 className="font-bold text-stone-800 dark:text-white">Còn hàng</h4>
                      <p className="text-xs text-stone-500">Hiển thị trên menu khách</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingItem.co_san}
                        onChange={e => setEditingItem({...editingItem, co_san: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
                    <div>
                      <h4 className="font-bold text-stone-800 dark:text-white">Có tùy chỉnh</h4>
                      <p className="text-xs text-stone-500">Đường, đá, topping...</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingItem.has_customizations}
                        onChange={e => setEditingItem({...editingItem, has_customizations: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#C9252C]"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-[#C9252C] text-white font-bold rounded-2xl shadow-xl shadow-red-200 dark:shadow-none tap-active disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
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
