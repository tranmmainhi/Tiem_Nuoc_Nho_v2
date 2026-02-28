import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, X, Check, Search, Heart, AlertCircle, RefreshCw, ChevronRight, ShoppingBag, Settings as SettingsIcon, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VirtuosoGrid } from 'react-virtuoso';
import { MenuItem, CartItem } from '../types';
import { useUI } from '../context/UIContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';

export const SIZES = [
  { id: 'STD', name: 'Tiêu chuẩn', price: 0 },
];

export const TOPPINGS: { id: string; name: string; price: number }[] = [];

interface MenuProps {
  appsScriptUrl: string;
  onNavigateSettings: () => void;
}

export function Menu({ appsScriptUrl, onNavigateSettings }: MenuProps) {
  const { setIsFabHidden } = useUI();
  const { menuItems: rawMenuItems, isLoading, isRefreshing, error, fetchAllData, createOrder, lastUpdated } = useData();
  const { cart, addToCart } = useCart();

  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name_asc'>('default');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [outOfStockItem, setOutOfStockItem] = useState<MenuItem | null>(null);
  const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);
  const [flyingItem, setFlyingItem] = useState<{ x: number; y: number; id: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean; type?: 'success' | 'warning' }>({ message: '', visible: false });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });

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

  useEffect(() => {
    const handleOutOfStock = (e: any) => {
      const item = e.detail;
      showToast(`Món "${item.name}" vừa hết hàng!`, 'warning');
      
      // Play alert sound only if user is not looking at the screen
      if (document.hidden) {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.5);
        } catch (err) {
          console.error('Error playing sound:', err);
        }
      }
    };

    window.addEventListener('itemOutOfStock', handleOutOfStock);
    return () => window.removeEventListener('itemOutOfStock', handleOutOfStock);
  }, []);

  const menuItems = useMemo(() => {
    const uniqueItemsMap = new Map();
    
    rawMenuItems.forEach((item: any) => {
      const match = item.name.match(/\s*[\(\-]?\s*(Nóng|Đá|Hot|Ice)\s*[\)]?$/i);
      let variantType = 'default';
      if (match) {
        const typeStr = match[1].toLowerCase();
        if (typeStr.includes('nóng') || typeStr.includes('hot')) variantType = 'Nóng';
        else if (typeStr.includes('đá') || typeStr.includes('ice')) variantType = 'Đá';
      }

      const normalizedName = item.name
        .replace(/\s*[\(\-]?\s*(Nóng|Đá|Hot|Ice)\s*[\)]?$/i, "")
        .trim();
      
      if (!uniqueItemsMap.has(normalizedName)) {
        uniqueItemsMap.set(normalizedName, {
          ...item,
          name: normalizedName,
          variants: {
            [variantType]: { id: item.id, price: item.price, isOutOfStock: item.isOutOfStock }
          }
        });
      } else {
        const existingItem = uniqueItemsMap.get(normalizedName);
        if (!existingItem.variants) existingItem.variants = {};
        existingItem.variants[variantType] = { id: item.id, price: item.price, isOutOfStock: item.isOutOfStock };
        existingItem.isOutOfStock = existingItem.isOutOfStock && item.isOutOfStock;
        if (variantType === 'Đá') {
           existingItem.id = item.id;
           existingItem.price = item.price;
        }
      }
    });
    
    return Array.from(uniqueItemsMap.values());
  }, [rawMenuItems]);

  useEffect(() => {
    setIsFabHidden(!!selectedItem || !!outOfStockItem);
    return () => setIsFabHidden(false);
  }, [selectedItem, outOfStockItem, setIsFabHidden]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      localStorage.setItem('favorites', JSON.stringify(next));
      return next;
    });
  };

  const CATEGORIES = Array.from(new Set(menuItems.map((item) => item.category)))
    .filter((cat): cat is string => typeof cat === 'string' && cat.trim().toLowerCase() !== 'tất cả' && cat.trim().toLowerCase() !== 'yêu thích');
  const displayCategories = ['Tất cả', ...CATEGORIES];
  if (favorites.length > 0) {
    displayCategories.splice(1, 0, 'Yêu thích');
  }

  let filteredItems = menuItems;

  if (searchQuery) {
    filteredItems = filteredItems.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  } else if (activeCategory === 'Yêu thích') {
    filteredItems = filteredItems.filter((item) => favorites.includes(item.id));
  } else if (activeCategory !== 'Tất cả') {
    filteredItems = filteredItems.filter((item) => item.category === activeCategory);
  }
  
  if (sortBy === 'price_asc') {
    filteredItems = [...filteredItems].sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    filteredItems = [...filteredItems].sort((a, b) => b.price - a.price);
  } else if (sortBy === 'name_asc') {
    filteredItems = [...filteredItems].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast({ message: '', visible: false }), 4000);
  };

  const getCartQuantity = (itemId: string) => {
    return cart.filter(c => c.id === itemId).reduce((sum, c) => sum + c.quantity, 0);
  };

  // Virtualization components
  const GridList = React.forwardRef(({ style, children, ...props }: any, ref: any) => (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '0.5rem',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
      }}
      className="sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    >
      {children}
    </div>
  ));

  const GridItem = ({ children, ...props }: any) => (
    <div {...props} className="h-full">
      {children}
    </div>
  );

  const handleAddToCart = (cartItem: CartItem, e?: React.MouseEvent) => {
    const currentQty = getCartQuantity(cartItem.id);
    if (cartItem.inventoryQty !== undefined && currentQty + cartItem.quantity > cartItem.inventoryQty) {
      showToast(`Chỉ còn ${cartItem.inventoryQty} sản phẩm trong kho!`);
      return;
    }

    addToCart(cartItem);
    setSelectedItem(null);
    setAnimatingItemId(cartItem.id);
    
    if (e) {
      setFlyingItem({ x: e.clientX, y: e.clientY, id: cartItem.id });
      setTimeout(() => setFlyingItem(null), 800);
    }

    showToast(`Đã thêm ${cartItem.name} vào giỏ hàng`);
    setTimeout(() => setAnimatingItemId(null), 1000);
  };

  const performAddDirectly = (item: MenuItem, type?: 'Mang về' | 'Tại chỗ', x?: number, y?: number) => {
    const currentQty = getCartQuantity(item.id);
    if (item.inventoryQty !== undefined && currentQty + 1 > item.inventoryQty) {
      showToast(`Chỉ còn ${item.inventoryQty} sản phẩm trong kho!`);
      return;
    }

    addToCart({
      ...item,
      cartItemId: Math.random().toString(36).substr(2, 9),
      quantity: 1,
      size: "Tiêu chuẩn",
      toppings: [],
      unitPrice: item.price,
      note: type || '',
    });
    setAnimatingItemId(item.id);

    if (x !== undefined && y !== undefined) {
      setFlyingItem({ x, y, id: item.id });
      setTimeout(() => setFlyingItem(null), 800);
    }

    showToast(`Đã thêm ${item.name} vào giỏ hàng`);
    setTimeout(() => setAnimatingItemId(null), 1000);
  };

  if (!appsScriptUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-3xl flex items-center justify-center mb-6 animate-float">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-stone-800 dark:text-white mb-2">Chưa cấu hình dữ liệu</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-xs">
          Bạn cần thiết lập đường dẫn Google Apps Script để tải danh sách thực đơn.
        </p>
        <button
          onClick={onNavigateSettings}
          className="w-full py-4 bg-[#C9252C] text-white font-bold rounded-2xl tap-active shadow-lg shadow-red-100 dark:shadow-none"
        >
          Đi tới Cài đặt
        </button>
      </div>
    );
  }

  if (isLoading && menuItems.length === 0) {
    return (
      <div className="flex flex-col min-h-full pb-20">
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-xl px-4 pt-3 pb-3 space-y-3 border-b border-stone-100/50 dark:border-stone-800/50 shadow-sm">
           {/* Skeleton Header */}
           <div className="h-10 bg-stone-100 dark:bg-stone-800 rounded-2xl animate-pulse" />
           <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 w-20 bg-stone-100 dark:bg-stone-800 rounded-xl animate-pulse flex-shrink-0" />
              ))}
           </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white dark:bg-stone-900 rounded-2xl p-3 h-48 border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col justify-between animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-3/4" />
                <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-1/2" />
              </div>
              <div className="flex justify-between items-end">
                <div className="h-5 bg-stone-100 dark:bg-stone-800 rounded w-1/3" />
                <div className="h-7 w-7 bg-stone-100 dark:bg-stone-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && menuItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-3xl flex items-center justify-center mb-6"
        >
          <AlertCircle className="w-10 h-10" />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-stone-800 dark:text-white mb-2">Không thể tải thực đơn</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-xs text-sm leading-relaxed">
          {error.includes('Rate Limit') 
            ? 'Hệ thống đang bận do có quá nhiều người truy cập cùng lúc. Vui lòng đợi 1-2 phút rồi nhấn nút Thử lại.'
            : error || 'Có lỗi xảy ra khi kết nối với hệ thống. Vui lòng kiểm tra lại đường dẫn Apps Script hoặc kết nối mạng.'}
        </p>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => fetchAllData(true)}
            className="w-full py-4 bg-[#C9252C] text-white font-bold rounded-2xl tap-active shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại ngay
          </button>
          <button
            onClick={onNavigateSettings}
            className="w-full py-4 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold rounded-2xl tap-active"
          >
            Kiểm tra Cài đặt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-20">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-black/95 backdrop-blur-xl px-3 pt-2 pb-2 space-y-2 border-b border-stone-100/50 dark:border-stone-800/50 shadow-sm transition-colors">
        {/* Loading Indicator */}
        <AnimatePresence>
          {(isLoading || isRefreshing) && menuItems.length > 0 && (
            <motion.div 
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 1, opacity: 0 }}
              className="absolute top-0 left-0 right-0 h-0.5 bg-[#C9252C] origin-left z-50"
            />
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <div className="relative flex-grow group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-[#C9252C]">
              <Search className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm món ngon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-900/50 border-none pl-9 pr-3 py-2 rounded-xl shadow-sm dark:shadow-none font-bold text-xs placeholder:font-medium focus:ring-2 focus:ring-[#C9252C]/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 tap-active"
              >
                <X className="h-3.5 w-3.5 bg-stone-100 dark:bg-stone-800 rounded-full p-0.5" />
              </button>
            )}
          </div>
          <div className="flex flex-col items-center">
            <button
              onClick={() => fetchAllData(false)}
              disabled={isRefreshing || isLoading}
              title="Làm mới dữ liệu thực đơn"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-stone-50 dark:bg-stone-900 rounded-xl shadow-sm dark:shadow-none text-stone-500 dark:text-stone-400 hover:text-[#C9252C] dark:hover:text-red-400 tap-active disabled:opacity-50 border border-stone-100 dark:border-stone-800 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C9252C]' : ''}`} />
            </button>
            {timeAgo && (
              <span className="text-[7px] font-bold text-stone-400 dark:text-stone-500 mt-0.5 whitespace-nowrap">
                {timeAgo}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-3 px-3 scroll-smooth scrollbar-hide">
          {displayCategories.map((category, index) => (
            <button
              key={`category-${category}-${index}`}
              onClick={() => {
                setActiveCategory(category);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-[11px] font-bold transition-all tap-active border ${
                activeCategory === category && !searchQuery
                  ? 'bg-[#C9252C] text-white border-[#C9252C] shadow-md shadow-red-100 dark:shadow-none'
                  : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-100 dark:border-stone-800 shadow-sm dark:shadow-none'
              }`}
            >
              {category === 'Yêu thích' ? (
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-current" />
                  {category}
                </span>
              ) : (
                category
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow">
        {filteredItems.length > 0 ? (
          <VirtuosoGrid
            customScrollParent={document.querySelector('main') || undefined}
            data={filteredItems}
            components={{
              List: GridList,
              Item: GridItem,
            }}
            itemContent={(index, item) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <MenuItemCard 
                  item={item} 
                  onOpenModal={() => {
                    if (item.hasCustomizations === false) {
                      performAddDirectly(item);
                    } else {
                      setSelectedItem(item);
                    }
                  }} 
                  onAddQuick={(e) => {
                    if (item.hasCustomizations === false) {
                      performAddDirectly(item, undefined, e.clientX, e.clientY);
                    } else {
                      setSelectedItem(item);
                    }
                  }}
                  onOutOfStockClick={() => setOutOfStockItem(item)}
                  isAnimating={animatingItemId === item.id}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={() => toggleFavorite(item.id)}
                />
              </motion.div>
            )}
          />
        ) : (
          <div className="py-20 text-center flex flex-col items-center justify-center h-[50vh]">
            <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 rounded-[24px] flex items-center justify-center mb-6">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-stone-800 dark:text-white font-black text-lg mb-2">Không tìm thấy món nào</h3>
            <p className="text-stone-400 dark:text-stone-500 font-medium text-sm max-w-[200px]">Thử tìm từ khóa khác hoặc chọn danh mục khác xem sao</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedItem && (
          <CustomizationModal 
            item={selectedItem} 
            currentQty={getCartQuantity(selectedItem.id)}
            onClose={() => setSelectedItem(null)} 
            onAdd={handleAddToCart} 
            showToast={showToast}
          />
        )}

        {toast.visible && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-[60]"
          >
            <div className={`${toast.type === 'warning' ? 'bg-orange-500 dark:bg-orange-600' : 'bg-stone-900 dark:bg-white'} text-white dark:text-black px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 dark:border-black/10`}>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 ${toast.type === 'warning' ? 'bg-white/20' : 'bg-[#C9252C]'} rounded-full flex items-center justify-center`}>
                  {toast.type === 'warning' ? <AlertCircle className="w-4 h-4 text-white" /> : <Check className="w-4 h-4 text-white" />}
                </div>
                <span className="text-sm font-bold">{toast.message}</span>
              </div>
              <button onClick={() => setToast({ ...toast, visible: false })} className="text-white/60 dark:text-stone-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {error && menuItems.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 z-[60]"
          >
            <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-bold">Lỗi cập nhật thực đơn</span>
              </div>
              <button 
                onClick={() => fetchAllData(false)} 
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
              >
                Thử lại
              </button>
            </div>
          </motion.div>
        )}

        {outOfStockItem && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70]" onClick={() => setOutOfStockItem(null)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-stone-900 rounded-[32px] p-6 max-w-sm w-full mx-4 shadow-2xl border border-stone-100 dark:border-stone-800 text-center"
            >
              <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400 dark:text-stone-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-stone-800 dark:text-white mb-2">Món này đã hết hàng</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">
                Rất tiếc, <strong>{outOfStockItem.name}</strong> hiện tại đã hết. Vui lòng chọn món khác nhé!
              </p>
              <button 
                onClick={() => setOutOfStockItem(null)}
                className="w-full py-4 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-white font-bold rounded-2xl tap-active"
              >
                Đóng
              </button>
            </motion.div>
          </div>
        )}

        <AnimatePresence>
          {flyingItem && (() => {
            const cartIcon = document.getElementById('bottom-nav-cart');
            const rect = cartIcon?.getBoundingClientRect();
            const targetX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
            const targetY = rect ? rect.top + rect.height / 2 : window.innerHeight - 60;

            return (
              <motion.div
                key={`flying-${flyingItem.id}-${flyingItem.x}-${flyingItem.y}`}
                initial={{ 
                  x: flyingItem.x - 20, 
                  y: flyingItem.y - 20, 
                  scale: 1, 
                  opacity: 1 
                }}
                animate={{ 
                  x: [flyingItem.x - 20, (flyingItem.x + targetX) / 2 + 100, targetX - 20], 
                  y: [flyingItem.y - 20, (flyingItem.y + targetY) / 2 - 150, targetY - 20], 
                  scale: [1, 1.2, 0.3], 
                  opacity: [1, 0.8, 0] 
                }}
                exit={{ opacity: 0 }}
                transition={{ 
                  duration: 0.8, 
                  ease: [0.4, 0, 0.2, 1],
                  times: [0, 0.4, 1]
                }}
                className="fixed z-[100] w-10 h-10 bg-[#C9252C] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(201,37,44,0.5)] pointer-events-none"
              >
                <ShoppingBag className="w-5 h-5 text-white" />
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 0.4, repeat: Infinity }}
                  className="absolute inset-0 bg-red-400 rounded-full -z-10"
                />
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}

const MenuItemCard: React.FC<{ 
  item: MenuItem; 
  onOpenModal: () => void; 
  onAddQuick: (e: React.MouseEvent) => void;
  onOutOfStockClick: () => void;
  isAnimating: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}> = ({ item, onOpenModal, onAddQuick, onOutOfStockClick, isAnimating, isFavorite, onToggleFavorite }) => {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={() => item.isOutOfStock ? onOutOfStockClick() : onOpenModal()}
      className={`group relative bg-white dark:bg-stone-900 rounded-xl p-2.5 flex flex-col h-full border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden ${item.isOutOfStock ? 'opacity-60' : ''}`}
    >
      {item.isOutOfStock && (
        <div className="absolute inset-0 z-20 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
          <span className="bg-stone-800 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md transform -rotate-3 shadow-sm">Hết hàng</span>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex-1 mb-1.5">
          <div className="flex justify-between items-start gap-1">
            <h3 className="font-bold text-stone-800 dark:text-white text-[13px] leading-tight line-clamp-2 group-hover:text-[#C9252C] transition-colors">
              {item.name}
            </h3>
            {item.inventoryQty !== undefined && item.inventoryQty > 0 && item.inventoryQty <= 5 && (
              <span className="flex-shrink-0 text-[8px] font-black text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1 py-0.5 rounded-md animate-pulse">
                {item.inventoryQty}
              </span>
            )}
          </div>
          <p className="text-stone-400 dark:text-stone-500 text-[9px] font-bold uppercase tracking-wider mt-0.5">
            {item.category}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-stone-50 dark:border-stone-800/50">
          <p className="text-[#C9252C] font-black text-[13px]">
            {item.price.toLocaleString('vi-VN')}
            <span className="text-[8px] align-top ml-0.5">đ</span>
          </p>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (item.isOutOfStock) {
                onOutOfStockClick();
              } else {
                onAddQuick(e);
              }
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm tap-active transition-all hover:scale-105 active:scale-95 ${
              item.isOutOfStock 
                ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500' 
                : 'bg-[#C9252C] text-white shadow-red-200 dark:shadow-none'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const CustomizationModal: React.FC<{ item: MenuItem; currentQty: number; onClose: () => void; onAdd: (item: CartItem, e: React.MouseEvent) => void; showToast: (msg: string) => void }> = ({ item, currentQty, onClose, onAdd, showToast }) => {
  const [quantity, setQuantity] = useState(1);
  const [temperature, setTemperature] = useState('Đá');
  const [sugarLevel, setSugarLevel] = useState('Bình thường');
  const [iceLevel, setIceLevel] = useState('Bình thường');
  const [note, setNote] = useState('');

  const hasCustomizations = item.hasCustomizations !== false;

  const getVariant = (temp: string) => {
    if (!item.variants) return null;
    if (temp === 'Nóng') return item.variants['Nóng'];
    if (temp === 'Đá' || temp === 'Đá riêng') return item.variants['Đá'];
    return null;
  };

  const currentVariant = getVariant(temperature);
  const basePrice = currentVariant ? currentVariant.price : item.price;
  const baseId = currentVariant ? currentVariant.id : item.id;

  const finalUnitPrice = basePrice;
  const finalTotalPrice = finalUnitPrice * quantity;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white dark:bg-stone-900 rounded-t-[40px] w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border-t border-stone-100 dark:border-stone-800"
      >
        <div className="px-6 py-4 flex justify-between items-center border-b border-stone-50 dark:border-stone-800">
          <div>
            <h2 className="text-xl font-black text-stone-800 dark:text-white">
              Tùy chỉnh
            </h2>
            <p className="text-stone-400 dark:text-stone-500 font-medium text-xs">{item.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto px-6 py-4 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 gap-6">
            <section>
              <h4 className="text-stone-400 dark:text-stone-500 font-black text-[10px] uppercase tracking-widest mb-3">Nhiệt độ</h4>
              <div className="flex gap-2">
                {['Nóng', 'Đá', 'Đá riêng'].map(temp => (
                  <button
                    key={temp}
                    onClick={() => setTemperature(temp)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs border-2 transition-all tap-active ${
                      temperature === temp ? 'border-[#C9252C] bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-300' : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {temp}
                  </button>
                ))}
              </div>
            </section>

            {(temperature === 'Đá') && (
              <section>
                <h4 className="text-stone-400 dark:text-stone-500 font-black text-[10px] uppercase tracking-widest mb-3">Lượng đá</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['Ít', 'Vừa', 'Bình thường'].map(level => (
                    <button
                      key={level}
                      onClick={() => setIceLevel(level)}
                      className={`py-2 rounded-lg font-bold text-[10px] border-2 transition-all tap-active ${
                        iceLevel === level ? 'border-[#C9252C] bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-300' : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h4 className="text-stone-400 dark:text-stone-500 font-black text-[10px] uppercase tracking-widest mb-3">Lượng đường</h4>
              <div className="grid grid-cols-2 gap-2">
                {['Ít ngọt', 'Vừa', 'Bình thường', 'Ngọt', 'Đường kiêng'].map(level => (
                  <button
                    key={level}
                    onClick={() => setSugarLevel(level === 'Đường kiêng' ? '1 gói đường kiêng' : level)}
                    className={`py-2 rounded-lg font-bold text-[10px] border-2 transition-all tap-active ${
                      (level === 'Đường kiêng' ? sugarLevel === '1 gói đường kiêng' : sugarLevel === level)
                        ? 'border-[#C9252C] bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-300' 
                        : 'border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section>
            <h4 className="text-stone-400 dark:text-stone-500 font-black text-[10px] uppercase tracking-widest mb-3">Ghi chú</h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Không lấy ống hút..."
              className="input-field p-4 rounded-xl resize-none text-xs font-medium"
              rows={2}
            />
          </section>
        </div>

        <div className="p-6 bg-white dark:bg-stone-900 border-t border-stone-50 dark:border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center bg-stone-50 dark:bg-stone-800 rounded-xl p-1 border border-stone-100 dark:border-stone-700">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active"><Minus className="w-4 h-4" /></button>
              <span className="w-9 text-center font-black text-lg text-stone-800 dark:text-white">{quantity}</span>
              <button 
                onClick={() => {
                  if (item.inventoryQty !== undefined && currentQty + quantity + 1 > item.inventoryQty) {
                    showToast(`Chỉ còn ${item.inventoryQty} sản phẩm trong kho!`);
                    return;
                  }
                  setQuantity(quantity + 1);
                }} 
                className="w-9 h-9 flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-stone-400 dark:text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-0.5">Tổng cộng</p>
              <p className="text-xl font-black text-[#C9252C]">{finalTotalPrice.toLocaleString()}đ</p>
            </div>
          </div>
          <button
            onClick={(e) => onAdd({
              ...item,
              id: baseId,
              price: basePrice,
              cartItemId: Math.random().toString(36).substr(2, 9),
              quantity,
              size: "Tiêu chuẩn",
              toppings: [],
              unitPrice: finalUnitPrice,
              temperature: temperature,
              sugarLevel: sugarLevel,
              iceLevel: temperature === 'Đá' ? iceLevel : (temperature === 'Đá riêng' ? 'Bình thường' : undefined),
              note: note,
            }, e)}
            className="btn-primary shadow-xl shadow-red-200 dark:shadow-red-900/20"
          >
            Thêm vào giỏ hàng
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
