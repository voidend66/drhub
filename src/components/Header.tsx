import React from 'react';
import { 
  Camera, 
  FolderSync, 
  Users, 
  Columns, 
  Volume2, 
  VolumeX, 
  Settings
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'inbox' | 'patients' | 'compare';
  setActiveTab: (tab: 'inbox' | 'patients' | 'compare') => void;
  inboxCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenFtpSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  inboxCount,
  soundEnabled,
  onToggleSound,
  onOpenFtpSettings,
}) => {
  return (
    <header id="clinical-header" className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-4 lg:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Clinic Title */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <h1 className="font-extrabold text-base md:text-lg text-slate-800 tracking-tight leading-tight">
                  تصاویر کلینیکال جراحی
                </h1>
                <p className="text-[11px] text-slate-500 font-semibold">
                  دکتر اکبر شهیدی پیام
                </p>
              </div>
              <span className="px-2 py-0.5 text-[11px] font-mono-numbers rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold flex items-center gap-1.5 self-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                FTP فعال
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav id="clinical-nav-tabs" className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner overflow-x-auto w-full md:w-auto justify-center gap-1">
          <button
            id="tab-inbox"
            onClick={() => setActiveTab('inbox')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'inbox'
                ? 'bg-white text-emerald-800 shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FolderSync className={`w-4 h-4 ${activeTab === 'inbox' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>صندوق ورودی</span>
            {inboxCount > 0 && (
              <span className="px-1.5 py-0.2 text-xs font-bold rounded-full font-mono-numbers bg-emerald-600 text-white">
                {inboxCount}
              </span>
            )}
          </button>

          <button
            id="tab-patients"
            onClick={() => setActiveTab('patients')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'patients'
                ? 'bg-white text-emerald-800 shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'patients' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>پرونده بیماران</span>
          </button>

          <button
            id="tab-compare"
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'compare'
                ? 'bg-white text-emerald-800 shadow-xs font-bold border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Columns className={`w-4 h-4 ${activeTab === 'compare' ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>مقایسه قبل و بعد</span>
          </button>
        </nav>

        {/* Action Controls: FTP Settings & Audio */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            id="btn-ftp-settings"
            onClick={onOpenFtpSettings}
            title="تنظیمات سرور FTP"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-700 hover:text-emerald-800 text-xs font-medium shadow-xs transition-all touch-active"
          >
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>تنظیمات FTP</span>
          </button>

          <button
            id="btn-toggle-sound"
            onClick={onToggleSound}
            title={soundEnabled ? 'صدای اعلان فعال است' : 'صدا قطع است'}
            className={`p-2 rounded-xl border transition-all touch-active ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </header>
  );
};

