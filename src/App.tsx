import { useState, useEffect } from 'react';
import { ShoppingBag, Coffee, Settings as SettingsIcon, Clock, BarChart3, Bell, QrCode } from 'lucide-react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu } from './components/Menu';
import { Cart } from './components/Cart';
import { Settings } from './components/Settings';
import { OrderHistory } from './components/OrderHistory';
import { StaffView } from './components/StaffView';
import { MenuManager } from './components/MenuManager';
import { NotificationsPanel } from './components/NotificationsPanel';
import { GlobalQrModal } from './components/GlobalQrModal';
import { CartItem } from './types';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider, useUI } from './context/UIContext';
import { DataProvider, useData } from './context/DataContext';
import { CartProvider, useCart } from './context/CartContext';
import { RefreshCw, Loader2 } from 'lucide-react';

const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxtqFTziakEfyDJQQsWmwZMytuC2PZwNmTkWC7gecpKKiGfOX1ERo9M9DNJYsEVW08/exec';

interface AppContentProps {
  appsScriptUrl: string;
  setAppsScriptUrl: (url: string) => void;
}

function AppContent({ appsScriptUrl, setAppsScriptUrl }: AppContentProps) {
  const location = useLocation();
  const { isFabHidden, setIsFabHidden } = useUI();
  const { isRefreshing, isLoading } = useData();
  const { cart, cartCount, updateQuantity, updateCartItem, clearCart, restoreCart } = useCart();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    setIsFabHidden(showNotifications || isQrModalOpen);
  }, [showNotifications, isQrModalOpen, setIsFabHidden]);

  const getTitle = () => {
    switch (location.pathname) {
      case '/': return 'Tiệm Nước Nhỏ';
      case '/cart': return 'Đơn hàng';
      case '/history': return 'Lịch sử';
      case '/staff': return 'Quản lý';
      case '/settings': return 'Cài đặt';
      default: return 'Tiệm Nước Nhỏ';
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-stone-50 dark:bg-black text-stone-900 dark:text-white font-sans overflow-hidden transition-colors duration-300">
      {/* Background Refresh Indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-white dark:bg-stone-900 px-4 py-2 rounded-full shadow-xl border border-stone-100 dark:border-stone-800 flex items-center gap-2 pointer-events-none"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C9252C]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Đang cập nhật...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-white dark:bg-stone-900 p-8 rounded-[40px] shadow-2xl flex flex-col items-center gap-4 border border-stone-100 dark:border-stone-800">
              <Loader2 className="w-10 h-10 animate-spin text-[#C9252C]" />
              <p className="text-sm font-black uppercase tracking-widest text-stone-800 dark:text-white">Đang xử lý...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex justify-between items-center bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-stone-100/50 dark:border-stone-800/50 transition-all duration-300">
        <h1 className="text-xl font-extrabold text-stone-800 dark:text-white tracking-tight flex items-center gap-2">
          {location.pathname === '/' && <Coffee className="w-6 h-6 text-[#C9252C]" />}
          {getTitle()}
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNotifications(true)}
            className="relative p-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full tap-active hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      <NotificationsPanel 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
        appsScriptUrl={appsScriptUrl} 
      />

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto w-full relative pt-[72px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="h-full"
          >
            <Routes location={location}>
              <Route path="/" element={
                <Menu 
                  appsScriptUrl={appsScriptUrl}
                  onNavigateSettings={() => {}}
                />
              } />
              <Route path="/cart" element={
                <Cart
                  appsScriptUrl={appsScriptUrl}
                  onNavigateSettings={() => {}}
                />
              } />
              <Route path="/history" element={<OrderHistory />} />
              <Route path="/staff" element={<StaffView appsScriptUrl={appsScriptUrl} />} />
              <Route path="/menu-manager" element={<MenuManager appsScriptUrl={appsScriptUrl} />} />
              <Route path="/settings" element={
                <Settings
                  appsScriptUrl={appsScriptUrl}
                  setAppsScriptUrl={(url) => {
                    setAppsScriptUrl(url);
                    localStorage.setItem('appsScriptUrl', url);
                  }}
                />
              } />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Quick QR FAB */}
      <AnimatePresence>
        {!isFabHidden && !showNotifications && !isQrModalOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={() => setIsQrModalOpen(true)}
            className="fixed bottom-32 right-6 z-50 w-14 h-14 bg-[#C9252C] text-white rounded-full shadow-xl shadow-red-500/30 flex items-center justify-center tap-active hover:scale-110 transition-transform duration-300 group"
          >
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-0 group-hover:opacity-100" />
            <QrCode className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      <GlobalQrModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        <nav className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-t border-stone-100 dark:border-stone-800 px-4 pt-3 pb-8 flex justify-around items-center pointer-events-auto shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          {[
            { to: '/', icon: Coffee, label: 'Menu' },
            { to: '/cart', icon: ShoppingBag, label: 'Giỏ', badge: cartCount },
            { to: '/history', icon: Clock, label: 'Lịch sử' },
            { to: '/staff', icon: BarChart3, label: 'Quản lý' },
            { to: '/settings', icon: SettingsIcon, label: 'Cài đặt' },
          ].map((item, index) => {
            const isActive = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                id={item.to === '/cart' ? 'bottom-nav-cart' : undefined}
                className={`relative flex flex-col items-center gap-1 transition-all duration-300 tap-active py-1 px-3 ${
                  isActive ? 'text-[#C9252C]' : 'text-stone-400 dark:text-stone-500'
                }`}
              >
                <div className={`relative p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-red-50 dark:bg-red-900/20 scale-110' : ''}`}>
                  <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C9252C] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-stone-900 shadow-sm animate-in zoom-in duration-300">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-60'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#C9252C] rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    const saved = localStorage.getItem('appsScriptUrl');
    const lastDefault = localStorage.getItem('lastDefaultUrl');
    
    // Check if we need to migrate to the new default URL
    if (lastDefault !== DEFAULT_URL) {
      localStorage.setItem('lastDefaultUrl', DEFAULT_URL);
      // Force update to new URL if the saved one looks like an old Google Script URL or is empty
      // This ensures users get the fix for the "Failed to fetch" error
      if (!saved || saved.includes('script.google.com')) {
        localStorage.setItem('appsScriptUrl', DEFAULT_URL);
        return DEFAULT_URL;
      }
    }
    return saved || DEFAULT_URL;
  });

  return (
    <ThemeProvider>
      <UIProvider>
        <DataProvider appsScriptUrl={appsScriptUrl}>
          <CartProvider>
            <HashRouter>
              <AppContent appsScriptUrl={appsScriptUrl} setAppsScriptUrl={setAppsScriptUrl} />
            </HashRouter>
          </CartProvider>
        </DataProvider>
      </UIProvider>
    </ThemeProvider>
  );
}

