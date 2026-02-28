import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, CreditCard, Copy } from 'lucide-react';
import QRCode from "react-qr-code";

interface GlobalQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOMO_DATA = "00020101021138630010A000000727013300069710250119PSP26021123000000070208QRIBFTTA53037045802VN62190515MOMOW2W4015735863043783";
const TIMO_DATA = "00020101021138570010A00000072701270006963388011380070410382070208QRIBFTTA53037045802VN6304E04B";

export function GlobalQrModal({ isOpen, onClose }: GlobalQrModalProps) {
  const [activeTab, setActiveTab] = useState<'momo' | 'timo'>('momo');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop - Darker Overlay for Lightbox Effect (75% opacity) */}
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-md transition-all duration-300"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-stone-900 rounded-[32px] overflow-hidden shadow-2xl border border-stone-200 dark:border-stone-800 z-10 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-white transition-colors z-20"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header Area */}
            <div className="pt-8 pb-4 px-6 text-center">
               <h2 className="text-2xl font-black text-stone-800 dark:text-white tracking-tight">
                 {activeTab === 'momo' ? 'Thanh toán MoMo' : 'Ngân hàng Timo'}
               </h2>
               <p className="text-stone-500 dark:text-stone-400 text-xs font-bold uppercase tracking-widest mt-1">
                 Quét mã để thanh toán
               </p>
            </div>

            {/* Tabs */}
            <div className="flex px-6 pb-6 gap-3">
              <button
                onClick={() => setActiveTab('momo')}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                  activeTab === 'momo'
                    ? 'bg-[#A50064] text-white shadow-lg shadow-[#A50064]/30 scale-105'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
                MoMo
              </button>
              <button
                onClick={() => setActiveTab('timo')}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                  activeTab === 'timo'
                    ? 'bg-[#6F3CD7] text-white shadow-lg shadow-[#6F3CD7]/30 scale-105'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Timo
              </button>
            </div>

            {/* QR Display Area - The "Spotlight" */}
            <div className="px-8 pb-2 flex justify-center">
              <div className="bg-white p-6 rounded-[32px] shadow-lg border-4 border-stone-100 dark:border-stone-800 w-full aspect-square flex items-center justify-center relative overflow-hidden group">
                <div className="bg-white p-4 rounded-lg inline-block mb-4 w-full h-full flex items-center justify-center">
                   <QRCode 
                      value={activeTab === 'momo' ? MOMO_DATA : TIMO_DATA} 
                      size={220} 
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 256 256`}
                      fgColor="#000000"
                      bgColor="#FFFFFF"
                   />
                </div>
                
                {/* Scan Line Animation */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px]">
                  <motion.div
                    animate={{ top: ['-10%', '110%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-1.5 bg-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.6)] z-10 blur-[2px]"
                  />
                </div>
              </div>
            </div>

            {/* Account Info Section */}
            <div className="px-6 pb-8 pt-4 text-center space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">Chủ tài khoản</p>
                <p className="text-lg font-black text-stone-800 dark:text-white">
                  {activeTab === 'momo' ? 'TRẦN MAI NHI' : 'TRAN MAI NHI'}
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2 bg-stone-50 dark:bg-stone-800/50 py-2 px-4 rounded-xl w-fit mx-auto">
                <p className="text-sm font-mono font-bold text-stone-600 dark:text-stone-300 tracking-wider">
                  {activeTab === 'momo' ? '*******483' : '*********8207'}
                </p>
                <Copy className="w-3.5 h-3.5 text-stone-400" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
