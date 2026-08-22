import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Radio, 
  Folder, 
  Check, 
  Camera, 
  Save,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  HardDrive,
  Terminal,
  Activity,
  Copy,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { FtpLogEntry, FtpConnectionTestResult } from '../types';

export interface FtpConfigData {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  allowAnonymous: boolean;
  securityMode: 'plain' | 'ftps_explicit';
  requireCertificate: boolean;
  storagePath: string;
  autoOrganizeByDate: boolean;
  passiveMode: boolean;
  passivePortRange?: string;
  maxFileSizeMb?: number;
}

interface FtpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FtpConfigData;
  onSaveConfig: (newConfig: FtpConfigData) => void;
}

const STORAGE_PATH_PRESETS = [
  { label: 'رزبری‌پای (پیش‌فرض)', path: '/home/pi/medical_storage/raw_uploads', desc: 'مسیر استاندارد لینوکس / رزبری‌پای ۴' },
  { label: 'سرور لینوکس / اوبونتو', path: '/var/ftp/medical_photos', desc: 'پوشه سرویس‌دهنده استاندارد vsftpd' },
  { label: 'درایو ویندوز', path: 'D:\\MedicalStorage\\Rhinoplasty', desc: 'مسیر دیسک پرسرعت SSD روی ویندوز' },
  { label: 'حافظه اکسترنال / فلش USB', path: '/media/pi/CAMERA_USB/photos', desc: 'اتصال مستقیم هارد اکسترنال یا فلش' },
  { label: 'فضای اشتراکی تحت شبکه (NAS)', path: '/mnt/nas_storage/clinic_vault', desc: 'سرور فایل مرکزی کلینیک' },
];

export const FtpSettingsModal: React.FC<FtpSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<FtpConfigData>(() => ({
    ...config,
    allowAnonymous: config.allowAnonymous !== undefined ? config.allowAnonymous : true,
    securityMode: config.securityMode || 'plain',
    requireCertificate: Boolean(config.requireCertificate),
    storagePath: config.storagePath || '/home/pi/medical_storage/raw_uploads',
    passivePortRange: config.passivePortRange || '50000-50100'
  }));

  const [activeTab, setActiveTab] = useState<'config' | 'storage' | 'diagnostics' | 'guide'>('config');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Diagnostics & Logs state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<FtpConnectionTestResult | null>(null);
  const [ftpLogs, setFtpLogs] = useState<FtpLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sync state when modal opens or config updates
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...config,
        allowAnonymous: config.allowAnonymous !== undefined ? config.allowAnonymous : true,
        securityMode: config.securityMode || 'plain',
        requireCertificate: Boolean(config.requireCertificate),
        storagePath: config.storagePath || '/home/pi/medical_storage/raw_uploads',
        passivePortRange: config.passivePortRange || '50000-50100'
      });
      setSaveSuccess(false);
    }
  }, [isOpen, config]);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/ftp/logs');
      if (res.ok) {
        const data = await res.json();
        setFtpLogs(data);
      }
    } catch (e) {
      console.warn('Failed to load FTP logs', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Fetch recent logs when switching to diagnostics tab
  useEffect(() => {
    if (isOpen && activeTab === 'diagnostics') {
      loadLogs();
    }
  }, [isOpen, activeTab]);

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ftp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const result = await res.json();
        setTestResult(result);
      }
    } catch (e) {
      console.error('FTP test failed', e);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  تنظیمات اتصال کلاینت به سرور FTP مقصد
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono-numbers">
                  FTP Client
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                اتصال و دریافت خودکار فایل‌ها از سرور FTP مقصد (NAS کلینیک، دوربین Wi-Fi یا سرور مرکزی)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-4 pt-2 bg-slate-50/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>اتصال و احراز هویت</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>مسیر ذخیره‌سازی</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'diagnostics'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>تست اتصال و لاگ‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-800 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>راهنمای دوربین‌ها</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: CONNECTION & AUTH */}
          {activeTab === 'config' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Status Banner */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2 text-emerald-900 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>وضعیت سرور: <strong>آنلاین و آماده دریافت تصاویر</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-numbers bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 text-[11px] font-bold border border-emerald-300">
                    Host: {formData.ipAddress}:{formData.port}
                  </span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    {formData.allowAnonymous ? 'ورود ناشناس فعال' : 'رمزدار'}
                  </span>
                </div>
              </div>

              {/* IP & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    آدرس آی‌پی سرور (Host IP):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                      placeholder="192.168.1.150 یا 127.0.0.1"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.ipAddress, 'ip')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded transition-colors"
                      title="کپی آی‌پی"
                    >
                      {copiedField === 'ip' ? 'کپی شد!' : <Copy className="w-3 h-3 inline" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    پورت FTP (Port):
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 2121 })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Anonymous Login Mode vs Custom Credentials */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">حالت ورود ناشناس (Anonymous Login)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowAnonymous}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          allowAnonymous: checked,
                          username: checked ? 'anonymous' : (formData.username === 'anonymous' ? 'clinic_user' : formData.username),
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  با فعال بودن این گزینه، دوربین‌های سونی، کانن یا نیکون بدون نیاز به وارد کردن رمز عبور (تنها با نام کاربری <code>anonymous</code> یا خالی) عکس‌ها را مستقیماً به سرور ارسال می‌کنند.
                </p>

                {!formData.allowAnonymous && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        نام کاربری (Username):
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        رمز عبور (Password):
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="رمز دلخواه"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Security & Certificate Requirement Section */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">امنیت و رمزنگاری ترافیک (SSL / TLS)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, securityMode: 'plain', requireCertificate: false })}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                      formData.securityMode === 'plain'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">حالت Plain FTP (ساده و روان)</span>
                      {formData.securityMode === 'plain' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">
                      بدون نیاز به گواهی SSL/TLS • سازگار با ۱۰۰٪ دوربین‌ها
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, securityMode: 'ftps_explicit' })}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                      formData.securityMode === 'ftps_explicit'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">حالت FTPS (رمزنگاری اختیاری)</span>
                      {formData.securityMode === 'ftps_explicit' && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Explicit TLS • برای شبکه‌های با الزام سازمانی
                    </span>
                  </button>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 pt-1 select-none">
                  <input
                    type="checkbox"
                    checked={!formData.requireCertificate}
                    onChange={(e) => setFormData({ ...formData, requireCertificate: !e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>گواهی امنیتی SSL/TLS غیر اجباری باشد (توصیه شده برای دوربین)</span>
                </label>
              </div>

              {/* Passive Mode & Save Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formData.passiveMode}
                    onChange={(e) => setFormData({ ...formData, passiveMode: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>فعال بودن حالت پسیو (Passive Mode)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تنظیمات ذخیره شد</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>ذخیره و اعمال تنظیمات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          )}

          {/* TAB 2: UNRESTRICTED STORAGE PATH */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <HardDrive className="w-4 h-4 text-emerald-700" />
                  <span>مسیر ذخیره‌سازی کاملاً آزاد و بدون محدودیت</span>
                </div>
                <span>
                  شما می‌توانید هر مسیری از حافظه داخلی رزبری‌پای، هارد اکسترنال متصل به پورت USB، درایو ویندوز یا سرور فایل کلینیک را بدون هیچ محدودیتی وارد کنید.
                </span>
              </div>

              {/* Custom Path Input */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  مسیر ذخیره‌سازی فایل‌های خام (Absolute Custom Path):
                </label>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
                    <Folder className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.storagePath}
                    onChange={(e) => setFormData({ ...formData, storagePath: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                    placeholder="/home/pi/medical_storage/raw_uploads یا D:\Photos"
                  />
                </div>
              </div>

              {/* Storage Presets */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  الگوهای آماده مسیر برای انواع سیستم‌ها:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STORAGE_PATH_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, storagePath: preset.path })}
                      className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                        formData.storagePath === preset.path
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{preset.label}</span>
                        {formData.storagePath === preset.path && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <code className="text-[10px] text-emerald-800 font-mono text-left block truncate dir-ltr">
                        {preset.path}
                      </code>
                      <span className="text-[9px] text-slate-500">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Passive port range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    محدوده پورت‌های پسیو (Passive Port Range):
                  </label>
                  <input
                    type="text"
                    value={formData.passivePortRange}
                    onChange={(e) => setFormData({ ...formData, passivePortRange: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500"
                    placeholder="50000-50100"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none py-2">
                    <input
                      type="checkbox"
                      checked={formData.autoOrganizeByDate}
                      onChange={(e) => setFormData({ ...formData, autoOrganizeByDate: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span>دسته‌بندی خودکار فایل‌ها در پوشه سال/ماه</span>
                  </label>
                </div>
              </div>

              {/* Save Button in Storage Tab */}
              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    onSaveConfig(formData);
                    setSaveSuccess(true);
                    setTimeout(() => {
                      setSaveSuccess(false);
                      onClose();
                    }, 1000);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>ذخیره مسیر انتخابی</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: LIVE DIAGNOSTICS & FTP LOGS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              
              {/* Test Connection Button */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-emerald-400 flex items-center gap-1.5">
                    <Activity className="w-4 h-4" />
                    <span>تست زنده اتصال سرور و دسترسی دیسک</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    بررسی پورت {formData.port}، مسیر {formData.storagePath} و قابلیت ورود بدون رمز
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={isTesting}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'در حال ارزیابی...' : 'اجرای تست اتصال'}</span>
                </button>
              </div>

              {/* Test Results Output */}
              {testResult && (
                <div className={`p-3.5 rounded-xl border font-mono-numbers text-xs space-y-1.5 animate-in fade-in duration-200 ${
                  testResult.isLive
                    ? 'bg-slate-900 border-emerald-500/50 text-slate-200'
                    : 'bg-rose-950/40 border-rose-800 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-bold">
                    <span className="flex items-center gap-1.5">
                      {testResult.isLive ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className={testResult.isLive ? 'text-emerald-400' : 'text-rose-400'}>
                        نتیجه ارزیابی سرور FTP ({testResult.checkedAt})
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      testResult.isLive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {testResult.isLive ? 'اتصال موفق و فعال' : 'اتصال برقرار نشد'}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1 text-[11px]">
                    {testResult.logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={testResult.isLive ? 'text-emerald-500 font-bold' : 'text-rose-400 font-bold'}>›</span>
                        <span className={testResult.isLive ? 'text-slate-300' : 'text-rose-200'}>{log}</span>
                      </div>
                    ))}
                  </div>

                  {testResult.error && (
                    <div className="mt-2 p-2 rounded bg-rose-900/50 border border-rose-700 text-rose-200 text-[11px]">
                      <strong>علت خطا:</strong> {testResult.error}
                    </div>
                  )}
                </div>
              )}

              {/* Real-time FTP Server Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-700" />
                    <span>لاگ‌های زنده تراکنش‌های سرور FTP:</span>
                  </span>
                  <button
                    onClick={loadLogs}
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>تازه‌سازی لاگ‌ها</span>
                  </button>
                </div>

                <div className="bg-slate-900 rounded-xl p-3 max-h-52 overflow-y-auto text-[11px] font-mono-numbers text-slate-300 space-y-2 border border-slate-800">
                  {isLoadingLogs ? (
                    <div className="text-center py-4 text-slate-500">در حال دریافت لاگ‌ها...</div>
                  ) : ftpLogs.length === 0 ? (
                    <div className="text-center py-4 text-slate-500">هیچ رویدادی ثبت نشده است.</div>
                  ) : (
                    ftpLogs.map((log) => (
                      <div key={log.id} className="border-b border-slate-800/80 pb-1.5 last:border-b-0">
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                          <span>{log.timestamp} • IP: {log.clientIp} ({log.clientName})</span>
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            log.isSuccess ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                        <p className="text-slate-200 mt-0.5">{log.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: STEP-BY-STEP CAMERA GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              
              {/* Quick Connection Parameters Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
                <span className="text-xs font-bold text-emerald-400 block">
                  اطلاعات وارد کردن در منوی دوربین:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono-numbers text-xs">
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">IP Server:</span>
                    <span className="font-bold text-white">{formData.ipAddress}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Port:</span>
                    <span className="font-bold text-emerald-400">{formData.port}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">User:</span>
                    <span className="font-bold text-white">{formData.allowAnonymous ? 'anonymous' : formData.username}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">SSL/TLS:</span>
                    <span className="font-bold text-emerald-400">خاموش (Off)</span>
                  </div>
                </div>
              </div>

              {/* Sony Guide */}
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1.5">
                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>دوربین‌های سونی (Sony Alpha 7 IV / 7R V / FX3 / A1):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pr-1">
                  <li>از منوی <strong>Network</strong> دوربین به Wi-Fi متصل شوید.</li>
                  <li>وارد <strong>Transfer/FTP ➔ FTP Transfer Func ➔ Server Setting</strong> شوید.</li>
                  <li>یک سرور جدید بسازید، <strong>Destination IP</strong> را برابر با <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-emerald-800 font-bold">{formData.ipAddress}</code> قرار دهید.</li>
                  <li>پورت را روی <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-emerald-800 font-bold">{formData.port}</code> بگذارید.</li>
                  <li>گزینه <strong>Anonymous</strong> را روی <strong>ON</strong> بگذارید و <strong>Secure Protocol</strong> را خاموش کنید.</li>
                  <li>گزینه <strong>Auto Transfer</strong> را فعال کنید تا با هر بار فشردن دکمه شاتر، عکس فوراً به صندوق ورودی ارسال شود.</li>
                </ol>
              </div>

              {/* Canon Guide */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-slate-700" />
                  <span>دوربین‌های کانن (Canon EOS R5 / R6 / R8):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pr-1">
                  <li>در منوی زرد رنگ، وارد <strong>Wi-Fi settings ➔ Wi-Fi function ➔ Transfer images to FTP</strong> شوید.</li>
                  <li><strong>FTP Mode</strong> را روی <strong>FTP (نه FTPS)</strong> بگذارید.</li>
                  <li>آدرس IP و پورت {formData.port} را وارد کرده و در بخش لاگین، <strong>Anonymous</strong> را انتخاب کنید.</li>
                </ol>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
