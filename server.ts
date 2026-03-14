import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import multer from "multer";
import fs from "fs";


if (typeof process === 'undefined') {
  (globalThis as any).process = { env: { NODE_ENV: 'development' } };
}

const db = new Database("podcast_studio.db");

const SCRIPT_URL = process.env.SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzPsBSM0sdZWv6gw8PNuzrz71iXKb-bnmPO5aFzAIf3XogBho6Xp4qn6Zt8487dBxl3/exec";


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/letters';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed') as any);
    }
  }
});

// Google Apps Script Helper
async function sendBookingToAppsScript(booking: any) {
  if (!SCRIPT_URL) {
    console.warn("Google Apps Script integration skipped: URL not set in server.ts");
    return null;
  }

  try {
    let fileData = null;
    let fileName = null;

    if (booking.request_letter_path && fs.existsSync(booking.request_letter_path)) {
      const fileBuffer = fs.readFileSync(booking.request_letter_path);
      fileData = fileBuffer.toString('base64');
      fileName = path.basename(booking.request_letter_path);
    }

    const payload = {
      ...booking,
      fileData,
      fileName
    };

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      const result = await response.json();
      console.log("Successfully sent booking and file to Google Apps Script");
      return result;
    } else {
      const text = await response.text();
      console.error("Failed to send booking to Google Apps Script. Status:", response.status, "Body snippet:", text.substring(0, 200));
      return null;
    }
  } catch (error) {
    console.error("Error sending to Google Apps Script:", error);
    return null;
  }
}

// Google Apps Script Helper for Actions (Delete/Update)
async function syncActionToAppsScript(action: 'delete' | 'update' | 'updateStatus', id: any, data: any = {}) {
  if (!SCRIPT_URL) return { success: false, error: "SCRIPT_URL not configured" };
  try {
    const cleanId = id.toString().trim();
    console.log(`[SYNC] ${action.toUpperCase()} request for ID: ${cleanId}`);

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        id: cleanId,
        ...data
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[SYNC] Apps Script response:`, result);
      if (result.result === 'success' || result.success) {
        return { success: true };
      }
      return { success: false, error: result.error || "Apps Script failed to perform action" };
    }

    const text = await response.text();
    console.error(`[SYNC] HTTP Error ${response.status}:`, text);
    return { success: false, error: `Server Error (${response.status})` };
  } catch (error) {
    console.error(`[SYNC] Critical Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Network/System Error" };
  }
}

// Initialize Database
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS studios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      capacity INTEGER DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studio_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      user_type TEXT DEFAULT 'Mahasiswa',
      phone_number TEXT,
      organization TEXT,
      request_letter_path TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (studio_id) REFERENCES studios(id)
    );
  `);

  // Add user_type column if it doesn't exist (for existing databases)
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN user_type TEXT DEFAULT 'Mahasiswa'");
  } catch (e) {
    // Column already exists
  }

  // Seed data
  const studiosList = db.prepare("SELECT name FROM studios").all() as { name: string }[];
  const studioNames = studiosList.map(s => s.name);

  const finalStudios = [
    { name: "Podcast Studio 1", desc: "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, High Quality Audio Setup.", img: "studio1", cap: 4 },
    { name: "Podcast Studio 2", desc: "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, High Quality Audio Setup.", img: "studio2", cap: 4 },
    { name: "Podcast Studio 3", desc: "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, Video Podcast Ready.", img: "studio3", cap: 4 },
    { name: "Podcast Studio 4", desc: "Relaxed Setup: Comfortable sofa, lounge atmosphere, great for casual talk and light discussion.", img: "studio4", cap: 6 }
  ];

  const insert = db.prepare("INSERT INTO studios (name, description, image_url, capacity) VALUES (?, ?, ?, ?)");

  finalStudios.forEach(s => {
    if (!studioNames.includes(s.name)) {
      insert.run(s.name, s.desc, `https://picsum.photos/seed/${s.img}/800/600`, s.cap);
    }
  });

  // Clear local bookings to ensure full spreadsheet mode starts clean
  db.exec("DELETE FROM bookings");
}

initDatabase();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  // API Routes
  app.get("/api/init-backend", async (req, res) => {
    if (!SCRIPT_URL) return res.status(400).json({ error: "SCRIPT_URL not set" });
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' })
      });
      const result = await response.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to initialize backend" });
    }
  });

  app.get("/api/studios", (req, res) => {
    const studios = db.prepare("SELECT * FROM studios").all();
    res.json(studios);
  });

  app.post("/api/studios", (req, res) => {
    const { name, description, image_url, capacity } = req.body;
    const stmt = db.prepare("INSERT INTO studios (name, description, image_url, capacity) VALUES (?, ?, ?, ?)");
    const result = stmt.run(name, description, image_url || `https://picsum.photos/seed/${Date.now()}/800/600`, capacity || 4);
    const newStudio = db.prepare("SELECT * FROM studios WHERE id = ?").get(result.lastInsertRowid);
    res.json(newStudio);
  });

  app.put("/api/studios/:id", (req, res) => {
    const { name, description, image_url, capacity } = req.body;
    const stmt = db.prepare("UPDATE studios SET name = ?, description = ?, image_url = ?, capacity = ? WHERE id = ?");
    stmt.run(name, description, image_url, capacity, req.params.id);
    const updatedStudio = db.prepare("SELECT * FROM studios WHERE id = ?").get(req.params.id);
    res.json(updatedStudio);
  });

  app.delete("/api/studios/:id", (req, res) => {
    const bookings = db.prepare("SELECT id FROM bookings WHERE studio_id = ?").all(req.params.id) as any[];
    if (bookings.length > 0) {
      return res.status(400).json({ error: "Cannot delete studio with existing bookings." });
    }
    const stmt = db.prepare("DELETE FROM studios WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=getSettings`);
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        res.json({});
      }
    } catch (error) {
      res.json({});
    }
  });

  app.post("/api/settings/availability", async (req, res) => {
    const { dates } = req.body;
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateAvailableDates', dates })
      });
      if (response.ok) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to update availability" });
      }
    } catch (error) {
      res.status(500).json({ error: "System error" });
    }
  });

  app.get("/api/bookings", async (req, res) => {
    try {
      console.log("Fetching bookings from GAS...");
      const response = await fetch(`${SCRIPT_URL}?action=read`);
      const contentType = response.headers.get("content-type");

      console.log(`GAS Response: ${response.status}, Content-Type: ${contentType}`);

      if (response.ok && contentType && contentType.includes("application/json")) {
        const gasData = await response.json();

        if (!Array.isArray(gasData)) {
          console.error("GAS returned non-array data:", gasData);
          return res.json([]);
        }

        console.log(`Successfully fetched ${gasData.length} bookings from GAS`);
        const merged = gasData.map((b: any) => ({ ...b, source: 'live' }));

        const sortedData = merged.sort((a: any, b: any) => {
          const dateA = a.date?.includes('T') ? a.date.split('T')[0] : a.date;
          const dateB = b.date?.includes('T') ? b.date.split('T')[0] : b.date;
          const dateCompare = (dateB || "").localeCompare(dateA || "");
          if (dateCompare !== 0) return dateCompare;
          return (b.start_time || "").localeCompare(a.start_time || "");
        });

        res.json(sortedData);
      } else {
        const text = await response.text();
        console.error(`GAS response not JSON or not OK. Status: ${response.status}`);
        res.json([]);
      }
    } catch (error) {
      console.error("Failed to fetch from GAS:", error);
      res.json([]);
    }
  });

  app.post("/api/bookings", upload.single('request_letter'), async (req, res) => {
    const { studio_id, student_name, student_id, user_type, phone_number, organization, date, start_time, end_time } = req.body;
    const request_letter_path = req.file ? req.file.path : null;

    try {
      const gasRes = await fetch(`${SCRIPT_URL}?action=read`);
      const contentType = gasRes.headers.get("content-type");

      if (gasRes.ok && contentType && contentType.includes("application/json")) {
        const allBookings = await gasRes.json();
        const studio = db.prepare("SELECT name FROM studios WHERE id = ?").get(studio_id) as { name: string };

        const isOverlapping = allBookings.some((b: any) => {
          const bDate = b.date?.includes('T') ? b.date.split('T')[0] : b.date;
          if (b.studio_name !== studio.name || bDate !== date) return false;
          const bStart = b.start_time;
          const bEnd = b.end_time;
          return (
            (start_time <= bStart && end_time > bStart) ||
            (start_time < bEnd && end_time >= bEnd) ||
            (bStart <= start_time && bEnd > start_time)
          );
        });

        if (isOverlapping) {
          return res.status(400).json({ error: "Studio is already booked for this time slot (verified from Spreadsheet)." });
        }
      }
    } catch (error) {
      console.warn("Could not verify overlap from Spreadsheet, using local fallback");
      const overlap = db.prepare(`
        SELECT * FROM bookings 
        WHERE studio_id = ? AND date = ? 
        AND (
          (start_time <= ? AND end_time > ?) OR
          (start_time < ? AND end_time >= ?) OR
          (? <= start_time AND ? > start_time)
        )
      `).get(studio_id, date, start_time, start_time, end_time, end_time, start_time, end_time);

      if (overlap) {
        return res.status(400).json({ error: "Studio is already booked for this time slot." });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO bookings (studio_id, student_name, student_id, user_type, phone_number, organization, request_letter_path, date, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(studio_id, student_name, student_id, user_type || 'Mahasiswa', phone_number, organization, request_letter_path, date, start_time, end_time);

    const newBooking = db.prepare(`
      SELECT b.*, s.name as studio_name 
      FROM bookings b 
      JOIN studios s ON b.studio_id = s.id
      WHERE b.id = ?
    `).get(result.lastInsertRowid) as any;

    const studioInfo = db.prepare("SELECT name FROM studios WHERE id = ?").get(studio_id) as { name: string };
    const appsScriptResult = await sendBookingToAppsScript({
      ...newBooking,
      studio_name: studioInfo.name,
      action: 'create'
    });

    if (appsScriptResult && appsScriptResult.fileUrl) {
      newBooking.drive_url = appsScriptResult.fileUrl;
    }

    res.json(newBooking);
  });

  app.patch("/api/bookings/:id/status", async (req, res) => {
    const id = req.params.id.trim();
    const { status } = req.body;
    const syncResult = await syncActionToAppsScript('updateStatus', id, { status });

    if (!syncResult.success) {
      return res.status(500).json({ error: `Gagal memperbarui di Spreadsheet: ${syncResult.error}` });
    }

    const stmt = db.prepare("UPDATE bookings SET status = ? WHERE id = ?");
    stmt.run(status, id);
    res.json({ success: true });
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    const id = req.params.id.trim();
    const syncResult = await syncActionToAppsScript('delete', id);

    if (!syncResult.success) {
      return res.status(500).json({ error: `Gagal menghapus di Spreadsheet: ${syncResult.error}` });
    }

    const stmt = db.prepare("DELETE FROM bookings WHERE id = ?");
    stmt.run(id);
    res.json({ success: true });
  });

  app.get("/api/studios/:id/booked-slots", async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    try {
      const response = await fetch(`${SCRIPT_URL}?action=read`);
      if (response.ok) {
        const allBookings = await response.json();
        const studio = db.prepare("SELECT id, name FROM studios WHERE id = ?").get(id) as { id: number, name: string };
        const slots = allBookings
          .filter((b: any) => {
            if (!b.date) return false;
            const bDate = b.date.toString().includes('T') ? b.date.toString().split('T')[0] : b.date.toString().trim();
            const targetDate = date.toString().trim();
            const studioIdMatch = b.studio_id && b.studio_id.toString() === studio.id.toString();
            const studioNameMatch = (b.studio_name || "").toString().trim().toLowerCase() === (studio.name || "").toString().trim().toLowerCase();
            return (studioIdMatch || studioNameMatch) && bDate === targetDate;
          })
          .map((b: any) => ({
            start_time: b.start_time,
            end_time: b.end_time,
            status: b.status || 'pending'
          }));
        res.json(slots);
      } else { throw new Error("GAS error"); }
    } catch (error) {
      const slots = db.prepare(`SELECT start_time, end_time, status FROM bookings WHERE studio_id = ? AND date = ?`).all(id, date);
      res.json(slots);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(process.cwd(), "dist", "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();