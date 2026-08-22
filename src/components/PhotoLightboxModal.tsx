import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FlipHorizontal,
  Grid, 
  Tag, 
  Camera, 
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Eye
} from 'lucide-react';
import { MedicalPhoto, Patient, PhotoAngle } from '../types';
import { CLINICAL_ANGLES, SURGERY_STAGES } from '../data/clinicalDefinitions';

interface PhotoLightboxModalProps {
  photo: MedicalPhoto | null;
  photos?: MedicalPhoto[];
  patient?: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto?: (photo: MedicalPhoto) => void;
  onOpenTagModal?: (photo: MedicalPhoto) => void;
  onUpdateAngle?: (photoId: string, angle: PhotoAngle) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  photos = [],
  patient,
  isOpen,
  onClose,
  onSelectPhoto,
  onOpenTagModal,
  onUpdateAngle,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isAnglePickerOpen, setIsAnglePickerOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFilmstrip, setShowFilmstrip] = useState<boolean>(true);

  // Pan / Drag State
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Filter relevant photos for navigation (same patient or all)
  const relevantPhotos = photos.length > 0 
    ? (photo?.patientId ? photos.filter(p => p.patientId === photo.patientId) : photos.filter(p => !p.patientId))
    : [];
  
  const currentIndex = relevantPhotos.findIndex(p => p.id === photo?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < relevantPhotos.length - 1;

  const handlePrevPhoto = useCallback(() => {
    if (hasPrev && onSelectPhoto) {
      onSelectPhoto(relevantPhotos[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, relevantPhotos, onSelectPhoto]);

  const handleNextPhoto = useCallback(() => {
    if (hasNext && onSelectPhoto) {
      onSelectPhoto(relevantPhotos[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, relevantPhotos, onSelectPhoto]);

  // Reset transform when photo changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setIsFlippedH(false);
    setPanPosition({ x: 0, y: 0 });
    setIsAnglePickerOpen(false);
  }, [photo?.id]);

  // Fullscreen API integration
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (modalContainerRef.current?.requestFullscreen) {
        modalContainerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(prev => !prev);
        });
      } else {
        setIsFullscreen(prev => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  // Listen to browser fullscreen change event
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen || !photo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen && !document.fullscreenElement) {
            setIsFullscreen(false);
          } else if (!document.fullscreenElement) {
            onClose();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNextPhoto();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlePrevPhoto();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(z => Math.min(z + 0.25, 4));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setZoom(z => Math.max(z - 0.25, 0.7));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setRotation(0);
          setIsFlippedH(false);
          setPanPosition({ x: 0, y: 0 });
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setRotation(r => (r + 90) % 360);
          break;
        case 'm':
        case 'h':
          e.preventDefault();
          setIsFlippedH(prev => !prev);
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowGrid(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photo, isFullscreen, toggleFullscreen, handleNextPhoto, handlePrevPhoto, onClose]);

  if (!isOpen || !photo) return null;

  const angleObj = CLINICAL_ANGLES.find((a) => a.id === photo.angle);
  const stageObj = SURGERY_STAGES.find((s) => s.id === photo.stage);

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setIsFlippedH(false);
    setPanPosition({ x: 0, y: 0 });
    setFitMode('contain');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.2, 4));
    } else {
      setZoom((z) => {
        const next = Math.max(z - 0.2, 0.7);
        if (next <= 1) setPanPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleDoubleClick = () => {
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPanPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? 'p-0 bg-black' : 'p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md'} animate-in fade-in duration-200`}>
      <div
        ref={modalContainerRef}
        className={`relative w-full bg-slate-900 flex flex-col overflow-hidden text-slate-100 transition-all duration-300 ${
          isFullscreen 
            ? 'h-screen w-screen rounded-none border-none max-w-none' 
            : 'max-w-6xl h-[94vh] border border-slate-700/80 rounded-2xl shadow-2xl'
        }`}
      >
        {/* Lightbox Header Bar */}
        <div className="px-3 sm:px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm text-white font-mono-numbers">
                  {photo.fileName}
                </h3>
                {stageObj && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${stageObj.colorClass}`}>
                    {stageObj.labelFa}
                  </span>
                )}
                
                {/* Angle Badge with Dropdown Switcher */}
                <div className="relative">
                  <button
                    onClick={() => setIsAnglePickerOpen(!isAnglePickerOpen)}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1 transition-colors"
                    title="تغییر زاویه ثبت‌شده"
                  >
                    <span>{angleObj ? angleObj.labelFa.split('(')[0] : 'تعیین‌نشده'}</span>
                    <span className="text-[9px] text-emerald-400 font-normal">▼</span>
                  </button>

                  {isAnglePickerOpen && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1.5 z-50 text-right space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      <div className="px-2 py-1 text-[10px] text-slate-400 font-bold border-b border-slate-700/60 mb-1">
                        تغییر زاویه عکاسی:
                      </div>
                      {CLINICAL_ANGLES.map((ang) => (
                        <button
                          key={ang.id}
                          onClick={() => {
                            if (onUpdateAngle) onUpdateAngle(photo.id, ang.id);
                            setIsAnglePickerOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-1 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            photo.angle === ang.id
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          <span>{ang.labelFa}</span>
                          {photo.angle === ang.id && <Check className="w-3 h-3 text-white" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {relevantPhotos.length > 1 && (
                  <span className="text-[10px] text-slate-400 font-mono-numbers bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    عکس {currentIndex + 1} از {relevantPhotos.length}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-0.5 font-mono-numbers">
                بیمار: {patient ? `${patient.fullName} (${patient.fileNumber})` : 'در صندوق ورودی'}
              </p>
            </div>
          </div>

          {/* Quick Inspection Toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* FULLSCREEN TOGGLE BUTTON */}
            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all ${
                isFullscreen
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700 hover:border-emerald-500/50'
              }`}
              title={isFullscreen ? 'خروج از تمام‌صفحه (کلید F یا Esc)' : 'نمایش تمام‌صفحه (کلید F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              <span className="hidden sm:inline font-sans">
                {isFullscreen ? 'خروج تمام‌صفحه' : 'فول اسکرین'}
              </span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-0.5 hidden sm:block" />

            <button
              onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border border-slate-700 shadow-xs transition-all"
              title="بزرگ‌نمایی (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.25, 0.7))}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border border-slate-700 shadow-xs transition-all"
              title="کوچک‌نمایی (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border border-slate-700 shadow-xs transition-all"
              title="چرخش ۹۰ درجه (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFlippedH((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all shadow-xs ${
                isFlippedH
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border-slate-700'
              }`}
              title="آینه افقی (H)"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-xl border transition-all shadow-xs ${
                showGrid
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border-slate-700'
              }`}
              title="شبکه شطرنجی تقارن (G)"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
              className={`p-2 rounded-xl border transition-all shadow-xs ${
                fitMode === 'cover'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border-slate-700'
              }`}
              title={fitMode === 'contain' ? 'پر کردن کادر (Fill)' : 'تناسب در کادر (Fit)'}
            >
              {fitMode === 'contain' ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-xs transition-all"
              title="بازنشانی اندازه و زاویه (کلید 0)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-700 mx-0.5 hidden sm:block" />

            {onOpenTagModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenTagModal(photo);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden md:inline">الصاق</span>
              </button>
            )}

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 rounded-xl border transition-all ${
                isSidebarOpen ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="اطلاعات پرونده و EXIF"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
              title="بستن (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lightbox Canvas & Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Main Photo Viewport */}
          <div 
            ref={imageContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            className={`flex-1 bg-[#05080c] relative flex items-center justify-center overflow-hidden select-none ${
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Medical Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none medical-grid-bg opacity-40 z-10" />
            )}

            {/* Symmetry Center Guide Line */}
            {showGrid && (
              <div className="absolute inset-y-0 left-1/2 w-0.5 bg-emerald-500/60 pointer-events-none z-10 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}

            {/* PREVIOUS PHOTO ARROW (RTL Right) */}
            {hasPrev && onSelectPhoto && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPhoto();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-2xl bg-slate-900/80 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl backdrop-blur-md transition-all group"
                title="عکس قبلی (کلید جهت‌نما راست)"
              >
                <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            )}

            {/* NEXT PHOTO ARROW (RTL Left) */}
            {hasNext && onSelectPhoto && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-2xl bg-slate-900/80 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700/80 shadow-xl backdrop-blur-md transition-all group"
                title="عکس بعدی (کلید جهت‌نما چپ)"
              >
                <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            )}

            {/* Transform Canvas */}
            <div
              className="w-full h-full flex items-center justify-center p-2 sm:p-4"
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${isFlippedH ? -1 : 1})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                transformOrigin: 'center center',
              }}
            >
              <img
                src={photo.highResUrl}
                alt={photo.fileName}
                className={`max-w-full max-h-full rounded-md shadow-2xl transition-all duration-200 ${
                  fitMode === 'cover' ? 'w-full h-full object-cover' : 'object-contain'
                }`}
                referrerPolicy="no-referrer"
                draggable={false}
              />
            </div>

            {/* Bottom Floating Status Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 px-4 py-1.5 rounded-full text-[11px] font-mono-numbers text-slate-300 flex items-center gap-3 pointer-events-none z-20 shadow-lg">
              <span>بزرگ‌نمایی: <strong className="text-emerald-400">{Math.round(zoom * 100)}%</strong></span>
              {rotation !== 0 && <span>چرخش: <strong className="text-emerald-400">{rotation}°</strong></span>}
              {isFlippedH && <span className="text-amber-400 font-semibold">حالت آینه‌ای</span>}
              {isFullscreen && <span className="text-emerald-400 font-semibold hidden sm:inline">تمام‌صفحه (F)</span>}
            </div>

            {/* Shortcut Hint Toast in Fullscreen */}
            {isFullscreen && (
              <div className="absolute top-4 left-4 bg-slate-900/70 backdrop-blur-md border border-slate-700/60 px-3 py-1 rounded-lg text-[10px] text-slate-400 pointer-events-none z-20 hidden md:block">
                <span>کلیدها: <strong>F</strong> تمام‌صفحه • <strong>+ / -</strong> زوم • <strong>← →</strong> جابجایی • <strong>R</strong> چرخش • <strong>Esc</strong> خروج</span>
              </div>
            )}
          </div>

          {/* EXIF and Notes Sidebar */}
          {isSidebarOpen && (
            <div
              className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 p-4 sm:p-5 overflow-y-auto space-y-4 text-xs z-20 flex-shrink-0 animate-in fade-in duration-150"
            >
              {/* Clinical Metadata */}
              <div>
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-800">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span>مشخصات بالینی تصویر</span>
                </h4>

                <div className="mt-3 space-y-2 font-mono-numbers">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400">زاویه پزشکی:</span>
                    <span className="font-bold text-emerald-400">{angleObj ? angleObj.labelFa : 'تعیین نشده'}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400">مرحله جراحی:</span>
                    <span className="font-bold text-slate-200">{stageObj ? stageObj.labelFa : 'تعیین نشده'}</span>
                  </div>

                  {photo.clinicalNotes.humpReduction && (
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">تغییرات دورسوم / قوز:</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">{photo.clinicalNotes.humpReduction}</span>
                    </div>
                  )}

                  {photo.clinicalNotes.tipRotation && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                      <span className="text-slate-400">زاویه چرخش نوک:</span>
                      <span className="font-bold text-emerald-400">{photo.clinicalNotes.tipRotation}°</span>
                    </div>
                  )}
                </div>
              </div>

              {/* EXIF Information */}
              <div>
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-800">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>اطلاعات عکاسی استودیو</span>
                </h4>

                <div className="mt-3 grid grid-cols-2 gap-2 font-mono-numbers">
                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px]">دوربین:</span>
                    <span className="font-bold text-slate-200 truncate block">{photo.exif.cameraModel}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px]">لنز:</span>
                    <span className="font-bold text-slate-200 truncate block">{photo.exif.lensModel}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px]">دیافراگم / ISO:</span>
                    <span className="font-bold text-emerald-400">{photo.exif.aperture} • ISO {photo.exif.iso}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px]">سرعت شاتر:</span>
                    <span className="font-bold text-slate-200">{photo.exif.shutterSpeed}</span>
                  </div>

                  <div className="col-span-2 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                    <span className="text-slate-400 block text-[10px]">رزولوشن و حجم:</span>
                    <span className="font-bold text-slate-200">{photo.exif.resolution} • {photo.exif.fileSize}</span>
                  </div>
                </div>
              </div>

              {/* Clinical Notes Card */}
              <div>
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-2 pb-2.5 border-b border-slate-800">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>یادداشت بالینی ثبت‌شده</span>
                </h4>

                <div className="mt-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 leading-relaxed text-xs">
                  {photo.clinicalNotes.customNotes || 'یادداشت بالینی ثبت نشده است.'}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Bottom Filmstrip for Patient Angles (if multiple photos exist) */}
        {relevantPhotos.length > 1 && showFilmstrip && (
          <div className="bg-slate-950/95 border-t border-slate-800 p-2 z-20 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] text-slate-400 font-bold px-2 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
              <Eye className="w-3 h-3 text-emerald-400" />
              <span>تمام زوایا:</span>
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-1">
              {relevantPhotos.map((p) => {
                const isCurrent = p.id === photo.id;
                const pAngle = CLINICAL_ANGLES.find((a) => a.id === p.angle)?.labelFa.split('(')[0] || p.angle;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectPhoto && onSelectPhoto(p)}
                    className={`relative flex-shrink-0 rounded-lg overflow-hidden border transition-all ${
                      isCurrent
                        ? 'border-emerald-400 ring-2 ring-emerald-500/50 scale-105'
                        : 'border-slate-700/80 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={p.thumbnailUrl}
                      alt={p.fileName}
                      className="w-12 h-10 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-white text-center py-0.5 truncate px-1 font-mono-numbers">
                      {pAngle}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowFilmstrip(false)}
              className="text-slate-500 hover:text-slate-300 text-[10px] px-1"
              title="مخفی‌سازی نوار زوایا"
            >
              ✕
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
