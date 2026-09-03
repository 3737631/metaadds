/**
 * Fetch externo con protección SSRF y límites.
 * Solo http/https, bloquea localhost/loopback/redes privadas/reservadas,
 * limita redirects, timeout y tamaño de respuesta.
 */
const PRIVATE_IP_RANGES: Array<[number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc0000000, 0xc00002ff], // 192.0.0.0/24
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET)
  [0xc6336400, 0xc63364ff], // 198.18.0.0/15
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
  [0xffff0000, 0xffffffff], // 255.255.255.255/32
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map((n) => Number(n));
  return (
    ((parts[0] ?? 0) << 24) | ((parts[1] ?? 0) << 16) | ((parts[2] ?? 0) << 8) | (parts[3] ?? 0)
  );
}

async function hostLookup(hostname: string): Promise<string | null> {
  try {
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup(hostname, { all: true });
    return addrs[0]?.address ?? null;
  } catch {
    return null;
  }
}

function isBlockedIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(([lo, hi]) => {
    const n = ipToInt(ip);
    return n >= lo && n <= hi;
  });
}

export async function resolveSafeUrl(rawUrl: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return null;
  }

  const ip = await hostLookup(hostname);
  if (ip && isBlockedIp(ip)) return null;

  return url;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  finalHost: string;
  contentType: string;
  html: string;
}

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_500_000; // ~2.5 MB de HTML

const ASSET_TIMEOUT_MS = 10000;
const ASSET_MAX_BYTES = 1_500_000; // 1.5 MB por recurso CSS

/**
 * Fetch seguro para recursos (CSS/JS/HTML genérico) con límites y SSRF.
 * Devuelve el buffer o null. NO valida tipo de contenido (el llamador decide).
 */
export async function safeFetchBytes(rawUrl: string): Promise<Buffer | null> {
  const start = await resolveSafeUrl(rawUrl);
  if (!start) return null;

  let current = start;
  let redirects = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);

  try {
    while (true) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; MetaWinnersBot/1.0)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || redirects >= MAX_REDIRECTS) return null;
        const next = await resolveSafeUrl(new URL(loc, current).toString());
        if (!next) return null;
        current = next;
        redirects++;
        continue;
      }

      if (res.status !== 200) return null;

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > ASSET_MAX_BYTES) return null;
      return buf;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetchHtml(rawUrl: string): Promise<SafeFetchResult | null> {
  const start = await resolveSafeUrl(rawUrl);
  if (!start) return null;

  let current = start;
  let redirects = 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    while (true) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; MetaWinnersBot/1.0)" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || redirects >= MAX_REDIRECTS) return null;
        const next = await resolveSafeUrl(new URL(loc, current).toString());
        if (!next) return null;
        current = next;
        redirects++;
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (
        res.status !== 200 ||
        (!contentType.includes("text/html") && !contentType.includes("text/plain"))
      ) {
        return {
          ok: false,
          status: res.status,
          finalUrl: current.toString(),
          finalHost: current.hostname,
          contentType,
          html: "",
        };
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        return { ok: false, status: res.status, finalUrl: current.toString(), finalHost: current.hostname, contentType, html: "" };
      }

      return {
        ok: true,
        status: res.status,
        finalUrl: current.toString(),
        finalHost: current.hostname,
        contentType,
        html: buf.toString("utf8"),
      };
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extrae etiquetas <title> desde HTML crudo. */
export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

/** Detecta si un HTML parece una tienda Shopify mediante señales públicas. */
export function detectShopify(html: string): boolean {
  return (
    html.includes("cdn.shopify.com") ||
    html.includes("/cdn/shop/") ||
    html.includes("shopify") ||
    /shopify\.com\/js/i.test(html) ||
    html.includes("Shopify.theme")
  );
}
