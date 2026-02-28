import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Share2, Download, X, Coffee, Printer } from 'lucide-react';
import { motion } from 'motion/react';

interface InvoiceProps {
  order: any;
  onClose: () => void;
}

export const Invoice: React.FC<InvoiceProps> = ({ order, onClose }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (invoiceRef.current === null) return;
    
    try {
      const dataUrl = await toPng(invoiceRef.current, { 
        cacheBust: true, 
        backgroundColor: '#fff',
        pixelRatio: 2 // Higher quality
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `invoice-${order.orderId}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `Hóa đơn ${order.orderId}`,
          text: `Hóa đơn cho đơn hàng ${order.orderId}`
        });
      } else {
        // Fallback to download
        const link = document.createElement('a');
        link.download = `invoice-${order.orderId}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Error sharing invoice:', err);
    }
  };

  const handleDownload = async () => {
    if (invoiceRef.current === null) return;
    try {
      const dataUrl = await toPng(invoiceRef.current, { 
        cacheBust: true, 
        backgroundColor: '#fff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `invoice-${order.orderId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading invoice:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-stone-900 rounded-[32px] w-full max-w-sm overflow-hidden flex flex-col shadow-2xl print:shadow-none print:rounded-none print:max-w-none"
      >
        {/* Header Actions */}
        <div className="p-4 flex justify-between items-center border-b border-stone-100 dark:border-stone-800 print:hidden">
          <h3 className="font-black text-stone-800 dark:text-white uppercase tracking-widest text-[10px]">Hóa đơn điện tử</h3>
          <button onClick={onClose} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500 tap-active">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invoice Content to Capture */}
        <div className="p-4 overflow-y-auto max-h-[60vh] print:max-h-none print:overflow-visible print:p-0">
          <div id="printable-invoice" ref={invoiceRef} className="bg-white p-6 text-stone-800 font-sans print:p-4">
            <div className="text-center mb-6 border-b-2 border-dashed border-stone-200 pb-6">
              <div className="w-12 h-12 bg-red-50 text-[#C9252C] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Coffee className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-black uppercase tracking-tighter mb-1">COFFEE & TEA</h1>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Hóa đơn thanh toán</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-400 font-bold uppercase tracking-widest">Mã đơn</span>
                <span className="font-black">#{order.orderId}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-400 font-bold uppercase tracking-widest">Ngày đặt</span>
                <span className="font-bold">{new Date(order.timestamp).toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-400 font-bold uppercase tracking-widest">Khách hàng</span>
                <span className="font-bold">{order.customerName}</span>
              </div>
              {order.tableNumber && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-stone-400 font-bold uppercase tracking-widest">Số bàn</span>
                  <span className="font-bold">{order.tableNumber}</span>
                </div>
              )}
            </div>

            <div className="border-t border-b border-dashed border-stone-200 py-4 mb-4">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-stone-400 font-black uppercase tracking-widest">
                    <th className="pb-2">Món</th>
                    <th className="pb-2 text-center">SL</th>
                    <th className="pb-2 text-right">Tiền</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold">
                  {order.items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-1">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-[8px] text-stone-400 font-medium">
                            {item.temperature}{item.iceLevel ? `, ${item.iceLevel} đá` : ''}{item.sugarLevel ? `, ${item.sugarLevel} đường` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">{(item.unitPrice * item.quantity).toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-black">
                <span>TỔNG CỘNG</span>
                <span className="text-[#C9252C]">{order.total.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                <span>Thanh toán</span>
                <span>{order.paymentMethod}</span>
              </div>
            </div>

            <div className="mt-8 text-center border-t-2 border-dashed border-stone-200 pt-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Cảm ơn quý khách!</p>
              <p className="text-[8px] text-stone-300 mt-1 italic">Hẹn gặp lại bạn lần sau</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-stone-50 dark:bg-stone-800/50 flex gap-3 print:hidden">
          <button 
            onClick={handleShare}
            className="flex-1 py-4 bg-[#C9252C] text-white font-black rounded-2xl tap-active flex items-center justify-center gap-2 shadow-lg shadow-red-100 dark:shadow-none uppercase tracking-widest text-xs"
          >
            <Share2 className="w-4 h-4" />
            Chia sẻ
          </button>
          <button 
            onClick={handlePrint}
            className="w-14 h-14 bg-white dark:bg-stone-800 text-stone-500 rounded-2xl flex items-center justify-center tap-active border border-stone-100 dark:border-stone-700"
            title="In hóa đơn"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDownload}
            className="w-14 h-14 bg-white dark:bg-stone-800 text-stone-500 rounded-2xl flex items-center justify-center tap-active border border-stone-100 dark:border-stone-700"
            title="Tải về"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
