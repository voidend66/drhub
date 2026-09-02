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
  FolderSync, 
  Camera, 
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
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({
  currentActiveStoragePath,
  onSetActiveStoragePath,
  onOpenTagModal,
  onSelectPhotoLightbox,
  allPhotos,
  patients,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(currentActiveStoragePath || '/media/pi/hdd_medical');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);

  // Load directory items from Raspberry Pi backend
  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        const data = await res.json();
        setListing(data);
        setCurrentPath(data.currentPath);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'امکان دسترسی یا خواندن اطلاعات این مسیر وجود ندارد.');
      }
    } catch (e: any) {
      setError(e.message || 'خطا در برقراری ارتباط با هارد درایو رزبری‌پای');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
  }, []);

  // Navigate up
  const handleNavigateUp = () => {
    if (listing?.parentPath) {
      loadDirectory(listing.parentPath);
    }
  };

  // Open directory
  const handleOpenDirectory = (folderPath: string) => {
    loadDirectory(folderPath);
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
      title: 'هارد اکسترنال کلینیک (fstab)',
      path: '/mnt/external_hdd/medical_photos',
      icon: <HardDrive className="w-4 h-4 text-emerald-600" />,
      badge: 'HDD',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'هارد اکسترنال دسکتاپ (Raspberry Pi OS)',
      path: '/media/pi/hdd_medical',
      icon: <HardDrive className="w-4 h-4 text-emerald-600" />,
      badge: 'Desktop',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'مسیر فعال پردازش شاتر',
      path: currentActiveStoragePath,
      icon: <FolderSync className="w-4 h-4 text-emerald-600" />,
      badge: 'فعال',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      title: 'حافظه داخلی رزبری‌پای (MicroSD/SSD)',
      path: '/var/app_data/medical_storage',
      icon: <HardDrive className="w-4 h-4 text-slate-600" />,
      badge: 'Internal',
      badgeColor: 'bg-slate-200 text-slate-700',
    },
    {
      title: 'حافظه محلی پروژه',
      path: './medical_storage',
      icon: <HardDrive className="w-4 h-4 text-slate-600" />,
      badge: 'App Dir',
      badgeColor: 'bg-slate-200 text-slate-700',
    },
  ];

  // Breadcrumbs
  const renderBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className="flex items-center flex-wrap gap-1 text-xs text-slate-600 font-medium">
        <button
          onClick={() => loadDirectory('/')}
          className="hover:text-emerald-600 flex items-center gap-1 font-mono hover:bg-slate-100 px-1.5 py-0.5 rounded transition"
        >
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span>/</span>
        </button>
        {parts.map((part, index) => {
          const accPath = '/' + parts.slice(0, index + 1).join('/');
          const isLast = index === parts.length - 1;
          return (
            <React.Fragment key={index}>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => loadDirectory(accPath)}
                className={`px-1.5 py-0.5 rounded transition ${
                  isLast
                    ? 'font-bold text-emerald-700 bg-emerald-50'
                    : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-100'
                }`}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const filteredItems = listing?.items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-emerald-600" />
              مدیریت هارد دیسک و فایل‌های رزبری‌پای
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Local Storage
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مشاهده، دسته‌بندی و مدیریت مستقیم پوشه‌های تصاویر پزشکی در هارد دیسک متصل به رزبری‌پای
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSetAsActiveStorage(currentPath)}
            disabled={currentPath === currentActiveStoragePath}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
              currentPath === currentActiveStoragePath
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {currentPath === currentActiveStoragePath
                ? 'مسیر فعلی پردازش'
                : 'تنظیم این پوشه به عنوان مسیر ذخیره‌سازی اصلی'}
            </span>
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="بروزرسانی لیست"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar: Shortcuts & Drives */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
            <h3 className="font-bold text-xs text-slate-700 px-2 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              درایوهای متصل به رزبری‌پای
            </h3>

            <div className="space-y-1.5">
              {QUICK_SHORTCUTS.map((sc, idx) => {
                const isSelected = currentPath === sc.path;
                return (
                  <button
                    key={idx}
                    onClick={() => loadDirectory(sc.path)}
                    className={`w-full text-right p-2.5 rounded-xl text-xs transition-all flex items-center justify-between gap-2 border ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                        : 'bg-slate-50/60 border-slate-100 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {sc.icon}
                      <span className="truncate">{sc.title}</span>
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
          </div>

          {/* Active path indicator card */}
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                مسیر پردازش شاتر
              </span>
              <span className="text-emerald-400 font-bold text-[10px]">آماده</span>
            </div>
            <div className="text-xs font-mono text-emerald-300 bg-slate-950 p-2 rounded-xl border border-slate-800 break-all dir-ltr text-right">
              {currentActiveStoragePath}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-3">
          {/* Path Navigation & Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNavigateUp}
                  disabled={!listing?.parentPath}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition"
                  title="پوشه بالایی"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div className="overflow-x-auto max-w-md">{renderBreadcrumbs()}</div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleCopyCurrentPath}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium flex items-center gap-1 transition"
                  title="کپی آدرس کامل"
                >
                  {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>پوشه جدید</span>
                </button>

                <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500'}`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500'}`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Create Folder Bar */}
            {isCreatingFolder && (
              <form onSubmit={handleCreateFolder} className="flex items-center gap-2 pt-1 animate-fadeIn">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="نام پوشه جدید را وارد کنید..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                >
                  ایجاد
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-300 transition"
                >
                  انصراف
                </button>
              </form>
            )}

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی فایل یا پوشه در مسیر فعلی..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Directory Contents */}
          {error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2 text-rose-800">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="font-bold text-sm">{error}</p>
              <button
                onClick={() => loadDirectory('/media/pi/hdd_medical')}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
              >
                بازگشت به هارد اصلی
              </button>
            </div>
          ) : isLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-xs font-semibold">در حال خواندن محتوای هارد دیسک...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
              <FolderOpen className="w-12 h-12 stroke-1 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">پوشه خالی است یا فایلی مطابق جستجو یافت نشد.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map((item, idx) => {
                const isFolder = item.type === 'directory';
                const matchingPhoto = allPhotos.find(
                  (p) => p.fileName === item.name || p.filePath === item.path
                );

                return (
                  <div
                    key={idx}
                    className="group bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-2xl p-3 transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    <div>
                      {/* Icon or Thumbnail */}
                      <div
                        onClick={() => {
                          if (isFolder) {
                            handleOpenDirectory(item.path);
                          } else if (matchingPhoto && onSelectPhotoLightbox) {
                            onSelectPhotoLightbox(matchingPhoto);
                          }
                        }}
                        className="w-full h-28 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer mb-2.5 relative group-hover:scale-[1.02] transition-transform"
                      >
                        {item.isImage && (matchingPhoto?.thumbnailUrl || item.thumbnailUrl) ? (
                          <img
                            src={matchingPhoto?.thumbnailUrl || item.thumbnailUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : isFolder ? (
                          <Folder className="w-12 h-12 text-amber-500 fill-amber-100" />
                        ) : (
                          <FileImage className="w-10 h-10 text-slate-400" />
                        )}

                        {item.itemsCount !== undefined && isFolder && (
                          <span className="absolute bottom-1.5 left-1.5 bg-slate-900/80 text-white text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md">
                            {item.itemsCount} فایل
                          </span>
                        )}
                      </div>

                      {/* Name & Details */}
                      <div className="space-y-0.5">
                        <div
                          onClick={() => isFolder && handleOpenDirectory(item.path)}
                          className="font-bold text-xs text-slate-800 truncate cursor-pointer hover:text-emerald-700"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{item.sizeFormatted || (isFolder ? 'پوشه' : 'فایل')}</span>
                          <span>{item.modifiedAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {matchingPhoto && onOpenTagModal && (
                        <button
                          onClick={() => onOpenTagModal(matchingPhoto)}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold rounded-lg flex items-center gap-1 transition"
                        >
                          <Tag className="w-3 h-3" />
                          الصاق پرونده
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">نام فایل / پوشه</th>
                    <th className="p-3">نوع</th>
                    <th className="p-3">اندازه</th>
                    <th className="p-3">تاریخ تغییرات</th>
                    <th className="p-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredItems.map((item, idx) => {
                    const isFolder = item.type === 'directory';
                    const matchingPhoto = allPhotos.find(
                      (p) => p.fileName === item.name || p.filePath === item.path
                    );

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 flex items-center gap-2">
                          {isFolder ? (
                            <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />
                          ) : (
                            <FileImage className="w-4 h-4 text-slate-400" />
                          )}
                          <span
                            onClick={() => isFolder && handleOpenDirectory(item.path)}
                            className="font-bold text-slate-800 hover:text-emerald-700 cursor-pointer"
                          >
                            {item.name}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{isFolder ? 'پوشه' : item.extension || 'فایل'}</td>
                        <td className="p-3 font-mono text-slate-500">{item.sizeFormatted || '—'}</td>
                        <td className="p-3 text-slate-500">{item.modifiedAt || 'امروز'}</td>
                        <td className="p-3 text-left space-x-1 space-x-reverse">
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
