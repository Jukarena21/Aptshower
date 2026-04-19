const { fetch: undiciFetch } = globalThis;

const MAX_BYTES = 450_000;
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

function extractPreviewImageUrl(html, pageUrl) {
  if (!html || !pageUrl) return null;
  const candidates = [];
  const push = (raw) => {
    if (!raw) return;
    const u = decodeHtmlEntities(raw).replace(/\s+/g, "");
    if (u) candidates.push(u);
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
    while ((m = r.exec(html)) !== null) {
      push(m[1]);
    }
  }

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
        const im = node.image;
        if (typeof im === "string") push(im);
        else if (Array.isArray(im)) {
          im.forEach((x) => {
            if (typeof x === "string") push(x);
            else if (x && typeof x === "object" && x.url) push(x.url);
          });
        } else if (im && typeof im === "object" && im.url) push(im.url);
      };
      visit(data);
    } catch {
      /* ignorar JSON inválido */
    }
  }

  const base = new URL(pageUrl);
  for (const c of candidates) {
    try {
      const abs = new URL(c, base);
      if (!isSafeHttpUrl(abs.href)) continue;
      return abs.href;
    } catch {
      /* siguiente */
    }
  }
  return null;
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

async function fetchOgImage(pageUrl) {
  if (!isSafeHttpUrl(pageUrl)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await undiciFetch(pageUrl, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) return null;
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return null;
    }
    const html = await readLimitedHtml(res, MAX_BYTES);
    const finalUrl = res.url || pageUrl;
    return extractPreviewImageUrl(html, finalUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

module.exports = {
  fetchOgImage,
  extractPreviewImageUrl,
  isSafeHttpUrl,
};
