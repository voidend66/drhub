import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Search, 
  Calendar, 
  FileText, 
  Camera, 
  Filter, 
  Check, 
  Columns, 
  Maximize2,
  Edit3
} from 'lucide-react';
import { Patient, MedicalPhoto, SurgeryStage, PhotoAngle } from '../types';
import { CLINICAL_ANGLES, SURGERY_STAGES } from '../data/clinicalDefinitions';

interface PatientGalleryViewProps {
  patients: Patient[];
  photos: MedicalPhoto[];
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient) => void;
  onToggleCompareFlag: (photoId: string) => void;
  onSelectPhotoLightbox: (photo: MedicalPhoto) => void;
  onNavigateToCompare: (prePhotoId?: string, postPhotoId?: string) => void;
  onUpdateNotes: (photoId: string, notes: string) => void;
}

export const PatientGalleryView: React.FC<PatientGalleryViewProps> = ({
  patients,
  photos,
  selectedPatient,
  onSelectPatient,
  onToggleCompareFlag,
  onSelectPhotoLightbox,
  onNavigateToCompare,
  onUpdateNotes,
}) => {
  const [patientSearch, setPatientSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [angleFilter, setAngleFilter] = useState<string>('all');
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  // Filter patients list
  const filteredPatients = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.nationalId.includes(patientSearch) ||
      p.fileNumber.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // Photos for active patient
  const patientPhotos = photos.filter((p) => p.patientId === selectedPatient?.id);

  // Filtered photos by stage and angle
  const filteredPhotos = patientPhotos.filter((p) => {
    if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
    if (angleFilter !== 'all' && p.angle !== angleFilter) return false;
    return true;
  });

  // Flagged photos for comparison
  const flaggedPhotos = patientPhotos.filter((p) => p.isFlaggedForComparison);

  const getStageBadge = (stage: SurgeryStage) => {
    const stageObj = SURGERY_STAGES.find((s) => s.id === stage);
    if (!stageObj) return null;
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${stageObj.colorClass}`}>
        {stageObj.labelFa}
      </span>
    );
  };

  const getAngleBadge = (angle: PhotoAngle) => {
    const angleObj = CLINICAL_ANGLES.find((a) => a.id === angle);
    if (!angleObj) return null;
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-numbers bg-slate-100 text-slate-700 border border-slate-200">
        {angleObj.labelFa.split('(')[0]}
      </span>
    );
  };

  return (
    <div id="patient-gallery-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      
      {/* Right Sidebar: Patients List (4 cols) */}
      <div className="lg:col-span-4 space-y-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>پرونده بیماران</span>
            </h3>
            <span className="text-xs font-mono-numbers text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              {patients.length} پرونده
            </span>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو با نام یا شماره پرونده..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Patient Cards List */}
          <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-0.5">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              const photoCount = photos.filter((p) => p.patientId === patient.id).length;

              return (
                <div
                  key={patient.id}
                  onClick={() => onSelectPatient(patient)}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all touch-active ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={patient.avatarUrl}
                    alt={patient.fullName}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-800 truncate">{patient.fullName}</h4>
                      <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold">
                        {photoCount} عکس
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono-numbers mt-0.5 truncate">
                      پرونده: {patient.fileNumber}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area: Patient Dossier & Photos Album (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        {selectedPatient ? (
          <>
            {/* Patient Header Dossier Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src={selectedPatient.avatarUrl}
                    alt={selectedPatient.fullName}
                    className="w-14 h-14 rounded-2xl object-cover border border-emerald-200"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base text-slate-800">{selectedPatient.fullName}</h2>
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono-numbers bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                        {selectedPatient.fileNumber}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-mono-numbers">
                      <span>سن: <strong className="text-slate-700">{selectedPatient.age} سال</strong></span>
                      <span>•</span>
                      <span>جراح: <strong className="text-slate-700">{selectedPatient.surgeonName}</strong></span>
                      <span>•</span>
                      <span>تاریخ عمل: <strong className="text-slate-700">{selectedPatient.surgeryDate}</strong></span>
                    </div>
                  </div>
                </div>

                {flaggedPhotos.length >= 2 && (
                  <button
                    onClick={() => onNavigateToCompare(flaggedPhotos[0].id, flaggedPhotos[1].id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all touch-active"
                  >
                    <Columns className="w-4 h-4" />
                    <span>مقایسه ۲ عکس نشان‌شده</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Bar: Stages & Angles */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
              
              {/* Surgical Stages Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setStageFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    stageFilter === 'all'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  همه مراحل ({patientPhotos.length})
                </button>

                {SURGERY_STAGES.map((s) => {
                  const count = patientPhotos.filter((p) => p.stage === s.id).length;
                  if (count === 0 && stageFilter !== s.id) return null;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStageFilter(s.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                        stageFilter === s.id
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{s.labelFa}</span>
                      <span className="font-mono-numbers text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Angles Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
                <button
                  onClick={() => setAngleFilter('all')}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                    angleFilter === 'all' 
                      ? 'bg-slate-800 text-white font-bold' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  همه زوایا
                </button>
                {CLINICAL_ANGLES.map((a) => {
                  const count = patientPhotos.filter((p) => p.angle === a.id).length;
                  if (count === 0 && angleFilter !== a.id) return null;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAngleFilter(a.id)}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                        angleFilter === a.id 
                          ? 'bg-emerald-600 text-white font-bold' 
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {a.labelFa.split('(')[0]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photos Grid */}
            {filteredPhotos.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="font-bold text-slate-700 text-sm">تصویری با این فیلتر یافت نشد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredPhotos.map((photo) => {
                  const isFlagged = photo.isFlaggedForComparison;
                  const isEditing = editingPhotoId === photo.id;

                  return (
                    <motion.div
                      layout
                      key={photo.id}
                      className={`bg-white border rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col ${
                        isFlagged ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200'
                      }`}
                    >
                      {/* Photo Frame */}
                      <div className="relative aspect-[4/3] bg-slate-100 group overflow-hidden cursor-pointer">
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.fileName}
                          onClick={() => onSelectPhotoLightbox(photo)}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />

                        {/* Top Overlay Badges */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          {getStageBadge(photo.stage)}
                        </div>

                        <div className="absolute top-2.5 left-2.5">
                          {getAngleBadge(photo.angle)}
                        </div>

                        {/* Compare Selector Button */}
                        <button
                          onClick={() => onToggleCompareFlag(photo.id)}
                          className={`absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs backdrop-blur-xs transition-all ${
                            isFlagged
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
                          }`}
                          title="انتخاب برای مقایسه"
                        >
                          <Check className={`w-3.5 h-3.5 ${isFlagged ? 'stroke-[3]' : ''}`} />
                          <span>{isFlagged ? 'نشان‌شده برای مقایسه' : 'انتخاب برای مقایسه'}</span>
                        </button>

                        {/* Fullscreen icon */}
                        <button
                          onClick={() => onSelectPhotoLightbox(photo)}
                          className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-white/95 text-slate-700 hover:text-emerald-600 shadow-xs transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Photo Details & Clinical Notes */}
                      <div className="p-3 flex-1 flex flex-col justify-between gap-2 text-xs">
                        <div className="flex items-center justify-between text-slate-500 font-mono-numbers text-[11px]">
                          <span>{photo.exif.cameraModel}</span>
                          <span>{photo.exif.aperture} • ISO {photo.exif.iso}</span>
                        </div>

                        {/* Notes field */}
                        <div>
                          {isEditing ? (
                            <div className="space-y-1.5 mt-1">
                              <textarea
                                rows={2}
                                value={tempNotes}
                                onChange={(e) => setTempNotes(e.target.value)}
                                placeholder="یادداشت بالینی..."
                                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setEditingPhotoId(null)}
                                  className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
                                >
                                  انصراف
                                </button>
                                <button
                                  onClick={() => {
                                    onUpdateNotes(photo.id, tempNotes);
                                    setEditingPhotoId(null);
                                  }}
                                  className="px-2.5 py-0.5 bg-emerald-600 text-white rounded text-[11px] font-bold"
                                >
                                  ذخیره
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <p className="line-clamp-2">
                                {photo.clinicalNotes.customNotes || 'یادداشت ثبت نشده است.'}
                              </p>
                              <button
                                onClick={() => {
                                  setEditingPhotoId(photo.id);
                                  setTempNotes(photo.clinicalNotes.customNotes || '');
                                }}
                                className="text-slate-400 hover:text-emerald-600 p-0.5 flex-shrink-0"
                                title="ویرایش"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <h3 className="font-bold text-slate-700 text-base">یک پرونده را انتخاب کنید</h3>
          </div>
        )}
      </div>

    </div>
  );
};
