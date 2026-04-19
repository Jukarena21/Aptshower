const { fetch: undiciFetch } = globalThis;

const MAX_BYTES = 900_000;
const FETCH_TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function isBlockedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h || h === "localhost") return true;
  if (h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0") return true;
  if (h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  if (h.startsWith("169.254.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function isSafeHttpUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (isBlockedHost(u.hostname)) return false;
  return true;
}

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .trim();
}

function normalizeImgCandidate(raw) {
  if (!raw) return null;
  const u = decodeHtmlEntities(raw).replace(/\s+/g, "");
  return u || null;
}

function collectMetaPreviewImages(html) {
  const out = [];
  const push = (raw) => {
    const u = normalizeImgCandidate(raw);
    if (u) out.push(u);
  };
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/gi,
    /<meta[^>]+property=["']og:image:url["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image:url["']/gi,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/gi,
    /<meta[^>]+name=["']twitter:image:src["'][^>]*content=["']([^"']+)["']/gi,
    /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(html)) !== null) push(m[1]);
  }
  return out;
}

function pushProductImageTargets(out, im) {
  if (typeof im === "string") {
    const u = normalizeImgCandidate(im);
    if (u) out.push(u);
  } else if (Array.isArray(im)) {
    for (const x of im) {
      if (typeof x === "string") {
        const u = normalizeImgCandidate(x);
        if (u) out.push(u);
      } else if (x && typeof x === "object" && x.url) {
        const u = normalizeImgCandidate(x.url);
        if (u) out.push(u);
      }
    }
  } else if (im && typeof im === "object" && im.url) {
    const u = normalizeImgCandidate(im.url);
    if (u) out.push(u);
  }
}

function collectLdJsonProductImages(html) {
  const out = [];
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let lm;
  while ((lm = ldRe.exec(html)) !== null) {
    const raw = lm[1].trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const visit = (node) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if (node["@graph"]) visit(node["@graph"]);
        const t = node["@type"];
        const types = (Array.isArray(t) ? t : t != null ? [t] : []).map((x) => String(x).toLowerCase());
        const isProduct = types.some((x) => x.includes("product"));
        if (isProduct) pushProductImageTargets(out, node.image);
        for (const k of Object.keys(node)) {
          if (k === "@context" || k === "@type" || k === "@graph" || k === "image") continue;
          const v = node[k];
          if (v && typeof v === "object") visit(v);
        }
      };
      visit(data);
    } catch {
      /* ignorar JSON inválido */
    }
  }
  return out;
}

function falabellaProductNumericTokens(pageUrl) {
  const ids = new Set();
  try {
    const u = new URL(pageUrl);
    for (const seg of u.pathname.split("/")) {
      if (/^\d{5,}$/.test(seg)) ids.add(seg);
    }
    for (const v of u.searchParams.values()) {
      if (/^\d{5,}$/.test(v)) ids.add(v);
    }
  } catch {
    /* noop */
  }
  return ids;
}

function scorePreviewCandidate(pageUrl, absoluteHref) {
  let score = 0;
  try {
    const page = new URL(pageUrl);
    const h = page.hostname.toLowerCase();
    const cand = String(absoluteHref).toLowerCase();
    if (h.includes("falabella")) {
      for (const t of falabellaProductNumericTokens(pageUrl)) {
        if (cand.includes(t)) score += 50;
      }
      if (cand.includes("media.falabella.com")) score += 12;
      if (cand.includes("falabellaco")) score += 4;
    }
  } catch {
    /* noop */
  }
  return score;
}

function preferLdProductImagesFirst(hostname) {
  const h = String(hostname || "").toLowerCase();
  return (
    h.includes("falabella") ||
    h.includes("homecenter") ||
    h.includes("ikea.com") ||
    h.includes("casaideas") ||
    h.includes("ambientegourmet") ||
    h.includes("inversoro") ||
    h.includes("lamborghini") ||
    h.includes("nvidia.com") ||
    h.includes("terracoramg")
  );
}

/** <link rel="icon|apple-touch-icon" href="…"> cuando no hay og:image. */
function collectLinkIconImages(html) {
  const out = [];
  const push = (raw) => {
    const u = normalizeImgCandidate(raw);
    if (u) out.push(u);
  };
  const relIcon =
    /<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]*href=["']([^"']+)["']/gi;
  const hrefIcon =
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["']/gi;
  let m;
  while ((m = relIcon.exec(html)) !== null) push(m[1]);
  while ((m = hrefIcon.exec(html)) !== null) push(m[1]);
  return out;
}

/** <img src="…"> del HTML inicial (Drupal, Next sin metas, etc.). */
function collectBodyImgSrcs(html) {
  const out = [];
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (!raw || /^data:/i.test(raw) || /^about:/i.test(raw)) continue;
    const u = normalizeImgCandidate(raw);
    if (u) out.push(u);
  }
  return out;
}

function scoreIcbfCandidate(absoluteHref) {
  const lower = String(absoluteHref || "").toLowerCase();
  let s = 0;
  if (lower.includes("icbf-logo")) s += 120;
  if (lower.includes("logo_colombiapotencia")) s += 110;
  if (lower.includes("/sites/default/files/") && /\.(png|jpe?g|webp)(\?|$)/.test(lower)) s += 35;
  if (lower.includes("web-ada-icons")) s += 25;
  if (lower.includes("icon-") || lower.includes("icons-trhome")) s -= 90;
  if (lower.includes("favicon")) s -= 100;
  if (lower.endsWith(".svg")) s -= 15;
  return s;
}

function scoreTrumpCandidate(absoluteHref) {
  const lower = String(absoluteHref || "").toLowerCase();
  let s = 0;
  if (lower.includes("usa-flag")) s -= 200;
  if (/\.(png|jpe?g|webp)(\?|$)/.test(lower)) s += 60;
  if (lower.includes("favicon")) s += 15;
  if (lower.endsWith(".svg")) s += 5;
  return s;
}

function pickBestPreview(pageUrl, absList) {
  if (!absList.length) return null;
  try {
    const h = new URL(pageUrl).hostname.toLowerCase();
    if (h.includes("falabella")) {
      let best = absList[0];
      let bestScore = scorePreviewCandidate(pageUrl, best);
      for (let i = 1; i < absList.length; i++) {
        const s = scorePreviewCandidate(pageUrl, absList[i]);
        if (s > bestScore) {
          bestScore = s;
          best = absList[i];
        }
      }
      return best;
    }
    if (h.includes("icbf.gov.co")) {
      let best = absList[0];
      let bestScore = scoreIcbfCandidate(best);
      for (let i = 1; i < absList.length; i++) {
        const s = scoreIcbfCandidate(absList[i]);
        if (s > bestScore) {
          bestScore = s;
          best = absList[i];
        }
      }
      return best;
    }
    if (h.includes("trumpcard.gov")) {
      let best = absList[0];
      let bestScore = scoreTrumpCandidate(best);
      for (let i = 1; i < absList.length; i++) {
        const s = scoreTrumpCandidate(absList[i]);
        if (s > bestScore) {
          bestScore = s;
          best = absList[i];
        }
      }
      return best;
    }
  } catch {
    /* primera */
  }
  return absList[0];
}

function extractPreviewImageUrl(html, pageUrl) {
  if (!html || !pageUrl) return null;
  const metaImages = collectMetaPreviewImages(html);
  const ldProductImages = collectLdJsonProductImages(html);
  const linkIcons = collectLinkIconImages(html);
  const bodyImgs = collectBodyImgSrcs(html);
  let ordered;
  try {
    const h = new URL(pageUrl).hostname;
    ordered = preferLdProductImagesFirst(h)
      ? [...ldProductImages, ...metaImages, ...linkIcons, ...bodyImgs]
      : [...metaImages, ...ldProductImages, ...linkIcons, ...bodyImgs];
  } catch {
    ordered = [...metaImages, ...ldProductImages, ...linkIcons, ...bodyImgs];
  }
  const seen = new Set();
  const dedup = [];
  for (const c of ordered) {
    if (seen.has(c)) continue;
    seen.add(c);
    dedup.push(c);
  }
  const base = new URL(pageUrl);
  const absList = [];
  for (const c of dedup) {
    try {
      const abs = new URL(c, base);
      if (!isSafeHttpUrl(abs.href)) continue;
      absList.push(abs.href);
    } catch {
      /* siguiente */
    }
  }
  if (!absList.length) return null;
  return pickBestPreview(pageUrl, absList);
}

async function readLimitedHtml(response, maxBytes) {
  if (!response.body) {
    const t = await response.text();
    return t.slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* noop */
    }
  }
  const buf = Buffer.concat(chunks);
  return buf.subarray(0, Math.min(buf.length, maxBytes)).toString("utf8");
}

function isNvidiaMarketplaceRtx5090Url(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().includes("marketplace.nvidia.com")) return false;
    return /rtx[-_]?5090|5090|geforce.*5090/i.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

const NVIDIA_RTX5090_LEARN_PAGE =
  "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/";

async function fetchHtmlForPreview(pageUrl) {
  if (!isSafeHttpUrl(pageUrl)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await undiciFetch(pageUrl, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en-US,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return null;
    }
    const html = await readLimitedHtml(res, MAX_BYTES);
    return { html, finalUrl: res.url || pageUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOgImage(pageUrl) {
  if (!isSafeHttpUrl(pageUrl)) return null;
  const first = await fetchHtmlForPreview(pageUrl);
  if (first) {
    const img = extractPreviewImageUrl(first.html, first.finalUrl);
    if (img) return img;
  }
  if (isNvidiaMarketplaceRtx5090Url(pageUrl)) {
    const alt = await fetchHtmlForPreview(NVIDIA_RTX5090_LEARN_PAGE);
    if (alt) {
      const img = extractPreviewImageUrl(alt.html, alt.finalUrl);
      if (img) return img;
    }
  }
  return null;
}

module.exports = {
  fetchOgImage,
  extractPreviewImageUrl,
  isSafeHttpUrl,
};
