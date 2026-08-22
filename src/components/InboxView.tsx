import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Tag, 
  FolderSync, 
  Maximize2, 
  Trash2, 
  UploadCloud,
  Check,
  HardDrive,
  Radio,
  FileImage,
  RefreshCw
} from 'lucide-react';
import { MedicalPhoto } from '../types';

interface InboxViewProps {
  inboxPhotos: MedicalPhoto[];
  onOpenTagModal: (photo: MedicalPhoto) => void;
  onDeletePhoto: (photoId: string) => void;
  onSelectPhotoLightbox: (photo: MedicalPhoto) => void;
  onPhotosUploaded?: (newPhotos: MedicalPhoto[]) => void;
  ftpStoragePath?: string;
  ftpPort?: number;
  allowAnonymous?: boolean;
}

export const InboxView: React.FC<InboxViewProps> = ({
  inboxPhotos,
  onOpenTagModal,
  onDeletePhoto,
  onSelectPhotoLightbox,
  onPhotosUploaded,
  ftpStoragePath = '/home/pi/medical_storage/raw_uploads',
  ftpPort = 2121,
  allowAnonymous = true,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    const uploadedList: MedicalPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            try {
              const res = await fetch('/api/ftp/upload-raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: event.target.result,
                  fileName: file.name,
                  fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                  source: 'Direct File Upload / SD Card Reader'
                })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.photo) uploadedList.push(data.photo);
              }
            } catch (err) {
              console.error('Failed to upload file', err);
            }
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setIsUploading(false);
    if (uploadedList.length > 0 && onPhotosUploaded) {
      onPhotosUploaded(uploadedList);
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div id="inbox-view-container" className="space-y-4">
      
      {/* Hidden File Input for Direct Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Header Bar with FTP Status & Direct Upload Button */}
      <div className="bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <FolderSync className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-slate-800">
                صندوق ورودی شات‌های دوربین
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono-numbers bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                {inboxPhotos.length} شات جدید
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono-numbers mt-0.5 flex items-center gap-2">
              <span>Port: {ftpPort}</span>
              <span>•</span>
              <span>{allowAnonymous ? 'ورود ناشناس فعال (Anonymous)' : 'احراز هویت رمزدار'}</span>
              <span>•</span>
              <span className="truncate max-w-[220px]" title={ftpStoragePath}>مسیر: {ftpStoragePath}</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all touch-active disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>در حال دریافت...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>انتخاب یا آپلود عکس‌های دوربین</span>
              </>
            )}
          </button>
        </div>
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
              : 'border-slate-300 hover:border-emerald-400'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">صندوق ورودی آماده دریافت عکس</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              کلیه عکس‌های نمایشی پاک شدند. با زدن شاتر دوربین متصل به وای‌فای (FTP) یا کشیدن و رها کردن عکس‌های دوربین (Drag & Drop)، فایل‌ها در این بخش دریافت و فهرست می‌شوند.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <FileImage className="w-4 h-4" />
              <span>بارگذاری عکس از رم ریدر / سیستم</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-mono-numbers">
            سرور FTP روی پورت {ftpPort} (بدون نیاز به گواهی SSL) آماده پذیرش اتصال دوربین است.
          </span>
        </div>
      ) : (
        /* Photos Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {inboxPhotos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col group animate-in fade-in duration-200"
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
                  title="مشاهده تمام صفحه و ابزارها"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Photo Details */}
              <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 truncate font-mono-numbers" title={photo.fileName}>
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
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
