import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Cpu,
  RefreshCw,
  Folder,
  Check,
  X,
  Database,
  Sliders,
  Activity,
  Terminal,
  Zap,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { PiSystemTelemetry, DriveStorageConfig, SystemLogEntry } from '../types';

interface DriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: PiSystemTelemetry | null;
  currentConfig: DriveStorageConfig;
  onSaveConfig: (newConfig: DriveStorageConfig) => Promise<void>;
  onTriggerRescan: () => Promise<void>;
}

export const DriveSettingsModal: React.FC<DriveSettingsModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  currentConfig,
  onSaveConfig,
  onTriggerRescan
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'hardware' | 'logs'>('config');
  const [formData, setFormData] = useState<DriveStorageConfig>(currentConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [liveLogs, setLiveLogs] = useState<SystemLogEntry[]>([]);
  const [recentScanLog, setRecentScanLog] = useState<string | null>(null);

  useEffect(() => {
    setFormData(currentConfig);
  }, [currentConfig]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/logs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLiveLogs(data.slice(0, 15)))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const HDD_PRESETS = [
    { label: 'هارد اکسترنال اصلی (USB 3.0)', path: '/media/pi/hdd_medical', desc: 'مسیر پیش‌فرض مانت هارد اکسترنال در رزبری‌پای' },
    { label: 'حافظه داخلی رزبری‌پای', path: '/home/pi/medical_storage/raw_uploads', desc: 'مسیر محلی در دیسک داخلی سیستم‌عامل' },
    { label: 'پوشه شبکه کلینیک (Samba/NFS)', path: '/mnt/clinic_nas/photos', desc: 'درایو به اشتراک گذاشته شده در شبکه داخلی' },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveConfig(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save config error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setRecentScanLog(null);
    try {
      await onTriggerRescan();
      setRecentScanLog('اسکن کامل هارد دیسک با موفقیت انجام شد و فایل‌های جدید نمایه شدند.');
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLiveLogs(data.slice(0, 15));
      }
    } catch (err: any) {
      setRecentScanLog('خطا در اسکن هارد دیسک: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-inner">
              <HardDrive className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  تنظیمات هارد دیسک و پردازش رزبری‌پای
                </h3>
                <span className="bg-emerald-900/40 text-emerald-100 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Raspberry Pi Storage
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                مدیریت مسیر ذخیره‌سازی، پایش سخت‌افزار رزبری‌پای و لاگ‌های زنده دیسک
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'config'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            مسیر و تنظیمات هارد
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'hardware'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            وضعیت سخت‌افزار رزبری‌پای
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'logs'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            لاگ‌های زنده سیستم ({liveLogs.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh] space-y-5">
          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* HDD Label & Presets */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  عنوان هارد دیسک
                </label>
                <input
                  type="text"
                  value={formData.driveLabel}
                  onChange={(e) => setFormData({ ...formData, driveLabel: e.target.value })}
                  placeholder="مثال: هارد اکسترنال 2TB مطب"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none"
                />

                <label className="text-xs font-bold text-slate-700 flex items-center gap-2 pt-2">
                  <Folder className="w-4 h-4 text-emerald-600" />
                  مسیر ذخیره‌سازی تصاویر پزشکی در هارد
                </label>
                <input
                  type="text"
                  value={formData.activeStoragePath}
                  onChange={(e) => setFormData({ ...formData, activeStoragePath: e.target.value })}
                  placeholder="/media/pi/hdd_medical"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-800 font-mono font-semibold focus:border-emerald-500 focus:outline-none dir-ltr text-right"
                />

                {/* Presets */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {HDD_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          activeStoragePath: p.path,
                          driveLabel: p.label,
                        })
                      }
                      className={`p-2.5 text-right rounded-xl border text-[11px] transition ${
                        formData.activeStoragePath === p.path
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-slate-800">
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                        {p.label}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 dir-ltr text-right truncate">
                        {p.path}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="border border-slate-200 bg-slate-50/60 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  اتوماسیون اسکن و اندکس‌گذاری تصاویر
                </h4>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="font-medium text-slate-800">سازماندهی خودکار بر اساس تاریخ</span>
                    <p className="text-[10px] text-slate-500">ایجاد خودکار پوشه‌های سال/ماه بر روی هارد دیسک</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoOrganizeByDate}
                    onChange={(e) => setFormData({ ...formData, autoOrganizeByDate: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="font-medium text-slate-800">اندکس‌گذاری هوشمند شماره پرونده</span>
                    <p className="text-[10px] text-slate-500">شناسایی پوشه‌های بیماران و تطبیق با پایگاه داده</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoIndexPatients}
                    onChange={(e) => setFormData({ ...formData, autoIndexPatients: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* Auto Scan Slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">بازه زمانی اسکن خودکار هارد:</span>
                    <span className="text-emerald-700 font-bold">{formData.autoScanIntervalSeconds} ثانیه</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    value={formData.autoScanIntervalSeconds}
                    onChange={(e) => setFormData({ ...formData, autoScanIntervalSeconds: Number(e.target.value) })}
                    className="w-full accent-emerald-600 bg-slate-200 rounded-lg h-1.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={isScanning}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-200 transition"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-600 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'در حال اسکن هارد...' : 'اسکن دستی مجدد هارد'}
                </button>

                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-emerald-600 text-xs flex items-center gap-1 font-bold animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4" />
                      تنظیمات ذخیره شد
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    ذخیره تغییرات
                  </button>
                </div>
              </div>

              {recentScanLog && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {recentScanLog}
                </div>
              )}
            </form>
          )}

          {activeTab === 'hardware' && telemetry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* CPU Temp */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-amber-500" />
                      دمای پردازنده (CPU)
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-600">
                    {telemetry.cpuTemperatureC}°C
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        telemetry.cpuTemperatureC > 65 ? 'bg-rose-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, (telemetry.cpuTemperatureC / 85) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">محدوده ایمن کاری رزبری‌پای 4B: زیر ۶۵ درجه</p>
                </div>

                {/* RAM Usage */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-sky-600" />
                      حافظه رم (RAM)
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-sky-600">
                    {telemetry.ramUsageMb} <span className="text-xs font-normal text-slate-500">/ {telemetry.ramTotalMb} MB</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${(telemetry.ramUsageMb / telemetry.ramTotalMb) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">مصرف لایه پردازش و حافظه موقت</p>
                </div>

                {/* Disk Space */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-emerald-600" />
                      فضای هارد دیسک
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600">
                    {(telemetry.diskTotalGb - telemetry.diskUsedGb).toFixed(1)}{' '}
                    <span className="text-xs font-normal text-slate-500">GB آزاد</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(telemetry.diskUsedGb / telemetry.diskTotalGb) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    کل فضا: {telemetry.diskTotalGb} GB (مصرف‌شده: {telemetry.diskUsedGb} GB)
                  </p>
                </div>
              </div>

              {/* Hardware Summary Card */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2 text-xs">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  مشخصات اتصال هارد درایو و رزبری‌پای
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    عنوان درایو فعال: <span className="text-slate-900 font-bold">{telemetry.activeDriveName}</span>
                  </div>
                  <div>
                    آدرس آی‌پی رزبری‌پای: <span className="text-emerald-700 font-mono font-bold dir-ltr inline-block">{telemetry.localIp}</span>
                  </div>
                  <div>
                    زمان فعالیت پیوسته (Uptime):{' '}
                    <span className="text-slate-900 font-mono font-semibold">
                      {Math.floor(telemetry.uptimeSeconds / 3600)} ساعت و {Math.floor((telemetry.uptimeSeconds % 3600) / 60)} دقیقه
                    </span>
                  </div>
                  <div>
                    وضعیت هارد دیسک:{' '}
                    <span className="text-emerald-600 font-bold">متصل و آماده خواندن/نوشتن</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>آخرین لاگ‌های رویداد هارد و پردازش رزبری‌پای</span>
                <span className="text-emerald-700 font-mono text-[11px] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  بروزرسانی زنده
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-72 overflow-y-auto space-y-2 font-mono text-[11px]">
                {liveLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">هیچ لاگی ثبت نشده است.</div>
                ) : (
                  liveLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 shadow-2xs hover:border-emerald-300 transition"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              log.level === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : log.level === 'DRIVE'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : log.level === 'WARN'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : log.level === 'ERROR'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.level}
                          </span>
                          <span className="text-slate-500 font-medium">{log.source}</span>
                        </div>
                        <span className="text-slate-400">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-800 text-xs font-sans font-medium">{log.message}</p>
                      {log.details && <p className="text-[10px] text-slate-500 font-sans">{log.details}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
