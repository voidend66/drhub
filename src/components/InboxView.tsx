import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Camera, 
  Tag, 
  FolderSync, 
  Maximize2, 
  Trash2, 
  UploadCloud,
  Check
} from 'lucide-react';
import { MedicalPhoto } from '../types';

interface InboxViewProps {
  inboxPhotos: MedicalPhoto[];
  onOpenTagModal: (photo: MedicalPhoto) => void;
  onDeletePhoto: (photoId: string) => void;
  onSelectPhotoLightbox: (photo: MedicalPhoto) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  inboxPhotos,
  onOpenTagModal,
  onDeletePhoto,
  onSelectPhotoLightbox,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          fetch('/api/ftp/upload-raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: event.target.result,
              fileName: file.name
            })
          }).then(() => {
            window.location.reload();
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div id="inbox-view-container" className="space-y-4">
      
      {/* Clean Header Bar */}
      <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <FolderSync className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-slate-800">
                صندوق ورودی شات‌های جدید
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono-numbers bg-emerald-100 text-emerald-800 font-bold">
                {inboxPhotos.length} شات جدید
              </span>
            </div>
          </div>
        </div>

        <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          اتصال خودکار Wi-Fi
        </span>
      </div>

      {/* Grid of Incoming Photos */}
      {inboxPhotos.length === 0 ? (
        /* Empty State */
        <div 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`p-12 text-center rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 bg-white ${
            dragActive 
              ? 'border-emerald-500 bg-emerald-50/50' 
              : 'border-slate-300'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">صندوق ورودی خالی است</h3>
            <p className="text-xs text-slate-500 mt-1">
              عکس‌های گرفته شده با دوربین به طور خودکار در این صفحه دریافت می‌شوند.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">یا عکس را اینجا بکشید و رها کنید (Drag & Drop)</span>
        </div>
      ) : (
        /* Photos Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {inboxPhotos.map((photo) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              key={photo.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col group"
            >
              {/* Photo Image Card */}
              <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer">
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.fileName}
                  onClick={() => onSelectPhotoLightbox(photo)}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />

                {/* Camera Name Badge */}
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 text-[11px] font-mono-numbers text-slate-700 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{photo.sourceCamera.name.split(' ')[0]}</span>
                </div>

                {/* Fullscreen icon */}
                <button
                  onClick={() => onSelectPhotoLightbox(photo)}
                  className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-white/95 text-slate-700 hover:text-emerald-600 shadow-xs transition-all opacity-0 group-hover:opacity-100"
                  title="بزرگ‌نمایی"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Photo Details */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 truncate font-mono-numbers">
                    {photo.fileName}
                  </h4>
                  <span className="text-[10px] font-mono-numbers text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {photo.exif.fileSize}
                  </span>
                </div>

                {/* Tag & Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onOpenTagModal(photo)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all touch-active"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>الصاق به پرونده</span>
                  </button>

                  <button
                    onClick={() => onDeletePhoto(photo.id)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
};

