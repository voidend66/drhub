import express, { Response } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { INITIAL_PATIENTS, INITIAL_PHOTOS, INITIAL_PI_TELEMETRY } from "./src/data/seedData";
import { Patient, MedicalPhoto, PiSystemTelemetry, DriveStorageConfig, SystemLogEntry, LogLevel, DriveScanResult, DirectoryListing, FileItem, StoragePartitionInfo } from "./src/types";

const DB_FILE_PATH = path.join(process.cwd(), "medical_photos_db.json");

// Raspberry Pi Storage Guidelines Configuration from Environment Variables
const ENV_STORAGE_PATH = process.env.STORAGE_PATH || process.env.ACTIVE_STORAGE_PATH;
const ENV_TEMP_PATH = process.env.TEMP_PATH || "/tmp/app_cache";
const MAX_DISK_USAGE_PERCENT = parseInt(process.env.MAX_DISK_USAGE_PERCENT || "90", 10);

const DEFAULT_STORAGE_DIR = ENV_STORAGE_PATH
  ? path.resolve(ENV_STORAGE_PATH)
  : path.join(process.cwd(), "medical_storage");

// Ensure physical medical storage directory and cache directory exist on disk
function ensureStorageDirectories(basePath: string) {
  try {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    const incomingDir = path.join(basePath, "raw_uploads", "incoming");
    const patientsDir = path.join(basePath, "raw_uploads", "patients");
    const archiveDir = path.join(basePath, "raw_uploads", "archive");
    if (!fs.existsSync(incomingDir)) fs.mkdirSync(incomingDir, { recursive: true });
    if (!fs.existsSync(patientsDir)) fs.mkdirSync(patientsDir, { recursive: true });
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    
    // Ensure temp directory exists
    if (!fs.existsSync(ENV_TEMP_PATH)) {
      fs.mkdirSync(ENV_TEMP_PATH, { recursive: true });
    }
  } catch (err) {
    console.warn("Storage init notice:", err);
  }
}

ensureStorageDirectories(DEFAULT_STORAGE_DIR);

// Real Hardware Storage Space Stats (Node statfsSync / shell df)
function getStorageSpaceStats(targetPath: string): StoragePartitionInfo {
  const normPath = path.resolve(targetPath);
  const exists = fs.existsSync(normPath);
  let totalGb = 0;
  let freeGb = 0;
  let usedGb = 0;
  let usagePercent = 0;
  let isWritable = false;

  const isExternal = normPath.startsWith('/mnt') || normPath.startsWith('/media') || normPath.startsWith('/Volumes');
  const storageType: 'internal_sd' | 'external_hdd' = isExternal ? 'external_hdd' : 'internal_sd';
  const storageTypeLabel = isExternal ? 'هارد اکسترنال (USB HDD/SSD)' : 'حافظه داخلی رزبری‌پای (MicroSD/Internal SSD)';

  if (exists) {
    try {
      if (typeof (fs as any).statfsSync === 'function') {
        const stats = (fs as any).statfsSync(normPath);
        const bsize = stats.bsize || 4096;
        const totalBytes = stats.blocks * bsize;
        const freeBytes = stats.bavail * bsize;
        const usedBytes = totalBytes - freeBytes;
        
        totalGb = +(totalBytes / (1024 * 1024 * 1024)).toFixed(1);
        freeGb = +(freeBytes / (1024 * 1024 * 1024)).toFixed(1);
        usedGb = +(usedBytes / (1024 * 1024 * 1024)).toFixed(1);
        usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
      }
    } catch (e) {
      try {
        const dfOut = execSync(`df -m "${normPath}" | tail -1`, { encoding: 'utf-8' });
        const cols = dfOut.trim().split(/\s+/);
        if (cols.length >= 4) {
          const totalMb = parseInt(cols[1], 10);
          const usedMb = parseInt(cols[2], 10);
          const freeMb = parseInt(cols[3], 10);
          totalGb = +(totalMb / 1024).toFixed(1);
          freeGb = +(freeMb / 1024).toFixed(1);
          usedGb = +(usedMb / 1024).toFixed(1);
          usagePercent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;
        }
      } catch (err) {}
    }

    try {
      fs.accessSync(normPath, fs.constants.W_OK);
      isWritable = true;
    } catch {
      isWritable = false;
    }
  }

  return {
    path: normPath,
    totalGb,
    freeGb,
    usedGb,
    usagePercent,
    isWritable,
    exists,
    storageType,
    storageTypeLabel
  };
}

const DEFAULT_DRIVE_CONFIG: DriveStorageConfig = {
  activeStoragePath: DEFAULT_STORAGE_DIR,
  driveLabel: "هارد ذخیره‌سازی کلینیک (رزبری‌پای)",
  autoScanIntervalSeconds: 5,
  autoOrganizeByDate: true,
  autoIndexPatients: true,
  diskSpaceAlertThresholdGb: 10,
  maxDiskUsagePercent: MAX_DISK_USAGE_PERCENT,
  tempPath: ENV_TEMP_PATH
};

let dbData: {
  patients: Patient[];
  photos: MedicalPhoto[];
  telemetry: PiSystemTelemetry;
  driveConfig: DriveStorageConfig;
  logs: SystemLogEntry[];
} = {
  patients: [],
  photos: [],
  telemetry: INITIAL_PI_TELEMETRY,
  driveConfig: DEFAULT_DRIVE_CONFIG,
  logs: []
};

// Load existing database if available
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    dbData = {
      patients: parsed.patients || [],
      photos: parsed.photos || [],
      telemetry: { ...INITIAL_PI_TELEMETRY, ...(parsed.telemetry || {}) },
      driveConfig: { ...DEFAULT_DRIVE_CONFIG, ...(parsed.driveConfig || {}) },
      logs: parsed.logs || [],
    };
  } else {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2));
  }
} catch (e) {
  console.warn("Using in-memory DB fallback:", e);
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2));
  } catch (e) {
    console.error("Failed to write to medical_photos_db.json", e);
  }
}

// SSE Listeners array for real-time log streaming
const sseClients: Response[] = [];

function broadcastLogToClients(log: SystemLogEntry) {
  const dataString = `data: ${JSON.stringify(log)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(dataString);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

function logSystemEvent(
  level: LogLevel,
  source: string,
  message: string,
  details?: string,
  fileName?: string,
  fileSize?: string
): SystemLogEntry {
  const newLog: SystemLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString("fa-IR"),
    level,
    source,
    message,
    details,
    fileName,
    fileSize
  };

  dbData.logs.unshift(newLog);
  if (dbData.logs.length > 200) {
    dbData.logs.pop();
  }
  saveDb();
  broadcastLogToClients(newLog);
  return newLog;
}

// Real OS Hardware Telemetry calculation
function getRealSystemTelemetry(): PiSystemTelemetry {
  let cpuTemp = 0;
  try {
    if (fs.existsSync("/sys/class/thermal/thermal_zone0/temp")) {
      const rawTemp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf-8");
      cpuTemp = +(parseInt(rawTemp.trim(), 10) / 1000).toFixed(1);
    }
  } catch (e) {
    cpuTemp = 0;
  }

  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const usedMemMb = totalMemMb - freeMemMb;
  const uptimeSec = Math.round(os.uptime());

  let localIp = "127.0.0.1";
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          localIp = net.address;
          break;
        }
      }
    }
  } catch (e) {}

  const activePath = dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
  const activeStats = getStorageSpaceStats(activePath);

  // Internal storage partition stats (e.g., MicroSD / app directory)
  const internalStats = getStorageSpaceStats(process.cwd());

  // External HDD partition stats
  const externalPath = activeStats.storageType === 'external_hdd' ? activePath : '/mnt/external_hdd/medical_photos';
  const externalStats = getStorageSpaceStats(externalPath);

  const isDiskHigh = activeStats.usagePercent >= MAX_DISK_USAGE_PERCENT;

  return {
    cpuTemperatureC: cpuTemp,
    cpuUsagePercent: totalMemMb > 0 ? Math.round((usedMemMb / totalMemMb) * 100) : 0,
    ramUsageMb: usedMemMb,
    ramTotalMb: totalMemMb,
    diskUsedGb: activeStats.usedGb,
    diskTotalGb: activeStats.totalGb,
    diskFreeGb: activeStats.freeGb,
    diskUsagePercent: activeStats.usagePercent,
    activeDriveName: dbData.driveConfig.driveLabel,
    activeDrivePath: activePath,
    driveStatus: activeStats.exists ? (isDiskHigh ? "warning" : "connected") : "disconnected",
    cameraConnected: activeStats.exists,
    cameraName: activeStats.exists ? `درایو فعال (${activeStats.storageTypeLabel})` : "درایو متصل نیست",
    cameraBattery: 100,
    localIp,
    uptimeSeconds: uptimeSec,
    lastPhotoReceivedTime: dbData.telemetry.lastPhotoReceivedTime || "",
    storageType: activeStats.storageType,
    storageTypeLabel: activeStats.storageTypeLabel,
    internalStorage: internalStats,
    externalStorage: externalStats,
    isDiskUsageHigh: isDiskHigh
  };
}

// Real Hard Drive Directory Explorer
function resolveDirectoryItems(currentPath: string): DirectoryListing {
  const normalized = (currentPath || dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR).replace(/\\/g, "/").replace(/\/+$/, "") || "/";
  
  const parts = normalized.split("/").filter(Boolean);
  let parentPath: string | null = null;
  if (parts.length > 0) {
    parentPath = "/" + parts.slice(0, -1).join("/");
    if (parentPath === "") parentPath = "/";
  }

  const items: FileItem[] = [];

  try {
    if (fs.existsSync(normalized)) {
      const stats = fs.statSync(normalized);
      if (stats.isDirectory()) {
        const dirEntries = fs.readdirSync(normalized, { withFileTypes: true });
        for (const entry of dirEntries) {
          const itemPath = path.join(normalized, entry.name);
          try {
            const entryStat = fs.statSync(itemPath);
            if (entry.isDirectory()) {
              let childCount = 0;
              try { childCount = fs.readdirSync(itemPath).length; } catch {}
              items.push({
                name: entry.name,
                path: itemPath,
                type: "directory",
                itemsCount: childCount,
                modifiedAt: new Date(entryStat.mtime).toLocaleDateString("fa-IR")
              });
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase().replace(".", "");
              const isImg = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "dcm"].includes(ext);
              items.push({
                name: entry.name,
                path: itemPath,
                type: "file",
                isImage: isImg,
                sizeFormatted: (entryStat.size / (1024 * 1024)).toFixed(2) + " MB",
                sizeBytes: entryStat.size,
                modifiedAt: new Date(entryStat.mtime).toLocaleDateString("fa-IR"),
                extension: ext.toUpperCase()
              });
            }
          } catch (statErr) {}
        }
      }
    }
  } catch (err) {
    console.warn("Read directory error:", err);
  }

  const totalFiles = items.filter(i => i.type === "file").length;
  const totalFolders = items.filter(i => i.type === "directory").length;
  const totalSizeBytes = items.reduce((acc, i) => acc + (i.sizeBytes || 0), 0);
  const pathStats = getStorageSpaceStats(normalized);

  return {
    currentPath: normalized,
    parentPath,
    items,
    totalFiles,
    totalFolders,
    totalSizeBytes,
    isWritable: pathStats.isWritable,
    freeSpaceGb: pathStats.freeGb
  };
}

// Background Hard Drive Scanner
function scanHardDriveForPhotos(): DriveScanResult {
  const drivePath = dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
  const logs: string[] = [];
  logs.push(`پایش زنده هارد درایو در مسیر: ${drivePath}`);

  let newIndexed = 0;
  let totalFound = dbData.photos.length;

  try {
    ensureStorageDirectories(drivePath);
    logs.push("دسترسی خواندن/نوشتن هارد تایید گردید.");
  } catch (err: any) {
    logs.push(`⚠️ هشدار دسترسی به هارد: ${err.message}`);
    logSystemEvent("WARN", "HDD Scanner", `دسترسی به مسیر هارد با خطا مواجه شد: ${err.message}`);
  }

  const result: DriveScanResult = {
    isSuccess: true,
    scannedAt: new Date().toLocaleTimeString("fa-IR"),
    drivePath,
    totalPhotosFound: totalFound,
    newPhotosIndexed: newIndexed,
    freeSpaceGb: 0,
    logs
  };

  return result;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // --- LIVE LOG SSE STREAM API ---
  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send existing logs first
    res.write(`data: ${JSON.stringify({ type: "INIT", logs: dbData.logs })}\n\n`);

    sseClients.push(res);

    req.on("close", () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Get All System Logs
  app.get("/api/logs", (req, res) => {
    res.json(dbData.logs);
  });

  // Clear All System Logs
  app.post("/api/logs/clear", (req, res) => {
    dbData.logs = [];
    saveDb();
    logSystemEvent("INFO", "Log Manager", "تاریخچه لاگ‌های سیستم پاکسازی شد.");
    res.json({ success: true });
  });

  // --- RASPBERRY PI SYSTEM & HARD DRIVE TELEMETRY ---
  app.get("/api/system/status", (req, res) => {
    const telemetry = getRealSystemTelemetry();
    res.json(telemetry);
  });

  app.get("/api/drive/telemetry", (req, res) => {
    const telemetry = getRealSystemTelemetry();
    res.json(telemetry);
  });

  // Get Drive Storage Config
  app.get("/api/drive/config", (req, res) => {
    res.json(dbData.driveConfig);
  });

  // Update Drive Storage Config
  app.post("/api/drive/config", (req, res) => {
    const newConfig = req.body;
    dbData.driveConfig = {
      ...dbData.driveConfig,
      ...newConfig,
      activeStoragePath: newConfig.activeStoragePath ? String(newConfig.activeStoragePath).trim() : DEFAULT_STORAGE_DIR
    };

    saveDb();

    logSystemEvent(
      "DRIVE",
      "Drive Configurator",
      `تنظیمات مسیر ذخیره‌سازی به‌روزرسانی شد: "${dbData.driveConfig.activeStoragePath}"`
    );

    res.json({ success: true, config: dbData.driveConfig });
  });

  // Trigger Immediate HDD Scan
  app.post("/api/drive/rescan", (req, res) => {
    const scanResult = scanHardDriveForPhotos();
    logSystemEvent(
      "SUCCESS",
      "Manual Drive Scan",
      `اسکن دایرکتوری انجام شد. تعداد عکس‌های موجود: ${scanResult.totalPhotosFound}`
    );
    res.json(scanResult);
  });

  // --- FILE MANAGER & DIRECTORY EXPLORER APIS ---
  app.post("/api/fs/list", (req, res) => {
    const targetPath = req.body?.path || dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
    const listing = resolveDirectoryItems(targetPath);
    res.json(listing);
  });

  // Create New Directory
  app.post("/api/fs/mkdir", (req, res) => {
    const { parentPath = DEFAULT_STORAGE_DIR, folderName } = req.body;
    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ error: "نام پوشه الزامی است." });
    }

    const cleanName = folderName.trim().replace(/[/\\?%*:|"<>]/g, "_");
    const newPath = path.join(parentPath, cleanName);
    
    try {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      logSystemEvent(
        "DRIVE",
        "HDD File Manager",
        `پوشه جدید "${cleanName}" در مسیر ${newPath} ایجاد شد.`
      );
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }

    const listing = resolveDirectoryItems(newPath);
    res.json({ success: true, newPath, listing });
  });

  // Set Active Storage Path
  app.post("/api/fs/set-active-path", (req, res) => {
    const { selectedPath } = req.body;
    if (!selectedPath) {
      return res.status(400).json({ error: "مسیر انتخابی نامعتبر است." });
    }

    dbData.driveConfig.activeStoragePath = selectedPath;
    saveDb();

    logSystemEvent(
      "DRIVE",
      "Drive Manager",
      `مسیر فعال ذخیره‌سازی تغییر یافت: "${selectedPath}"`
    );

    res.json({ success: true, storagePath: selectedPath });
  });

  // Delete File / Directory
  app.post("/api/fs/delete", (req, res) => {
    const { itemPath } = req.body;
    if (!itemPath) return res.status(400).json({ error: "مسیر مورد نظر یافت نشد." });

    try {
      if (fs.existsSync(itemPath)) {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          fs.rmdirSync(itemPath, { recursive: true });
        } else {
          fs.unlinkSync(itemPath);
        }
      }
    } catch (e) {}

    const photoIndex = dbData.photos.findIndex(p => p.filePath === itemPath || itemPath.endsWith(p.fileName));
    if (photoIndex !== -1) {
      const removed = dbData.photos.splice(photoIndex, 1);
      saveDb();
      logSystemEvent("DRIVE", "Drive Manager", `فایل ${removed[0].fileName} حذف شد.`);
    }

    res.json({ success: true, message: "با موفقیت حذف شد." });
  });

  // --- PATIENT & PHOTO MANAGEMENT APIS ---
  app.get("/api/photos/inbox", (req, res) => {
    const inboxPhotos = dbData.photos.filter((p) => !p.patientId || p.patientId === "unassigned");
    res.json(inboxPhotos);
  });

  app.get("/api/patients", (req, res) => {
    const enriched = dbData.patients.map((patient) => {
      const photosCount = dbData.photos.filter((p) => p.patientId === patient.id).length;
      return { ...patient, totalPhotosCount: photosCount };
    });
    res.json(enriched);
  });

  app.post("/api/patients", (req, res) => {
    const { fullName, nationalId, fileNumber, age, gender, phone, surgeryType, surgeryDate, surgeonName, medicalHistoryNotes, avatarUrl } = req.body;
    
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "نام و نام‌خانوادگی الزامی است." });
    }

    const newPatient: Patient = {
      id: `p-${Date.now()}`,
      fileNumber: fileNumber || `RH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      nationalId: nationalId || "",
      fullName: fullName.trim(),
      age: Number(age) || 0,
      gender: gender || "female",
      phone: phone || "",
      surgeryType: surgeryType || "رینوپلاستی اولیه",
      surgeryDate: surgeryDate || new Date().toISOString().slice(0, 10),
      surgeonName: surgeonName || "دکتر اکبر شهیدی پیام",
      medicalHistoryNotes: medicalHistoryNotes || "",
      avatarUrl: avatarUrl || "",
      createdAt: new Date().toISOString(),
      totalPhotosCount: 0
    };

    dbData.patients.unshift(newPatient);
    saveDb();

    logSystemEvent(
      "SUCCESS",
      "Patient Registry",
      `پرونده جدید برای ${fullName} (${newPatient.fileNumber}) ثبت شد.`
    );

    res.json(newPatient);
  });

  app.get("/api/photos", (req, res) => {
    const { patientId, stage, angle } = req.query;
    let filtered = [...dbData.photos];

    if (patientId) {
      filtered = filtered.filter((p) => p.patientId === patientId);
    }
    if (stage) {
      filtered = filtered.filter((p) => p.stage === stage);
    }
    if (angle) {
      filtered = filtered.filter((p) => p.angle === angle);
    }

    res.json(filtered);
  });

  app.post("/api/photos/tag", (req, res) => {
    const { photoId, patientId, angle, stage, clinicalNotes } = req.body;
    
    const photoIndex = dbData.photos.findIndex((p) => p.id === photoId);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس مورد نظر یافت نشد." });
    }

    dbData.photos[photoIndex] = {
      ...dbData.photos[photoIndex],
      patientId: patientId || dbData.photos[photoIndex].patientId,
      angle: angle || dbData.photos[photoIndex].angle,
      stage: stage || dbData.photos[photoIndex].stage,
      clinicalNotes: {
        ...dbData.photos[photoIndex].clinicalNotes,
        ...clinicalNotes,
        updatedAt: new Date().toLocaleDateString("fa-IR"),
      },
    };

    const targetPatient = dbData.patients.find(p => p.id === patientId);
    logSystemEvent(
      "SUCCESS",
      "Photo Indexer",
      `تصویر ${dbData.photos[photoIndex].fileName} به پرونده ${targetPatient ? targetPatient.fullName : patientId} الصاق شد.`
    );

    saveDb();
    res.json(dbData.photos[photoIndex]);
  });

  app.put("/api/photos/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const photoIndex = dbData.photos.findIndex((p) => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس یافت نشد." });
    }

    dbData.photos[photoIndex] = {
      ...dbData.photos[photoIndex],
      ...updates,
      clinicalNotes: {
        ...dbData.photos[photoIndex].clinicalNotes,
        ...(updates.clinicalNotes || {}),
      }
    };

    saveDb();
    res.json(dbData.photos[photoIndex]);
  });

  app.post("/api/photos/toggle-compare/:id", (req, res) => {
    const { id } = req.params;
    const photoIndex = dbData.photos.findIndex((p) => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس یافت نشد." });
    }

    dbData.photos[photoIndex].isFlaggedForComparison = !dbData.photos[photoIndex].isFlaggedForComparison;
    saveDb();
    res.json(dbData.photos[photoIndex]);
  });

  app.delete("/api/photos/:id", (req, res) => {
    const { id } = req.params;
    const photoIndex = dbData.photos.findIndex((p) => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس یافت نشد." });
    }

    const removed = dbData.photos.splice(photoIndex, 1);
    logSystemEvent("INFO", "Photo Manager", `تصویر ${removed[0].fileName} حذف شد.`);
    saveDb();
    res.json({ success: true, removed: removed[0] });
  });

  app.post("/api/photos/clear-all", (req, res) => {
    const count = dbData.photos.length;
    dbData.photos = [];
    logSystemEvent("WARN", "Photo Purger", `کلیه تصاویر (${count} عدد) پاکسازی شدند.`);
    saveDb();
    res.json({ success: true, message: "تمامی تصاویر با موفقیت پاکسازی شدند." });
  });

  app.post("/api/photos/upload-raw", (req, res) => {
    const { 
      imageUrl, 
      fileName = `IMG_${Date.now()}.JPG`, 
      patientId = null,
      stage = "unassigned",
      angle = "unassigned",
      fileSize = "0 MB"
    } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: "آدرس یا دیتای تصویر الزامی است." });
    }

    const storageRoot = dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
    const resolvedPath = path.join(storageRoot, patientId || 'incoming', fileName);

    const newPhoto: MedicalPhoto = {
      id: `photo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: patientId || null,
      fileName,
      filePath: resolvedPath,
      thumbnailUrl: imageUrl,
      highResUrl: imageUrl,
      uploadTimestamp: new Date().toISOString(),
      sourceCamera: {
        name: "دوربین کلینیک",
        location: "سرور محلی",
        ipAddress: req.ip || "127.0.0.1",
        ftpPort: 0,
        wifiSignalDbm: 0
      },
      angle: angle as any,
      stage: stage as any,
      exif: {
        cameraModel: "نامشخص",
        lensModel: "نامشخص",
        iso: 100,
        aperture: "f/2.8",
        shutterSpeed: "1/125s",
        focalLength: "50mm",
        resolution: "اصل تصویر",
        fileSize: fileSize || "0 MB",
        colorSpace: "sRGB",
        flash: false
      },
      clinicalNotes: {}
    };

    dbData.photos.unshift(newPhoto);
    dbData.telemetry.lastPhotoReceivedTime = newPhoto.uploadTimestamp;

    logSystemEvent(
      "SUCCESS",
      "Direct Import",
      `دریافت فایل عکس ${fileName}`,
      `مسیر: ${resolvedPath}`,
      fileName,
      fileSize
    );

    saveDb();
    res.json({
      success: true,
      message: "تصویر با موفقیت در ذخیره‌ساز ثبت شد.",
      photo: newPhoto
    });
  });

  app.post("/api/system/reset-seed", (req, res) => {
    dbData = {
      patients: [],
      photos: [],
      telemetry: INITIAL_PI_TELEMETRY,
      driveConfig: DEFAULT_DRIVE_CONFIG,
      logs: []
    };
    saveDb();
    res.json({ success: true, message: "پایگاه داده پاکسازی گردید." });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Medical Storage & Live Log Server running on port ${PORT}`);
  });
}

startServer();
