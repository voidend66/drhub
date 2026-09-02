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
  const [activeTab, setActiveTab] = useState<'config' | 'database' | 'hardware' | 'logs'>('config');
  const [formData, setFormData] = useState<DriveStorageConfig>(currentConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [liveLogs, setLiveLogs] = useState<SystemLogEntry[]>([]);
  const [recentScanLog, setRecentScanLog] = useState<string | null>(null);

  // SQLite Database States
  const [sqlitePath, setSqlitePath] = useState<string>(
    currentConfig.sqliteDbPath || '/media/mahdi/mm/doctor/patients.db'
  );
  const [sqliteStatus, setSqliteStatus] = useState(telemetry?.sqliteStatus || null);
  const [isSavingDbPath, setIsSavingDbPath] = useState(false);
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbFeedback, setDbFeedback] = useState<{ type: 'success' | 'error' | 'warn'; message: string } | null>(null);

  useEffect(() => {
    setFormData(currentConfig);
    if (currentConfig.sqliteDbPath) {
      setSqlitePath(currentConfig.sqliteDbPath);
    }
  }, [currentConfig]);

  useEffect(() => {
    if (telemetry?.sqliteStatus) {
      setSqliteStatus(telemetry.sqliteStatus);
    }
  }, [telemetry?.sqliteStatus]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/logs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLiveLogs(data.slice(0, 15)))
      .catch(() => {});

    // Fetch initial SQLite status
    fetch('/api/database/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSqliteStatus(data);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const HDD_PRESETS = [
    { label: 'هارد اکسترنال (fstab / USB 3.0)', path: '/mnt/external_hdd/medical_photos', desc: 'مسیر استاندارد مانت دائم هارد اکسترنال با fstab' },
    { label: 'هارد اکسترنال دسکتاپ (Raspberry Pi OS)', path: '/media/pi/hdd_medical', desc: 'مسیر پیش‌فرض خودکار در رزبری‌پای دسکتاپ' },
    { label: 'حافظه داخلی رزبری‌پای (MicroSD/SSD)', path: '/var/app_data/medical_storage', desc: 'مسیر محلی در کارت حافظه/حافظه داخلی سیستم‌عامل' },
    { label: 'حافظه داخلی (پوشه پروژه)', path: './medical_storage', desc: 'پوشه محلی درون شاخه اجرای پروژه' },
  ];

  const SQLITE_PRESETS = [
    { label: 'هارد اکسترنال پزشک (پیش‌فرض)', path: '/media/mahdi/mm/doctor/patients.db', desc: 'مسیر اختصاصی هارد دیسک مطب' },
    { label: 'هارد اکسترنال کلینیک', path: '/mnt/external_hdd/medical_photos/patients.db', desc: 'مانت دائمی USB در fstab' },
    { label: 'حافظه داخلی سیستم', path: '/var/app_data/medical_storage/patients.db', desc: 'ذخیره در دیسک داخلی رزبری‌پای' },
    { label: 'پوشه محلی پروژه', path: './medical_storage/doctor/patients.db', desc: 'مسیر لوکال در شاخه برنامه' },
  ];

  const handleSaveSqliteConfig = async (pathToSave?: string) => {
    const targetPath = pathToSave || sqlitePath;
    setIsSavingDbPath(true);
    setDbFeedback(null);
    try {
      const res = await fetch('/api/database/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sqliteDbPath: targetPath })
      });
      const data = await res.json();
      if (res.ok) {
        setSqliteStatus(data.status);
        if (data.isFallback) {
          setDbFeedback({
            type: 'warn',
            message: `دیتابیس در مسیر امن فعال شد. مسیر درخواستی در دسترس نبود.`
          });
        } else {
          setDbFeedback({
            type: 'success',
            message: `پایگاه داده SQLite با موفقیت در مسیر "${data.status?.actualPath}" متصل شد.`
          });
        }
        // Also update parent config
        onSaveConfig({ ...formData, sqliteDbPath: targetPath });
      } else {
        setDbFeedback({ type: 'error', message: data.error || 'خطا در ذخیره مسیر دیتابیس' });
      }
    } catch (err: any) {
      setDbFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSavingDbPath(false);
    }
  };

  const handleSyncSqlite = async () => {
    setIsSyncingDb(true);
    setDbFeedback(null);
    try {
      const res = await fetch('/api/database/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSqliteStatus(data.status);
        setDbFeedback({
          type: 'success',
          message: `همگام‌سازی کامل انجام شد. هم‌اکنون ${data.status?.patientsCount} پرونده و ${data.status?.photosCount} عکس در SQLite ذخیره شده است.`
        });
      } else {
        setDbFeedback({ type: 'error', message: data.error || 'خطا در همگام‌سازی' });
      }
    } catch (err: any) {
      setDbFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSyncingDb(false);
    }
  };

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
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'config'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            مسیر و تنظیمات هارد
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'database'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Database className="w-4 h-4" />
            دیتابیس SQLite بیماران
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'hardware'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            سخت‌افزار رزبری‌پای
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition ${
              activeTab === 'logs'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Terminal className="w-4 h-4" />
            لاگ‌ها ({liveLogs.length})
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

          {/* SQLite Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-5 animate-fadeIn">
              {/* SQLite Info Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 border border-slate-700 shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        پایگاه داده SQLite بیماران (Embedded SQL)
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          sqliteStatus?.isConnected 
                            ? (sqliteStatus.isFallback ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}>
                          {sqliteStatus?.isConnected ? (sqliteStatus.isFallback ? 'مسیر فال‌بک امن' : 'متصل و فعال') : 'قطع اتصال'}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        ذخیره و مدیریت مستقل رکوردهای بیماران و متادیتای تصاویر در یک پایگاه داده سبک و پرسرعت SQL
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">تعداد بیماران در SQL</span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {sqliteStatus?.patientsCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">تصاویر ثبت‌شده</span>
                  <span className="text-xl font-black font-mono text-sky-700">
                    {sqliteStatus?.photosCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">حجم فایل دیتابیس</span>
                  <span className="text-xl font-black font-mono text-amber-700">
                    {sqliteStatus?.fileSizeFormatted || '0 بایت'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">مجوز دسترسی (Write)</span>
                  <span className={`text-xs font-bold font-mono px-2 py-1 rounded-md inline-block ${
                    sqliteStatus?.isWritable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {sqliteStatus?.isWritable ? 'قابل نوشتن (OK)' : 'فقط خواندنی'}
                  </span>
                </div>
              </div>

              {/* Database Path Configuration */}
              <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-1.5">
                    <Folder className="w-4 h-4 text-emerald-600" />
                    مسیر فایل پایگاه داده SQLite بر روی هارد دیسک
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    می‌توانید مسیر دلخواه روی هارد دیسک مطب یا کارت حافظه رزبری‌پای را مشخص کنید.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sqlitePath}
                      onChange={(e) => setSqlitePath(e.target.value)}
                      placeholder="/media/mahdi/mm/doctor/patients.db"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-emerald-800 font-mono font-semibold focus:border-emerald-500 focus:outline-none dir-ltr text-right"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveSqliteConfig()}
                      disabled={isSavingDbPath}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shrink-0 transition"
                    >
                      {isSavingDbPath ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      اعمال مسیر
                    </button>
                  </div>
                </div>

                {/* Database Path Presets */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-600 block">مسیرهای پیش‌فرض پیشنهادی:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SQLITE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSqlitePath(p.path);
                          handleSaveSqliteConfig(p.path);
                        }}
                        className={`p-2.5 text-right rounded-xl border text-[11px] transition ${
                          sqlitePath === p.path || sqliteStatus?.actualPath === p.path
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5 text-slate-800">
                          <Database className="w-3.5 h-3.5 text-emerald-600" />
                          {p.label}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 dir-ltr text-right truncate">
                          {p.path}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Path Details */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">مسیر فعال کنونی فایل:</span>
                    <span className="font-mono text-emerald-800 font-semibold dir-ltr truncate max-w-[280px]">
                      {sqliteStatus?.actualPath || 'در حال بارگذاری...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">وضعیت دایرکتوری در سیستم‌عامل:</span>
                    <span className="font-medium text-slate-700">
                      {sqliteStatus?.directoryExists ? 'دایرکتوری موجود و آماده است' : 'دایرکتوری هنوز ایجاد نشده'}
                    </span>
                  </div>
                  {sqliteStatus?.statusMessage && (
                    <p className={`text-[11px] font-medium pt-1 ${
                      sqliteStatus.isFallback ? 'text-amber-700' : 'text-slate-600'
                    }`}>
                      {sqliteStatus.statusMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Sync and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSyncSqlite}
                  disabled={isSyncingDb}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 border border-slate-200 transition"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncingDb ? 'animate-spin' : ''}`} />
                  {isSyncingDb ? 'در حال همگام‌سازی...' : 'همگام‌سازی فوری دیتابیس با داده‌های برنامه'}
                </button>

                <div className="text-[11px] text-slate-500">
                  فرمت فایل: SQLite 3 با قابلیت WAL و تراکنش‌های امن
                </div>
              </div>

              {/* Feedback Alert */}
              {dbFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn font-medium ${
                  dbFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : dbFeedback.type === 'warn'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {dbFeedback.message}
                </div>
              )}
            </div>
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
                  <p className="text-[10px] text-slate-500">محدوده ایمن کاری رزبری‌پای: زیر ۶۵ درجه</p>
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

                {/* Active Storage Partition */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-emerald-600" />
                      درایو فعال ذخیره‌سازی
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600">
                    {telemetry.diskFreeGb ?? (telemetry.diskTotalGb - telemetry.diskUsedGb).toFixed(1)}{' '}
                    <span className="text-xs font-normal text-slate-500">GB آزاد</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${
                        (telemetry.diskUsagePercent || 0) >= 90 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${telemetry.diskUsagePercent || (telemetry.diskTotalGb > 0 ? (telemetry.diskUsedGb / telemetry.diskTotalGb) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    کل: {telemetry.diskTotalGb} GB (مصرف: {telemetry.diskUsedGb} GB - {telemetry.diskUsagePercent || 0}%)
                  </p>
                </div>
              </div>

              {/* Storage Partitions Detailed Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Internal Storage Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-slate-600" />
                      حافظه داخلی رزبری‌پای (MicroSD/SSD)
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      Internal OS
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono dir-ltr text-right truncate">
                    {telemetry.internalStorage?.path || process.cwd()}
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold pt-1">
                    <span className="text-slate-600">فضای کل / آزاد:</span>
                    <span className="font-mono text-slate-900">
                      {telemetry.internalStorage?.freeGb || 0} GB آزاد از {telemetry.internalStorage?.totalGb || 0} GB
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-slate-700 transition-all"
                      style={{ width: `${telemetry.internalStorage?.usagePercent || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>درصد مصرف: {telemetry.internalStorage?.usagePercent || 0}%</span>
                    <span>وضعیت: {telemetry.internalStorage?.isWritable ? 'قابل نوشتن (OK)' : 'فقط خواندنی'}</span>
                  </div>
                </div>

                {/* External HDD Card */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-emerald-600" />
                      هارد اکسترنال (USB HDD/SSD)
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      External Drive
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono dir-ltr text-right truncate">
                    {telemetry.externalStorage?.path || '/mnt/external_hdd/medical_photos'}
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold pt-1">
                    <span className="text-slate-600">فضای کل / آزاد:</span>
                    <span className="font-mono text-emerald-800 font-bold">
                      {telemetry.externalStorage?.freeGb || 0} GB آزاد از {telemetry.externalStorage?.totalGb || 0} GB
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${telemetry.externalStorage?.usagePercent || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span>درصد مصرف: {telemetry.externalStorage?.usagePercent || 0}%</span>
                    <span>وضعیت: {telemetry.externalStorage?.exists ? 'متصل و آماده' : 'عدم شناسایی درایو'}</span>
                  </div>
                </div>
              </div>

              {/* Hardware Summary Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  مشخصات اتصال هارد درایو و رزبری‌پای
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div>
                    عنوان درایو فعال: <span className="text-emerald-300 font-bold">{telemetry.activeDriveName}</span>
                  </div>
                  <div>
                    آدرس آی‌پی رزبری‌پای: <span className="text-emerald-400 font-mono font-bold dir-ltr inline-block">{telemetry.localIp}</span>
                  </div>
                  <div>
                    زمان فعالیت پیوسته (Uptime):{' '}
                    <span className="text-slate-200 font-mono font-semibold">
                      {Math.floor(telemetry.uptimeSeconds / 3600)} ساعت و {Math.floor((telemetry.uptimeSeconds % 3600) / 60)} دقیقه
                    </span>
                  </div>
                  <div>
                    نوع ذخیره‌سازی فعال:{' '}
                    <span className="text-emerald-400 font-bold">{telemetry.storageTypeLabel || 'هارد درایو محلی'}</span>
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
