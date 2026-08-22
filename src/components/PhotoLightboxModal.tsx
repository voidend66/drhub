import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Grid, 
  Tag, 
  Camera, 
  FileText
} from 'lucide-react';
import { MedicalPhoto, Patient } from '../types';
import { CLINICAL_ANGLES, SURGERY_STAGES } from '../data/clinicalDefinitions';

interface PhotoLightboxModalProps {
  photo: MedicalPhoto | null;
  patient?: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenTagModal?: (photo: MedicalPhoto) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  patient,
  isOpen,
  onClose,
  onOpenTagModal,
}) => {
  if (!isOpen || !photo) return null;

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const angleObj = CLINICAL_ANGLES.find((a) => a.id === photo.angle);
  const stageObj = SURGERY_STAGES.find((s) => s.id === photo.stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative w-full max-w-5xl h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Lightbox Header Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 font-mono-numbers">
                  {photo.fileName}
                </h3>
                {stageObj && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stageObj.colorClass}`}>
                    {stageObj.labelFa}
                  </span>
                )}
                {angleObj && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                    {angleObj.labelFa.split('(')[0]}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono-numbers">
                بیمار: {patient ? `${patient.fullName} (${patient.fileNumber})` : 'در صندوق ورودی'}
              </p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
              className="p-1.5 rounded-xl bg-white text-slate-600 hover:text-emerald-700 border border-slate-200 shadow-xs"
              title="بزرگ‌نمایی"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
              className="p-1.5 rounded-xl bg-white text-slate-600 hover:text-emerald-700 border border-slate-200 shadow-xs"
              title="کوچک‌نمایی"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 rounded-xl bg-white text-slate-600 hover:text-emerald-700 border border-slate-200 shadow-xs"
              title="چرخش"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-xl border transition-all shadow-xs ${
                showGrid ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white text-slate-600 border-slate-200'
              }`}
              title="شبکه شطرنجی"
            >
              <Grid className="w-4 h-4" />
            </button>

            {onOpenTagModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenTagModal(photo);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>ویرایش الصاق</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lightbox Canvas & Sidebar */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Main Photo Viewport */}
          <div className="lg:col-span-8 bg-slate-950 relative flex items-center justify-center overflow-hidden">
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.15s ease-out'
              }}
            >
              <img
                src={photo.highResUrl}
                alt={photo.fileName}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {showGrid && <div className="absolute inset-0 pointer-events-none medical-grid-bg opacity-30" />}
          </div>

          {/* EXIF and Notes Sidebar */}
          <div className="lg:col-span-4 p-4 bg-white border-t lg:border-t-0 lg:border-r border-slate-200 overflow-y-auto space-y-3.5 text-xs">
            <div>
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>اطلاعات عکاسی</span>
              </h4>

              <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono-numbers text-slate-700">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">دوربین:</span>
                  <span className="font-bold text-slate-800 truncate block">{photo.exif.cameraModel}</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">لنز:</span>
                  <span className="font-bold text-slate-800 truncate block">{photo.exif.lensModel}</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">دیافراگم / ISO:</span>
                  <span className="font-bold text-emerald-700">{photo.exif.aperture} • ISO {photo.exif.iso}</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">شاتر:</span>
                  <span className="font-bold text-slate-800">{photo.exif.shutterSpeed}</span>
                </div>
              </div>
            </div>

            {/* Clinical Notes Card */}
            <div>
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>یادداشت بالینی</span>
              </h4>

              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                {photo.clinicalNotes.customNotes || 'یادداشت ثبت نشده است.'}
              </div>
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
};
