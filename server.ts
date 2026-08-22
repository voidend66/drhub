import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { INITIAL_PATIENTS, INITIAL_PHOTOS, INITIAL_PI_TELEMETRY } from "./src/data/seedData";
import { Patient, MedicalPhoto, PiSystemTelemetry } from "./src/types";

const DB_FILE_PATH = path.join(process.cwd(), "medical_photos_db.json");

// Ensure DB initialization
let dbData: {
  patients: Patient[];
  photos: MedicalPhoto[];
  telemetry: PiSystemTelemetry;
} = {
  patients: INITIAL_PATIENTS,
  photos: INITIAL_PHOTOS,
  telemetry: INITIAL_PI_TELEMETRY,
};

// Try loading existing JSON DB or write seed
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    dbData = JSON.parse(raw);
  } else {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2));
  }
} catch (e) {
  console.warn("Using in-memory seed DB:", e);
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2));
  } catch (e) {
    console.error("Failed to write to medical_photos_db.json", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // --- API ROUTES ---

  // Pi 4 System Telemetry
  app.get("/api/pi/system-status", (req, res) => {
    // Add minor realistic jitter for live temperature and RAM
    const tempJitter = (Math.random() * 0.8 - 0.4);
    const ramJitter = Math.floor(Math.random() * 12 - 6);
    const telemetry: PiSystemTelemetry = {
      ...dbData.telemetry,
      cpuTemperatureC: +(dbData.telemetry.cpuTemperatureC + tempJitter).toFixed(1),
      ramUsageMb: Math.max(1200, dbData.telemetry.ramUsageMb + ramJitter),
      cpuUsagePercent: Math.floor(12 + Math.random() * 8),
      uptimeSeconds: dbData.telemetry.uptimeSeconds + Math.floor(process.uptime()),
    };
    res.json(telemetry);
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
      avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
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
    saveDb();
    res.json({ success: true, removed: removed[0] });
  });

  // Camera Wi-Fi Trigger Shutter Simulation (Creates a new RAW shot into FTP inbox)
  app.post("/api/ftp/trigger-shutter", (req, res) => {
    const { source = "Studio A", angleHint = "profile_right" } = req.body;
    const shotNumber = Math.floor(1000 + Math.random() * 9000);
    const fileName = `DSC0${shotNumber}_RAW.JPG`;

    const sampleImages = [
      {
        url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=80",
        angle: "profile_right",
        conf: 95
      },
      {
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
        angle: "frontal",
        conf: 98
      },
      {
        url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=1200&q=80",
        angle: "profile_left",
        conf: 92
      },
      {
        url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80",
        angle: "oblique_right",
        conf: 90
      },
      {
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
        angle: "basal",
        conf: 94
      }
    ];

    const chosen = sampleImages[Math.floor(Math.random() * sampleImages.length)];

    const newPhoto: MedicalPhoto = {
      id: `inbox-live-${Date.now()}`,
      patientId: null,
      fileName,
      filePath: `medical_storage/raw_uploads/incoming/${fileName}`,
      thumbnailUrl: chosen.url,
      highResUrl: chosen.url,
      uploadTimestamp: new Date().toISOString(),
      sourceCamera: {
        name: source === "Operating Room" ? "Canon EOS R6 (OR-2)" : "Sony α7 IV (Studio-A)",
        location: source === "Operating Room" ? "اتاق عمل شماره ۲" : "استودیو عکاسی کلینیک",
        ipAddress: source === "Operating Room" ? "192.168.1.185" : "192.168.1.180",
        ftpPort: 2121,
        wifiSignalDbm: -45 - Math.floor(Math.random() * 8),
      },
      angle: "unassigned",
      stage: "unassigned",
      exif: {
        cameraModel: source === "Operating Room" ? "Canon EOS R6" : "ILCE-7M4",
        lensModel: source === "Operating Room" ? "RF 24-70mm F2.8 L" : "FE 85mm F1.4 GM",
        iso: source === "Operating Room" ? 400 : 100,
        aperture: "f/8.0",
        shutterSpeed: "1/160s",
        focalLength: "85.0mm",
        resolution: "7008 x 4672 (33MP)",
        fileSize: (15.5 + Math.random() * 2.5).toFixed(1) + " MB",
        colorSpace: "sRGB IEC61966-2.1",
        flash: source !== "Operating Room"
      },
      clinicalNotes: {},
      aiSuggestedAngle: chosen.angle as any,
      aiSuggestedConfidence: chosen.conf
    };

    dbData.photos.unshift(newPhoto);
    dbData.telemetry.lastPhotoReceivedTime = newPhoto.uploadTimestamp;
    saveDb();

    res.json({
      success: true,
      message: "📸 تصویر جدید از دوربین دریافت شد",
      photo: newPhoto
    });
  });

  // Direct Upload Simulation
  app.post("/api/ftp/upload-raw", (req, res) => {
    const { imageUrl, fileName = "MANUAL_UPLOAD.JPG", source = "USB/Web" } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: "آدرس یا دیتای تصویر الزامی است." });
    }

    const newPhoto: MedicalPhoto = {
      id: `inbox-upload-${Date.now()}`,
      patientId: null,
      fileName,
      filePath: `medical_storage/raw_uploads/incoming/${fileName}`,
      thumbnailUrl: imageUrl,
      highResUrl: imageUrl,
      uploadTimestamp: new Date().toISOString(),
      sourceCamera: {
        name: "Manual Upload / Direct Client",
        location: "پنل وب پزشک",
        ipAddress: "127.0.0.1",
        ftpPort: 2121,
        wifiSignalDbm: -30
      },
      angle: "unassigned",
      stage: "unassigned",
      exif: {
        cameraModel: "Direct Digital Import",
        lensModel: "Medical Prime",
        iso: 100,
        aperture: "f/8.0",
        shutterSpeed: "1/160s",
        focalLength: "85.0mm",
        resolution: "4000 x 3000",
        fileSize: "8.5 MB",
        colorSpace: "sRGB",
        flash: true
      },
      clinicalNotes: {}
    };

    dbData.photos.unshift(newPhoto);
    saveDb();
    res.json(newPhoto);
  });

  // Reset database to seed
  app.post("/api/ftp/reset-seed", (req, res) => {
    dbData = {
      patients: INITIAL_PATIENTS,
      photos: INITIAL_PHOTOS,
      telemetry: INITIAL_PI_TELEMETRY,
    };
    saveDb();
    res.json({ success: true, message: "دیتابیس به حالت اولیه بازنشانی شد." });
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
    console.log(`Raspberry Pi 4 Clinical Server listening on port ${PORT}`);
  });
}

startServer();
