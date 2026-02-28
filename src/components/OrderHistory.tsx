import React, { useState, useEffect, useMemo } from 'react';
import { Clock, ShoppingBag, Calendar, ChevronRight, Package, CreditCard, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { useData } from '../context/DataContext';

interface OrderHistoryItem {
  orderId: string;
  customerName: string;
  phoneNumber?: string;
  timestamp: string;
  total: number;
  items: any[];
  orderStatus?: string;
  paymentMethod?: string;
  paymentStatus?: string;
}

export function OrderHistory() {
  const { orders } = useData();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [aiEmptyState, setAiEmptyState] = useState<{title: string, content: string, button: string, emoji: string} | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const emptyStates = [
    {
      title: "Chưa có ly nào!",
      content: "Lịch sử uống nước của bạn đang trống trơn. Barista đang buồn thiu vì chưa được phục vụ bạn đó!",
      button: "Đặt ly đầu tiên ngay",
      emoji: "🥤"
    },
    {
      title: "Ký ức trống rỗng...",
      content: "Bạn chưa có kỷ niệm nào với quán. Hãy tạo ra những ký ức ngọt ngào bằng một ly trà sữa full topping nhé!",
      button: "Tạo kỷ niệm ngay",
      emoji: "💭"
    },
    {
      title: "Thánh 'nhịn' uống?",
      content: "Sao bạn có thể chịu được cơn khát này hay vậy? Mau order một ly nước mát lạnh để giải tỏa đi nào!",
      button: "Giải khát ngay",
      emoji: "🌵"
    },
    {
      title: "Sổ nợ sạch trơn",
      content: "Chưa có hóa đơn nào được ghi lại. Bạn là khách hàng gương mẫu hay là chưa từng ghé quán vậy?",
      button: "Ghé quán online ngay",
      emoji: "📝"
    },
    {
      title: "Buồn so...",
      content: "Nhìn lịch sử trống trải mà lòng quán buồn so. Order một ly nước để tụi mình vui lên đi!",
      button: "Làm quán vui ngay",
      emoji: "😢"
    },
    {
      title: "Người lạ ơi!",
      content: "Người lạ ơi, xin hãy ghé mua giùm tôi... một ly nước. Lịch sử trống quá nè!",
      button: "Làm quen ngay",
      emoji: "👋"
    },
    {
      title: "Chưa mở hàng",
      content: "Bạn chưa mở hàng cho quán đơn nào cả. Nhanh tay đặt món để lấy hên cho quán đi nào!",
      button: "Mở hàng ngay",
      emoji: "🍀"
    },
    {
      title: "Ẩn danh?",
      content: "Bạn đang hoạt động ẩn danh hay sao mà không thấy đơn nào lưu lại vậy? Hiện hình bằng một đơn hàng đi!",
      button: "Hiện hình!",
      emoji: "🥷"
    },
    {
      title: "Trí nhớ cá vàng",
      content: "App không phải cá vàng đâu, mà là bạn chưa uống gì thật đó. Đừng để bụng đói cồn cào nữa!",
      button: "Nạp năng lượng",
      emoji: "🐠"
    },
    {
      title: "Fan cứng đâu rồi?",
      content: "Fan cứng của quán đâu rồi? Sao để lịch sử trống trơn thế này? Điểm danh bằng một ly trà sữa nào!",
      button: "Điểm danh!",
      emoji: "🙋"
    }
  ];

  const randomState = useMemo(() => {
    // 1. Get cached AI messages
    const cached = localStorage.getItem('ai_history_messages');
    const aiMessages = cached ? JSON.parse(cached) : [];
    
    // 2. Combine with static messages
    const allMessages = [...emptyStates, ...aiMessages];
    
    // 3. Pick one randomly
    return allMessages[Math.floor(Math.random() * allMessages.length)];
  }, [orders.length === 0]);

  const generateAIEmptyState = async () => {
    if (isGeneratingAI) return;

    // Check if AI is enabled in settings
    const isAIEnabled = localStorage.getItem('enableAI') !== 'false';
    if (!isAIEnabled) return;

    // Clear error if it's older than 10 minutes
    const lastError = localStorage.getItem('ai_history_error_time');
    if (lastError && Date.now() - parseInt(lastError) > 10 * 60 * 1000) {
      localStorage.removeItem('ai_history_error_time');
    }

    // 1. Luân phiên: Chỉ gọi AI 30% số lần hoặc khi chưa có mẫu AI nào lưu lại
    const cached = localStorage.getItem('ai_history_messages');
    const aiMessages = cached ? JSON.parse(cached) : [];
    const shouldCallAI = aiMessages.length < 5 || Math.random() < 0.3;

    if (!shouldCallAI) return;

    // 2. Rate limit: Don't try again if we hit a quota error recently
    if (localStorage.getItem('ai_history_error_time')) {
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
            menuContext = `Gợi ý khéo các món này: ${randomItems.join(', ')}.`;
          }
        } catch (e) {}
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Model tối ưu nhất cho text
        contents: `Tạo 1 thông báo lịch sử đơn hàng trống cho app quán nước. 
        Style: Nhắc kỷ niệm, rủ rê quay lại, GenZ. ${menuContext}
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
        localStorage.removeItem('ai_history_error_time');

        const isDuplicate = aiMessages.some((msg: any) => msg.title === result.title || msg.content === result.content);
        if (!isDuplicate) {
          const newCache = [result, ...aiMessages].slice(0, 20); // Lưu tối đa 20 mẫu từ AI
          localStorage.setItem('ai_history_messages', JSON.stringify(newCache));
        }
      }
    } catch (e: any) {
      // Ẩn thông báo lỗi, tự động dùng mẫu cũ
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        localStorage.setItem('ai_history_error_time', Date.now().toString());
      }
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (orders.length === 0) {
      generateAIEmptyState();
    }
  }, [orders.length]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(order => {
      const orderDate = new Date(order.timestamp);
      if (timeRange === 'day') return orderDate.toDateString() === now.toDateString();
      if (timeRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      }
      if (timeRange === 'month') return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      if (timeRange === 'year') return orderDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [orders, timeRange]);

  if (orders.length === 0) {
    const isAIEnabled = localStorage.getItem('enableAI') !== 'false';
    const displayState = isAIEnabled ? randomState : emptyStates[0];
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-8 pb-20 relative">
        {/* AI Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {isAIEnabled ? (
            <><span className="w-2 h-2 rounded-full bg-emerald-500"></span> AI Bật</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-700"></span> AI Tắt</>
          )}
        </div>

        <div className="relative mb-6">
          <div className="w-24 h-24 bg-stone-50 dark:bg-stone-800 rounded-[32px] flex items-center justify-center text-5xl shadow-sm animate-float">
            {displayState.emoji}
          </div>
        </div>
        <h2 className="text-2xl font-black text-stone-800 dark:text-white mb-3">{displayState.title}</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8 leading-relaxed font-medium max-w-xs mx-auto">
          {displayState.content}
        </p>
        <div className="w-full max-w-xs">
          <button
            onClick={() => window.location.hash = '#/'}
            className="w-full py-4 bg-[#C9252C] text-white font-black rounded-[20px] tap-active shadow-xl shadow-red-100 dark:shadow-none transition-all hover:bg-[#a01d23]"
          >
            {displayState.button}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6 pb-24">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest">Lịch sử đơn hàng</h2>
        <span className="text-stone-400 dark:text-stone-500 font-bold text-xs bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-lg">{filteredOrders.length} đơn</span>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scroll-smooth">
        {[
          { id: 'day', label: 'Hôm nay' },
          { id: 'week', label: 'Tuần này' },
          { id: 'month', label: 'Tháng này' },
          { id: 'year', label: 'Năm nay' },
        ].map((range) => (
          <button
            key={range.id}
            onClick={() => setTimeRange(range.id as any)}
            className={`px-5 py-2.5 rounded-[16px] whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all tap-active border ${
              timeRange === range.id
                ? 'bg-[#C9252C] text-white border-[#C9252C] shadow-lg shadow-red-100 dark:shadow-none'
                : 'bg-white dark:bg-stone-900 text-stone-400 dark:text-stone-500 border-stone-100 dark:border-stone-800 shadow-sm dark:shadow-none'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
      
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-[24px] flex items-center justify-center mb-4 text-stone-300 dark:text-stone-600">
                <Package className="w-8 h-8" />
              </div>
              <p className="text-stone-400 dark:text-stone-500 font-bold">Không có đơn hàng nào</p>
            </div>
          ) : (
            filteredOrders.map((order, index) => (
              <motion.div
                layout
                key={`${order.orderId}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card p-5 space-y-4 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800"
              >
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">#{order.orderId}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                      order.orderStatus === 'Hoàn thành' ? 'bg-red-50 dark:bg-red-900/20 text-[#C9252C] dark:text-red-400' :
                      order.orderStatus === 'Đã hủy' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                      'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    }`}>
                      {order.orderStatus || 'Đã nhận'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-800 dark:text-white">
                    <User className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                    <div className="flex flex-col">
                      <h3 className="font-bold text-lg leading-none">{order.customerName}</h3>
                      {order.phoneNumber && <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium mt-1">{order.phoneNumber}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#C9252C] font-black text-xl">{order.total.toLocaleString()}đ</p>
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 justify-end font-bold uppercase tracking-tighter mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(order.timestamp).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
              
              <div className="bg-stone-50 dark:bg-stone-800 rounded-[18px] p-4 space-y-3 border border-stone-100/50 dark:border-stone-700/50">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-white dark:bg-stone-700 rounded-lg flex items-center justify-center text-[10px] font-black text-[#C9252C] shadow-sm border border-stone-100 dark:border-stone-600">
                        {item.quantity}
                      </div>
                      <span className="font-bold text-stone-700 dark:text-stone-300">{item.name}</span>
                    </div>
                    <span className="text-stone-400 dark:text-stone-500 font-bold text-[10px] uppercase tracking-wider bg-white dark:bg-stone-700 px-2 py-1 rounded-lg border border-stone-100 dark:border-stone-600">{item.size}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{order.paymentMethod}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                      order.paymentStatus === 'Đã thanh toán' 
                        ? 'border-red-100 dark:border-red-900/30 text-[#C9252C] dark:text-red-400 bg-red-50 dark:bg-red-900/20' 
                        : 'border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    }`}>
                      {order.paymentStatus === 'Đã thanh toán' ? 'Đã trả' : 'Chưa trả'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )))}
        </AnimatePresence>
      </div>
    </div>
  );
}
