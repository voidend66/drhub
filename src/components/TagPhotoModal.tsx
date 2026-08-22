import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Check, 
  User, 
  Layers, 
  Tag, 
  FileText,
  Compass
} from 'lucide-react';
import { MedicalPhoto, Patient, PhotoAngle, SurgeryStage } from '../types';
import { CLINICAL_ANGLES, SURGERY_STAGES, QUICK_CLINICAL_TAGS } from '../data/clinicalDefinitions';

interface TagPhotoModalProps {
  photo: MedicalPhoto | null;
  patients: Patient[];
  onClose: () => void;
  onSave: (
    photoId: string, 
    patientId: string, 
    stage: SurgeryStage, 
    angle: PhotoAngle, 
    notes: string,
    humpReduction?: string,
    tipRotation?: number
  ) => void;
}

export const TagPhotoModal: React.FC<TagPhotoModalProps> = ({
  photo,
  patients,
  onClose,
  onSave,
}) => {
  if (!photo) return null;

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    photo.patientId || patients[0]?.id || ''
  );
  const [selectedStage, setSelectedStage] = useState<SurgeryStage>(
    photo.stage !== 'unassigned' ? photo.stage : 'pre_op'
  );
  const [selectedAngle, setSelectedAngle] = useState<PhotoAngle>(
    photo.angle !== 'unassigned' ? photo.angle : 'frontal'
  );
  const [notes, setNotes] = useState<string>(photo.clinicalNotes.customNotes || '');
  const [humpReduction, setHumpReduction] = useState<string>(photo.clinicalNotes.humpReduction || '');
  const [tipRotation, setTipRotation] = useState<number>(photo.clinicalNotes.tipRotation || 95);

  const handleSave = () => {
    if (!selectedPatientId) return;
    onSave(photo.id, selectedPatientId, selectedStage, selectedAngle, notes, humpReduction, tipRotation);
    onClose();
  };

  const addQuickTag = (tagText: string) => {
    setNotes((prev) => (prev ? `${prev} • ${tagText}` : tagText));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                الصاق تصویر به پرونده بیمار
              </h3>
              <p className="text-[11px] text-slate-500 font-mono-numbers mt-0.5">
                {photo.fileName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Patient Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>انتخاب بیمار:</span>
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.fileNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Surgical Stage Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>مرحله جراحی:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SURGERY_STAGES.map((s) => {
                const isSelected = selectedStage === s.id;
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setSelectedStage(s.id)}
                    className={`p-2 rounded-xl text-xs font-medium border text-center transition-all touch-active ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {s.labelFa}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical Angle Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>زاویه تصویر:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CLINICAL_ANGLES.map((a) => {
                const isSelected = selectedAngle === a.id;
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setSelectedAngle(a.id)}
                    className={`p-2 rounded-xl text-xs font-medium border text-center transition-all touch-active ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {a.labelFa.split('(')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes & Quick Tags */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>یادداشت بالینی:</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="یادداشت پزشک..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
            />

            {/* Quick Tag Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_CLINICAL_TAGS.slice(0, 4).map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => addQuickTag(tag.split('(')[0].trim())}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[10px] border border-slate-200 transition-colors"
                >
                  + {tag.split('(')[0].trim()}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            انصراف
          </button>
          
          <button
            onClick={handleSave}
            className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 touch-active"
          >
            <Check className="w-3.5 h-3.5" />
            <span>ذخیره در پرونده</span>
          </button>
        </div>

      </motion.div>
    </div>
  );
};
