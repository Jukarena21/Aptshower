/**
 * Sustituye toda la lista por el catálogo por defecto (19 regalos).
 * Úsalo si ya tenías pruebas en la base y la semilla automática no se aplicó.
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const {
  ensureSchema,
  replaceAllCatalog,
  repairPremiumSections,
  applyPreviewFallbacks,
  repairCatalogListEdits,
  repairCatalogTitles,
  ensureCatalogThumbRevision,
} = require("./catalog");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "registry.db");
const db = new DatabaseSync(dbPath);
ensureSchema(db);
replaceAllCatalog(db);
repairPremiumSections(db);
applyPreviewFallbacks(db);
repairCatalogTitles(db);
repairCatalogListEdits(db);
ensureCatalogThumbRevision(db);
console.log("Catálogo listo: 19 regalos (13 amigos + 6 premium). Arranca el servidor con npm start.");
