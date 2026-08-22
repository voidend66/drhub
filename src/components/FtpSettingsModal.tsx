import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Settings, 
  Radio, 
  Folder, 
  Check, 
  Camera, 
  Save 
} from 'lucide-react';

export interface FtpConfigData {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  storagePath: string;
  autoOrganizeByDate: boolean;
  passiveMode: boolean;
}

interface FtpSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FtpConfigData;
  onSaveConfig: (newConfig: FtpConfigData) => void;
}

export const FtpSettingsModal: React.FC<FtpSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<FtpConfigData>(config);
  const [activeTab, setActiveTab] = useState<'config' | 'guide'>('config');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                تنظیمات سرور FTP
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                پیکربندی دریافت خودکار عکس‌ها از دوربین
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 pt-2 bg-white">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>مشخصات اتصال</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>راهنمای دوربین</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'config' ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Status Banner */}
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>سرور FTP: <strong className="text-emerald-900">آماده دریافت</strong></span>
                </div>
                <span className="font-mono-numbers bg-emerald-100/70 px-2 py-0.5 rounded text-emerald-800 text-[11px] font-bold">
                  Port {formData.port}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* IP Address */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    آی‌پی سرور (Host IP):
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Port */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    پورت (Port):
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) || 2121 })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    نام کاربری (User):
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    رمز عبور:
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Storage Path */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  مسیر پوشه ذخیره‌سازی:
                </label>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.storagePath}
                    onChange={(e) => setFormData({ ...formData, storagePath: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono-numbers focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="pt-1.5 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formData.autoOrganizeByDate}
                    onChange={(e) => setFormData({ ...formData, autoOrganizeByDate: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>پوشه‌بندی خودکار بر اساس تاریخ</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={formData.passiveMode}
                    onChange={(e) => setFormData({ ...formData, passiveMode: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>حالت Passive Mode</span>
                </label>
              </div>

              {/* Save Button */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>ذخیره شد</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>ذخیره تنظیمات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Guide Tab */
            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1.5">
                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                  <span>مراحل اتصال دوربین سونی (Sony Alpha):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pr-1">
                  <li>دوربین را به وای‌فای متصل کنید.</li>
                  <li>وارد <strong>Network ➔ Transfer/FTP ➔ FTP Transfer Func</strong> شوید.</li>
                  <li>آی‌پی <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-emerald-800 font-bold">{formData.ipAddress}</code> و پورت <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-emerald-800 font-bold">{formData.port}</code> را وارد کنید.</li>
                  <li>نام کاربری <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-200 font-mono text-emerald-800 font-bold">{formData.username}</code> را وارد کنید.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-slate-600" />
                  <span>دوربین کانن (Canon EOS):</span>
                </h4>
                <p className="text-slate-600">
                  در منوی <strong>Wi-Fi function ➔ Transfer images to FTP</strong> همان آی‌پی و پورت بالا را وارد نمایید.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
