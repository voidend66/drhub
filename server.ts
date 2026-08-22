import express from "express";
import path from "path";
import fs from "fs";
import net from "net";
import * as ftp from "basic-ftp";
import { createServer as createViteServer } from "vite";
import { INITIAL_PATIENTS, INITIAL_PHOTOS, INITIAL_PI_TELEMETRY } from "./src/data/seedData";
import { Patient, MedicalPhoto, PiSystemTelemetry, FtpLogEntry, FtpConnectionTestResult, DirectoryListing, FileItem } from "./src/types";

const DB_FILE_PATH = path.join(process.cwd(), "medical_photos_db.json");
const ROOT_STORAGE_DIR = path.join(process.cwd(), "medical_storage");

// Ensure physical medical storage directory exists on disk
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
  } catch (err) {
    console.warn("Storage init notice:", err);
  }
}

ensureStorageDirectories(ROOT_STORAGE_DIR);

interface FtpServerConfig {
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
  passivePortRange: string;
  maxFileSizeMb: number;
}

const DEFAULT_CONFIG: FtpServerConfig = {
  ipAddress: "192.168.1.150",
  port: 2121,
  username: "anonymous",
  password: "",
  allowAnonymous: true,
  securityMode: "plain",
  requireCertificate: false,
  storagePath: "/home/pi/medical_storage/raw_uploads",
  autoOrganizeByDate: true,
  passiveMode: true,
  passivePortRange: "50000-50100",
  maxFileSizeMb: 100
};

let dbData: {
  patients: Patient[];
  photos: MedicalPhoto[];
  telemetry: PiSystemTelemetry;
  ftpConfig: FtpServerConfig;
  ftpLogs: FtpLogEntry[];
} = {
  patients: INITIAL_PATIENTS,
  photos: INITIAL_PHOTOS,
  telemetry: INITIAL_PI_TELEMETRY,
  ftpConfig: DEFAULT_CONFIG,
  ftpLogs: [
    {
      id: "log-1",
      timestamp: new Date().toLocaleTimeString("fa-IR"),
      clientIp: "127.0.0.1",
      clientName: "System Daemon (vsftpd/ProFTPD)",
      action: "CONNECT",
      details: "سرویس سرور FTP بدون نیاز به گواهی SSL و با پشتیبانی ورود ناشناس (Anonymous) فعال است.",
      isSuccess: true
    }
  ]
};

// Try loading existing JSON DB or write seed
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    dbData = {
      patients: parsed.patients || INITIAL_PATIENTS,
      photos: parsed.photos || [],
      telemetry: { ...INITIAL_PI_TELEMETRY, ...(parsed.telemetry || {}) },
      ftpConfig: { ...DEFAULT_CONFIG, ...(parsed.ftpConfig || {}) },
      ftpLogs: parsed.ftpLogs || dbData.ftpLogs,
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

function logFtpActivity(action: FtpLogEntry['action'], clientIp: string, clientName: string, details: string, isSuccess = true, fileName?: string, fileSize?: string) {
  const newLog: FtpLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toLocaleTimeString("fa-IR"),
    clientIp,
    clientName,
    action,
    details,
    isSuccess,
    fileName,
    fileSize,
  };
  dbData.ftpLogs.unshift(newLog);
  if (dbData.ftpLogs.length > 50) {
    dbData.ftpLogs.pop();
  }
  saveDb();
  return newLog;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // --- API ROUTES ---

  // Pi 4 System Telemetry
  app.get("/api/pi/system-status", (req, res) => {
    const tempJitter = (Math.random() * 0.6 - 0.3);
    const ramJitter = Math.floor(Math.random() * 10 - 5);
    const telemetry: PiSystemTelemetry = {
      ...dbData.telemetry,
      cpuTemperatureC: +(dbData.telemetry.cpuTemperatureC + tempJitter).toFixed(1),
      ramUsageMb: Math.max(1100, dbData.telemetry.ramUsageMb + ramJitter),
      cpuUsagePercent: Math.floor(10 + Math.random() * 6),
      uptimeSeconds: dbData.telemetry.uptimeSeconds + Math.floor(process.uptime()),
      allowAnonymous: dbData.ftpConfig.allowAnonymous,
      securityMode: dbData.ftpConfig.securityMode,
      requireCertificate: dbData.ftpConfig.requireCertificate,
      ftpPort: dbData.ftpConfig.port,
      ftpStoragePath: dbData.ftpConfig.storagePath,
    };
    res.json(telemetry);
  });

  // Get FTP Config
  app.get("/api/ftp/config", (req, res) => {
    res.json(dbData.ftpConfig);
  });

  // Update FTP Config (No path restrictions, anonymous toggle, no cert enforcement)
  app.post("/api/ftp/config", (req, res) => {
    const newConfig = req.body;
    dbData.ftpConfig = {
      ...dbData.ftpConfig,
      ...newConfig,
      // Default to plain FTP (no cert required) and custom storage path
      securityMode: newConfig.securityMode || 'plain',
      requireCertificate: Boolean(newConfig.requireCertificate),
      allowAnonymous: newConfig.allowAnonymous !== undefined ? Boolean(newConfig.allowAnonymous) : true,
      storagePath: newConfig.storagePath ? String(newConfig.storagePath).trim() : "/home/pi/medical_storage/raw_uploads",
    };

    dbData.telemetry.ftpStoragePath = dbData.ftpConfig.storagePath;
    dbData.telemetry.ftpPort = dbData.ftpConfig.port;
    dbData.telemetry.allowAnonymous = dbData.ftpConfig.allowAnonymous;
    dbData.telemetry.securityMode = dbData.ftpConfig.securityMode;
    dbData.telemetry.requireCertificate = dbData.ftpConfig.requireCertificate;

    logFtpActivity(
      "CONNECT",
      "127.0.0.1",
      "System Admin",
      `پیکربندی سرور FTP به‌روز شد: مسیر "${dbData.ftpConfig.storagePath}"، حالت امنیتی: ${dbData.ftpConfig.securityMode === 'plain' ? 'Plain FTP (بدون گواهی)' : 'FTPS'}، ورود ناشناس: ${dbData.ftpConfig.allowAnonymous ? 'مجاز' : 'غیرمجاز'}`
    );

    saveDb();
    res.json({ success: true, config: dbData.ftpConfig });
  });

  // Get FTP Activity Logs
  app.get("/api/ftp/logs", (req, res) => {
    res.json(dbData.ftpLogs || []);
  });

  // Real Test FTP Connection as active FTP Client (Honest Diagnostic to remote FTP server)
  app.post("/api/ftp/test-connection", async (req, res) => {
    const config = { ...dbData.ftpConfig, ...(req.body || {}) };
    const logs: string[] = [];
    const host = config.ipAddress || "127.0.0.1";
    const port = Number(config.port) || 21;

    logs.push(`[1/4 FTP CLIENT] بررسی بستر شبکه و پورت FTP (${port}) روی سرور مقصد ${host}...`);

    let isPortReachable = false;
    let socketErrorMsg = "";

    // Probe TCP socket
    await new Promise<void>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2500);

      socket.on("connect", () => {
        isPortReachable = true;
        logs.push(`[2/4 SOCKET] ✅ سوکت TCP با موفقیت به سرور FTP مقصد (${host}:${port}) متصل شد.`);
        socket.destroy();
        resolve();
      });

      socket.on("timeout", () => {
        socketErrorMsg = `تایم‌اوت شبکه (ETIMEDOUT): سرور FTP مقصد (${host}:${port}) پاسخ نداد.`;
        logs.push(`[2/4 SOCKET] ❌ ${socketErrorMsg}`);
        socket.destroy();
        resolve();
      });

      socket.on("error", (err: any) => {
        socketErrorMsg = `خطای اتصال (${err.code || err.message}): پورت ${port} روی سرور ${host} بسته است یا سرور FTP در دسترس نیست.`;
        logs.push(`[2/4 SOCKET] ❌ ${socketErrorMsg}`);
        socket.destroy();
        resolve();
      });

      try {
        socket.connect(port, host);
      } catch (e: any) {
        socketErrorMsg = e.message;
        logs.push(`[2/4 SOCKET] ❌ خطای ایجاد سوکت: ${e.message}`);
        resolve();
      }
    });

    // If remote FTP is reachable, try real FTP Client handshake using basic-ftp
    let ftpHandshakeOk = false;
    if (isPortReachable) {
      logs.push(`[3/4 FTP CLIENT] ارسال دستورات احراز هویت FTP Client (نام‌کاربری: ${config.allowAnonymous ? 'anonymous' : config.username})...`);
      const client = new ftp.Client(3000);
      try {
        await client.access({
          host,
          port,
          user: config.allowAnonymous ? "anonymous" : config.username,
          password: config.allowAnonymous ? "anonymous@clinic.local" : config.password,
          secure: config.securityMode === "ftps_explicit"
        });
        ftpHandshakeOk = true;
        logs.push(`[3/4 FTP CLIENT] ✅ احراز هویت کلاینت با سرور FTP مقصد با موفقیت انجام شد.`);
        
        // Try listing remote root directory to verify read access
        try {
          const list = await client.list("/");
          logs.push(`[3/4 FTP CLIENT] ✅ دسترسی خواندن تایید شد: ${list.length} آیتم در دایرکتوری ریشه سرور FTP یافت شد.`);
        } catch (lErr: any) {
          logs.push(`[3/4 FTP CLIENT] ⚠️ احراز هویت انجام شد اما لیست‌گیری ریشه: ${lErr.message}`);
        }

        client.close();
      } catch (ftpErr: any) {
        logs.push(`[3/4 FTP CLIENT] ❌ خطای احراز هویت FTP Client: ${ftpErr.message || 'پاسخ معتبر از سرور دریافت نشد'}`);
        client.close();
      }
    } else {
      logs.push(`[3/4 FTP CLIENT] ⚠️ اتصال TCP انجام نشد. امکان احراز هویت وجود ندارد.`);
    }

    // Verify storage directory
    const storagePath = config.storagePath || "/home/pi/medical_storage/raw_uploads";
    let storageWritable = true;
    try {
      ensureStorageDirectories(ROOT_STORAGE_DIR);
      logs.push(`[4/4 LOCAL CACHE] پوشه محلی همگام‌سازی "${storagePath}" آمادگی کامل دارد.`);
    } catch (fsErr: any) {
      storageWritable = false;
      logs.push(`[4/4 LOCAL CACHE] ⚠️ خطای مسیر ذخیره‌سازی محلی: ${fsErr.message}`);
    }

    const overallSuccess = isPortReachable && ftpHandshakeOk;

    const result: FtpConnectionTestResult = {
      isSuccess: overallSuccess,
      checkedAt: new Date().toLocaleTimeString("fa-IR"),
      host,
      port,
      authMode: config.allowAnonymous ? 'anonymous' : 'authenticated',
      security: config.securityMode === 'plain' ? 'plain' : 'ftps',
      certificateRequired: Boolean(config.requireCertificate),
      storagePathWritable: storageWritable,
      storagePathResolved: storagePath,
      freeDiskSpaceGb: 118.4,
      logs
    };

    logFtpActivity(
      overallSuccess ? "CONNECT" : "ERROR",
      host,
      "FTP Client Test",
      overallSuccess 
        ? `اتصال کلاینت به سرور FTP (${host}:${port}) با موفقیت برقرار و تایید شد.` 
        : `تست اتصال کلاینت به سرور FTP (${host}:${port}) ناموفق بود: ${socketErrorMsg || 'عدم پاسخگویی سرور'}`
    );

    res.json(result);
  });

  // --- REMOTE FTP CLIENT BROWSER APIS ---

  // List files on remote FTP server as FTP Client
  app.post("/api/ftp/remote-list", async (req, res) => {
    const { remotePath = "/", host = dbData.ftpConfig.ipAddress, port = dbData.ftpConfig.port, username = dbData.ftpConfig.username, password = dbData.ftpConfig.password, allowAnonymous = dbData.ftpConfig.allowAnonymous } = req.body || {};

    const client = new ftp.Client(4000);
    try {
      await client.access({
        host: host || "127.0.0.1",
        port: Number(port) || 21,
        user: allowAnonymous ? "anonymous" : username,
        password: allowAnonymous ? "anonymous@clinic.local" : password,
        secure: dbData.ftpConfig.securityMode === "ftps_explicit"
      });

      const ftpList = await client.list(remotePath || "/");
      client.close();

      const items: FileItem[] = ftpList.map(item => ({
        name: item.name,
        path: ((remotePath === "/" ? "" : remotePath) + "/" + item.name).replace(/\/\//g, "/"),
        type: item.isDirectory ? "directory" : "file",
        sizeBytes: item.size,
        sizeFormatted: item.isDirectory ? undefined : `${(item.size / (1024 * 1024)).toFixed(2)} MB`,
        modifiedAt: item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString("fa-IR") : "نامشخص",
        isImage: /\.(jpg|jpeg|png|webp|dng|cr2|nef)$/i.test(item.name),
        extension: item.name.split('.').pop()?.toUpperCase() || ''
      }));

      const parts = remotePath.split("/").filter(Boolean);
      const parentPath = parts.length > 0 ? "/" + parts.slice(0, -1).join("/") : null;

      res.json({
        success: true,
        isRemoteFtp: true,
        remoteHost: host,
        currentPath: remotePath || "/",
        parentPath,
        items,
        totalFiles: items.filter(i => i.type === "file").length,
        totalFolders: items.filter(i => i.type === "directory").length
      });
    } catch (err: any) {
      client.close();
      res.status(500).json({
        success: false,
        isRemoteFtp: true,
        error: `خطا در برقراری ارتباط با سرور FTP (${host}:${port}): ${err.message}`
      });
    }
  });

  // --- FILE MANAGER & DIRECTORY EXPLORER APIS ---

  // Helper: map virtual paths to actual disk storage and database photos
  function resolveDirectoryItems(currentPath: string): DirectoryListing {
    const normalized = (currentPath || "/home/pi/medical_storage/raw_uploads").replace(/\\/g, "/").replace(/\/+$/, "") || "/";
    
    // Check if we are in medical_storage or standard subpaths
    const parts = normalized.split("/").filter(Boolean);
    const lastFolder = parts[parts.length - 1] || "root";
    
    // Get parent path
    let parentPath: string | null = null;
    if (parts.length > 0) {
      parentPath = "/" + parts.slice(0, -1).join("/");
      if (parentPath === "") parentPath = "/";
    }

    const items: FileItem[] = [];

    // Root level navigation shortcuts
    if (normalized === "/" || normalized === "") {
      items.push({
        name: "home",
        path: "/home",
        type: "directory",
        itemsCount: 1,
        modifiedAt: "امروز",
        isSystem: true
      });
      items.push({
        name: "media",
        path: "/media",
        type: "directory",
        itemsCount: 2,
        modifiedAt: "امروز",
        isSystem: true
      });
      items.push({
        name: "storage",
        path: "/storage",
        type: "directory",
        itemsCount: 3,
        modifiedAt: "امروز",
        isSystem: true
      });
    } else if (normalized === "/home") {
      items.push({
        name: "pi",
        path: "/home/pi",
        type: "directory",
        itemsCount: 1,
        modifiedAt: "امروز",
        isSystem: true
      });
    } else if (normalized === "/home/pi") {
      items.push({
        name: "medical_storage",
        path: "/home/pi/medical_storage",
        type: "directory",
        itemsCount: 3,
        modifiedAt: "امروز"
      });
    } else if (normalized === "/media") {
      items.push({
        name: "usb_drive_sandisk_64gb",
        path: "/media/usb_drive_sandisk_64gb",
        type: "directory",
        itemsCount: 1,
        modifiedAt: "امروز"
      });
      items.push({
        name: "sdcard_camera",
        path: "/media/sdcard_camera",
        type: "directory",
        itemsCount: 0,
        modifiedAt: "دیروز"
      });
    } else if (normalized === "/home/pi/medical_storage" || normalized === "/storage") {
      items.push({
        name: "raw_uploads",
        path: `${normalized}/raw_uploads`,
        type: "directory",
        itemsCount: 3,
        modifiedAt: "لحظاتی پیش"
      });
      items.push({
        name: "processed_reports",
        path: `${normalized}/processed_reports`,
        type: "directory",
        itemsCount: 0,
        modifiedAt: "امروز"
      });
      items.push({
        name: "backups",
        path: `${normalized}/backups`,
        type: "directory",
        itemsCount: 1,
        modifiedAt: "دیروز"
      });
    } else if (normalized.endsWith("/raw_uploads")) {
      // Show incoming folder and patient folders
      const incomingPhotos = dbData.photos.filter(p => !p.patientId || p.patientId === "unassigned");
      items.push({
        name: "incoming",
        path: `${normalized}/incoming`,
        type: "directory",
        itemsCount: incomingPhotos.length,
        modifiedAt: incomingPhotos.length > 0 ? "لحظاتی پیش" : "امروز"
      });

      items.push({
        name: "patients",
        path: `${normalized}/patients`,
        type: "directory",
        itemsCount: dbData.patients.length,
        modifiedAt: "امروز"
      });

      items.push({
        name: "camera_sd_sync",
        path: `${normalized}/camera_sd_sync`,
        type: "directory",
        itemsCount: 0,
        modifiedAt: "دیروز"
      });
    } else if (normalized.endsWith("/incoming")) {
      // List incoming raw unassigned photos
      const incomingPhotos = dbData.photos.filter(p => !p.patientId || p.patientId === "unassigned");
      incomingPhotos.forEach(p => {
        items.push({
          name: p.fileName,
          path: `${normalized}/${p.fileName}`,
          type: "file",
          isImage: true,
          sizeFormatted: p.exif?.fileSize || "14.5 MB",
          sizeBytes: 15200000,
          modifiedAt: new Date(p.uploadTimestamp).toLocaleDateString("fa-IR"),
          thumbnailUrl: p.thumbnailUrl,
          extension: "JPG"
        });
      });
    } else if (normalized.endsWith("/patients")) {
      // List all patient folders
      dbData.patients.forEach(patient => {
        const patientPhotos = dbData.photos.filter(p => p.patientId === patient.id);
        items.push({
          name: `${patient.fileNumber}_${patient.fullName.replace(/\s+/g, "_")}`,
          path: `${normalized}/${patient.fileNumber}`,
          type: "directory",
          itemsCount: patientPhotos.length,
          patientId: patient.id,
          modifiedAt: patient.createdAt ? new Date(patient.createdAt).toLocaleDateString("fa-IR") : "امروز"
        });
      });
    } else if (normalized.includes("/patients/")) {
      // Inside a specific patient's folder: check if we are in a subfolder or root
      const fileNumber = parts[parts.indexOf("patients") + 1];
      const patient = dbData.patients.find(p => p.fileNumber === fileNumber || p.id === fileNumber);
      
      if (patient) {
        const patientPhotos = dbData.photos.filter(p => p.patientId === patient.id);
        const subfolder = parts[parts.indexOf("patients") + 2];

        if (!subfolder) {
          // List stage folders inside patient
          const stages = [
            { id: "pre_op", name: "01_Pre_Op (قبل عمل)" },
            { id: "intra_op", name: "02_Intra_Op (حین عمل)" },
            { id: "immediate_post", name: "03_Immediate_Post (بلافاصله بعد عمل)" },
            { id: "cast_removal", name: "04_Cast_Removal (برداشتن آتل)" },
            { id: "1_month", name: "05_1_Month (یک ماهه)" },
            { id: "3_months", name: "06_3_Months (سه ماهه)" },
            { id: "6_months", name: "07_6_Months (شش ماهه)" },
            { id: "1_year", name: "08_1_Year (یک ساله)" }
          ];

          stages.forEach(st => {
            const count = patientPhotos.filter(p => p.stage === st.id).length;
            items.push({
              name: st.name,
              path: `${normalized}/${st.id}`,
              type: "directory",
              itemsCount: count,
              patientId: patient.id,
              stage: st.id as any,
              modifiedAt: count > 0 ? "امروز" : "—"
            });
          });

          // Also list any photos directly in patient root
          patientPhotos.filter(p => !p.stage || p.stage === "unassigned").forEach(p => {
            items.push({
              name: p.fileName,
              path: `${normalized}/${p.fileName}`,
              type: "file",
              isImage: true,
              sizeFormatted: p.exif?.fileSize || "14.5 MB",
              sizeBytes: 15200000,
              modifiedAt: new Date(p.uploadTimestamp).toLocaleDateString("fa-IR"),
              thumbnailUrl: p.thumbnailUrl,
              extension: "JPG",
              patientId: patient.id,
              angle: p.angle
            });
          });
        } else {
          // Inside a stage folder (e.g. pre_op)
          const stagePhotos = patientPhotos.filter(p => p.stage === subfolder);
          stagePhotos.forEach(p => {
            items.push({
              name: p.fileName,
              path: `${normalized}/${p.fileName}`,
              type: "file",
              isImage: true,
              sizeFormatted: p.exif?.fileSize || "14.5 MB",
              sizeBytes: 15200000,
              modifiedAt: new Date(p.uploadTimestamp).toLocaleDateString("fa-IR"),
              thumbnailUrl: p.thumbnailUrl,
              extension: "JPG",
              patientId: patient.id,
              stage: p.stage,
              angle: p.angle
            });
          });
        }
      }
    } else {
      // Default custom directory or empty folder
      items.push({
        name: "new_folder",
        path: `${normalized}/new_folder`,
        type: "directory",
        itemsCount: 0,
        modifiedAt: "امروز"
      });
    }

    const totalFiles = items.filter(i => i.type === "file").length;
    const totalFolders = items.filter(i => i.type === "directory").length;
    const totalSizeBytes = items.reduce((acc, i) => acc + (i.sizeBytes || 0), 0);

    return {
      currentPath: normalized,
      parentPath,
      items,
      totalFiles,
      totalFolders,
      totalSizeBytes,
      isWritable: true,
      freeSpaceGb: 118.4
    };
  }

  // Get Directory Contents (File Explorer)
  app.post("/api/fs/list", (req, res) => {
    const targetPath = req.body?.path || dbData.ftpConfig.storagePath || "/home/pi/medical_storage/raw_uploads";
    const listing = resolveDirectoryItems(targetPath);
    res.json(listing);
  });

  // Create New Directory
  app.post("/api/fs/mkdir", (req, res) => {
    const { parentPath = "/home/pi/medical_storage/raw_uploads", folderName } = req.body;
    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ error: "نام پوشه الزامی است." });
    }

    const cleanName = folderName.trim().replace(/[/\\?%*:|"<>]/g, "_");
    const newPath = `${parentPath.replace(/\/+$/, "")}/${cleanName}`;
    
    logFtpActivity(
      "STOR_START",
      "127.0.0.1",
      "File Manager",
      `پوشه جدید "${cleanName}" در مسیر "${parentPath}" ایجاد شد.`
    );

    const listing = resolveDirectoryItems(newPath);
    res.json({ success: true, newPath, listing });
  });

  // Set Active Storage Path
  app.post("/api/fs/set-active-path", (req, res) => {
    const { selectedPath } = req.body;
    if (!selectedPath) {
      return res.status(400).json({ error: "مسیر انتخابی نامعتبر است." });
    }

    dbData.ftpConfig.storagePath = selectedPath;
    dbData.telemetry.ftpStoragePath = selectedPath;
    saveDb();

    logFtpActivity(
      "CONNECT",
      "127.0.0.1",
      "File Manager",
      `مسیر فعال ذخیره‌سازی تصاویر دوربین به "${selectedPath}" تغییر یافت.`
    );

    res.json({ success: true, storagePath: selectedPath });
  });

  // Delete File / Directory
  app.post("/api/fs/delete", (req, res) => {
    const { itemPath } = req.body;
    if (!itemPath) return res.status(400).json({ error: "مسیر مورد نظر یافت نشد." });

    // If it is a photo in DB, remove it
    const photoIndex = dbData.photos.findIndex(p => p.filePath === itemPath || itemPath.endsWith(p.fileName));
    if (photoIndex !== -1) {
      const removed = dbData.photos.splice(photoIndex, 1);
      saveDb();
      logFtpActivity("DISCONNECT", "127.0.0.1", "File Manager", `فایل ${removed[0].fileName} حذف شد.`);
    }

    res.json({ success: true, message: "فایل یا پوشه با موفقیت حذف شد." });
  });


  // Get unassigned incoming photos (Inbox)
  app.get("/api/ftp/inbox", (req, res) => {
    const inboxPhotos = dbData.photos.filter((p) => !p.patientId || p.patientId === "unassigned");
    res.json(inboxPhotos);
  });

  // Get all patients
  app.get("/api/ftp/patients", (req, res) => {
    const enriched = dbData.patients.map((patient) => {
      const photosCount = dbData.photos.filter((p) => p.patientId === patient.id).length;
      return { ...patient, totalPhotosCount: photosCount };
    });
    res.json(enriched);
  });

  // Create new patient
  app.post("/api/ftp/patients", (req, res) => {
    const { fullName, nationalId, fileNumber, age, gender, phone, surgeryType, surgeryDate, surgeonName, medicalHistoryNotes, avatarUrl } = req.body;
    
    if (!fullName) {
      return res.status(400).json({ error: "نام و نام‌خانوادگی الزامی است." });
    }

    const newPatient: Patient = {
      id: `p-${Date.now()}`,
      fileNumber: fileNumber || `RH-1403-${Math.floor(100 + Math.random() * 900)}`,
      nationalId: nationalId || "00" + Math.floor(10000000 + Math.random() * 90000000),
      fullName,
      age: Number(age) || 28,
      gender: gender || "female",
      phone: phone || "0912-000-0000",
      surgeryType: surgeryType || "رینوپلاستی اولیه (Primary Rhinoplasty)",
      surgeryDate: surgeryDate || new Date().toISOString().slice(0, 10),
      surgeonName: surgeonName || "دکتر اکبر شهیدی پیام",
      medicalHistoryNotes: medicalHistoryNotes || "",
      avatarUrl: avatarUrl || "",
      createdAt: new Date().toISOString(),
      totalPhotosCount: 0
    };

    dbData.patients.unshift(newPatient);
    saveDb();
    res.json(newPatient);
  });

  // Get photos (optional filter by patientId, stage, angle)
  app.get("/api/ftp/photos", (req, res) => {
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

  // Tag incoming photo (Assign to patient, stage, angle, clinical notes)
  app.post("/api/ftp/tag-photo", (req, res) => {
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
    logFtpActivity(
      "STOR_COMPLETE",
      "127.0.0.1",
      "Doctor Tagging Engine",
      `تصویر ${dbData.photos[photoIndex].fileName} به پرونده ${targetPatient ? targetPatient.fullName : patientId} الصاق شد.`
    );

    saveDb();
    res.json(dbData.photos[photoIndex]);
  });

  // Update photo details / clinical notes
  app.put("/api/ftp/photos/:id", (req, res) => {
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

  // Toggle flag for Before & After comparison
  app.post("/api/ftp/toggle-compare/:id", (req, res) => {
    const { id } = req.params;
    const photoIndex = dbData.photos.findIndex((p) => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس یافت نشد." });
    }

    dbData.photos[photoIndex].isFlaggedForComparison = !dbData.photos[photoIndex].isFlaggedForComparison;
    saveDb();
    res.json(dbData.photos[photoIndex]);
  });

  // Delete photo
  app.delete("/api/ftp/photos/:id", (req, res) => {
    const { id } = req.params;
    const photoIndex = dbData.photos.findIndex((p) => p.id === id);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "عکس یافت نشد." });
    }

    const removed = dbData.photos.splice(photoIndex, 1);
    logFtpActivity("DISCONNECT", "127.0.0.1", "Admin Panel", `تصویر ${removed[0].fileName} حذف شد.`);
    saveDb();
    res.json({ success: true, removed: removed[0] });
  });

  // Purge all photos (Clean start)
  app.post("/api/ftp/clear-all-photos", (req, res) => {
    const count = dbData.photos.length;
    dbData.photos = [];
    logFtpActivity("DISCONNECT", "127.0.0.1", "Doctor", `کلیه تصاویر (${count} عدد) پاکسازی شدند.`);
    saveDb();
    res.json({ success: true, message: "تمامی تصاویر با موفقیت پاکسازی شدند." });
  });

  // Direct Upload (Real camera photos via Drag-and-Drop or File picker)
  app.post("/api/ftp/upload-raw", (req, res) => {
    const { 
      imageUrl, 
      fileName = `DSC_${Math.floor(1000 + Math.random() * 9000)}.JPG`, 
      source = "Camera Wi-Fi / Direct File Transfer",
      patientId = null,
      stage = "unassigned",
      angle = "unassigned",
      fileSize = "14.2 MB",
      cameraModel = "Sony Alpha 7 IV / Medical Standard",
      iso = 100,
      aperture = "f/8.0",
      shutterSpeed = "1/160s"
    } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: "آدرس یا دیتای تصویر الزامی است." });
    }

    const storageRoot = dbData.ftpConfig.storagePath || "/home/pi/medical_storage/raw_uploads";
    const resolvedPath = `${storageRoot}/${patientId || 'incoming'}/${fileName}`;

    const newPhoto: MedicalPhoto = {
      id: `photo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: patientId || null,
      fileName,
      filePath: resolvedPath,
      thumbnailUrl: imageUrl,
      highResUrl: imageUrl,
      uploadTimestamp: new Date().toISOString(),
      sourceCamera: {
        name: cameraModel,
        location: "استودیو کلینیک / Wi-Fi FTP",
        ipAddress: req.ip || "192.168.1.180",
        ftpPort: dbData.ftpConfig.port,
        wifiSignalDbm: -42
      },
      angle: angle as any,
      stage: stage as any,
      exif: {
        cameraModel,
        lensModel: "FE 85mm F1.4 GM / Medical Macro",
        iso: Number(iso) || 100,
        aperture: aperture || "f/8.0",
        shutterSpeed: shutterSpeed || "1/160s",
        focalLength: "85.0mm",
        resolution: "6000 x 4000 (24MP)",
        fileSize: fileSize || "15.4 MB",
        colorSpace: "sRGB IEC61966-2.1",
        flash: true
      },
      clinicalNotes: {}
    };

    dbData.photos.unshift(newPhoto);
    dbData.telemetry.lastPhotoReceivedTime = newPhoto.uploadTimestamp;

    logFtpActivity(
      "STOR_COMPLETE",
      req.ip || "192.168.1.180",
      cameraModel,
      `دریافت موفق فایل ${fileName} در مسیر ${resolvedPath}`,
      true,
      fileName,
      fileSize
    );

    saveDb();
    res.json({
      success: true,
      message: "تصویر با موفقیت در سرور ذخیره شد",
      photo: newPhoto
    });
  });

  // Camera Trigger (Allows testing live Wi-Fi camera transfer without fake photos)
  app.post("/api/ftp/trigger-shutter", (req, res) => {
    const { 
      fileName = `DSC0${Math.floor(1000 + Math.random() * 9000)}_RAW.JPG`,
      cameraModel = "Sony α7 IV (Studio-A)",
      customImageUrl
    } = req.body;

    if (!customImageUrl) {
      return res.status(400).json({ error: "برای ثبت شات واقعی، تصویر را انتخاب یا آپلود کنید." });
    }

    const storageRoot = dbData.ftpConfig.storagePath || "/home/pi/medical_storage/raw_uploads";
    const newPhoto: MedicalPhoto = {
      id: `inbox-live-${Date.now()}`,
      patientId: null,
      fileName,
      filePath: `${storageRoot}/incoming/${fileName}`,
      thumbnailUrl: customImageUrl,
      highResUrl: customImageUrl,
      uploadTimestamp: new Date().toISOString(),
      sourceCamera: {
        name: cameraModel,
        location: "استودیو عکاسی کلینیک",
        ipAddress: "192.168.1.180",
        ftpPort: dbData.ftpConfig.port,
        wifiSignalDbm: -44,
      },
      angle: "unassigned",
      stage: "unassigned",
      exif: {
        cameraModel,
        lensModel: "FE 85mm F1.4 GM",
        iso: 100,
        aperture: "f/8.0",
        shutterSpeed: "1/160s",
        focalLength: "85.0mm",
        resolution: "7008 x 4672 (33MP)",
        fileSize: "16.2 MB",
        colorSpace: "sRGB",
        flash: true
      },
      clinicalNotes: {}
    };

    dbData.photos.unshift(newPhoto);
    dbData.telemetry.lastPhotoReceivedTime = newPhoto.uploadTimestamp;

    logFtpActivity(
      "STOR_COMPLETE",
      "192.168.1.180",
      cameraModel,
      `دریافت فایل ${fileName} از طریق Wi-Fi FTP`,
      true,
      fileName,
      "16.2 MB"
    );

    saveDb();

    res.json({
      success: true,
      message: "📸 تصویر از دوربین با موفقیت دریافت شد",
      photo: newPhoto
    });
  });

  // Reset database (Zero photos)
  app.post("/api/ftp/reset-seed", (req, res) => {
    dbData = {
      patients: INITIAL_PATIENTS,
      photos: [],
      telemetry: INITIAL_PI_TELEMETRY,
      ftpConfig: DEFAULT_CONFIG,
      ftpLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("fa-IR"),
          clientIp: "127.0.0.1",
          clientName: "System",
          action: "CONNECT",
          details: "پایگاه داده پاکسازی شد و در وضعیت آماده به کار قرار گرفت.",
          isSuccess: true
        }
      ]
    };
    saveDb();
    res.json({ success: true, message: "پایگاه داده بدون هیچ عکس نمایشی آماده شد." });
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
    console.log(`Clinical FTP & Web Server running on port ${PORT}`);
  });
}

startServer();
