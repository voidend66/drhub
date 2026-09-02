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
import { FileManagerView } from './components/FileManagerView';
import { SystemLogsView } from './components/SystemLogsView';
import { TagPhotoModal } from './components/TagPhotoModal';
import { PhotoLightboxModal } from './components/PhotoLightboxModal';
import { DriveSettingsModal } from './components/DriveSettingsModal';
import {
  Patient,
  MedicalPhoto,
  PhotoAngle,
  SurgeryStage,
  ClinicalNotes,
  DriveStorageConfig,
  PiSystemTelemetry
} from './types';
import { INITIAL_PATIENTS, INITIAL_PHOTOS, INITIAL_PI_TELEMETRY } from './data/seedData';
import { medicalAudio } from './utils/audioAlert';

const DEFAULT_DRIVE_CONFIG: DriveStorageConfig = {
  activeStoragePath: '/media/pi/hdd_medical',
  driveLabel: 'هارد اکسترنال کلینیک (2TB)',
  autoOrganizeByDate: true,
  autoIndexPatients: true,
  autoScanIntervalSeconds: 5,
  diskSpaceAlertThresholdGb: 10,
};

export default function App() {
  // Navigation: 5 Views
  const [activeTab, setActiveTab] = useState<'inbox' | 'patients' | 'compare' | 'explorer' | 'logs'>('inbox');
  
  // Data States
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const [photos, setPhotos] = useState<MedicalPhoto[]>(INITIAL_PHOTOS);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(INITIAL_PATIENTS[0] || null);

  // Drive Config & Raspberry Pi Hardware Telemetry
  const [driveConfig, setDriveConfig] = useState<DriveStorageConfig>(() => {
    const saved = localStorage.getItem('drive_config');
    return saved ? JSON.parse(saved) : DEFAULT_DRIVE_CONFIG;
  });
  const [telemetry, setTelemetry] = useState<PiSystemTelemetry | null>(INITIAL_PI_TELEMETRY);

  // Active Modals & Settings
  const [liveAlertPhoto, setLiveAlertPhoto] = useState<MedicalPhoto | null>(null);
  const [taggingPhoto, setTaggingPhoto] = useState<MedicalPhoto | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MedicalPhoto | null>(null);
  const [isDriveSettingsOpen, setIsDriveSettingsOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Before & After Comparison Selection
  const [comparePrePhotoId, setComparePrePhotoId] = useState<string | undefined>(undefined);
  const [comparePostPhotoId, setComparePostPhotoId] = useState<string | undefined>(undefined);

  // Fetch initial data, telemetry & drive config from local server
  const loadServerData = useCallback(async () => {
    try {
      const [ptsRes, ptsPhotos, cfgRes, telemRes] = await Promise.all([
        fetch('/api/patients').then((r) => (r.ok ? r.json() : INITIAL_PATIENTS)),
        fetch('/api/photos').then((r) => (r.ok ? r.json() : INITIAL_PHOTOS)),
        fetch('/api/drive/config').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/drive/telemetry').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (Array.isArray(ptsRes)) setPatients(ptsRes);
      if (Array.isArray(ptsPhotos)) setPhotos(ptsPhotos);
      if (cfgRes && typeof cfgRes === 'object') {
        setDriveConfig((prev) => ({ ...prev, ...cfgRes }));
      }
      if (telemRes && typeof telemRes === 'object') {
        setTelemetry(telemRes);
      }
    } catch (e) {
      console.warn('Using local fallback state:', e);
    }
  }, []);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  // Periodic telemetry refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/drive/telemetry')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setTelemetry(data);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
      const res = await fetch('/api/photos/tag', {
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
      await fetch(`/api/photos/toggle-compare/${photoId}`, { method: 'POST' });
    } catch (e) {}
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, isFlaggedForComparison: !p.isFlaggedForComparison } : p
      )
    );
  };

  // Delete raw photo
  const handleDeletePhoto = async (photoId: string) => {
    try {
      await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
    } catch (e) {}
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Update photo angle
  const handleUpdateAngle = async (photoId: string, angle: PhotoAngle) => {
    try {
      await fetch(`/api/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle }),
      });
    } catch (e) {}
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, angle } : p))
    );
    if (lightboxPhoto && lightboxPhoto.id === photoId) {
      setLightboxPhoto((prev) => (prev ? { ...prev, angle } : null));
    }
  };

  // Update notes
  const handleUpdateNotes = async (photoId: string, notes: string) => {
    try {
      await fetch(`/api/photos/${photoId}`, {
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

  // Save Drive Config to server & local storage
  const handleSaveDriveConfig = async (newConfig: DriveStorageConfig) => {
    setDriveConfig(newConfig);
    localStorage.setItem('drive_config', JSON.stringify(newConfig));
    try {
      await fetch('/api/drive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      console.warn('Could not save drive config to server:', e);
    }
  };

  // Trigger HDD Rescan
  const handleTriggerRescan = async () => {
    try {
      const res = await fetch('/api/drive/rescan', { method: 'POST' });
      if (res.ok) {
        const freshPhotos = await fetch('/api/photos').then((r) => r.json());
        if (Array.isArray(freshPhotos)) setPhotos(freshPhotos);
      }
    } catch (e) {
      console.error('Trigger rescan error:', e);
    }
  };

  // When real photos are imported or uploaded
  const handlePhotosUploaded = (newPhotos: MedicalPhoto[]) => {
    setPhotos((prev) => [...newPhotos, ...prev]);
    if (soundEnabled && newPhotos.length > 0) {
      medicalAudio.playNewPhotoChime();
    }
  };

  // Handle adding new patient
  const handleAddPatient = (newPatient: Patient) => {
    setPatients((prev) => [newPatient, ...prev]);
    setSelectedPatient(newPatient);
  };

  // Navigate to compare view with specific pair
  const handleNavigateToCompare = (preId?: string, postId?: string) => {
    setComparePrePhotoId(preId);
    setComparePostPhotoId(postId);
    setActiveTab('compare');
  };

  const inboxPhotos = photos.filter((p) => !p.patientId || p.patientId === 'unassigned');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      
      {/* Clean Clinical Header with Navigation & Hard Drive Status */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inboxCount={inboxPhotos.length}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenDriveSettings={() => setIsDriveSettingsOpen(true)}
        telemetry={telemetry}
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
            onPhotosUploaded={handlePhotosUploaded}
            activeStoragePath={driveConfig.activeStoragePath}
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
            onAddPatient={handleAddPatient}
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

        {activeTab === 'explorer' && (
          <FileManagerView
            currentActiveStoragePath={driveConfig.activeStoragePath}
            onSetActiveStoragePath={(newPath) => {
              const updated = { ...driveConfig, activeStoragePath: newPath };
              handleSaveDriveConfig(updated);
            }}
            onOpenTagModal={(photo) => setTaggingPhoto(photo)}
            onSelectPhotoLightbox={(photo) => setLightboxPhoto(photo)}
            allPhotos={photos}
            patients={patients}
            onPhotosUploaded={handlePhotosUploaded}
          />
        )}

        {activeTab === 'logs' && (
          <SystemLogsView
            telemetry={telemetry}
            onTriggerRescan={handleTriggerRescan}
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

      {/* Modal: Lightbox High-Res EXIF Inspector & Fullscreen */}
      <PhotoLightboxModal
        photo={lightboxPhoto}
        photos={photos}
        patient={patients.find((p) => p.id === lightboxPhoto?.patientId)}
        isOpen={Boolean(lightboxPhoto)}
        onClose={() => setLightboxPhoto(null)}
        onSelectPhoto={(photo) => setLightboxPhoto(photo)}
        onOpenTagModal={(photo) => setTaggingPhoto(photo)}
        onUpdateAngle={handleUpdateAngle}
      />

      {/* Modal: Raspberry Pi Hard Drive Settings & Telemetry */}
      <DriveSettingsModal
        isOpen={isDriveSettingsOpen}
        onClose={() => setIsDriveSettingsOpen(false)}
        telemetry={telemetry}
        currentConfig={driveConfig}
        onSaveConfig={handleSaveDriveConfig}
        onTriggerRescan={handleTriggerRescan}
      />

      {/* Clean Footer */}
      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-xs text-slate-500 text-center shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>سامانه آرشیو و پایش مستقیم هارد دیسک عکس‌های پزشکی رزبری‌پای</span>
          <span className="font-mono text-slate-600 font-semibold">
            مسیر فعال: {driveConfig.activeStoragePath} • آی‌پی: {telemetry?.localIp || '192.168.1.150'} • دمای پردازنده: {telemetry?.cpuTemperatureC || 48.5}°C
          </span>
        </div>
      </footer>

    </div>
  );
}
