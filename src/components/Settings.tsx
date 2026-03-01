import { useState, useEffect } from 'react';
import { Save, CheckCircle2, Store, Printer, Volume2, Wifi, Moon, Sun, Database, RotateCcw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

interface SettingsProps {
  appsScriptUrl: string;
  setAppsScriptUrl: (url: string) => void;
}

export function Settings({ appsScriptUrl, setAppsScriptUrl }: SettingsProps) {
  const { theme, toggleTheme } = useTheme();
  const { refreshInterval, setRefreshInterval, autoSyncEnabled: dataAutoSync, setAutoSyncEnabled: setDataAutoSync, fetchAllData, syncDatabase } = useData();
  
  // Initial values for dirty checking
  const [initialSettings, setInitialSettings] = useState({
    storeName: localStorage.getItem('storeName') || 'Tiệm Nước Nhỏ',
    storeAddress: localStorage.getItem('storeAddress') || '123 Đường ABC, TP.HCM',
    wifiPass: localStorage.getItem('wifiPass') || '12345678',
    printerIp: localStorage.getItem('printerIp') || '192.168.1.200',
    autoPrint: localStorage.getItem('autoPrint') === 'true',
    isMuted: localStorage.getItem('notificationMuted') === 'true',
    enableAI: localStorage.getItem('enableAI') !== 'false',
    appsScriptUrl: appsScriptUrl,
    refreshInterval: refreshInterval,
    autoSyncEnabled: localStorage.getItem('autoSyncEnabled') !== 'false',
  });

  // Store Settings
  const [storeName, setStoreName] = useState(initialSettings.storeName);
  const [storeAddress, setStoreAddress] = useState(initialSettings.storeAddress);
  const [wifiPass, setWifiPass] = useState(initialSettings.wifiPass);

  // Connection Settings
  const [url, setUrl] = useState(appsScriptUrl);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(initialSettings.autoSyncEnabled);

  // Printer Settings
  const [printerIp, setPrinterIp] = useState(initialSettings.printerIp);
  const [autoPrint, setAutoPrint] = useState(initialSettings.autoPrint);

  // Sound Settings
  const [isMuted, setIsMuted] = useState(initialSettings.isMuted);

  // AI Settings
  const [enableAI, setEnableAI] = useState(initialSettings.enableAI);

  // Data Refresh Settings
  const [localRefreshInterval, setLocalRefreshInterval] = useState(initialSettings.refreshInterval);

  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = 
      storeName !== initialSettings.storeName ||
      storeAddress !== initialSettings.storeAddress ||
      wifiPass !== initialSettings.wifiPass ||
      printerIp !== initialSettings.printerIp ||
      autoPrint !== initialSettings.autoPrint ||
      isMuted !== initialSettings.isMuted ||
      enableAI !== initialSettings.enableAI ||
      url !== initialSettings.appsScriptUrl ||
      localRefreshInterval !== initialSettings.refreshInterval ||
      autoSyncEnabled !== initialSettings.autoSyncEnabled;
    
    setHasChanges(changed);
  }, [storeName, storeAddress, wifiPass, printerIp, autoPrint, isMuted, enableAI, url, localRefreshInterval, autoSyncEnabled, initialSettings]);

  const handleSave = () => {
    if (localRefreshInterval < 15) {
      alert('Thời gian làm mới tối thiểu là 15 giây.');
      return;
    }

    localStorage.setItem('storeName', storeName);
    localStorage.setItem('storeAddress', storeAddress);
    localStorage.setItem('wifiPass', wifiPass);
    localStorage.setItem('printerIp', printerIp);
    localStorage.setItem('autoPrint', String(autoPrint));
    localStorage.setItem('notificationMuted', String(isMuted));
    localStorage.setItem('enableAI', String(enableAI));
    localStorage.setItem('appsScriptUrl', url);
    localStorage.setItem('refreshInterval', String(localRefreshInterval));
    localStorage.setItem('autoSyncEnabled', String(autoSyncEnabled));
    
    setAppsScriptUrl(url);
    setRefreshInterval(localRefreshInterval);
    setDataAutoSync(autoSyncEnabled);

    // Update initial settings to match current saved state
    setInitialSettings({
      storeName,
      storeAddress,
      wifiPass,
      printerIp,
      autoPrint,
      isMuted,
      enableAI,
      appsScriptUrl: url,
      refreshInterval: localRefreshInterval,
      autoSyncEnabled: autoSyncEnabled,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full pb-32 p-6 space-y-8 max-w-2xl mx-auto">
      
      {/* Header Section */}
      <header className="space-y-1 px-1">
        <h1 className="text-3xl font-black text-stone-800 dark:text-white tracking-tight">Cài đặt</h1>
        <p className="text-stone-500 dark:text-stone-400 font-medium">Quản lý cửa hàng và cấu hình hệ thống</p>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* Connection Settings */}
        <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shadow-inner">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Kết nối dữ liệu</h2>
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">Data Connection</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const defaultUrl = 'https://script.google.com/macros/s/AKfycbwzknc8DQz48L7I3j-YC_Rd8KavO4tFlogytheNjYyaujpIMDYnuNFXrS9gNMbWcUMF/exec';
                setUrl(defaultUrl);
              }}
              className="p-2.5 text-stone-400 hover:text-[#C9252C] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all tap-active"
              title="Khôi phục mặc định"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Apps Script URL</label>
              <div className="relative group">
                <textarea 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-2xl px-4 py-3 font-mono text-[11px] leading-relaxed min-h-[100px] focus:ring-2 focus:ring-[#C9252C]/20 focus:border-[#C9252C] outline-none transition-all resize-none"
                  placeholder="https://script.google.com/macros/s/..."
                />
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Database className="w-4 h-4 text-stone-300 dark:text-stone-700" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  const success = await syncDatabase();
                  if (!success) {
                    alert('Đồng bộ thất bại. Vui lòng kiểm tra lại kết nối.');
                  } else {
                    alert('Đồng bộ cấu trúc Database thành công!');
                  }
                }}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 bg-gradient-to-br from-[#C9252C] to-[#991B1B] text-white rounded-[24px] font-black shadow-xl shadow-red-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all tap-active group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center gap-3">
                  <RotateCcw className="w-6 h-6 animate-pulse" />
                  <span className="text-lg uppercase tracking-wider">Sync Master Data</span>
                </div>
                <p className="text-[10px] font-bold opacity-70 uppercase tracking-[0.2em]">Đồng bộ cấu trúc Database</p>
              </button>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-stone-600 dark:text-stone-300 uppercase tracking-wider">Tự động đồng bộ</label>
                    <p className="text-[10px] text-stone-400 font-medium">Cập nhật đơn hàng & thực đơn</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${autoSyncEnabled ? 'bg-[#C9252C]' : 'bg-stone-200 dark:bg-stone-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  {autoSyncEnabled && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="15"
                        value={localRefreshInterval}
                        onChange={(e) => setLocalRefreshInterval(Number(e.target.value))}
                        className="w-16 bg-stone-50 dark:bg-stone-950 px-2 py-1.5 rounded-xl border border-stone-100 dark:border-stone-800 text-xs font-black text-[#C9252C] text-center focus:ring-2 focus:ring-[#C9252C]/20 focus:outline-none"
                      />
                      <span className="text-xs font-black text-stone-500">s</span>
                    </div>
                  )}
                </div>
              </div>
              {autoSyncEnabled && localRefreshInterval < 15 && (
                <p className="text-xs text-red-500 font-bold mt-2">Thời gian làm mới tối thiểu là 15 giây để tránh lỗi Rate Limit.</p>
              )}
            </div>
          </div>
        </section>

        {/* Store Info Section */}
        <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-[#C9252C] rounded-2xl flex items-center justify-center shadow-inner">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Thông tin cửa hàng</h2>
              <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">Store Info</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Tên quán</label>
              <input 
                type="text" 
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-2xl px-4 py-3 font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20 focus:border-[#C9252C] outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Mật khẩu Wifi</label>
              <div className="relative">
                <Wifi className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input 
                  type="text" 
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-2xl pl-11 pr-4 py-3 font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20 focus:border-[#C9252C] outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Địa chỉ</label>
              <input 
                type="text" 
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-2xl px-4 py-3 font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20 focus:border-[#C9252C] outline-none transition-all"
              />
            </div>
          </div>
        </section>

        {/* Preferences Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Appearance */}
          <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-2xl flex items-center justify-center shadow-inner">
                {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Giao diện</h2>
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">Appearance</p>
              </div>
            </div>

            <button 
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-100 dark:border-stone-800 group transition-all tap-active"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <span className="font-bold text-stone-700 dark:text-stone-300 text-sm">Chế độ tối</span>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[#C9252C]' : 'bg-stone-300 dark:bg-stone-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
          </section>

          {/* Sound */}
          <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center shadow-inner">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Âm thanh</h2>
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">Sound Settings</p>
              </div>
            </div>

            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-full flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-100 dark:border-stone-800 group transition-all tap-active"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${!isMuted ? 'bg-purple-500/10 text-purple-500' : 'bg-stone-500/10 text-stone-500'}`}>
                  <Volume2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-sm">Âm thanh thông báo</span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">Phát tiếng "Ting Ting" khi có đơn mới</span>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors relative ${!isMuted ? 'bg-[#C9252C]' : 'bg-stone-300 dark:bg-stone-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${!isMuted ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
          </section>

          {/* AI Settings */}
          <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md md:col-span-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Trí tuệ nhân tạo</h2>
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">AI Features</p>
              </div>
            </div>

            <button 
              onClick={() => setEnableAI(!enableAI)}
              className="w-full flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-100 dark:border-stone-800 group transition-all tap-active"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${enableAI ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-500/10 text-stone-500'}`}>
                  <Database className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-sm">Bật AI Model</span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">Tự động tạo nội dung cho Giỏ hàng & Lịch sử</span>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors relative ${enableAI ? 'bg-[#C9252C]' : 'bg-stone-300 dark:bg-stone-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${enableAI ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
          </section>
        </div>

        {/* Printer Settings */}
        <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 space-y-6 transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-inner">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-stone-800 dark:text-white text-lg leading-none">Máy in & Hóa đơn</h2>
              <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1.5">Printer Settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setAutoPrint(!autoPrint)}
              className="w-full flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-950 rounded-2xl border border-stone-100 dark:border-stone-800 group transition-all tap-active"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${autoPrint ? 'bg-blue-500/10 text-blue-500' : 'bg-stone-500/10 text-stone-500'}`}>
                  <Printer className="w-4 h-4" />
                </div>
                <span className="font-bold text-stone-700 dark:text-stone-300 text-sm">Tự động in hóa đơn</span>
              </div>
              <div className={`w-12 h-7 rounded-full transition-colors relative ${autoPrint ? 'bg-[#C9252C]' : 'bg-stone-300 dark:bg-stone-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-1 transition-all ${autoPrint ? 'left-6' : 'left-1'}`} />
              </div>
            </button>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">IP Máy in LAN/WiFi</label>
              <div className="relative">
                <Wifi className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input 
                  type="text" 
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="192.168.1.xxx"
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-2xl pl-11 pr-4 py-3 font-mono text-sm font-bold text-stone-800 dark:text-white focus:ring-2 focus:ring-[#C9252C]/20 focus:border-[#C9252C] outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-stone-400 font-medium px-1 italic">* Hệ thống hỗ trợ in trực tiếp qua trình duyệt (window.print) tối ưu cho khổ giấy 58mm/80mm.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Save Button */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-24 left-6 right-6 z-50 flex justify-center"
          >
            <button
              onClick={handleSave}
              className="w-full max-w-md bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-5 rounded-[24px] font-black text-lg shadow-2xl shadow-stone-900/20 dark:shadow-white/10 tap-active flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Đã lưu thay đổi
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  Lưu cấu hình
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Version */}
      <footer className="text-center space-y-2 pt-8 pb-4 opacity-40">
        <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.2em]">Tiệm Nước Nhỏ • POS System</p>
        <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500">Version 1.4.0 • Build 2025</p>
      </footer>

    </div>
  );
}
