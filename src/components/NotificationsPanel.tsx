import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertCircle, CheckCircle2, Info, X, Clock, Wallet, AlertTriangle } from 'lucide-react';
import { OrderData, Expense } from '../types';

import { useData } from '../context/DataContext';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  appsScriptUrl: string;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  time: Date;
}

export function NotificationsPanel({ isOpen, onClose, appsScriptUrl }: NotificationsPanelProps) {
  const { orders, soTayData } = useData();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const notifs: AppNotification[] = [];
    const now = new Date();

    // 1. Connection Error
    if (!appsScriptUrl) {
      notifs.push({
        id: 'no-sheet',
        title: 'Chưa kết nối Sheet',
        message: 'Vui lòng vào Cài đặt để thiết lập URL Apps Script.',
        type: 'error',
        time: now,
      });
    }

    // 2. Sync Error
    const syncError = localStorage.getItem('sync_error');
    if (syncError) {
      notifs.push({
        id: 'sync-error',
        title: 'Lỗi đồng bộ',
        message: 'Không gửi được đơn hàng về sheet. Vui lòng kiểm tra mạng.',
        type: 'error',
        time: now,
      });
    }

    // 3. Order Status Notifications (Recent 10)
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    recentOrders.forEach(order => {
      const orderTime = new Date(order.timestamp);
      
      if (order.orderStatus === 'Hoàn thành') {
        notifs.push({
          id: `order-done-${order.orderId}`,
          title: 'Đơn hàng hoàn thành',
          message: `Đơn ${order.orderId} đã được hoàn thành.`,
          type: 'success',
          time: orderTime,
        });
      } else if (order.orderStatus === 'Đã hủy') {
        notifs.push({
          id: `order-cancel-${order.orderId}`,
          title: 'Đơn hàng đã hủy',
          message: `Đơn ${order.orderId} đã bị hủy.`,
          type: 'warning',
          time: orderTime,
        });
      }
      
      if (order.paymentStatus === 'Chưa thanh toán') {
        notifs.push({
          id: `order-debt-${order.orderId}`,
          title: 'Đơn hàng công nợ',
          message: `Đơn ${order.orderId} chưa được thanh toán.`,
          type: 'warning',
          time: orderTime,
        });
      } else if (order.paymentStatus === 'Đã thanh toán') {
        notifs.push({
          id: `order-paid-${order.orderId}`,
          title: 'Đã thanh toán',
          message: `Đơn ${order.orderId} đã thanh toán thành công.`,
          type: 'success',
          time: orderTime,
        });
      }
    });

    // 4. End of Day Summary (After 20:00)
    if (now.getHours() >= 20) {
      const todayOrders = orders.filter(o => new Date(o.timestamp).toDateString() === now.toDateString() && o.orderStatus === 'Hoàn thành');
      const todayExpenses = soTayData.filter(e => e.phan_loai === 'Chi' && new Date(e.thoi_gian).toDateString() === now.toDateString());
      
      const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
      const todayCost = todayExpenses.reduce((sum, e) => sum + Number(e.so_tien), 0);

      notifs.push({
        id: `eod-${now.toDateString()}`,
        title: 'Tổng kết cuối ngày',
        message: `Doanh thu: ${todayRevenue.toLocaleString()}đ | Chi phí: ${todayCost.toLocaleString()}đ`,
        type: 'info',
        time: now,
      });
    }

    // 5. Monthly Fixed Cost Reminder (1st to 5th)
    const date = now.getDate();
    if (date >= 1 && date <= 5) {
      const daysLeft = 5 - date;
      notifs.push({
        id: `monthly-reminder-${now.getMonth()}`,
        title: 'Nhắc nhở thanh toán',
        message: daysLeft === 0 
          ? 'Hôm nay là hạn chót thanh toán chi phí cố định hàng tháng!' 
          : `Còn ${daysLeft} ngày nữa đến hạn thanh toán chi phí cố định (ngày 5).`,
        type: daysLeft === 0 ? 'error' : 'warning',
        time: now,
      });
    }

    // 6. End of Month Summary (>= 25th)
    if (date >= 25) {
      const thisMonthOrders = orders.filter(o => {
        const d = new Date(o.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && o.orderStatus === 'Hoàn thành';
      });
      const thisMonthExpenses = soTayData.filter(e => {
        const d = new Date(e.thoi_gian);
        return e.phan_loai === 'Chi' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      const monthRevenue = thisMonthOrders.reduce((sum, o) => sum + o.total, 0);
      const monthCost = thisMonthExpenses.reduce((sum, e) => sum + Number(e.so_tien), 0);
      
      // Calculate Fixed Costs
      const fixedCostCategories = ["Mặt bằng", "Nhân viên", "Điện", "Nước", "Wifi", "Rác"];
      const fixedCosts = thisMonthExpenses
        .filter(e => fixedCostCategories.includes(e.danh_muc))
        .reduce((sum, e) => sum + Number(e.so_tien), 0);

      const isEnoughForFixed = monthRevenue >= fixedCosts;
      const isEnoughTotal = monthRevenue >= monthCost;

      notifs.push({
        id: `eom-${now.getMonth()}`,
        title: 'Tổng kết tháng ' + (now.getMonth() + 1),
        message: `Doanh thu: ${monthRevenue.toLocaleString()}đ | Tổng chi: ${monthCost.toLocaleString()}đ. ${isEnoughForFixed ? 'Đủ chi trả các chi phí cố định.' : 'Cảnh báo: Doanh thu chưa đủ bù chi phí cố định!'}`,
        type: isEnoughTotal ? 'success' : (isEnoughForFixed ? 'warning' : 'error'),
        time: now,
      });
    }

    // Sort by time descending
    notifs.sort((a, b) => b.time.getTime() - a.time.getTime());

    // Filter out cleared notifications
    const clearedIds = JSON.parse(localStorage.getItem('cleared_notifications') || '[]');
    const activeNotifs = notifs.filter(n => !clearedIds.includes(n.id));

    // Remove duplicates by ID (keep first occurrence which is latest due to sort)
    const uniqueNotifs = activeNotifs.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

    setNotifications(uniqueNotifs);
  }, [isOpen, appsScriptUrl]);

  const handleClearAll = () => {
    const currentIds = notifications.map(n => n.id);
    const clearedIds = JSON.parse(localStorage.getItem('cleared_notifications') || '[]');
    const newClearedIds = Array.from(new Set([...clearedIds, ...currentIds]));
    localStorage.setItem('cleared_notifications', JSON.stringify(newClearedIds));
    setNotifications([]);
  };

  const handleClearOne = (id: string) => {
    const clearedIds = JSON.parse(localStorage.getItem('cleared_notifications') || '[]');
    clearedIds.push(id);
    localStorage.setItem('cleared_notifications', JSON.stringify(clearedIds));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-20 right-4 w-80 max-h-[70vh] bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-100 dark:border-stone-800 z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/50">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-stone-800 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#C9252C]" />
                  Thông báo
                </h3>
                {notifications.length > 0 && (
                  <span className="bg-[#C9252C] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-[#C9252C] px-2 py-1 transition-colors"
                  >
                    Xóa hết
                  </button>
                )}
                <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full tap-active">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-2 flex-grow">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-stone-400 dark:text-stone-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-bold">Không có thông báo nào</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {notifications.map(notif => (
                      <motion.div 
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl flex gap-3 items-start group relative"
                      >
                        <div className="mt-0.5">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-stone-800 dark:text-white mb-0.5">{notif.title}</h4>
                          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-stone-400 mt-1.5 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {notif.time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {notif.time.toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleClearOne(notif.id)}
                          className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-stone-300 hover:text-stone-500 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
