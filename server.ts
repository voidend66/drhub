import express, { Response } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import { createServer as createViteServer } from "vite";
import { INITIAL_PATIENTS, INITIAL_PHOTOS, INITIAL_PI_TELEMETRY } from "./src/data/seedData";
import { Patient, MedicalPhoto, PiSystemTelemetry, DriveStorageConfig, SystemLogEntry, LogLevel, DriveScanResult, DirectoryListing, FileItem, StoragePartitionInfo, SqliteStatus } from "./src/types";
import {
  initSqliteDatabase,
  getSqliteStatus,
  getAllPatientsFromSqlite,
  getPatientByIdFromSqlite,
  upsertPatientToSqlite,
  deletePatientFromSqlite,
  getAllPhotosFromSqlite,
  upsertPhotoToSqlite,
  deletePhotoFromSqlite,
  clearAllPhotosFromSqlite,
  seedInitialDataIfEmpty
} from "./database";

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

const DEFAULT_SQLITE_PATH = process.env.SQLITE_DB_PATH || "/media/mahdi/mm/doctor/patients.db";

const DEFAULT_DRIVE_CONFIG: DriveStorageConfig = {
  activeStoragePath: DEFAULT_STORAGE_DIR,
  driveLabel: "هارد ذخیره‌سازی کلینیک (رزبری‌پای)",
  autoScanIntervalSeconds: 5,
  autoOrganizeByDate: true,
  autoIndexPatients: true,
  diskSpaceAlertThresholdGb: 10,
  maxDiskUsagePercent: MAX_DISK_USAGE_PERCENT,
  tempPath: ENV_TEMP_PATH,
  sqliteDbPath: DEFAULT_SQLITE_PATH,
  sqliteAutoSync: true
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

// Initialize SQLite Database with configured path
const activeSqlitePath = dbData.driveConfig.sqliteDbPath || DEFAULT_SQLITE_PATH;
const sqliteInitResult = initSqliteDatabase(activeSqlitePath);
console.log(`[Database Init] SQLite active at: ${sqliteInitResult.path} (isFallback: ${sqliteInitResult.isFallback})`);

// Seed SQLite if empty or sync patients
seedInitialDataIfEmpty(
  dbData.patients.length > 0 ? dbData.patients : INITIAL_PATIENTS,
  dbData.photos.length > 0 ? dbData.photos : INITIAL_PHOTOS
);

// If local dbData has no patients, load from SQLite
const sqlitePatients = getAllPatientsFromSqlite();
if (sqlitePatients.length > 0) {
  dbData.patients = sqlitePatients;
}

// If local dbData has no photos, load from SQLite
const sqlitePhotos = getAllPhotosFromSqlite();
if (sqlitePhotos.length > 0 && dbData.photos.length === 0) {
  dbData.photos = sqlitePhotos;
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

function broadcastEventToClients(event: { type: string; [key: string]: any }) {
  const dataString = `data: ${JSON.stringify(event)}\n\n`;
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
    isDiskUsageHigh: isDiskHigh,
    sqliteStatus: getSqliteStatus()
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
              const rawUrl = isImg ? `/api/fs/raw?path=${encodeURIComponent(itemPath)}` : undefined;
              items.push({
                name: entry.name,
                path: itemPath,
                type: "file",
                isImage: isImg,
                thumbnailUrl: rawUrl,
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

const SUPPORTED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp"]);

// Recursive Hard Drive Scanner for Camera & Medical Photos
function scanDirectoryRecursivelyForPhotos(
  dirPath: string,
  maxDepth = 6,
  currentDepth = 0
): { indexedCount: number; totalPhotos: number; newlyAdded: MedicalPhoto[] } {
  let indexedCount = 0;
  let totalPhotos = 0;
  const newlyAdded: MedicalPhoto[] = [];

  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) {
    return { indexedCount, totalPhotos, newlyAdded };
  }

  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) return { indexedCount, totalPhotos, newlyAdded };

    const dirEntries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of dirEntries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
        const sub = scanDirectoryRecursivelyForPhotos(fullPath, maxDepth, currentDepth + 1);
        indexedCount += sub.indexedCount;
        totalPhotos += sub.totalPhotos;
        newlyAdded.push(...sub.newlyAdded);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().replace(".", "");
        if (SUPPORTED_IMAGE_EXTS.has(ext)) {
          totalPhotos++;

          // Check if already in dbData.photos by path or name
          const alreadyExists = dbData.photos.some(
            (p) => p.filePath === fullPath || p.fileName === entry.name
          );

          if (!alreadyExists) {
            try {
              const fileStat = fs.statSync(fullPath);
              const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);
              const sizeFormatted = fileStat.size > 1024 * 1024 ? `${sizeMb} MB` : `${Math.round(fileStat.size / 1024)} KB`;
              const photoId = `photo-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
              const rawUrl = `/api/fs/raw?path=${encodeURIComponent(fullPath)}`;

              const newPhoto: MedicalPhoto = {
                id: photoId,
                patientId: null, // Placed directly into Inbox (صندوق ورودی)!
                fileName: entry.name,
                filePath: fullPath,
                thumbnailUrl: rawUrl,
                highResUrl: rawUrl,
                uploadTimestamp: fileStat.mtime.toISOString(),
                sourceCamera: {
                  name: "هارد اکسترنال کلینیک (USB/SD)",
                  location: path.dirname(fullPath),
                  ipAddress: "127.0.0.1",
                  ftpPort: 0,
                  wifiSignalDbm: 100,
                },
                angle: "unassigned",
                stage: "unassigned",
                exif: {
                  cameraModel: "Sony / Canon Medical",
                  lensModel: "Medical Macro Lens",
                  iso: 100,
                  aperture: "f/8.0",
                  shutterSpeed: "1/160s",
                  focalLength: "50mm",
                  resolution: "High-Res 24MP",
                  fileSize: sizeFormatted,
                  colorSpace: "sRGB",
                  flash: true,
                },
                clinicalNotes: {},
              };

              dbData.photos.unshift(newPhoto);
              upsertPhotoToSqlite(newPhoto);
              newlyAdded.push(newPhoto);
              indexedCount++;

              logSystemEvent(
                "SUCCESS",
                "HDD Scanner",
                `عکس جدید از هارد در صندوق ورودی ثبت شد: ${entry.name}`,
                `مسیر: ${fullPath}`,
                entry.name,
                sizeFormatted
              );
            } catch (fileErr) {
              console.warn("Could not index file:", fullPath, fileErr);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("Scanner error at:", dirPath, err?.message);
  }

  return { indexedCount, totalPhotos, newlyAdded };
}

// Background Hard Drive Scanner
function scanHardDriveForPhotos(targetPath?: string): DriveScanResult {
  const drivePath = targetPath || dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
  const logs: string[] = [];
  logs.push(`پایش زنده هارد درایو در مسیر: ${drivePath}`);

  let newIndexed = 0;
  let totalFound = 0;

  try {
    ensureStorageDirectories(drivePath);
    logs.push("دسترسی به هارد دیسک بررسی شد.");
    
    const scanRes = scanDirectoryRecursivelyForPhotos(drivePath);
    newIndexed = scanRes.indexedCount;
    totalFound = scanRes.totalPhotos;

    if (newIndexed > 0) {
      saveDb();
      dbData.telemetry.lastPhotoReceivedTime = new Date().toISOString();
      logs.push(`تعداد ${newIndexed} شات جدید به صندوق ورودی اضافه شد.`);
      broadcastEventToClients({
        type: "NEW_PHOTOS",
        count: newIndexed,
        photos: scanRes.newlyAdded,
      });
    } else {
      logs.push(`تمام عکس‌های موجود در این پوشه (${totalFound} عکس) قبلاً ایندکس شده‌اند.`);
    }
  } catch (err: any) {
    logs.push(`⚠️ هشدار دسترسی به هارد: ${err.message}`);
    logSystemEvent("WARN", "HDD Scanner", `دسترسی به مسیر هارد با خطا مواجه شد: ${err.message}`);
  }

  const spaceStats = getStorageSpaceStats(drivePath);

  const result: DriveScanResult = {
    isSuccess: true,
    scannedAt: new Date().toLocaleTimeString("fa-IR"),
    drivePath,
    totalPhotosFound: dbData.photos.length,
    newPhotosIndexed: newIndexed,
    freeSpaceGb: spaceStats.freeGb,
    logs,
  };

  return result;
}

async function startServer() {
  const app = express();
  // Support custom PORT (e.g. 8081 for PM2/production) with fallback to 8081 in production and 3000 in dev
  const PORT = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : (process.env.NODE_ENV === "production" ? 8081 : 3000);

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // --- RAW IMAGE STREAMING API (SERVES REAL HDD FILES & CAMERA PICTURES) ---
  app.get(["/api/fs/raw", "/api/photos/image"], (req, res) => {
    const rawPath = (req.query.path || req.query.file || "") as string;
    if (!rawPath) {
      return res.status(400).send("مسیر فایل مشخص نشده است.");
    }

    try {
      const decodedPath = decodeURIComponent(rawPath);
      const resolvedPath = path.resolve(decodedPath);

      if (fs.existsSync(resolvedPath)) {
        const stat = fs.statSync(resolvedPath);
        if (stat.isFile() && stat.size > 0) {
          const ext = path.extname(resolvedPath).toLowerCase();
          let mimeType = "image/jpeg";
          if (ext === ".png") mimeType = "image/png";
          else if (ext === ".webp") mimeType = "image/webp";
          else if (ext === ".gif") mimeType = "image/gif";
          else if (ext === ".bmp") mimeType = "image/bmp";
          else if (ext === ".svg") mimeType = "image/svg+xml";

          res.setHeader("Content-Type", mimeType);
          res.setHeader("Content-Length", stat.size);
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          res.setHeader("Accept-Ranges", "bytes");

          const stream = fs.createReadStream(resolvedPath);
          return stream.pipe(res);
        }
      }
    } catch (e) {
      console.warn("Raw image serve error:", rawPath, e);
    }

    // High quality medical SVG placeholder when local file is missing or still synchronizing
    const fileName = path.basename(rawPath) || "MEDICAL_PHOTO.JPG";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg)" />
      <g stroke="#334155" stroke-width="0.5" opacity="0.3">
        <path d="M0,100 H800 M0,200 H800 M0,300 H800 M0,400 H800 M0,500 H800" />
        <path d="M100,0 V600 M200,0 V600 M300,0 V600 M400,0 V600 M500,0 V600 M600,0 V600 M700,0 V600" />
      </g>
      <rect x="20" y="20" width="760" height="560" rx="16" fill="none" stroke="url(#accent)" stroke-width="2" opacity="0.6" />
      <circle cx="400" cy="240" r="48" fill="#1e293b" stroke="#10b981" stroke-width="3" />
      <circle cx="400" cy="240" r="28" fill="#0f172a" stroke="#38bdf8" stroke-width="2" />
      <circle cx="410" cy="230" r="6" fill="#38bdf8" opacity="0.8" />
      <text x="400" y="340" text-anchor="middle" font-family="sans-serif, system-ui" font-size="22" font-weight="bold" fill="#f8fafc">${fileName}</text>
      <text x="400" y="375" text-anchor="middle" font-family="sans-serif, system-ui" font-size="14" fill="#10b981">شات پزشکی رزبری‌پای • هارد اکسترنال</text>
      <text x="400" y="410" text-anchor="middle" font-family="sans-serif, system-ui" font-size="12" fill="#64748b">فرمت: JPG 24MP • آماده مشاهده و الصاق به پرونده</text>
    </svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.send(svg);
  });

  // --- LIVE LOG SSE STREAM API ---
  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
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
    const oldSqlitePath = dbData.driveConfig.sqliteDbPath;

    dbData.driveConfig = {
      ...dbData.driveConfig,
      ...newConfig,
      activeStoragePath: newConfig.activeStoragePath ? String(newConfig.activeStoragePath).trim() : DEFAULT_STORAGE_DIR,
      sqliteDbPath: newConfig.sqliteDbPath ? String(newConfig.sqliteDbPath).trim() : (oldSqlitePath || DEFAULT_SQLITE_PATH)
    };

    if (newConfig.sqliteDbPath && newConfig.sqliteDbPath !== oldSqlitePath) {
      const initRes = initSqliteDatabase(newConfig.sqliteDbPath);
      logSystemEvent(
        initRes.isFallback ? "WARN" : "SUCCESS",
        "SQLite Config",
        `پایگاه داده SQLite به مسیر جدید هدایت شد: ${initRes.path}${initRes.isFallback ? " (مسیر امن محلی)" : ""}`
      );
    }

    saveDb();

    logSystemEvent(
      "DRIVE",
      "Drive Configurator",
      `تنظیمات مسیر ذخیره‌سازی به‌روزرسانی شد: "${dbData.driveConfig.activeStoragePath}"`
    );

    res.json({ success: true, config: dbData.driveConfig });
  });

  // --- SQLITE DATABASE MANAGEMENT APIS ---
  app.get("/api/database/status", (req, res) => {
    res.json(getSqliteStatus());
  });

  app.post("/api/database/config", (req, res) => {
    const { sqliteDbPath } = req.body;
    if (!sqliteDbPath || !String(sqliteDbPath).trim()) {
      return res.status(400).json({ error: "مسیر پایگاه داده الزامی است." });
    }

    const cleanPath = String(sqliteDbPath).trim();
    const result = initSqliteDatabase(cleanPath);

    dbData.driveConfig.sqliteDbPath = cleanPath;
    saveDb();

    logSystemEvent(
      result.isFallback ? "WARN" : "SUCCESS",
      "SQLite Config",
      `مسیر دیتابیس SQLite تنظیم شد: ${result.path}${result.isFallback ? " (مسیر فال‌بک موقت)" : ""}`
    );

    res.json({
      success: result.success,
      isFallback: result.isFallback,
      error: result.error,
      status: getSqliteStatus()
    });
  });

  app.post("/api/database/sync", (req, res) => {
    try {
      for (const p of dbData.patients) {
        upsertPatientToSqlite(p);
      }
      for (const ph of dbData.photos) {
        upsertPhotoToSqlite(ph);
      }
      const updatedPatients = getAllPatientsFromSqlite();
      if (updatedPatients.length > 0) {
        dbData.patients = updatedPatients;
      }
      saveDb();

      logSystemEvent(
        "SUCCESS",
        "SQLite Sync",
        `همگام‌سازی کامل پایگاه داده SQLite با موفقیت انجام شد (${updatedPatients.length} پرونده).`
      );
      res.json({ success: true, status: getSqliteStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger Immediate HDD Scan
  app.post(["/api/drive/rescan", "/api/storage/rescan"], (req, res) => {
    const scanResult = scanHardDriveForPhotos();
    logSystemEvent(
      "SUCCESS",
      "Manual Drive Scan",
      `اسکن دایرکتوری انجام شد. تعداد عکس‌های موجود: ${scanResult.totalPhotosFound}`
    );
    res.json(scanResult);
  });

  // Fix Permissions Endpoint for storage folder
  app.post("/api/fs/fix-permissions", (req, res) => {
    const targetDir = req.body?.path || dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
    try {
      if (fs.existsSync(targetDir)) {
        try {
          execSync(`chmod -R 775 "${targetDir}"`);
        } catch (e) {}
      }
      res.json({ success: true, message: "مجوزهای دسترسی بازنشانی شدند.", path: targetDir });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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

    // Immediately scan this selected folder so new photos appear in Inbox!
    const scanResult = scanHardDriveForPhotos(selectedPath);

    res.json({ success: true, storagePath: selectedPath, scanResult });
  });

  // Import all photos of a specific folder into Inbox
  app.post("/api/fs/import-folder-to-inbox", (req, res) => {
    const targetFolder = req.body?.folderPath || dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
    const scanRes = scanDirectoryRecursivelyForPhotos(targetFolder);
    if (scanRes.indexedCount > 0) {
      saveDb();
      dbData.telemetry.lastPhotoReceivedTime = new Date().toISOString();
      broadcastEventToClients({
        type: "NEW_PHOTOS",
        count: scanRes.indexedCount,
        photos: scanRes.newlyAdded,
      });
    }
    res.json({
      success: true,
      folder: targetFolder,
      newIndexed: scanRes.indexedCount,
      totalFound: scanRes.totalPhotos,
      photos: scanRes.newlyAdded,
    });
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
    let patientList = getAllPatientsFromSqlite();
    if (patientList.length === 0 && dbData.patients.length > 0) {
      patientList = dbData.patients;
    }
    const enriched = patientList.map((patient) => {
      const photosCount = dbData.photos.filter((p) => p.patientId === patient.id).length;
      return { ...patient, totalPhotosCount: photosCount || patient.totalPhotosCount || 0 };
    });
    res.json(enriched);
  });

  app.get("/api/patients/:id", (req, res) => {
    const { id } = req.params;
    const patient = getPatientByIdFromSqlite(id) || dbData.patients.find(p => p.id === id);
    if (!patient) {
      return res.status(404).json({ error: "پرونده بیمار یافت نشد." });
    }
    const photosCount = dbData.photos.filter((p) => p.patientId === patient.id).length;
    res.json({ ...patient, totalPhotosCount: photosCount || patient.totalPhotosCount || 0 });
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

    // Save to SQLite
    upsertPatientToSqlite(newPatient);

    // Save to memory cache & JSON
    dbData.patients.unshift(newPatient);
    saveDb();

    logSystemEvent(
      "SUCCESS",
      "Patient Registry",
      `پرونده جدید برای ${fullName} (${newPatient.fileNumber}) در دیتابیس SQLite ثبت شد.`
    );

    res.json(newPatient);
  });

  app.put("/api/patients/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const patientIndex = dbData.patients.findIndex(p => p.id === id);
    
    let existingPatient = patientIndex !== -1 ? dbData.patients[patientIndex] : getPatientByIdFromSqlite(id);
    if (!existingPatient) {
      return res.status(404).json({ error: "پرونده بیمار یافت نشد." });
    }

    const updatedPatient: Patient = {
      ...existingPatient,
      ...updates,
      id
    };

    upsertPatientToSqlite(updatedPatient);
    if (patientIndex !== -1) {
      dbData.patients[patientIndex] = updatedPatient;
    } else {
      dbData.patients.unshift(updatedPatient);
    }
    saveDb();

    logSystemEvent(
      "SUCCESS",
      "Patient Registry",
      `اطلاعات پرونده ${updatedPatient.fullName} (${updatedPatient.fileNumber}) در دیتابیس SQLite به‌روزرسانی شد.`
    );

    res.json(updatedPatient);
  });

  app.delete("/api/patients/:id", (req, res) => {
    const { id } = req.params;
    deletePatientFromSqlite(id);

    const patientIndex = dbData.patients.findIndex(p => p.id === id);
    let removedPatient: Patient | null = null;
    if (patientIndex !== -1) {
      removedPatient = dbData.patients.splice(patientIndex, 1)[0];
    }
    saveDb();

    logSystemEvent(
      "INFO",
      "Patient Registry",
      `پرونده بیمار (${id}) از پایگاه داده SQLite حذف گردید.`
    );

    res.json({ success: true, removed: removedPatient });
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
    upsertPhotoToSqlite(dbData.photos[photoIndex]);
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
    upsertPhotoToSqlite(dbData.photos[photoIndex]);
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
    upsertPhotoToSqlite(dbData.photos[photoIndex]);
    res.json(dbData.photos[photoIndex]);
  });

  app.delete("/api/photos/:id", (req, res) => {
    const { id } = req.params;
    deletePhotoFromSqlite(id);
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
    clearAllPhotosFromSqlite();
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
    upsertPhotoToSqlite(newPhoto);
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

  // Strict JSON 404 Handler for all API routes (prevents SPA index.html rewrite)
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      error: "مسیر API مورد نظر یافت نشد.",
      path: req.originalUrl
    });
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

  // Initial scan of active storage directory on boot
  try {
    const initScan = scanHardDriveForPhotos();
    console.log(`[HDD Auto-Scanner] Initial scan indexed ${initScan.newPhotosIndexed} new photos. Total photos: ${initScan.totalPhotosFound}`);
  } catch (err) {
    console.warn("[HDD Auto-Scanner] Initial scan warning:", err);
  }

  // Background auto-detection interval: checks every 3 seconds for new photos from SD Card, Camera, or HDD
  setInterval(() => {
    try {
      const activePath = dbData.driveConfig.activeStoragePath || DEFAULT_STORAGE_DIR;
      if (fs.existsSync(activePath)) {
        const scanRes = scanDirectoryRecursivelyForPhotos(activePath, 6);
        if (scanRes.indexedCount > 0) {
          saveDb();
          dbData.telemetry.lastPhotoReceivedTime = new Date().toISOString();
          console.log(`[HDD Auto-Scanner] Discovered ${scanRes.indexedCount} new photo(s) in "${activePath}". Added to Inbox.`);
          broadcastEventToClients({
            type: "NEW_PHOTOS",
            count: scanRes.indexedCount,
            photos: scanRes.newlyAdded,
          });
        }
      }
    } catch (e) {}
  }, 3000);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Medical Storage & Live Log Server running on port ${PORT}`);
  });
}

startServer();
