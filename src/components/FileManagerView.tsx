import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FolderPlus, 
  FileImage, 
  HardDrive, 
  ChevronLeft, 
  ArrowUp, 
  RefreshCw, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Tag, 
  Search, 
  Grid, 
  List, 
  Check, 
  AlertCircle, 
  Copy, 
  ExternalLink,
  Laptop,
  FolderSync,
  Camera,
  Activity,
  Layers
} from 'lucide-react';
import { FileItem, DirectoryListing, MedicalPhoto, Patient } from '../types';

interface FileManagerViewProps {
  currentActiveStoragePath: string;
  onSetActiveStoragePath: (path: string) => void;
  onOpenTagModal?: (photo: MedicalPhoto) => void;
  onSelectPhotoLightbox?: (photo: MedicalPhoto) => void;
  allPhotos: MedicalPhoto[];
  patients: Patient[];
  onPhotosUploaded?: (photos: MedicalPhoto[]) => void;
  serverIp: string;
  serverPort: number;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  currentActiveStoragePath,
  onSetActiveStoragePath,
  onOpenTagModal,
  onSelectPhotoLightbox,
  allPhotos,
  patients,
  serverIp,
  serverPort,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(currentActiveStoragePath || '/home/pi/medical_storage/raw_uploads');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);

  const [isRemoteMode, setIsRemoteMode] = useState<boolean>(false);

  // Load directory items from backend (local or remote FTP)
  const loadDirectory = useCallback(async (path: string, remote: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = remote ? '/api/ftp/remote-list' : '/api/fs/list';
      const bodyPayload = remote 
        ? { remotePath: path, host: serverIp, port: serverPort } 
        : { path };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        const data = await res.json();
        setListing(data);
        setCurrentPath(data.currentPath);
        setIsRemoteMode(remote);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'امکان دسترسی یا خواندن اطلاعات این مسیر وجود ندارد.');
      }
    } catch (e: any) {
      setError(e.message || 'خطا در برقراری ارتباط با سرویس مدیریت فایل سرور');
    } finally {
      setIsLoading(false);
    }
  }, [serverIp, serverPort]);

  useEffect(() => {
    loadDirectory(currentPath, isRemoteMode);
  }, []);

  // Navigate up
  const handleNavigateUp = () => {
    if (listing?.parentPath) {
      loadDirectory(listing.parentPath, isRemoteMode);
    }
  };

  // Open directory
  const handleOpenDirectory = (folderPath: string) => {
    loadDirectory(folderPath, isRemoteMode);
    setSelectedItem(null);
  };

  // Create folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/fs/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: currentPath,
          folderName: newFolderName.trim(),
        }),
      });
      if (res.ok) {
        setNewFolderName('');
        setIsCreatingFolder(false);
        loadDirectory(currentPath);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete item
  const handleDeleteItem = async (item: FileItem) => {
    if (!confirm(`آیا از حذف "${item.name}" اطمینان دارید؟`)) return;
    try {
      await fetch('/api/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemPath: item.path }),
      });
      loadDirectory(currentPath);
    } catch (e) {
      console.error(e);
    }
  };

  // Set as active camera storage path
  const handleSetAsActiveStorage = async (targetPath: string) => {
    onSetActiveStoragePath(targetPath);
    try {
      await fetch('/api/fs/set-active-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPath: targetPath }),
      });
      loadDirectory(currentPath);
    } catch (e) {
      console.error(e);
    }
  };

  // Copy path
  const handleCopyCurrentPath = () => {
    navigator.clipboard.writeText(currentPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // Quick shortcuts in left sidebar
  const QUICK_SHORTCUTS = [
    {
      title: 'سرور FTP مقصد (FTP Server)',
      path: '/',
      isRemote: true,
      icon: <ExternalLink className="w-4 h-4 text-emerald-600" />,
      badge: 'کلاینت FTP',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'مسیر فعال ذخیره شاتر دوربین',
      path: currentActiveStoragePath,
      isRemote: false,
      icon: <FolderSync className="w-4 h-4 text-emerald-600" />,
      badge: 'فعال',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'صندوق ورودی خام (Incoming)',
      path: '/home/pi/medical_storage/raw_uploads/incoming',
      isRemote: false,
      icon: <Camera className="w-4 h-4 text-sky-600" />,
    },
    {
      title: 'پوشه کلیه بیماران (Patients)',
      path: '/home/pi/medical_storage/raw_uploads/patients',
      isRemote: false,
      icon: <Layers className="w-4 h-4 text-indigo-600" />,
    },
    {
      title: 'سرور رزبری‌پای (Pi Storage)',
      path: '/home/pi/medical_storage/raw_uploads',
      isRemote: false,
      icon: <HardDrive className="w-4 h-4 text-slate-600" />,
    },
    {
      title: 'حافظه فلش USB اکسترنال',
      path: '/media/usb_drive_sandisk_64gb',
      isRemote: false,
      icon: <HardDrive className="w-4 h-4 text-amber-600" />,
    },
    {
      title: 'کارت حافظه SD دوربین',
      path: '/media/sdcard_camera',
      isRemote: false,
      icon: <FileImage className="w-4 h-4 text-rose-600" />,
    },
  ];

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  // Filter items
  const filteredItems = (listing?.items || []).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isCurrentActive = currentPath === currentActiveStoragePath;

  return (
    <div className="space-y-4">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
                <span>مرورگر فایل و مدیریت ساختار پوشه‌ها</span>
                <span className="text-xs font-normal text-slate-500 font-mono-numbers">
                  (File Manager)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                مشاهده مستقیم دایرکتوری‌ها، پوشه‌های مرحله‌ای بیماران و انتخاب آزادانه مسیر ذخیره‌سازی
              </p>
            </div>
          </div>
        </div>

        {/* Current Active Storage Target Status */}
        <div className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs w-full md:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold">پوشه مقصد شاترهای ورودی دوربین:</span>
            <span className="font-mono text-slate-700 font-bold truncate max-w-[280px]" dir="ltr">
              {currentActiveStoragePath}
            </span>
          </div>
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            فعال
          </span>
        </div>
      </div>

      {/* Main Grid: Sidebar + Directory Contents */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Sidebar: Quick Mounts & Folders */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span>مسیرها و درایوهای کلینیک</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono-numbers">
                {QUICK_SHORTCUTS.length} حافظه
              </span>
            </div>

            <div className="space-y-1.5">
              {QUICK_SHORTCUTS.map((sc, idx) => {
                const isSelected = currentPath === sc.path && Boolean(sc.isRemote) === isRemoteMode;
                return (
                  <button
                    key={idx}
                    onClick={() => loadDirectory(sc.path, Boolean(sc.isRemote))}
                    className={`w-full text-right p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-2 border ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">{sc.icon}</div>
                      <div className="truncate">
                        <div className="truncate font-semibold">{sc.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate" dir="ltr">
                          {sc.path}
                        </div>
                      </div>
                    </div>
                    {sc.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${sc.badgeColor}`}>
                        {sc.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Storage Device Telemetry Box */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  وضعیت دیسک ذخیره‌سازی:
                </span>
                <span className="font-mono-numbers text-emerald-700 font-bold">118.4 GB خالی</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '22%' }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>مصرف شده: 33.6 GB (22%)</span>
                <span>کل دیسک: 152 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Area: File Manager Explorer */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            
            {/* Toolbar & Breadcrumbs */}
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 space-y-2.5">
              
              {/* Top Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                
                {/* Navigation Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleNavigateUp}
                    disabled={!listing?.parentPath}
                    title="یک مرحله بالاتر (Up)"
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none shadow-xs transition-all touch-active"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => loadDirectory(currentPath)}
                    title="تازه‌سازی لیست فایل‌ها"
                    className={`p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs transition-all touch-active ${
                      isLoading ? 'animate-spin text-emerald-600' : ''
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-xs font-semibold shadow-xs transition-all touch-active"
                  >
                    <FolderPlus className="w-4 h-4 text-emerald-600" />
                    <span>پوشه جدید</span>
                  </button>
                </div>

                {/* Make Active Storage Button */}
                <div className="flex items-center gap-1.5">
                  {!isCurrentActive ? (
                    <button
                      onClick={() => handleSetAsActiveStorage(currentPath)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all touch-active"
                    >
                      <Check className="w-4 h-4" />
                      <span>تنظیم این پوشه به عنوان مقصد FTP</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>مسیر پیش‌فرض ذخیره دوربین</span>
                    </span>
                  )}

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'grid' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="نمایش شبکه‌ای"
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg transition-all ${
                        viewMode === 'list' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="نمایش لیستی"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>

              {/* Breadcrumb Path Bar */}
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono">
                <button
                  onClick={() => loadDirectory('/')}
                  className="text-slate-400 hover:text-emerald-600 transition-colors font-bold"
                  title="ریشه فایل سیستم"
                >
                  /
                </button>
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap flex-1 py-0.5 text-slate-600" dir="ltr">
                  {pathParts.map((part, index) => {
                    const subPath = '/' + pathParts.slice(0, index + 1).join('/');
                    const isLast = index === pathParts.length - 1;
                    return (
                      <React.Fragment key={index}>
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <button
                          onClick={() => loadDirectory(subPath)}
                          className={`hover:text-emerald-700 transition-colors rounded px-1.5 py-0.5 ${
                            isLast
                              ? 'font-bold text-emerald-800 bg-emerald-50 border border-emerald-200'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {part}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Copy Path Button */}
                <button
                  onClick={handleCopyCurrentPath}
                  title="کپی مسیر کامل پوشه"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
                >
                  {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Create New Folder Inline Bar */}
              {isCreatingFolder && (
                <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 animate-in fade-in duration-150">
                  <FolderPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="نام پوشه جدید (مثلاً: 09_Pre_Op_Side یا Patient_Photos)"
                    autoFocus
                    className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ایجاد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs transition-colors"
                  >
                    انصراف
                  </button>
                </form>
              )}

              {/* Search Filter Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در این پوشه..."
                  className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Items Container */}
            <div className="p-4 min-h-[360px] max-h-[560px] overflow-y-auto">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                  <p className="text-xs font-semibold text-slate-500">در حال دریافت محتوای پوشه از سرور...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Folder className="w-12 h-12 text-slate-300 stroke-[1.2]" />
                  <p className="text-sm font-semibold text-slate-600">این پوشه خالی است</p>
                  <p className="text-xs text-slate-400">تصاویر دریافتی از دوربین یا پوشه‌های جدید در این محل قرار می‌گیرند.</p>
                  <button
                    onClick={() => handleSetAsActiveStorage(currentPath)}
                    className="mt-2 text-xs text-emerald-700 font-bold hover:underline"
                  >
                    + ذخیره عکس‌های جدید دوربین در این پوشه
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredItems.map((item, idx) => {
                    const isFolder = item.type === 'directory';
                    const matchedPhoto = allPhotos.find(
                      (p) => p.filePath === item.path || item.path.endsWith(p.fileName)
                    );

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        onDoubleClick={() => isFolder && handleOpenDirectory(item.path)}
                        className={`group relative rounded-xl border p-3 flex flex-col items-center text-center transition-all cursor-pointer select-none ${
                          selectedItem?.path === item.path
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isFolder ? (
                          <div
                            onClick={() => handleOpenDirectory(item.path)}
                            className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-2 group-hover:scale-105 transition-transform"
                          >
                            <Folder className="w-7 h-7 fill-amber-400 text-amber-600" />
                          </div>
                        ) : (
                          <div className="w-full aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden mb-2 relative group-hover:shadow-xs transition-shadow">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <FileImage className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 px-1 py-0.2 text-[9px] font-mono font-bold bg-slate-900/80 text-white rounded">
                              {item.extension || 'JPG'}
                            </span>
                          </div>
                        )}

                        {/* Title & Info */}
                        <span
                          className="text-xs font-semibold text-slate-800 line-clamp-1 w-full break-all"
                          title={item.name}
                        >
                          {item.name}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono-numbers mt-0.5">
                          {isFolder
                            ? `${item.itemsCount || 0} آیتم`
                            : item.sizeFormatted || '14.5 MB'}
                        </span>

                        {/* Quick Hover Actions */}
                        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-xs">
                          {!isFolder && matchedPhoto && onSelectPhotoLightbox && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPhotoLightbox(matchedPhoto);
                              }}
                              title="مشاهده بزرگنمایی"
                              className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isFolder && matchedPhoto && onOpenTagModal && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTagModal(matchedPhoto);
                              }}
                              title="الصاق به پرونده بیمار"
                              className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item);
                            }}
                            title="حذف"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                
                /* List / Table View */
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2.5">نام فایل / پوشه</th>
                        <th className="p-2.5 text-center">نوع</th>
                        <th className="p-2.5 text-center">حجم / تعداد</th>
                        <th className="p-2.5 text-center">تاریخ</th>
                        <th className="p-2.5 text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item, idx) => {
                        const isFolder = item.type === 'directory';
                        const matchedPhoto = allPhotos.find(
                          (p) => p.filePath === item.path || item.path.endsWith(p.fileName)
                        );

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedItem(item)}
                            onDoubleClick={() => isFolder && handleOpenDirectory(item.path)}
                            className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                              selectedItem?.path === item.path ? 'bg-emerald-50/60' : ''
                            }`}
                          >
                            <td className="p-2.5 flex items-center gap-2">
                              {isFolder ? (
                                <Folder className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                              ) : (
                                <FileImage className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                                {item.name}
                              </span>
                            </td>
                            <td className="p-2.5 text-center text-slate-500 font-mono">
                              {isFolder ? 'Folder' : item.extension || 'JPG'}
                            </td>
                            <td className="p-2.5 text-center text-slate-500 font-mono-numbers">
                              {isFolder ? `${item.itemsCount || 0} فایل` : item.sizeFormatted || '—'}
                            </td>
                            <td className="p-2.5 text-center text-slate-400 font-mono-numbers">
                              {item.modifiedAt || 'امروز'}
                            </td>
                            <td className="p-2.5 text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                {isFolder ? (
                                  <button
                                    onClick={() => handleOpenDirectory(item.path)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded font-semibold text-[11px]"
                                  >
                                    باز کردن
                                  </button>
                                ) : (
                                  <>
                                    {matchedPhoto && onSelectPhotoLightbox && (
                                      <button
                                        onClick={() => onSelectPhotoLightbox(matchedPhoto)}
                                        className="p-1 text-slate-500 hover:text-emerald-700 rounded"
                                        title="مشاهده"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {matchedPhoto && onOpenTagModal && (
                                      <button
                                        onClick={() => onOpenTagModal(matchedPhoto)}
                                        className="p-1 text-slate-500 hover:text-emerald-700 rounded"
                                        title="الصاق به پرونده"
                                      >
                                        <Tag className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Status Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 font-mono-numbers">
                  {listing?.totalFolders || 0} پوشه • {listing?.totalFiles || 0} فایل
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-mono text-slate-600 truncate max-w-[320px]" dir="ltr">
                  {currentPath}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono-numbers text-slate-600">
                  سرور: {serverIp}:{serverPort}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
