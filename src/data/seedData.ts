import { Patient, MedicalPhoto, PiSystemTelemetry } from '../types';

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'p-101',
    fileNumber: 'RH-1403-882',
    nationalId: '0021489931',
    fullName: 'سارا رضایی',
    age: 26,
    gender: 'female',
    phone: '0912-345-6789',
    surgeryType: 'رینوپلاستی اولیه فانتزی-طبیعی (Primary Rhinoplasty + Septal Graft)',
    surgeryDate: '1403/03/15',
    surgeonName: 'دکتر اکبر شهیدی پیام',
    medicalHistoryNotes: 'انحراف سپتوم خفیف به راست، قوز استخوانی ۲.۵ میلی‌متری، نوک بینی با پتوز ملایم، پوست با ضخامت متوسط.',
    avatarUrl: '',
    createdAt: '2024-06-01T10:00:00Z',
    totalPhotosCount: 0
  },
  {
    id: 'p-102',
    fileNumber: 'RH-1403-914',
    nationalId: '0018934522',
    fullName: 'امیرحسین مرادی',
    age: 31,
    gender: 'male',
    phone: '0935-887-2100',
    surgeryType: 'سپتورینوپلاستی استخوانی مردانه طبیعی (Preservation Rhinoplasty)',
    surgeryDate: '1403/04/20',
    surgeonName: 'دکتر اکبر شهیدی پیام',
    medicalHistoryNotes: 'سابقه شکستگی ورزشی بینی، انسداد تنفسی سمت چپ، استخوان‌های پهن و نیاز به استئوتومی لترال و دورسوم صاف بدون قوس زنانه.',
    avatarUrl: '',
    createdAt: '2024-07-05T11:30:00Z',
    totalPhotosCount: 0
  },
  {
    id: 'p-103',
    fileNumber: 'RH-1403-950',
    nationalId: '0076210984',
    fullName: 'نیلوفر صادقی',
    age: 29,
    gender: 'female',
    phone: '0919-445-1290',
    surgeryType: 'رینوپلاستی بینی گوشتی با پیوند غضروفی (Thick Skin Rhinoplasty)',
    surgeryDate: '1403/05/02',
    surgeonName: 'دکتر اکبر شهیدی پیام',
    medicalHistoryNotes: 'پوست ضخیم سباسه در یک‌سوم تحتانی، نیاز به تقویت ساختاری کلوملا و کاهش پهنای آلار و تریفای نوک بینی.',
    avatarUrl: '',
    createdAt: '2024-07-20T09:15:00Z',
    totalPhotosCount: 0
  }
];

// Clean empty photos database - ready for real camera FTP transfers & uploads
export const INITIAL_PHOTOS: MedicalPhoto[] = [];

export const INITIAL_PI_TELEMETRY: PiSystemTelemetry = {
  cpuTemperatureC: 43.5,
  cpuUsagePercent: 12,
  ramUsageMb: 1240,
  ramTotalMb: 3880, // 4GB Raspberry Pi / Host RAM
  diskUsedGb: 4.2,
  diskTotalGb: 128.0,
  ftpServerOnline: true,
  ftpPort: 2121,
  ftpStoragePath: '/home/pi/medical_storage/raw_uploads',
  allowAnonymous: true,
  securityMode: 'plain',
  requireCertificate: false,
  cameraConnected: true,
  cameraName: 'سرویس FTP بدون محدودیت (آماده اتصال دوربین)',
  cameraBattery: 95,
  localIp: '192.168.1.150:3000',
  uptimeSeconds: 84600,
  lastPhotoReceivedTime: ''
};
