import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Columns, 
  SplitSquareVertical, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FlipHorizontal, 
  Grid, 
  MoveHorizontal,
  FileSpreadsheet
} from 'lucide-react';
import { Patient, MedicalPhoto } from '../types';
import { SURGERY_STAGES, CLINICAL_ANGLES } from '../data/clinicalDefinitions';

interface BeforeAfterViewProps {
  patients: Patient[];
  photos: MedicalPhoto[];
  selectedPatientId?: string;
  initialPrePhotoId?: string;
  initialPostPhotoId?: string;
}

export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({
  patients,
  photos,
  selectedPatientId,
  initialPrePhotoId,
  initialPostPhotoId,
}) => {
  const [activePatientId, setActivePatientId] = useState<string>(
    selectedPatientId || patients[0]?.id || ''
  );

  const patient = patients.find((p) => p.id === activePatientId) || patients[0];
  const patientPhotos = photos.filter((p) => p.patientId === patient?.id);

  // Auto pick pre-op and post-op photos
  const preOpPhotos = patientPhotos.filter((p) => p.stage === 'pre_op');
  const postOpPhotos = patientPhotos.filter((p) => p.stage !== 'pre_op');

  const [prePhotoId, setPrePhotoId] = useState<string>(
    initialPrePhotoId || preOpPhotos[0]?.id || patientPhotos[0]?.id || ''
  );
  const [postPhotoId, setPostPhotoId] = useState<string>(
    initialPostPhotoId || postOpPhotos[0]?.id || patientPhotos[1]?.id || patientPhotos[0]?.id || ''
  );

  // Update when patient changes
  useEffect(() => {
    const curPatientPhotos = photos.filter((p) => p.patientId === activePatientId);
    const pres = curPatientPhotos.filter((p) => p.stage === 'pre_op');
    const posts = curPatientPhotos.filter((p) => p.stage !== 'pre_op');
    if (pres.length > 0) setPrePhotoId(pres[0].id);
    if (posts.length > 0) setPostPhotoId(posts[0].id);
    else if (curPatientPhotos.length > 1) setPostPhotoId(curPatientPhotos[1].id);
  }, [activePatientId, photos]);

  const prePhoto = patientPhotos.find((p) => p.id === prePhotoId) || patientPhotos[0];
  const postPhoto = patientPhotos.find((p) => p.id === postPhotoId) || patientPhotos[1] || patientPhotos[0];

  // Modes & Tools
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showSymmetryLine, setShowSymmetryLine] = useState<boolean>(true);
  const [rotation, setRotation] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Slider dragging refs
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const offset = clientX - rect.left;
    const percentage = Math.min(Math.max((offset / rect.width) * 100, 2), 98);
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      handleSliderMove(e.clientX);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    handleSliderMove(e.clientX);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div id="before-after-view" className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      
      {/* Top Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Patient Selection */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-700">پرونده:</span>
          <select
            value={activePatientId}
            onChange={(e) => setActivePatientId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} ({p.fileNumber})
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center justify-center bg-slate-100/90 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('slider')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'slider'
                ? 'bg-white text-emerald-800 shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>اسلایدر پرده‌ای</span>
          </button>

          <button
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'side-by-side'
                ? 'bg-white text-emerald-800 shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>کنار هم</span>
          </button>
        </div>

        {/* Zoom, Grid, Flip & Angle Caliper Controls */}
        <div className="flex items-center justify-end gap-1.5 overflow-x-auto">
          <button
            onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-emerald-700 transition-all touch-active"
            title="بزرگ‌نمایی"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-emerald-700 transition-all touch-active"
            title="کوچک‌نمایی"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-xl border transition-all touch-active ${
              showGrid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
            title="شبکه شطرنجی تقارن"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSymmetryLine(!showSymmetryLine)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all touch-active flex items-center gap-1 ${
              showSymmetryLine
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
            title="خط تقارن عمودی صورت"
          >
            <span className="w-2 h-2 border-r-2 border-emerald-600" />
            <span>خط تقارن</span>
          </button>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-emerald-700 transition-all touch-active"
            title="چرخش"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className={`p-2 rounded-xl border transition-all touch-active ${
              isFlipped
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
            title="آینه‌ای کردن"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Select Which Photos To Compare */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        {/* Left Photo Selector (Pre-Op) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-xs font-bold text-slate-800">تصویر پایه (قبل عمل):</span>
          </div>
          <select
            value={prePhotoId}
            onChange={(e) => setPrePhotoId(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 max-w-[200px]"
          >
            {patientPhotos.map((p) => {
              const stageLabel = SURGERY_STAGES.find((s) => s.id === p.stage)?.labelFa || p.stage;
              const angleLabel = CLINICAL_ANGLES.find((a) => a.id === p.angle)?.labelFa.split('(')[0] || p.angle;
              return (
                <option key={p.id} value={p.id}>
                  {stageLabel} • {angleLabel} ({p.fileName})
                </option>
              );
            })}
          </select>
        </div>

        {/* Right Photo Selector (Post-Op) */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-800">تصویر نتیجه (بعد عمل):</span>
          </div>
          <select
            value={postPhotoId}
            onChange={(e) => setPostPhotoId(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 max-w-[200px]"
          >
            {patientPhotos.map((p) => {
              const stageLabel = SURGERY_STAGES.find((s) => s.id === p.stage)?.labelFa || p.stage;
              const angleLabel = CLINICAL_ANGLES.find((a) => a.id === p.angle)?.labelFa.split('(')[0] || p.angle;
              return (
                <option key={p.id} value={p.id}>
                  {stageLabel} • {angleLabel} ({p.fileName})
                </option>
              );
            })}
          </select>
        </div>

      </div>

      {/* VIEWPORT CANVAS CONTAINER */}
      <div 
        id="medical-comparison-viewport"
        className="relative w-full rounded-2xl bg-slate-950 border border-slate-300 shadow-lg overflow-hidden min-h-[480px] flex items-center justify-center select-none"
      >
        
        {/* MODE 1: SPLIT CURTAIN SLIDER */}
        {viewMode === 'slider' && prePhoto && postPhoto && (
          <div 
            ref={sliderContainerRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onTouchMove={handleTouchMove}
            className="relative w-full h-[520px] md:h-[580px] overflow-hidden cursor-ew-resize bg-slate-950 flex items-center justify-center"
          >
            {/* Base Image (Pre-Op) */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                transition: 'transform 0.15s ease-out'
              }}
            >
              <img
                src={prePhoto.highResUrl}
                alt="قبل از عمل"
                className="w-full h-full object-contain pointer-events-none"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Overlaid Image (Post-Op) */}
            <div
              className="absolute inset-0 overflow-hidden flex items-center justify-center"
              style={{
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`
              }}
            >
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                  transition: 'transform 0.15s ease-out'
                }}
              >
                <img
                  src={postPhoto.highResUrl}
                  alt="بعد از عمل"
                  className="w-full h-full object-contain pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Symmetry Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none medical-grid-bg opacity-25" />
            )}

            {/* Vertical Symmetry Midline */}
            {showSymmetryLine && (
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-400/80 pointer-events-none z-20 shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-950/90 text-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono-numbers border border-emerald-400/40">
                  خط تقارن
                </div>
              </div>
            )}

            {/* Slider Dividing Bar & Touch Handle */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] -translate-x-1/2" />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white cursor-ew-resize">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>

            {/* Stage Labels */}
            <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-rose-400 text-xs font-bold text-rose-300">
              🔴 {SURGERY_STAGES.find((s) => s.id === prePhoto.stage)?.labelFa || 'قبل عمل'}
            </div>

            <div className="absolute top-3.5 left-3.5 z-20 pointer-events-none bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-emerald-400 text-xs font-bold text-emerald-300">
              🟢 {SURGERY_STAGES.find((s) => s.id === postPhoto.stage)?.labelFa || 'بعد عمل'}
            </div>

          </div>
        )}

        {/* MODE 2: SIDE-BY-SIDE COMPARISON */}
        {viewMode === 'side-by-side' && prePhoto && postPhoto && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 p-3 h-[520px] md:h-[580px]">
            
            {/* Pre-Op Panel */}
            <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                  transition: 'transform 0.15s ease-out'
                }}
              >
                <img
                  src={prePhoto.highResUrl}
                  alt="Pre-Op"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {showGrid && <div className="absolute inset-0 pointer-events-none medical-grid-bg opacity-25" />}

              <div className="absolute top-3 right-3 bg-black/75 px-2.5 py-1 rounded-lg border border-rose-400 text-xs font-bold text-rose-300">
                🔴 {SURGERY_STAGES.find((s) => s.id === prePhoto.stage)?.labelFa || 'قبل عمل'}
              </div>
            </div>

            {/* Post-Op Panel */}
            <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg) scaleX(${isFlipped ? -1 : 1})`,
                  transition: 'transform 0.15s ease-out'
                }}
              >
                <img
                  src={postPhoto.highResUrl}
                  alt="Post-Op"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {showGrid && <div className="absolute inset-0 pointer-events-none medical-grid-bg opacity-25" />}

              <div className="absolute top-3 right-3 bg-black/75 px-2.5 py-1 rounded-lg border border-emerald-400 text-xs font-bold text-emerald-300">
                🟢 {SURGERY_STAGES.find((s) => s.id === postPhoto.stage)?.labelFa || 'بعد عمل'}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
