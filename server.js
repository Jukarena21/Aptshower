require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const {
  ensureSchema,
  seedIfEmpty,
  replaceAllCatalog,
  repairPremiumSections,
  applyPreviewFallbacks,
  repairCatalogTitles,
  inferPremiumFromTitle,
} = require("./catalog");
const { isSafeHttpUrl } = require("./og-image");

const PORT = Number(process.env.PORT) || 3000;

/** Carpeta de SQLite; en la nube monta aquí un volumen persistente (variable DATA_DIR). */
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "registry.db");
const db = new DatabaseSync(dbPath);
ensureSchema(db);
repairPremiumSections(db);
applyPreviewFallbacks(db);

if (process.env.RESEED_CATALOG === "1") {
  replaceAllCatalog(db);
  repairPremiumSections(db);
  applyPreviewFallbacks(db);
  console.warn(
    "[Apartashower] RESEED_CATALOG=1: se cargó el catálogo por defecto (20 ítems). Quita RESEED_CATALOG del .env para no borrar la lista en cada arranque."
  );
} else if (seedIfEmpty(db)) {
  repairPremiumSections(db);
  applyPreviewFallbacks(db);
  console.log("Catálogo inicial cargado (20 regalos).");
}

repairCatalogTitles(db);

const itemCount = db.prepare("SELECT COUNT(*) AS c FROM items").get().c;
console.log(`[Apartashower] Regalos en la base de datos: ${itemCount}`);

function normalizeSection(raw) {
  const s = String(raw || "friends").toLowerCase();
  return s === "premium" ? "premium" : "friends";
}

function effectiveSection(row) {
  if (normalizeSection(row.section) === "premium") return "premium";
  if (inferPremiumFromTitle(row.title)) return "premium";
  return "friends";
}

function mapItemRow(row) {
  if (!row) return row;
  const id = row.id == null ? row.id : Number(row.id);
  return {
    ...row,
    id,
    section: effectiveSection(row),
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/items", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT i.id, i.title, i.url, i.section, i.image_url, i.created_at, r.guest_name AS reserved_by
      FROM items i
      LEFT JOIN reservations r ON r.item_id = i.id
      ORDER BY i.id ASC
    `
    )
    .all();
  const mapped = rows.map((row) => mapItemRow(row));
  mapped.sort((a, b) => {
    const ap = a.section === "premium" ? 1 : 0;
    const bp = b.section === "premium" ? 1 : 0;
    if (ap !== bp) return ap - bp;
    return a.id - b.id;
  });
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.json(mapped);
});

const THUMB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Sirve la miniatura por el mismo sitio (evita bloqueos por hotlink / referrer). */
app.get("/api/thumb", async (req, res) => {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).end();
  }
  const row = db.prepare("SELECT image_url FROM items WHERE id = ?").get(id);
  const url = row && String(row.image_url || "").trim();
  if (!url || !isSafeHttpUrl(url)) {
    return res.status(404).end();
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14_000);
  try {
    let referer;
    try {
      referer = new URL(url).origin + "/";
    } catch {
      referer = undefined;
    }
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": THUMB_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!r.ok) {
      return res.status(404).end();
    }
    const ct = String(r.headers.get("content-type") || "");
    if (!ct.toLowerCase().startsWith("image/")) {
      return res.status(404).end();
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8_000_000) {
      return res.status(404).end();
    }
    res.setHeader("Content-Type", ct.split(";")[0].trim());
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch {
    res.status(502).end();
  } finally {
    clearTimeout(timer);
  }
});

/** Reserva pública: un nombre por regalo. */
app.post("/api/items/:id/reserve", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identificador no válido." });
  }
  const name = String(req.body?.name || "").trim();
  if (!name || name.length > 120) {
    return res.status(400).json({ error: "Indica tu nombre (máx. 120 caracteres)." });
  }
  const item = db.prepare("SELECT id FROM items WHERE id = ?").get(id);
  if (!item) {
    return res.status(404).json({ error: "Regalo no encontrado." });
  }
  const taken = db.prepare("SELECT guest_name FROM reservations WHERE item_id = ?").get(id);
  if (taken) {
    return res.status(409).json({ error: "Este regalo ya está reservado." });
  }
  try {
    db.prepare("INSERT INTO reservations (item_id, guest_name) VALUES (?, ?)").run(id, name);
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Este regalo ya está reservado." });
    }
    throw e;
  }
  res.status(201).json({ ok: true, itemId: id, reservedBy: name });
});

function releaseItemById(res, rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identificador no válido." });
  }
  const result = db.prepare("DELETE FROM reservations WHERE item_id = ?").run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "No había reserva para este regalo." });
  }
  return res.json({ ok: true });
}

/** Cualquiera puede liberar una reserva (p. ej. si se equivocó al elegir). */
app.delete("/api/items/:id/reserve", (req, res) => releaseItemById(res, req.params.id));
/** Variantes de ruta por si algún proxy o proceso viejo no enruta bien el path con :id. */
app.post("/api/items/:id/release", (req, res) => releaseItemById(res, req.params.id));
app.post("/api/release-reservation", (req, res) => releaseItemById(res, req.body?.id));

app.use(express.static(path.join(__dirname, "public")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Apartashower en http://localhost:${PORT}`);
});
