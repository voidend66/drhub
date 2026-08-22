import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, ArrowLeft, X } from 'lucide-react';
import { MedicalPhoto } from '../types';

interface LiveAlertToastProps {
  photo: MedicalPhoto | null;
  onClose: () => void;
  onTagPhoto: (photo: MedicalPhoto) => void;
}

export const LiveAlertToast: React.FC<LiveAlertToastProps> = ({
  photo,
  onClose,
  onTagPhoto,
}) => {
  if (!photo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        id="live-camera-alert-toast"
        className="fixed top-18 right-4 left-4 md:right-8 md:left-auto md:w-[400px] z-50 bg-white border border-emerald-300 rounded-2xl shadow-xl p-3.5 text-slate-800 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-slate-800">
                  تصویر جدید از دوربین دریافت شد
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono-numbers bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  FTP LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono-numbers">
                {photo.fileName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Preview & Quick Action */}
        <div className="mt-2.5 flex gap-2.5 bg-slate-50 rounded-xl p-2 border border-slate-200">
          <img 
            src={photo.thumbnailUrl} 
            alt={photo.fileName} 
            className="w-16 h-16 rounded-lg object-cover border border-slate-200 flex-shrink-0"
            referrerPolicy="no-referrer"
          />

          <div className="flex-1 flex flex-col justify-between text-xs">
            <div className="text-[11px] text-slate-600 font-mono-numbers">
              <span>{photo.sourceCamera.name}</span> • <span>{photo.sourceCamera.location}</span>
            </div>

            <button
              id="btn-quick-tag-toast"
              onClick={() => {
                onTagPhoto(photo);
                onClose();
              }}
              className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all touch-active"
            >
              <span>الصاق به پرونده</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
