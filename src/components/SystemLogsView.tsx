import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Activity,
  Search,
  Trash2,
  Download,
  Play,
  Pause,
  RefreshCw,
  HardDrive,
  Info,
  Clock,
  Zap
} from 'lucide-react';
import { SystemLogEntry, PiSystemTelemetry } from '../types';

interface SystemLogsViewProps {
  telemetry: PiSystemTelemetry | null;
  onTriggerRescan: () => Promise<void>;
}

export const SystemLogsView: React.FC<SystemLogsViewProps> = ({ telemetry, onTriggerRescan }) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load initial logs and subscribe to SSE
  useEffect(() => {
    fetch('/api/logs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SystemLogEntry[]) => setLogs(data))
      .catch(() => {});

    if (isStreaming) {
      const es = new EventSource('/api/logs/stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'INIT' && Array.isArray(parsed.logs)) {
            setLogs(parsed.logs);
          } else if (parsed.id && parsed.level) {
            setLogs((prev) => [parsed, ...prev.slice(0, 199)]);
          }
        } catch (e) {
          console.error('SSE log parse error:', e);
        }
      };

      es.onerror = () => {
        es.close();
      };

      return () => {
        es.close();
      };
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  }, [isStreaming]);

  // Polling fallback every 3 seconds
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      fetch('/api/logs')
        .then((r) => (r.ok ? r.json() : []))
        .then((data: SystemLogEntry[]) => setLogs(data))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      await onTriggerRescan();
      const res = await fetch('/api/logs');
      if (res.ok) {
        const fresh = await res.json();
        setLogs(fresh);
      }
    } catch (err) {
      console.error('Rescan error:', err);
    } finally {
      setIsRescanning(false);
    }
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pi_drive_system_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesQuery =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.fileName && log.fileName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLevel = selectedLevelFilter === 'ALL' || log.level === selectedLevelFilter;

    return matchesQuery && matchesLevel;
  });

  const levelCounts = {
    ALL: logs.length,
    DRIVE: logs.filter((l) => l.level === 'DRIVE').length,
    SUCCESS: logs.filter((l) => l.level === 'SUCCESS').length,
    INFO: logs.filter((l) => l.level === 'INFO').length,
    WARN: logs.filter((l) => l.level === 'WARN').length,
    ERROR: logs.filter((l) => l.level === 'ERROR').length,
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
            <Terminal className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">سیستم لاگ‌گیری و پایش زنده هارد رزبری‌پای</h2>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Log Daemon
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              ثبت رویدادهای زنده اسکن هارد، تغییرات پوشه‌ها، نمایه عکس‌های پزشکی و سلامت سخت‌افزار
            </p>
          </div>
        </div>

        {/* Quick System Telemetry Pills */}
        {telemetry && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 text-xs font-mono">
            <div className="px-3 py-1.5 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center gap-2 text-slate-700 font-semibold shrink-0">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
              <span>{telemetry.activeDriveName || 'هارد اکسترنال'}</span>
            </div>
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-800 font-semibold shrink-0">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>{telemetry.cpuTemperatureC}°C</span>
            </div>
            <div className="px-3 py-1.5 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-2 text-sky-800 font-semibold shrink-0">
              <Activity className="w-3.5 h-3.5 text-sky-600" />
              <span>{telemetry.ramUsageMb} MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در متن لاگ‌ها، نام فایل، دایرکتوری یا منبع..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold py-1 md:py-0">
          {[
            { id: 'ALL', label: 'همه', count: levelCounts.ALL, color: 'text-slate-700' },
            { id: 'DRIVE', label: 'هارد دیسک', count: levelCounts.DRIVE, color: 'text-sky-700' },
            { id: 'SUCCESS', label: 'موفقیت', count: levelCounts.SUCCESS, color: 'text-emerald-700' },
            { id: 'INFO', label: 'اطلاعات', count: levelCounts.INFO, color: 'text-slate-600' },
            { id: 'WARN', label: 'هشدار', count: levelCounts.WARN, color: 'text-amber-700' },
            { id: 'ERROR', label: 'خطا', count: levelCounts.ERROR, color: 'text-rose-700' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedLevelFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 shrink-0 ${
                selectedLevelFilter === item.id
                  ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={selectedLevelFilter === item.id ? 'text-white' : item.color}>{item.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                selectedLevelFilter === item.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 justify-end">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            title={isStreaming ? 'توقف دریافت زنده' : 'ادامه دریافت زنده'}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              isStreaming
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isStreaming ? 'پایان استریم' : 'شروع استریم'}</span>
          </button>

          <button
            onClick={handleRescan}
            disabled={isRescanning}
            title="اسکن دستی مجدد هارد"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRescanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">اسکن هارد</span>
          </button>

          <button
            onClick={handleExportLogs}
            title="خروجی JSON"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearLogs}
            title="پاکسازی لاگ‌ها"
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Terminal-Style Logs Container */}
      <div
        ref={logContainerRef}
        className="bg-white border border-slate-200 rounded-3xl p-4 min-h-[500px] max-h-[700px] overflow-y-auto space-y-2 font-mono shadow-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-24 text-slate-400 space-y-3 font-sans">
            <Terminal className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-medium">هیچ لاگ یا رویدادی منطبق با فیلتر یافت نشد.</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                className={`group p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                  log.level === 'SUCCESS'
                    ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400'
                    : log.level === 'DRIVE'
                    ? 'bg-sky-50/30 border-sky-200 hover:border-sky-400'
                    : log.level === 'WARN'
                    ? 'bg-amber-50/30 border-amber-200 hover:border-amber-400'
                    : log.level === 'ERROR'
                    ? 'bg-rose-50/30 border-rose-200 hover:border-rose-400'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${
                        log.level === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : log.level === 'DRIVE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : log.level === 'WARN'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : log.level === 'ERROR'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-slate-600 font-semibold font-sans">{log.source}</span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-[10px] dir-ltr">
                    {log.fileSize && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 font-semibold">
                        {log.fileSize}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {log.timestamp}
                    </span>
                  </div>
                </div>

                <div className="mt-2 font-sans text-xs text-slate-800 font-semibold flex items-center justify-between">
                  <span>{log.message}</span>
                  {log.details && (
                    <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 transition">
                      {isExpanded ? 'بستن جزییات ▲' : 'مشاهده جزییات ▼'}
                    </span>
                  )}
                </div>

                {isExpanded && log.details && (
                  <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-mono space-y-1 animate-fadeIn">
                    <div className="text-slate-500 text-[10px] flex items-center gap-1 font-sans font-bold">
                      <Info className="w-3 h-3 text-emerald-600" />
                      توضیحات تکمیلی سیستم:
                    </div>
                    <div className="text-slate-800 dir-rtl text-right font-sans font-medium">{log.details}</div>
                    {log.fileName && (
                      <div className="text-emerald-700 font-bold text-[10px] dir-ltr text-right">
                        فایل پردازش‌شده: {log.fileName}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
