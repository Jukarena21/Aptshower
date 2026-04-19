/** Catálogo por defecto y migraciones mínimas de esquema (compartido con seed-catalog.js). */

/** Catálogo por defecto: misma lista que compartiste (títulos + un enlace por ítem). */
const SEED_ROWS = [
  {
    section: "friends",
    title: "Bowls acero inoxidable grande — Crate & Barrel 26 cm",
    url: "https://www.falabella.com.co/falabella-co/product/770439235/Bowl-en-Acero-inoxidable-26-cm-x-26-cm/770439235",
  },
  {
    section: "friends",
    title: "Bowls acero inoxidable medianos — Crate & Barrel 21 cm",
    url: "https://www.falabella.com.co/falabella-co/product/770439205/Bowl-en-Acero-inoxidable-21-cm-x-21-cm/770439205",
  },
  {
    section: "friends",
    title: "Set refractarias (Pyrex ×4 o Mica ×3)",
    url: "https://www.falabella.com.co/falabella-co/product/150795115/set-de-4-refractarias-para-horno-en-vidrio-2500-ml-1600-ml-1900-ml-3-2-lt-taza-medidora-500-m/150795116",
  },
  {
    section: "friends",
    title: "Taza medidora (Pyrex 1 L o VARDAGEN 500 ml)",
    url: "https://www.falabella.com.co/falabella-co/product/119360162/Vaso-medidor-1-litro-Pyrex-6001076/119360163?kid=shopp278fa&gclsrc=aw.ds&gad_source=1&gad_campaignid=22071755962",
  },
  {
    section: "friends",
    title: "Balanza (One Pixel negra o GENOMSNITT)",
    url: "https://www.falabella.com.co/falabella-co/product/143302191/balanza-bascula-digital-cocina-gramera-cubierta-vidrio-5-kgs/143302192",
  },
  {
    section: "friends",
    title: "Servilletero (negro o vertical)",
    url: "https://www.ambientegourmet.com/servilletero-cuadrado-negro/p?idsku=5952",
  },
  {
    section: "friends",
    title: "Set de espátulas cocina (silicona)",
    url: "https://www.homecenter.com.co/homecenter-co/product/915014/setx3-espatula-silicona-azul-y-blanco/915014/",
  },
  {
    section: "friends",
    title: "Set de cucharones GRUNKA",
    url: "https://www.ikea.com/co/es/p/grunka-set-utensilios-de-cocina-4-piezas-acero-inoxidable-30083334/",
  },
  {
    section: "friends",
    title: "Moka italiana / prensa francesa (UPPHETTA)",
    url: "https://www.ikea.com/co/es/p/upphetta-cafetera-prensa-francesa-vidrio-acero-inoxidable-60241389/",
  },
  {
    section: "friends",
    title: "Set de cucharas medidoras VARDAGEN",
    url: "https://www.ikea.com/co/es/p/vardagen-cucharas-medidoras-set-de-5-60324723/",
  },
  {
    section: "friends",
    title: "Batidor en globo VARDAGEN",
    url: "https://www.ikea.com/co/es/p/vardagen-batidor-acero-inoxidable-haya-10581480/",
  },
  {
    section: "friends",
    title: "Organizador de cubiertos",
    url: "https://www.casaideas.com.co/organizador-cub-extendible-plus-casa-cocina-3213709000036/p",
  },
  {
    section: "friends",
    title: "Exprimidor manual",
    url: "https://www.casaideas.com.co/exprimidor-transparent--verde-agua--0002-multicolor-casa-cocina_3226716000036/p",
  },
  {
    section: "friends",
    title: "Escurridor de verduras UPPFYLLD",
    url: "https://www.ikea.com/co/es/p/uppfylld-centrifugador-de-verduras-blanco-00521948/",
  },
  {
    section: "premium",
    title: "Lamborghini Murciélago (enlace Temerario)",
    url: "https://www.lamborghini.com/es-en/modelos/temerario",
  },
  {
    section: "premium",
    title: "MSI GeForce RTX 5090",
    url: "https://marketplace.nvidia.com/en-us/consumer/graphics-cards/msi-geforce-rtx-5090-vanguard-soc/",
  },
  {
    section: "premium",
    title: "Lingote de oro 12,5 kg (×2)",
    url: "https://www.inversoro.es/lingotes-de-oro/lingote-de-12-5-kilo-oro/lingote-12-5-kilo-oro/",
  },
  {
    section: "premium",
    title: "Isla (Cay Cen)",
    url: "https://terracoramg.com/propiedades/isla-ceycen/",
  },
  {
    section: "premium",
    title: "Trump Gold Card",
    url: "https://www.trumpcard.gov/apply",
  },
  {
    section: "premium",
    title: "Niño — adopción (chiste; ×2)",
    url: "https://www.icbf.gov.co/adopciones",
  },
];

function ensureSchema(db) {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT 'friends',
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL UNIQUE,
      guest_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );
  `);
  let itemColumns = db.prepare("PRAGMA table_info(items)").all();
  const hasSection = itemColumns.some((c) => c.name === "section");
  if (!hasSection) {
    db.exec("ALTER TABLE items ADD COLUMN section TEXT NOT NULL DEFAULT 'friends'");
  }
  itemColumns = db.prepare("PRAGMA table_info(items)").all();
  const hasImageUrl = itemColumns.some((c) => c.name === "image_url");
  if (!hasImageUrl) {
    db.exec("ALTER TABLE items ADD COLUMN image_url TEXT");
  }
}

/**
 * Páginas que bloquean bots, usan retos anti-bot o no publican og:image en el HTML inicial:
 * el servidor no puede extraer miniatura; usamos URL de imagen directa (misma política de seguridad que og-image).
 */
const PREVIEW_FALLBACK_BY_PRODUCT_URL = {
  "https://marketplace.nvidia.com/en-us/consumer/graphics-cards/msi-geforce-rtx-5090-vanguard-soc/":
    "https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=800&q=85",
  "https://www.inversoro.es/lingotes-de-oro/lingote-de-12-5-kilo-oro/lingote-12-5-kilo-oro/":
    "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=85",
  "https://www.trumpcard.gov/apply":
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=85",
  "https://www.icbf.gov.co/adopciones":
    "https://www.icbf.gov.co/sites/default/files/logo_colombiapotencia_de_la_vida_2.png",
};

function insertAllCatalog(db) {
  const ins = db.prepare("INSERT INTO items (title, url, section, image_url) VALUES (?, ?, ?, ?)");
  for (const row of SEED_ROWS) {
    const fallback = PREVIEW_FALLBACK_BY_PRODUCT_URL[row.url] || null;
    ins.run(row.title, row.url, row.section, fallback);
  }
}

/** Rellena image_url cuando la extracción Open Graph no es posible (catálogos ya creados). */
function applyPreviewFallbacks(db) {
  const stmt = db.prepare(`
    UPDATE items SET image_url = ?
    WHERE url = ?
    AND (image_url IS NULL OR trim(image_url) = '')
  `);
  for (const [url, imageUrl] of Object.entries(PREVIEW_FALLBACK_BY_PRODUCT_URL)) {
    stmt.run(imageUrl, url);
  }
}

function replaceAllCatalog(db) {
  db.exec("DELETE FROM reservations");
  db.exec("DELETE FROM items");
  insertAllCatalog(db);
}

function seedIfEmpty(db) {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM items").get();
  if (c > 0) return false;
  insertAllCatalog(db);
  return true;
}

/**
 * Detecta regalos "premium" por título (Unicode / español), sin depender de SQLite lower().
 */
function inferPremiumFromTitle(title) {
  const t = String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (/lamborghini|murci|temerario/.test(t)) return true;
  if (/rtx\s*5090|rtx5090|geforce\s*rtx|msi\s*geforce/.test(t)) return true;
  if (/lingote.*oro/.test(t)) return true;
  if (/isla.*privada|seychelles|isla\s*\(cay|\bcay\s*cen|ceycen/.test(t)) return true;
  if (/gold\s*card|goldcard|trumpcard|trump\s*gold/.test(t)) return true;
  if (/icbf/.test(t) && /adopc/.test(t)) return true;
  if (/nino.*adopc|adopc.*nino/.test(t)) return true;
  if (/adopc.*chiste|chiste.*adopc/.test(t)) return true;
  return false;
}

/** Corrige filas antiguas o mal guardadas: solo `premium` va a Amigos Premium. */
function repairPremiumSections(db) {
  db.exec(`
    UPDATE items SET section = 'friends'
    WHERE section IS NULL OR trim(section) = '';
  `);
  db.exec(`
    UPDATE items SET section = lower(trim(section))
    WHERE lower(trim(section)) IN ('premium', 'friends');
  `);
  db.exec(`
    UPDATE items SET section = 'friends'
    WHERE section NOT IN ('premium', 'friends');
  `);
  db.exec(`
    UPDATE items SET section = 'premium'
    WHERE section != 'premium'
    AND (
      instr(lower(title), 'lamborghini') > 0
      OR instr(lower(title), 'murcielago') > 0
      OR instr(lower(title), 'rtx 5090') > 0
      OR instr(lower(title), 'rtx5090') > 0
      OR instr(lower(title), 'lingote de oro') > 0
      OR instr(lower(title), 'isla privada') > 0
      OR instr(lower(title), 'gold card') > 0
      OR instr(lower(title), 'trumpcard') > 0
      OR instr(lower(title), 'temerario') > 0
      OR (instr(lower(title), 'icbf') > 0 AND instr(lower(title), 'adopc') > 0)
    )
  `);
  const rows = db.prepare("SELECT id, title FROM items").all();
  const upd = db.prepare("UPDATE items SET section = 'premium' WHERE id = ?");
  for (const r of rows) {
    if (inferPremiumFromTitle(r.title)) {
      upd.run(r.id);
    }
  }
}

module.exports = {
  SEED_ROWS,
  PREVIEW_FALLBACK_BY_PRODUCT_URL,
  ensureSchema,
  seedIfEmpty,
  replaceAllCatalog,
  repairPremiumSections,
  applyPreviewFallbacks,
  inferPremiumFromTitle,
};
