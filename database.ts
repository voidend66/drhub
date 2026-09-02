import fs from "fs";
import path from "path";
import DatabaseConstructor, { Database as SqliteDatabase } from "better-sqlite3";
import { Patient, MedicalPhoto, StoragePartitionInfo } from "./src/types";

export interface SqliteStatus {
  enabled: boolean;
  configuredPath: string;
  actualPath: string;
  directoryPath: string;
  isConnected: boolean;
  isFallback: boolean;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  patientsCount: number;
  photosCount: number;
  isWritable: boolean;
  directoryExists: boolean;
  statusMessage: string;
  lastUpdated: string;
}

// Default requested path: /media/mahdi/mm/doctor
const DEFAULT_SQLITE_DIR = "/media/mahdi/mm/doctor";
const DEFAULT_SQLITE_FILE = "patients.db";
const FALLBACK_SQLITE_DIR = path.join(process.cwd(), "medical_storage", "doctor");

let activeDbInstance: SqliteDatabase | null = null;
let currentConfiguredPath = process.env.SQLITE_DB_PATH || path.join(DEFAULT_SQLITE_DIR, DEFAULT_SQLITE_FILE);
let currentActualPath = currentConfiguredPath;
let isCurrentFallback = false;
let lastStatusError: string | null = null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 بایت";
  const k = 1024;
  const sizes = ["بایت", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Initialize SQLite tables for patients, photos, and settings
 */
function initSchema(db: SqliteDatabase) {
  // Optimize sqlite pragmas for reliable embedded writes on Raspberry Pi
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      fileNumber TEXT UNIQUE,
      nationalId TEXT,
      fullName TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      phone TEXT,
      surgeryType TEXT,
      surgeryDate TEXT,
      surgeonName TEXT,
      medicalHistoryNotes TEXT,
      avatarUrl TEXT,
      createdAt TEXT,
      totalPhotosCount INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      patientId TEXT,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      thumbnailUrl TEXT,
      highResUrl TEXT,
      uploadTimestamp TEXT,
      angle TEXT,
      stage TEXT,
      isFlaggedForComparison INTEGER DEFAULT 0,
      exifJson TEXT,
      clinicalNotesJson TEXT,
      sourceCameraJson TEXT,
      FOREIGN KEY (patientId) REFERENCES patients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_patients_filenumber ON patients(fileNumber);
    CREATE INDEX IF NOT EXISTS idx_photos_patient_id ON photos(patientId);
    CREATE INDEX IF NOT EXISTS idx_photos_stage ON photos(stage);
  `);
}

/**
 * Connect to SQLite at the given path, with graceful fallback if the directory is not accessible.
 */
export function initSqliteDatabase(requestedPath?: string): { success: boolean; path: string; isFallback: boolean; error?: string } {
  const targetPath = requestedPath ? path.resolve(requestedPath) : path.resolve(currentConfiguredPath);
  currentConfiguredPath = targetPath;
  lastStatusError = null;

  // Close previous connection if any
  if (activeDbInstance) {
    try {
      activeDbInstance.close();
    } catch (e) {}
    activeDbInstance = null;
  }

  const targetDir = path.dirname(targetPath);

  // Attempt 1: Connect to requested path (e.g. /media/mahdi/mm/doctor/patients.db)
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const db = new DatabaseConstructor(targetPath);
    initSchema(db);
    activeDbInstance = db;
    currentActualPath = targetPath;
    isCurrentFallback = false;
    return { success: true, path: targetPath, isFallback: false };
  } catch (err: any) {
    lastStatusError = err.message;
    console.warn(`[SQLite Notice] Could not open SQLite at "${targetPath}": ${err.message}. Attempting safe fallback directory...`);
  }

  // Attempt 2: Fallback to local storage (e.g. ./medical_storage/doctor/patients.db)
  try {
    if (!fs.existsSync(FALLBACK_SQLITE_DIR)) {
      fs.mkdirSync(FALLBACK_SQLITE_DIR, { recursive: true });
    }
    const fallbackPath = path.join(FALLBACK_SQLITE_DIR, DEFAULT_SQLITE_FILE);
    const db = new DatabaseConstructor(fallbackPath);
    initSchema(db);
    activeDbInstance = db;
    currentActualPath = fallbackPath;
    isCurrentFallback = true;
    return {
      success: true,
      path: fallbackPath,
      isFallback: true,
      error: `دسترسی به مسیر درخواستی (${targetPath}) میسر نشد؛ پایگاه داده موقتاً در مسیر امن محلی رزبری‌پای (${fallbackPath}) فعال گردید.`
    };
  } catch (fallbackErr: any) {
    console.error("[SQLite Error] Critical failure opening SQLite fallback:", fallbackErr);
    lastStatusError = fallbackErr.message;
    return { success: false, path: targetPath, isFallback: false, error: fallbackErr.message };
  }
}

/**
 * Get active SQLite connection, self-healing if needed.
 */
export function getDb(): SqliteDatabase {
  if (!activeDbInstance) {
    initSqliteDatabase(currentConfiguredPath);
  }
  if (!activeDbInstance) {
    throw new Error("پایگاه داده SQLite در دسترس نیست: " + (lastStatusError || "خطای ناشناخته"));
  }
  return activeDbInstance;
}

/**
 * Returns comprehensive status of the SQLite database
 */
export function getSqliteStatus(): SqliteStatus {
  const dirPath = path.dirname(currentActualPath);
  const dirExists = fs.existsSync(dirPath);
  const fileExists = fs.existsSync(currentActualPath);
  let fileSizeBytes = 0;
  let isWritable = false;

  if (fileExists) {
    try {
      const stat = fs.statSync(currentActualPath);
      fileSizeBytes = stat.size;
    } catch (e) {}
  }

  if (dirExists) {
    try {
      fs.accessSync(dirPath, fs.constants.W_OK);
      isWritable = true;
    } catch {
      isWritable = false;
    }
  }

  let patientsCount = 0;
  let photosCount = 0;
  let isConnected = false;

  try {
    const db = getDb();
    const pCountRow = db.prepare("SELECT COUNT(*) as count FROM patients").get() as { count: number };
    const phCountRow = db.prepare("SELECT COUNT(*) as count FROM photos").get() as { count: number };
    patientsCount = pCountRow?.count || 0;
    photosCount = phCountRow?.count || 0;
    isConnected = true;
  } catch (e) {
    isConnected = false;
  }

  let statusMessage = "پایگاه داده SQLite متصل و آماده است.";
  if (isCurrentFallback) {
    statusMessage = `توجه: هارد مسیر ${currentConfiguredPath} هنوز متصل نیست یا دسترسی نداشت، داده‌ها موقتاً در مسیر محلی ذخیره می‌شوند.`;
  } else if (!isConnected) {
    statusMessage = "خطا در اتصال به فایل SQLite.";
  }

  return {
    enabled: true,
    configuredPath: currentConfiguredPath,
    actualPath: currentActualPath,
    directoryPath: dirPath,
    isConnected,
    isFallback: isCurrentFallback,
    fileSizeBytes,
    fileSizeFormatted: formatBytes(fileSizeBytes),
    patientsCount,
    photosCount,
    isWritable,
    directoryExists: dirExists,
    statusMessage,
    lastUpdated: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// PATIENT OPERATIONS
// -------------------------------------------------------------

export function getAllPatientsFromSqlite(): Patient[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM photos ph WHERE ph.patientId = p.id) as computedPhotosCount
      FROM patients p 
      ORDER BY p.createdAt DESC
    `).all() as any[];

    return rows.map(r => ({
      id: r.id,
      fileNumber: r.fileNumber,
      nationalId: r.nationalId || "",
      fullName: r.fullName,
      age: Number(r.age) || 0,
      gender: r.gender || "female",
      phone: r.phone || "",
      surgeryType: r.surgeryType || "رینوپلاستی اولیه",
      surgeryDate: r.surgeryDate || "",
      surgeonName: r.surgeonName || "دکتر اکبر شهیدی پیام",
      medicalHistoryNotes: r.medicalHistoryNotes || "",
      avatarUrl: r.avatarUrl || "",
      createdAt: r.createdAt || new Date().toISOString(),
      totalPhotosCount: r.computedPhotosCount ?? r.totalPhotosCount ?? 0
    }));
  } catch (e) {
    console.error("Error reading patients from SQLite:", e);
    return [];
  }
}

export function getPatientByIdFromSqlite(id: string): Patient | null {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as any;
    if (!row) return null;
    const countRow = db.prepare("SELECT COUNT(*) as count FROM photos WHERE patientId = ?").get(id) as any;
    return {
      id: row.id,
      fileNumber: row.fileNumber,
      nationalId: row.nationalId || "",
      fullName: row.fullName,
      age: Number(row.age) || 0,
      gender: row.gender || "female",
      phone: row.phone || "",
      surgeryType: row.surgeryType || "",
      surgeryDate: row.surgeryDate || "",
      surgeonName: row.surgeonName || "",
      medicalHistoryNotes: row.medicalHistoryNotes || "",
      avatarUrl: row.avatarUrl || "",
      createdAt: row.createdAt || "",
      totalPhotosCount: countRow?.count || 0
    };
  } catch (e) {
    console.error("Error getting patient by id from SQLite:", e);
    return null;
  }
}

export function upsertPatientToSqlite(patient: Patient): boolean {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO patients (
        id, fileNumber, nationalId, fullName, age, gender, phone,
        surgeryType, surgeryDate, surgeonName, medicalHistoryNotes, avatarUrl, createdAt, totalPhotosCount
      ) VALUES (
        @id, @fileNumber, @nationalId, @fullName, @age, @gender, @phone,
        @surgeryType, @surgeryDate, @surgeonName, @medicalHistoryNotes, @avatarUrl, @createdAt, @totalPhotosCount
      )
      ON CONFLICT(id) DO UPDATE SET
        fileNumber = excluded.fileNumber,
        nationalId = excluded.nationalId,
        fullName = excluded.fullName,
        age = excluded.age,
        gender = excluded.gender,
        phone = excluded.phone,
        surgeryType = excluded.surgeryType,
        surgeryDate = excluded.surgeryDate,
        surgeonName = excluded.surgeonName,
        medicalHistoryNotes = excluded.medicalHistoryNotes,
        avatarUrl = excluded.avatarUrl
    `);

    stmt.run({
      id: patient.id,
      fileNumber: patient.fileNumber,
      nationalId: patient.nationalId || "",
      fullName: patient.fullName,
      age: patient.age || 0,
      gender: patient.gender || "female",
      phone: patient.phone || "",
      surgeryType: patient.surgeryType || "",
      surgeryDate: patient.surgeryDate || "",
      surgeonName: patient.surgeonName || "",
      medicalHistoryNotes: patient.medicalHistoryNotes || "",
      avatarUrl: patient.avatarUrl || "",
      createdAt: patient.createdAt || new Date().toISOString(),
      totalPhotosCount: patient.totalPhotosCount || 0
    });
    return true;
  } catch (e) {
    console.error("Error upserting patient into SQLite:", e);
    return false;
  }
}

export function deletePatientFromSqlite(id: string): boolean {
  try {
    const db = getDb();
    db.prepare("DELETE FROM patients WHERE id = ?").run(id);
    return true;
  } catch (e) {
    console.error("Error deleting patient from SQLite:", e);
    return false;
  }
}

// -------------------------------------------------------------
// PHOTO OPERATIONS
// -------------------------------------------------------------

export function getAllPhotosFromSqlite(): MedicalPhoto[] {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM photos ORDER BY uploadTimestamp DESC").all() as any[];
    return rows.map(r => {
      let exif = {};
      let clinicalNotes = {};
      let sourceCamera = { name: "دوربین کلینیک", location: "محلی", ipAddress: "127.0.0.1", ftpPort: 0, wifiSignalDbm: 0 };

      try { if (r.exifJson) exif = JSON.parse(r.exifJson); } catch (e) {}
      try { if (r.clinicalNotesJson) clinicalNotes = JSON.parse(r.clinicalNotesJson); } catch (e) {}
      try { if (r.sourceCameraJson) sourceCamera = JSON.parse(r.sourceCameraJson); } catch (e) {}

      return {
        id: r.id,
        patientId: r.patientId || null,
        fileName: r.fileName,
        filePath: r.filePath,
        thumbnailUrl: r.thumbnailUrl || "",
        highResUrl: r.highResUrl || "",
        uploadTimestamp: r.uploadTimestamp,
        angle: r.angle,
        stage: r.stage,
        isFlaggedForComparison: Boolean(r.isFlaggedForComparison),
        exif: exif as any,
        clinicalNotes: clinicalNotes as any,
        sourceCamera: sourceCamera as any
      };
    });
  } catch (e) {
    console.error("Error reading photos from SQLite:", e);
    return [];
  }
}

export function upsertPhotoToSqlite(photo: MedicalPhoto): boolean {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO photos (
        id, patientId, fileName, filePath, thumbnailUrl, highResUrl,
        uploadTimestamp, angle, stage, isFlaggedForComparison,
        exifJson, clinicalNotesJson, sourceCameraJson
      ) VALUES (
        @id, @patientId, @fileName, @filePath, @thumbnailUrl, @highResUrl,
        @uploadTimestamp, @angle, @stage, @isFlaggedForComparison,
        @exifJson, @clinicalNotesJson, @sourceCameraJson
      )
      ON CONFLICT(id) DO UPDATE SET
        patientId = excluded.patientId,
        fileName = excluded.fileName,
        filePath = excluded.filePath,
        thumbnailUrl = excluded.thumbnailUrl,
        highResUrl = excluded.highResUrl,
        angle = excluded.angle,
        stage = excluded.stage,
        isFlaggedForComparison = excluded.isFlaggedForComparison,
        exifJson = excluded.exifJson,
        clinicalNotesJson = excluded.clinicalNotesJson
    `);

    stmt.run({
      id: photo.id,
      patientId: photo.patientId || null,
      fileName: photo.fileName,
      filePath: photo.filePath,
      thumbnailUrl: photo.thumbnailUrl || "",
      highResUrl: photo.highResUrl || "",
      uploadTimestamp: photo.uploadTimestamp || new Date().toISOString(),
      angle: photo.angle || "unassigned",
      stage: photo.stage || "unassigned",
      isFlaggedForComparison: photo.isFlaggedForComparison ? 1 : 0,
      exifJson: JSON.stringify(photo.exif || {}),
      clinicalNotesJson: JSON.stringify(photo.clinicalNotes || {}),
      sourceCameraJson: JSON.stringify(photo.sourceCamera || {})
    });
    return true;
  } catch (e) {
    console.error("Error upserting photo into SQLite:", e);
    return false;
  }
}

export function deletePhotoFromSqlite(id: string): boolean {
  try {
    const db = getDb();
    db.prepare("DELETE FROM photos WHERE id = ?").run(id);
    return true;
  } catch (e) {
    console.error("Error deleting photo from SQLite:", e);
    return false;
  }
}

export function clearAllPhotosFromSqlite(): boolean {
  try {
    const db = getDb();
    db.prepare("DELETE FROM photos").run();
    return true;
  } catch (e) {
    console.error("Error clearing photos in SQLite:", e);
    return false;
  }
}

// -------------------------------------------------------------
// SEED & SYNC
// -------------------------------------------------------------

export function seedInitialDataIfEmpty(initialPatients: Patient[], initialPhotos: MedicalPhoto[]) {
  try {
    const db = getDb();
    const countRow = db.prepare("SELECT COUNT(*) as count FROM patients").get() as { count: number };
    if (countRow && countRow.count === 0 && initialPatients.length > 0) {
      console.log(`[SQLite Seed] Populating initial ${initialPatients.length} patients and ${initialPhotos.length} photos into SQLite...`);
      const insertManyPatients = db.transaction((patients: Patient[]) => {
        for (const p of patients) {
          upsertPatientToSqlite(p);
        }
      });
      insertManyPatients(initialPatients);

      const insertManyPhotos = db.transaction((photos: MedicalPhoto[]) => {
        for (const ph of photos) {
          upsertPhotoToSqlite(ph);
        }
      });
      insertManyPhotos(initialPhotos);
      console.log("[SQLite Seed] Seed completed successfully.");
    }
  } catch (e) {
    console.warn("Could not seed SQLite:", e);
  }
}

// Auto initialize on module load
initSqliteDatabase();
