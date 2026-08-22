/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveAlertToast } from './components/LiveAlertToast';
import { InboxView } from './components/InboxView';
import { PatientGalleryView } from './components/PatientGalleryView';
import { BeforeAfterView } from './components/BeforeAfterView';
import { TagPhotoModal } from './components/TagPhotoModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { FtpSettingsModal, FtpConfigData } from './components/FtpSettingsModal';
import { Patient, MedicalPhoto, PhotoAngle, SurgeryStage, ClinicalNotes } from './types';
import { INITIAL_PATIENTS, INITIAL_PHOTOS } from './data/seedData';
import { medicalAudio } from './utils/audioAlert';

const DEFAULT_FTP_CONFIG: FtpConfigData = {
  ipAddress: '192.168.1.150',
  port: 2121,
  username: 'clinic_camera',
  password: '••••••••',
  storagePath: '/var/clinic_photos/rhinoplasty_raw',
  autoOrganizeByDate: true,
  passiveMode: true,
};

export default function App() {
  // Navigation: 3 Essential Doctor Views
  const [activeTab, setActiveTab] = useState<'inbox' | 'patients' | 'compare'>('inbox');
  
  // Data States
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [photos, setPhotos] = useState<MedicalPhoto[]>(INITIAL_PHOTOS);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(INITIAL_PATIENTS[0] || null);

  // Active Modals & Settings
  const [liveAlertPhoto, setLiveAlertPhoto] = useState<MedicalPhoto | null>(null);
  const [taggingPhoto, setTaggingPhoto] = useState<MedicalPhoto | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MedicalPhoto | null>(null);
  const [isFtpSettingsOpen, setIsFtpSettingsOpen] = useState<boolean>(false);
  const [ftpConfig, setFtpConfig] = useState<FtpConfigData>(() => {
    const saved = localStorage.getItem('ftp_config');
    return saved ? JSON.parse(saved) : DEFAULT_FTP_CONFIG;
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Before & After Comparison Selection
  const [comparePrePhotoId, setComparePrePhotoId] = useState<string | undefined>(undefined);
  const [comparePostPhotoId, setComparePostPhotoId] = useState<string | undefined>(undefined);

  // Fetch initial data from local server
  const loadServerData = useCallback(async () => {
    try {
      const [ptsRes, ptsPhotos] = await Promise.all([
        fetch('/api/ftp/patients').then((r) => r.ok ? r.json() : INITIAL_PATIENTS),
        fetch('/api/ftp/photos').then((r) => r.ok ? r.json() : INITIAL_PHOTOS),
      ]);

      if (Array.isArray(ptsRes)) setPatients(ptsRes);
      if (Array.isArray(ptsPhotos)) setPhotos(ptsPhotos);
    } catch (e) {
      console.warn('Using local fallback state:', e);
    }
  }, []);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  // Toggle Sound
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    medicalAudio.setSoundEnabled(nextState);
    if (nextState) {
      medicalAudio.playNewPhotoChime();
    }
  };

  // Save Tagging & Assign to Patient
  const handleSaveTag = async (
    photoId: string,
    patientId: string,
    stage: SurgeryStage,
    angle: PhotoAngle,
    notes: string,
    humpReduction?: string,
    tipRotation?: number
  ) => {
    const clinicalNotes: ClinicalNotes = {
      customNotes: notes,
      humpReduction: humpReduction || undefined,
      tipRotation: tipRotation || undefined,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };

    try {
      const res = await fetch('/api/ftp/tag-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoId,
          patientId,
          angle,
          stage,
          clinicalNotes,
        }),
      });

      if (res.ok) {
        const updatedPhoto = await res.json();
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? updatedPhoto : p)));
      } else {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === photoId
              ? { ...p, patientId, angle, stage, clinicalNotes }
              : p
          )
        );
      }
    } catch (e) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId
            ? { ...p, patientId, angle, stage, clinicalNotes }
            : p
        )
      );
    }

    // Automatically switch to patient view so doctor sees the organized photo
    const targetPatient = patients.find((p) => p.id === patientId);
    if (targetPatient) {
      setSelectedPatient(targetPatient);
    }
  };

  // Toggle flag for comparison
  const handleToggleCompareFlag = async (photoId: string) => {
    try {
      await fetch(`/api/ftp/toggle-compare/${photoId}`, { method: 'POST' });
    } catch (e) {}
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, isFlaggedForComparison: !p.isFlaggedForComparison } : p
      )
    );
  };

  // Delete raw photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('آیا از حذف این تصویر مطمئن هستید؟')) return;
    try {
      await fetch(`/api/ftp/photos/${photoId}`, { method: 'DELETE' });
    } catch (e) {}
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Update notes
  const handleUpdateNotes = async (photoId: string, notes: string) => {
    try {
      await fetch(`/api/ftp/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicalNotes: { customNotes: notes, updatedAt: new Date().toLocaleDateString('fa-IR') }
        }),
      });
    } catch (e) {}
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? {
              ...p,
              clinicalNotes: {
                ...p.clinicalNotes,
                customNotes: notes,
                updatedAt: new Date().toLocaleDateString('fa-IR'),
              },
            }
          : p
      )
    );
  };

  // Save FTP config
  const handleSaveFtpConfig = (newConfig: FtpConfigData) => {
    setFtpConfig(newConfig);
    localStorage.setItem('ftp_config', JSON.stringify(newConfig));
  };

  // Navigate to compare view with specific pair
  const handleNavigateToCompare = (preId?: string, postId?: string) => {
    setComparePrePhotoId(preId);
    setComparePostPhotoId(postId);
    setActiveTab('compare');
  };

  const inboxPhotos = photos.filter((p) => !p.patientId || p.patientId === 'unassigned');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* Clean Clinical Header with Navigation & FTP Settings */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inboxCount={inboxPhotos.length}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenFtpSettings={() => setIsFtpSettingsOpen(true)}
      />

      {/* Live Toast Notification on New Photo */}
      <LiveAlertToast
        photo={liveAlertPhoto}
        onClose={() => setLiveAlertPhoto(null)}
        onTagPhoto={(photo) => setTaggingPhoto(photo)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {activeTab === 'inbox' && (
          <InboxView
            inboxPhotos={inboxPhotos}
            onOpenTagModal={(photo) => setTaggingPhoto(photo)}
            onDeletePhoto={handleDeletePhoto}
            onSelectPhotoLightbox={(photo) => setLightboxPhoto(photo)}
          />
        )}

        {activeTab === 'patients' && (
          <PatientGalleryView
            patients={patients}
            photos={photos}
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            onToggleCompareFlag={handleToggleCompareFlag}
            onSelectPhotoLightbox={(photo) => setLightboxPhoto(photo)}
            onNavigateToCompare={handleNavigateToCompare}
            onUpdateNotes={handleUpdateNotes}
          />
        )}

        {activeTab === 'compare' && (
          <BeforeAfterView
            patients={patients}
            photos={photos}
            selectedPatientId={selectedPatient?.id}
            initialPrePhotoId={comparePrePhotoId}
            initialPostPhotoId={comparePostPhotoId}
          />
        )}
      </main>

      {/* Modal: Fast 1-Click Patient & Surgical Angle Tagging */}
      <TagPhotoModal
        photo={taggingPhoto}
        patients={patients}
        onClose={() => setTaggingPhoto(null)}
        onSave={handleSaveTag}
      />

      {/* Modal: Lightbox High-Res EXIF Inspector */}
      <PhotoLightboxModal
        photo={lightboxPhoto}
        patient={patients.find((p) => p.id === lightboxPhoto?.patientId)}
        isOpen={Boolean(lightboxPhoto)}
        onClose={() => setLightboxPhoto(null)}
        onOpenTagModal={(photo) => setTaggingPhoto(photo)}
      />

      {/* Modal: FTP Server & Wi-Fi Camera Setup */}
      <FtpSettingsModal
        isOpen={isFtpSettingsOpen}
        onClose={() => setIsFtpSettingsOpen(false)}
        config={ftpConfig}
        onSaveConfig={handleSaveFtpConfig}
      />

      {/* Clean Footer */}
      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>سامانه دریافت خودکار و آرشیو تصاویر جراحی رینوپلاستی کلینیک</span>
          <span className="font-mono-numbers text-slate-600">
            سرور FTP: فعال روی پورت {ftpConfig.port} ({ftpConfig.ipAddress})
          </span>
        </div>
      </footer>

    </div>
  );
}
