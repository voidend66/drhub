export type PhotoAngle = 
  | 'frontal' 
  | 'profile_right' 
  | 'profile_left' 
  | 'oblique_right' 
  | 'oblique_left' 
  | 'basal' 
  | 'cephalic' 
  | 'unassigned';

export type SurgeryStage = 
  | 'pre_op' 
  | 'intra_op' 
  | 'immediate_post' 
  | 'cast_removal' 
  | '1_month' 
  | '3_months' 
  | '6_months' 
  | '1_year' 
  | 'revision' 
  | 'unassigned';

export interface CameraExif {
  cameraModel: string;
  lensModel: string;
  iso: number;
  aperture: string; // e.g. "f/8.0"
  shutterSpeed: string; // e.g. "1/160s"
  focalLength: string; // e.g. "85mm"
  resolution: string; // e.g. "6000 x 4000 (24MP)"
  fileSize: string; // e.g. "14.2 MB"
  colorSpace: string;
  flash: boolean;
}

export interface ClinicalNotes {
  humpReduction?: string; // e.g. "3mm Osteotomy"
  tipRotation?: number; // e.g. 105 degrees
  nasolabialAngle?: number;
  alarBaseReduction?: boolean;
  graftType?: string; // e.g. "Septal Cartilage / Columellar Strut"
  skinThickness?: 'Thin' | 'Medium' | 'Thick' | 'Sebaceous';
  dorsumProfile?: 'Straight' | 'Slight Natural Curve' | 'Retained';
  customNotes?: string;
  recordedBy?: string;
  updatedAt?: string;
}

export interface MedicalPhoto {
  id: string;
  patientId: string | null; // null if in unassigned raw inbox
  fileName: string;
  filePath: string;
  thumbnailUrl: string;
  highResUrl: string;
  uploadTimestamp: string;
  sourceCamera: {
    name: string;
    location: string; // "Studio Room A" | "Operating Room 2"
    ipAddress: string;
    ftpPort: number;
    wifiSignalDbm: number;
  };
  angle: PhotoAngle;
  stage: SurgeryStage;
  exif: CameraExif;
  clinicalNotes: ClinicalNotes;
  isFlaggedForComparison?: boolean;
  aiSuggestedAngle?: PhotoAngle;
  aiSuggestedConfidence?: number;
}

export interface Patient {
  id: string;
  fileNumber: string; // e.g. "RH-1403-882"
  nationalId: string;
  fullName: string;
  age: number;
  gender: 'female' | 'male' | 'other';
  phone: string;
  surgeryType: string; // e.g. "رینوپلاستی استخوانی - غضروفی (Primary Rhinoplasty)"
  surgeryDate: string; // e.g. "1403/05/12"
  surgeonName: string;
  medicalHistoryNotes: string;
  avatarUrl: string;
  createdAt: string;
  totalPhotosCount?: number;
}

export interface PiSystemTelemetry {
  cpuTemperatureC: number;
  cpuUsagePercent: number;
  ramUsageMb: number;
  ramTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  ftpServerOnline: boolean;
  ftpPort: number;
  ftpStoragePath: string;
  cameraConnected: boolean;
  cameraName: string;
  cameraBattery: number;
  localIp: string;
  uptimeSeconds: number;
  lastPhotoReceivedTime: string;
}

export interface AngleInfo {
  id: PhotoAngle;
  labelFa: string;
  labelEn: string;
  degrees: string;
  iconName: string;
  descriptionFa: string;
}

export interface StageInfo {
  id: SurgeryStage;
  labelFa: string;
  labelEn: string;
  colorClass: string;
  descriptionFa: string;
}
