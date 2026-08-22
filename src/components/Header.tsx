import React from 'react';
import { 
  HardDrive, 
  FolderSync, 
  Users, 
  Columns, 
  Volume2, 
  VolumeX, 
  Settings,
  FolderTree,
  Terminal
} from 'lucide-react';
import { PiSystemTelemetry } from '../types';

interface HeaderProps {
  activeTab: 'inbox' | 'patients' | 'compare' | 'explorer' | 'logs';
  setActiveTab: (tab: 'inbox' | 'patients' | 'compare' | 'explorer' | 'logs') => void;
  inboxCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenDriveSettings: () => void;
  telemetry: PiSystemTelemetry | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  inboxCount,
  soundEnabled,
  onToggleSound,
  onOpenDriveSettings,
  telemetry,
}) => {
  return (
    <header id="clinical-header" className="sticky top-0 z-40 bg-white border-b border-emerald-100 shadow-sm px-4 lg:px-6 py-2.5 text-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Clinic Title */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <HardDrive className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <h1 className="font-extrabold text-base md:text-lg text-slate-900 tracking-tight leading-tight">
                  تصاویر کلینیکال جراحی
                </h1>
                <p className="text-[11px] text-slate-500 font-semibold">
                  دکتر اکبر شهیدی پیام • سیستم هارد رزبری‌پای
                </p>
              </div>
              
              {/* Raspberry Pi HDD Status Badge */}
              <button
                onClick={onOpenDriveSettings}
                title="پایش هارد دیسک و سخت‌افزار رزبری‌پای"
                className="px-2.5 py-1 text-[11px] font-mono rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-1.5 self-center transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>{telemetry ? `${telemetry.cpuTemperatureC}°C | HDD` : 'هارد رزبری‌پای'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav id="clinical-nav-tabs" className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto w-full md:w-auto justify-center gap-1">
          <button
            id="tab-inbox"
            onClick={() => setActiveTab('inbox')}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'inbox'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>صندوق ورودی هارد</span>
            {inboxCount > 0 && (
              <span className={`px-1.5 py-0.2 text-xs font-bold rounded-full font-mono ${
                activeTab === 'inbox' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {inboxCount}
              </span>
            )}
          </button>

          <button
            id="tab-patients"
            onClick={() => setActiveTab('patients')}
            className={`flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'patients'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>پرونده بیماران</span>
          </button>

          <button
            id="tab-compare"
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'compare'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Columns className="w-4 h-4" />
            <span>مقایسه قبل و بعد</span>
          </button>

          <button
            id="tab-explorer"
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'explorer'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>مدیریت هارد (Explorer)</span>
          </button>

          <button
            id="tab-logs"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold transition-all touch-active whitespace-nowrap ${
              activeTab === 'logs'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>لاگ‌های زنده</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            id="btn-drive-settings"
            onClick={onOpenDriveSettings}
            title="تنظیمات هارد دیسک و رزبری‌پای"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold transition-all"
          >
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>تنظیمات هارد</span>
          </button>

          <button
            id="btn-toggle-sound"
            onClick={onToggleSound}
            title={soundEnabled ? 'صدای اعلان فعال است' : 'صدا قطع است'}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

      </div>
    </header>
  );
};
