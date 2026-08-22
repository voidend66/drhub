import { Patient, MedicalPhoto, PiSystemTelemetry } from '../types';

// Clean database with no mock data - ready for real clinical records
export const INITIAL_PATIENTS: Patient[] = [];

// Clean empty photos database - ready for real camera FTP transfers & uploads
export const INITIAL_PHOTOS: MedicalPhoto[] = [];

// Real Raspberry Pi System Telemetry - populated from OS metrics when server is connected
export const INITIAL_PI_TELEMETRY: PiSystemTelemetry = {
  cpuTemperatureC: 0,
  cpuUsagePercent: 0,
  ramUsageMb: 0,
  ramTotalMb: 0,
  diskUsedGb: 0,
  diskTotalGb: 0,
  activeDriveName: 'هارد اکسترنال کلینیک',
  activeDrivePath: '/media/pi/hdd_medical',
  driveStatus: 'disconnected',
  cameraConnected: false,
  cameraName: 'آماده اتصال درایو و دوربین',
  cameraBattery: 0,
  localIp: '---',
  uptimeSeconds: 0,
  lastPhotoReceivedTime: ''
};
