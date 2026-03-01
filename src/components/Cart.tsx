import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, Minus, ArrowRight, AlertCircle, Edit2, X, ShoppingBag, Clock, CheckCircle2, RefreshCw, ChevronRight, Sparkles, User, Share2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { CartItem, OrderData } from '../types';
import { SIZES, TOPPINGS } from './Menu';
import { useUI } from '../context/UIContext';
import { useData } from '../context/DataContext';
import { notificationService } from '../services/NotificationService';
import { Invoice } from './Invoice';

import { useCart } from '../context/CartContext';

interface CartProps {
  appsScriptUrl: string;
  onNavigateSettings: () => void;
}

export function Cart({ appsScriptUrl, onNavigateSettings }: CartProps) {
  const { setIsFabHidden } = useUI();
  const { orders, createOrder, fetchAllData, updateOrderStatus } = useData();
  const { cart, updateQuantity, updateCartItem, clearCart, restoreCart } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSubmitEnabled, setIsAutoSubmitEnabled] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<OrderData | null>(() => {
    const saved = localStorage.getItem('submittedOrder');
    return saved ? JSON.parse(saved) : null;
  });

  const [aiEmptyState, setAiEmptyState] = useState<{title: string, content: string, button: string, emoji: string} | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [showInvoice, setShowInvoice] = useState(false);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const handleUpdateQuantity = (item: CartItem, delta: number) => {
    if (delta > 0 && item.inventoryQty !== undefined && item.quantity + delta > item.inventoryQty) {
      showToast(`Chỉ còn ${item.inventoryQty} sản phẩm trong kho!`);
      return;
    }
    updateQuantity(item.cartItemId, delta);
  };

  const emptyStates = [
    {
      title: "Cốc của bạn đang buồn hiu...",
      content: "Chưa có giọt nước nào trong đơn cả. Đừng để cổ họng khô khốc, \"chốt đơn\" ngay ly trà sữa full topping đi!",
      button: "Uống ngay cho đã!",
      emoji: "🥺"
    },
    {
      title: "Sạch bóng ly cốc!",
      content: "Chưa thấy một dấu vết nào của sự giải khát ở đây cả. Bạn định nhịn uống để dành tiền lấy vợ/chồng à?",
      button: "Phung phí chút đi!",
      emoji: "💸"
    },
    {
      title: "Một sự trống trải...",
      content: "Lịch sử order của bạn còn sạch hơn cả ly nước lọc. Mau \"vấy bẩn\" nó bằng vài ly trà sữa béo ngậy đi!",
      button: "Lên đơn cho đỡ khát",
      emoji: "💅"
    },
    {
      title: "Tìm đỏ mắt không thấy đơn!",
      content: "Lục tung cái app này lên cũng không thấy bạn đã uống gì. Đừng để máy pha cà phê ngồi chơi xơi nước nữa bạn ơi!",
      button: "Tạo công ăn việc làm ngay",
      emoji: "👀"
    },
    {
      title: "Trống trơn!",
      content: "Nhìn gì mà nhìn? Chưa đặt ly nào thì lấy đâu ra lịch sử mà xem. Quay lại menu gấp!",
      button: "Đi đặt nước ngay đi!",
      emoji: "🙄"
    },
    {
      title: "Giỏ hàng đang 'khát'",
      content: "Giỏ hàng đang trống trải như ví tiền cuối tháng vậy. Chọn nước ngay thôi đồng chí ơi!",
      button: "Triển thôi!",
      emoji: "💀"
    },
    {
      title: "Barista đang đợi",
      content: "Đừng để Barista đợi chờ trong vô vọng, lên đơn ngay và luôn nào!",
      button: "Lên đơn!",
      emoji: "👨‍🍳"
    },
    {
      title: "Máy xay mốc meo rồi",
      content: "Máy xay đang mốc meo rồi, chọn đại một ly sinh tố cho vui cửa vui nhà đi!",
      button: "Cứu khát!",
      emoji: "🕸️"
    },
    {
      title: "Tính xem bói hả?",
      content: "Tính xem bói hay sao mà chưa chọn món nào thế? Quay lại thực đơn ngay!",
      button: "Xem menu!",
      emoji: "🔮"
    },
    {
      title: "Hông có gì giải nhiệt",
      content: "Hông chọn món là hông có gì giải nhiệt đâu nha. Quay lại menu thôi nè!",
      button: "Triển ngay!",
      emoji: "🫠"
    },
    {
      title: "Menu bao la",
      content: "Menu bao la mà chưa thấy món nào vào 'mắt xanh' của bạn sao? Thử lại xem!",
      button: "Thử lại!",
      emoji: "✨"
    },
    {
      title: "Đang đợi chốt đơn",
      content: "Tình trạng: Đang đợi chốt đơn. Đừng để tui đợi lâu, tui dỗi đó!",
      button: "Chốt đơn!",
      emoji: "😤"
    },
    {
      title: "Uống không khí hả?",
      content: "Ủa rồi có chọn món không hay định uống không khí? Quay lại menu gấp!",
      button: "Uống món ngon!",
      emoji: "🤡"
    },
    {
      title: "Trống như NYC",
      content: "Order trống trơn như người yêu cũ vậy. Quay lại tìm 'mối' mới trong menu đi!",
      button: "Tìm mối mới!",
      emoji: "💔"
    },
    {
      title: "Ảo thuật gia à?",
      content: "Định làm ảo thuật cho ly nước tự hiện ra à? Phải chọn thì mới có đơn chứ!",
      button: "Chọn món!",
      emoji: "🎩"
    }
  ];

  const randomState = useMemo(() => {
    // 1. Get cached AI messages
    const cached = localStorage.getItem('ai_generated_messages');
    const aiMessages = cached ? JSON.parse(cached) : [];
    
    // 2. Combine with static messages
    const allMessages = [...emptyStates, ...aiMessages];
    
    // 3. Pick one randomly
    return allMessages[Math.floor(Math.random() * allMessages.length)];
  }, [cart.length === 0]);

  const generateAIEmptyState = async () => {
    if (isGeneratingAI) return;
    
    // Check if AI is enabled in settings
    const isAIEnabled = localStorage.getItem('enableAI') !== 'false';
    if (!isAIEnabled) return;

    // Clear error if it's older than 10 minutes
    const lastError = localStorage.getItem('ai_last_error_time');
    if (lastError && Date.now() - parseInt(lastError) > 10 * 60 * 1000) {
      localStorage.removeItem('ai_last_error_time');
    }

    // 1. Luân phiên: Chỉ gọi AI 30% số lần hoặc khi chưa có mẫu AI nào lưu lại
    const cached = localStorage.getItem('ai_generated_messages');
    const aiMessages = cached ? JSON.parse(cached) : [];
    const shouldCallAI = aiMessages.length < 5 || Math.random() < 0.3;
    
    if (!shouldCallAI) return;

    // 2. Rate limit: Don't try again if we hit a quota error recently
    if (localStorage.getItem('ai_last_error_time')) {
      return;
    }

    setIsGeneratingAI(true);
    try {
      // Get menu data for context
      const menuData = localStorage.getItem('menu_data');
      let menuContext = "";
      if (menuData) {
        try {
          const items = JSON.parse(menuData);
          const available = items.filter((i: any) => !i.isOutOfStock).map((i: any) => i.name);
          const randomItems = available.sort(() => 0.5 - Math.random()).slice(0, 3);
          if (randomItems.length > 0) {
            menuContext = `Hãy nhắc đến các món này: ${randomItems.join(', ')}.`;
          }
        } catch (e) {}
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Model tối ưu nhất cho text
        contents: `Tạo 1 thông báo giỏ hàng trống cho app quán nước. 
        Style: GenZ, lầy lội, phũ, thả thính. ${menuContext}
        Tiêu đề < 25 ký tự, Nội dung < 80 ký tự. 
        Trả về JSON: title, content, button, emoji.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              button: { type: Type.STRING },
              emoji: { type: Type.STRING }
            },
            required: ["title", "content", "button", "emoji"]
          }
        }
      });
      
      const result = JSON.parse(response.text || '{}');
      if (result.title && result.content && result.button) {
        localStorage.removeItem('ai_last_error_time');
        
        const isDuplicate = aiMessages.some((msg: any) => msg.title === result.title || msg.content === result.content);
        if (!isDuplicate) {
          const newCache = [result, ...aiMessages].slice(0, 20); // Lưu tối đa 20 mẫu từ AI
          localStorage.setItem('ai_generated_messages', JSON.stringify(newCache));
        }
      }
    } catch (e: any) {
      // Ẩn thông báo lỗi, tự động dùng mẫu cũ
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        localStorage.setItem('ai_last_error_time', Date.now().toString());
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (cart.length === 0) {
      generateAIEmptyState();
    }
  }, [cart.length]);

  useEffect(() => {
    setIsFabHidden(showClearConfirm || !!editingItem);
    return () => setIsFabHidden(false);
  }, [showClearConfirm, editingItem, setIsFabHidden]);

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  useEffect(() => {
    if (submittedOrder) {
      const globalOrder = orders.find(o => o.orderId === submittedOrder.orderId);
      if (globalOrder && globalOrder.orderStatus !== submittedOrder.orderStatus) {
        setSubmittedOrder(globalOrder);
        localStorage.setItem('submittedOrder', JSON.stringify(globalOrder));
      }
    }
  }, [orders, submittedOrder]);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appsScriptUrl) {
      onNavigateSettings();
      return;
    }

    if (cart.length === 0) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    const ma_don = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Format ten_mon as a string: "1x CÀ PHÊ ĐEN, 2x TRÀ ĐÀO"
    const ten_mon_str = cart.map(item => `${item.quantity}x ${item.name.toUpperCase()}`).join(', ');

    // Map cart items to backend format
    const cartForBackend = cart.map(item => ({
      ma_mon: item.id || (item as any).ma_mon, 
      so_luong: item.quantity,
      has_customizations: item.hasCustomizations ?? false,
      ten_mon: item.name
    }));

    const orderData: OrderData = {
      orderId: ma_don,
      customerName,
      phoneNumber,
      tableNumber,
      items: cart,
      total,
      timestamp: new Date().toISOString(),
      notes,
      paymentMethod,
      orderStatus: 'Chờ xử lý',
      paymentStatus: paymentMethod === 'Tiền mặt' ? 'Chưa thanh toán' : 'Đã thanh toán',
    };

    const payload = {
      ma_don: ma_don,
      so_luong: totalQuantity,
      ten_mon: ten_mon_str,
      tong_tien: total,
      ghi_chu: notes,
      ten_khach_hang: customerName,
      so_ban: tableNumber,
      thanh_toan: paymentMethod,
      so_dien_thoai: phoneNumber,
      cart_items: cartForBackend
    };

    try {
      const success = await createOrder(payload, false);

      if (!success) {
        throw new Error('Có lỗi xảy ra khi gửi đơn hàng.');
      }

      setSubmitStatus('success');
      showToast('Tạo đơn thành công! Kho đã được cập nhật.');
      
      // Notify via WebSocket
      notificationService.notifyNewOrder(orderData);
      
      clearCart();
      setCustomerName('');
      setTableNumber('');
      setNotes('');

      if (isAutoSubmitEnabled) {
        setSubmittedOrder(null);
        localStorage.removeItem('submittedOrder');
      } else {
        setSubmittedOrder(orderData);
        localStorage.setItem('submittedOrder', JSON.stringify(orderData));
      }

      localStorage.removeItem('sync_error');
    } catch (error: any) {
      localStorage.setItem('sync_error', 'true');
      setErrorMessage(error.message || 'Có lỗi xảy ra khi gửi đơn hàng. Vui lòng thử lại.');
      setSubmitStatus('error');
      showToast('Hệ thống bận, chưa thể chốt đơn. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Auto-close success screen when unmounting (switching tabs)
    return () => {
      setSubmittedOrder(null);
      localStorage.removeItem('submittedOrder');
    };
  }, []);

  const mapCartToBackend = (items: CartItem[]) => {
    return items.map(item => ({
      ma_mon: item.id || (item as any).ma_mon, 
      so_luong: item.quantity,
      has_customizations: item.hasCustomizations ?? false,
      ten_mon: item.name
    }));
  };

  const handleCancelOrder = async () => {
    if (!submittedOrder) return;
    setIsSubmitting(true);
    try {
      const cartItemsPayload = mapCartToBackend(submittedOrder.items);
      const success = await updateOrderStatus(submittedOrder.orderId, 'Đã hủy', undefined, { cart_items: cartItemsPayload });
      
      if (success) {
        showToast('Hủy đơn thành công!');
        setSubmittedOrder(null);
        localStorage.removeItem('submittedOrder');
        clearCart();
        setSubmitStatus('idle');
      } else {
        throw new Error('Lỗi khi hủy đơn');
      }
    } catch (err) {
      alert('Không thể hủy đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOrder = async () => {
    if (!submittedOrder) return;
    setIsSubmitting(true);
    try {
      const cartItemsPayload = mapCartToBackend(submittedOrder.items);
      // Cancel old order first
      await updateOrderStatus(submittedOrder.orderId, 'Đã hủy', undefined, { cart_items: cartItemsPayload });
      
      // Restore cart
      restoreCart(submittedOrder.items);

      setCustomerName(submittedOrder.customerName);
      setPhoneNumber(submittedOrder.phoneNumber || '');
      setTableNumber(submittedOrder.tableNumber || '');
      setNotes(submittedOrder.notes || '');
      setSubmittedOrder(null);
      localStorage.removeItem('submittedOrder');
      setSubmitStatus('idle');
    } catch (err) {
      alert('Không thể chỉnh sửa lúc này. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewOrder = () => {
    setSubmittedOrder(null);
    localStorage.removeItem('submittedOrder');
    setSubmitStatus('idle');
    clearCart();
  };

    if (submittedOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center relative">
        <button 
          onClick={handleNewOrder}
          className="absolute top-4 right-4 w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400 rounded-[32px] flex items-center justify-center mb-8"
        >
          <CheckCircle2 className="w-12 h-12" />
        </motion.div>
        
        <h2 className="text-3xl font-black text-stone-800 dark:text-white mb-2">Đặt hàng thành công!</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8">Mã đơn: <span className="text-stone-800 dark:text-white font-bold">{submittedOrder.orderId}</span></p>

        <div className="w-full bg-white dark:bg-stone-900 rounded-[32px] p-6 shadow-sm border border-stone-100 dark:border-stone-800 text-left space-y-4 mb-8">
          <div className="flex justify-between items-center pb-4 border-b border-stone-50 dark:border-stone-800">
            <span className="text-stone-400 dark:text-stone-500 font-bold text-xs uppercase tracking-widest">Trạng thái</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              submittedOrder.orderStatus === 'Hoàn thành' ? 'bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400' :
              submittedOrder.orderStatus === 'Đã hủy' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
              'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            }`}>
              {submittedOrder.orderStatus}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400 dark:text-stone-500">Số điện thoại</span>
              <span className="font-bold text-stone-800 dark:text-white">{submittedOrder.phoneNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400 dark:text-stone-500">Thanh toán</span>
              <span className="font-bold text-stone-800 dark:text-white">{submittedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400 dark:text-stone-500">Tổng tiền</span>
              <span className="font-black text-[#C9252C] dark:text-red-400 text-lg">{submittedOrder.total.toLocaleString()}đ</span>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={() => setShowInvoice(true)}
            className="w-full py-4 bg-stone-800 dark:bg-white text-white dark:text-black font-black rounded-2xl tap-active flex items-center justify-center gap-2 shadow-lg uppercase tracking-widest text-xs"
          >
            <FileText className="w-4 h-4" />
            Xuất hóa đơn
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={handleEditOrder}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-red-50 dark:bg-red-900/20 text-[#B91C1C] dark:text-red-300 font-bold rounded-2xl tap-active flex items-center justify-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Sửa đơn
            </button>
            <button
              onClick={handleCancelOrder}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-2xl tap-active flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Hủy đơn
            </button>
          </div>
          <button
            onClick={handleNewOrder}
            className="w-full py-5 bg-[#C9252C] text-white font-black rounded-2xl tap-active shadow-xl shadow-red-100 dark:shadow-none"
          >
            Đặt đơn mới
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    const isAIEnabled = localStorage.getItem('enableAI') !== 'false';
    // Use randomState which now includes cached AI messages, or fallback to static if AI disabled
    const displayState = isAIEnabled ? randomState : emptyStates[0];
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-8 relative">
        {/* AI Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {isAIEnabled ? (
            <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> AI Bật</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-700"></span> AI Tắt</>
          )}
        </div>

        <div className="relative mb-8">
          <div className="w-24 h-24 bg-stone-50 dark:bg-stone-800 rounded-[32px] flex items-center justify-center text-5xl">
            {displayState.emoji}
          </div>
          {/* Hidden AI generation indicator */}
        </div>
        <h2 className="text-2xl font-black text-stone-800 dark:text-white mb-3">{displayState.title}</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-10 leading-relaxed">
          {displayState.content}
        </p>
        <div className="w-full">
          <button
            onClick={() => window.location.hash = '#/'}
            className="w-full py-5 bg-gradient-to-r from-[#C9252C] to-[#991B1B] text-white font-black rounded-[24px] tap-active shadow-xl shadow-red-200 dark:shadow-none hover:scale-[1.02] transition-all uppercase tracking-widest"
          >
            {displayState.button}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="p-3 space-y-4">
        {/* Cart Items */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-stone-400 dark:text-stone-500 font-black text-[9px] uppercase tracking-widest">Món đã chọn ({cart.length})</h2>
            <button onClick={() => setShowClearConfirm(true)} className="text-red-500 font-bold text-[9px] tap-active bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-lg">Xóa tất cả</button>
          </div>
          
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {cart.map((item, index) => (
                <motion.div
                  layout
                  key={`cart-item-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="card p-3 border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900"
                >
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 flex-grow pr-3">
                        <h3 className="font-bold text-stone-800 dark:text-white text-sm truncate leading-tight mb-1">{item.name}</h3>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-stone-50 dark:bg-stone-800 text-[8px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide border border-stone-100 dark:border-stone-700">
                            {item.temperature}
                          </span>
                          {item.iceLevel && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-stone-50 dark:bg-stone-800 text-[8px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide border border-stone-100 dark:border-stone-700">
                              {item.iceLevel} đá
                            </span>
                          )}
                          {item.sugarLevel && (
                            <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-stone-50 dark:bg-stone-800 text-[8px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide border border-stone-100 dark:border-stone-700">
                              {item.sugarLevel} đường
                            </span>
                          )}
                        </div>
                        {item.note && (
                          <div className="flex items-start gap-1.5 bg-amber-50/50 dark:bg-amber-900/10 p-1.5 rounded-lg border border-amber-100/50 dark:border-amber-800/30 mb-2">
                            <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium leading-tight italic">"{item.note}"</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[#C9252C] font-black text-sm whitespace-nowrap">
                        {(item.unitPrice * item.quantity).toLocaleString()}đ
                      </p>
                    </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-stone-50 dark:border-stone-800 mt-2">
                    <div className="flex items-center bg-stone-50 dark:bg-stone-800 rounded-xl p-1 border border-stone-100 dark:border-stone-700 shadow-inner">
                      <button 
                        onClick={() => handleUpdateQuantity(item, -1)} 
                        className="w-8 h-8 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-[#C9252C] tap-active bg-white dark:bg-stone-700 rounded-lg shadow-sm border border-stone-100 dark:border-stone-600 transition-all active:scale-90"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center font-black text-sm text-stone-800 dark:text-white">{item.quantity}</span>
                      <button 
                        onClick={() => handleUpdateQuantity(item, 1)} 
                        className="w-8 h-8 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:text-[#C9252C] tap-active bg-white dark:bg-stone-700 rounded-lg shadow-sm border border-stone-100 dark:border-stone-600 transition-all active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingItem(item)} 
                        className="w-9 h-9 flex items-center justify-center bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-xl tap-active border border-stone-100 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors" 
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleUpdateQuantity(item, -item.quantity)} 
                        className="w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl tap-active border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" 
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Order Form */}
        <section className="bg-white dark:bg-stone-900 rounded-[32px] p-6 border border-stone-100 dark:border-stone-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-[#C9252C] rounded-2xl flex items-center justify-center border border-red-100 dark:border-red-900/30">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-stone-800 dark:text-white text-base">Thông tin nhận món</h2>
                <p className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Delivery Details</p>
              </div>
            </div>
            
            {/* Auto Submit Toggle */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[8px] font-black text-stone-300 uppercase tracking-widest">Tự động gửi</span>
              <button 
                onClick={() => setIsAutoSubmitEnabled(!isAutoSubmitEnabled)}
                className={`w-10 h-6 rounded-full transition-all duration-300 relative ${isAutoSubmitEnabled ? 'bg-[#C9252C]' : 'bg-stone-200 dark:bg-stone-700'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isAutoSubmitEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Tên khách hàng</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nhập tên..."
                    className="w-full pl-11 pr-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-bold text-sm text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Số điện thoại</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Nhập SĐT..."
                    className="w-full pl-11 pr-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-bold text-sm text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Số bàn</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="VD: 05"
                  className="w-full px-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-black text-center text-lg text-[#C9252C] border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Thanh toán</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setPaymentMethod(paymentMethod === 'Tiền mặt' ? 'Chuyển khoản' : 'Tiền mặt')}
                    className={`w-full py-4 rounded-2xl font-black text-[10px] border-2 transition-all tap-active flex items-center justify-center gap-2 uppercase tracking-widest ${
                      paymentMethod === 'Tiền mặt' 
                        ? 'border-amber-100 bg-amber-50 text-amber-600 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-900/30' 
                        : 'border-blue-100 bg-blue-50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/30'
                    }`}
                  >
                    {paymentMethod === 'Tiền mặt' ? '💵 Tiền mặt' : '💳 Chuyển khoản'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest ml-1">Ghi chú đơn hàng</label>
              <div className="relative">
                <div className="absolute left-4 top-4 text-stone-300">
                  <FileText className="w-4 h-4" />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Ít đá, nhiều sữa..."
                  className="w-full pl-11 pr-4 py-4 bg-stone-50 dark:bg-stone-800 rounded-2xl font-bold text-sm text-stone-800 dark:text-white border-2 border-transparent focus:border-[#C9252C]/20 focus:bg-white dark:focus:bg-stone-900 transition-all shadow-inner min-h-[100px] resize-none"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {submitStatus === 'error' && (
        <div className="px-3 mb-4">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-[20px] flex items-center gap-3 border border-red-100 dark:border-red-900/30 animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-bold">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Sticky Footer Summary */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-stone-100/50 dark:border-stone-800/50 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] dark:shadow-none transition-colors">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="relative">
            <p className="text-stone-400 dark:text-stone-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Tổng thanh toán</p>
            <div className="flex items-center gap-2">
              <motion.p 
                animate={isSubmitting ? { scale: [1, 1.05, 1], opacity: [1, 0.7, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-xl font-black text-[#C9252C]"
              >
                {total.toLocaleString()}đ
              </motion.p>
              <AnimatePresence>
                {isSubmitting && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="text-right">
            <p className="text-stone-400 dark:text-stone-500 text-[9px] font-black uppercase tracking-widest mb-0.5">Số lượng</p>
            <motion.p 
              animate={isSubmitting ? { y: [0, -2, 0] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-stone-800 dark:text-white font-bold text-sm"
            >
              {cart.length} món
            </motion.p>
          </div>
        </div>
        <button
          onClick={handleOrder}
          disabled={isSubmitting || !customerName}
          className="w-full bg-gradient-to-r from-[#C9252C] to-[#991B1B] text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-red-200 dark:shadow-none tap-active flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden uppercase tracking-widest"
        >
          <AnimatePresence mode="wait">
            {isSubmitting ? (
              <motion.div
                key="submitting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center gap-3"
              >
                <div className="relative">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute inset-0 bg-white/30 rounded-full"
                  />
                </div>
                <span>Đang gửi đơn...</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center gap-3"
              >
                <ShoppingBag className="w-6 h-6" />
                <span>Xác nhận đặt đơn</span>
                <ChevronRight className="w-6 h-6 opacity-50" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-stone-900 rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-stone-100 dark:border-stone-800">
              <h3 className="text-xl font-extrabold text-stone-800 dark:text-white mb-3">Xác nhận xóa?</h3>
              <p className="text-stone-500 dark:text-stone-400 mb-8 leading-relaxed">Bạn có chắc chắn muốn xóa tất cả món trong giỏ hàng không?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-4 rounded-2xl font-bold text-stone-400 dark:text-stone-500 tap-active">Hủy</button>
                <button onClick={() => { clearCart(); setShowClearConfirm(false); }} className="flex-1 py-4 rounded-2xl font-bold text-white bg-red-500 tap-active shadow-lg shadow-red-100 dark:shadow-none">Xóa hết</button>
              </div>
            </motion.div>
          </div>
        )}

        {editingItem && (
          <EditCartItemModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(updated) => {
              updateCartItem(editingItem.cartItemId, updated);
              setEditingItem(null);
            }}
          />
        )}

        {showInvoice && submittedOrder && (
          <Invoice 
            order={submittedOrder} 
            onClose={() => setShowInvoice(false)} 
          />
        )}

        {toast.visible && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 z-[60]"
          >
            <div className="bg-stone-900 dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 dark:border-black/10">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold">{toast.message}</span>
              </div>
              <button onClick={() => setToast({ ...toast, visible: false })} className="text-stone-400 dark:text-stone-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditCartItemModal({ item, onClose, onSave }: { item: CartItem; onClose: () => void; onSave: (item: CartItem) => void }) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [temperature, setTemperature] = useState(item.temperature || 'Đá');
  const [sugarLevel, setSugarLevel] = useState(item.sugarLevel || 'Bình thường');
  const [iceLevel, setIceLevel] = useState(item.iceLevel || 'Bình thường');
  const [note, setNote] = useState(item.note || '');

  const unitPrice = item.price;
  const hasCustomizations = item.hasCustomizations !== false;

  const handleUpdateQty = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty < 1) return;
    if (delta > 0 && item.inventoryQty !== undefined && newQty > item.inventoryQty) {
      alert(`Chỉ còn ${item.inventoryQty} sản phẩm trong kho!`);
      return;
    }
    setQuantity(newQty);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-[60]">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="bg-white dark:bg-stone-900 rounded-t-[40px] w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border-t border-stone-100 dark:border-stone-800"
      >
        <div className="px-8 py-6 flex justify-between items-center border-b border-stone-50 dark:border-stone-800">
          <h2 className="text-2xl font-black text-stone-800 dark:text-white">Chỉnh sửa món</h2>
          <button onClick={onClose} className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 tap-active">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto px-8 py-6 space-y-10 scrollbar-hide">
          <section>
            <h4 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-4">Số lượng</h4>
            <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-800 p-2 rounded-2xl border border-stone-100 dark:border-stone-700">
              <button 
                onClick={() => handleUpdateQty(-1)}
                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl shadow-sm tap-active"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-black text-stone-800 dark:text-white">{quantity}</span>
              <button 
                onClick={() => handleUpdateQty(1)}
                className="w-12 h-12 flex items-center justify-center bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl shadow-sm tap-active"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </section>

          {hasCustomizations && (
            <div className="grid grid-cols-1 gap-8">
              <section>
                <h4 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-4">Nhiệt độ</h4>
                <div className="flex gap-2">
                  {['Nóng', 'Đá', 'Đá riêng'].map(temp => (
                    <button
                      key={temp}
                      onClick={() => setTemperature(temp)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all tap-active ${
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
                  <h4 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-4">Lượng đá</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['Ít', 'Vừa', 'Bình thường'].map(level => (
                      <button
                        key={level}
                        onClick={() => setIceLevel(level)}
                        className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all tap-active ${
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
                <h4 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-4">Lượng đường</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['Ít ngọt', 'Vừa', 'Bình thường', 'Ngọt', 'Đường kiêng'].map(level => (
                    <button
                      key={level}
                      onClick={() => setSugarLevel(level === 'Đường kiêng' ? '1 gói đường kiêng' : level)}
                      className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all tap-active ${
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
          )}

          <section>
            <h4 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest mb-4">Ghi chú</h4>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field p-5 rounded-[24px] resize-none text-sm font-medium"
              rows={2}
            />
          </section>
        </div>

        <div className="p-8 bg-white dark:bg-stone-900 border-t border-stone-50 dark:border-stone-800">
          <div className="flex justify-between items-center mb-6">
            <span className="text-stone-400 dark:text-stone-500 font-bold text-sm uppercase tracking-widest">Thành tiền</span>
            <span className="text-2xl font-black text-[#C9252C]">{(unitPrice * quantity).toLocaleString()}đ</span>
          </div>
          <button
            onClick={() => onSave({
              ...item,
              quantity,
              unitPrice,
              temperature: hasCustomizations ? temperature : undefined,
              sugarLevel: hasCustomizations ? sugarLevel : undefined,
              iceLevel: hasCustomizations ? (temperature === 'Đá' ? iceLevel : (temperature === 'Đá riêng' ? 'Bình thường' : undefined)) : undefined,
              note,
            })}
            className="btn-primary shadow-xl shadow-red-200 dark:shadow-red-900/20"
          >
            Lưu thay đổi
          </button>
        </div>
      </motion.div>
    </div>
  );
}
