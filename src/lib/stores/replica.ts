/**
 * Réplica fiel y editable de una tienda real, reconstruida a partir del HTML
 * real que devuelve la tienda (nunca inventada). El editor permite tocarla
 * en el sitio (click-to-edit), pero los datos iniciales provienen de la web.
 */

import { safeFetchHtml, extractTitle, detectShopify } from "./safe-fetch";

export interface ReplicaBrand {
  name: string;
  logoUrl: string | null;
  colors: string[];
  fontFamily: string | null;
}

export interface ReplicaHeader {
  logoText: string;
  menu: string[];
}

export interface ReplicaHero {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string | null;
}

export interface ReplicaSection {
  type: string;
  heading: string;
  text: string;
  imageUrl: string | null;
  items?: { title: string; text: string }[];
}

export interface ReplicaProduct {
  title: string;
  price: number | null;
  compareAt: number | null;
  currency: string;
  description: string;
  imageUrl: string | null;
  ctaLabel: string;
  badge: string | null;
}

export interface ReplicaFooter {
  about: string;
  links: { text: string; href: string }[];
  newsletter: boolean;
}

export interface StoreReplica {
  url: string;
  domain: string;
  shopify: boolean;
  brand: ReplicaBrand;
  header: ReplicaHeader;
  hero: ReplicaHero;
  sections: ReplicaSection[];
  product: ReplicaProduct;
  footer: ReplicaFooter;
  extraImages: string[];
}

function absolutize(src: string, base: URL): string | null {
  if (!src) return null;
  const clean = src.replace(/&amp;/g, "&").replace(/&#38;/g, "&");
  try {
    return new URL(clean, base).toString();
  } catch {
    return null;
  }
}

function findFirst(lines: string[], re: RegExp): string | null {
  for (const line of lines) {
    const m = line.match(re);
    if (m && m[0]) return m[0];
  }
  return null;
}

/** Convierte a relativo un color o devuelve null si no parece color */
function pickColor(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const c = raw.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
  const rgb = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Math.max(0, Number(n))));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

/** Lee el valor de una variable CSS: --accent, --primary, etc. */
function cssVarColors(html: string): string[] {
  const out: string[] = [];
  const re = /(--[\w-]+\s*:\s*)(#[0-9a-fA-F]{3,8})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const hex = m[2];
    if (!out.includes(hex.toLowerCase())) out.push(hex);
  }
  return out;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMenu(html: string): string[] {
  const navHtml = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/i)?.[0] ?? html;
  const links = [...navHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => {
      const text = stripTags(m[1]);
      const href = m[0].match(/href=["']([^"']+)["']/)?.[1] ?? "";
      return { text, href };
    })
    // quita enlaces de accesibilidad y enlaces casi vacíos
    .filter((l) => {
      const t = l.text.trim().toLowerCase();
      if (t.length < 2 || t.length > 40) return false;
      if (/(conmutar el modo|ir a la|accesibilidad|contenido\(|pie de página|navegación\(|búsqueda\(|inicio \(h\))/i.test(t)) return false;
      // prefiere enlaces de navegación real de la tienda
      return /(\/collections|\/products|\/pages|\/shop|\/catalog|\/categor|\/about|\/contact)/i.test(l.href) ||
        !/^(#|javascript:)/i.test(l.href);
    })
    .map((l) => l.text)
    .slice(0, 8);
  // si el <nav> no tenía nada real, intenta en todo el documento links de
  // navegación de la tienda (menus tipo details/ul en header o body).
  const real = links.filter((t) => t && t.length > 1);
  const source = real.length ? links : collectMenuFromDoc(html);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of source) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** Busca enlaces de navegación reales en todo el documento (fuera de <nav>). */
function collectMenuFromDoc(html: string): string[] {
  const links = [...html.matchAll(/<a[^>]*href=["']([^"']*\/?(?:collections|products|pages|shop|catalog|categor|about|contact)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ text: stripTags(m[2]), href: m[1] }))
    .filter((l) => {
      const t = l.text.trim().toLowerCase();
      return t.length > 1 && t.length < 40 &&
        !/(conmutar el modo|ir a la|accesibilidad)/i.test(t);
    })
    .map((l) => l.text.trim())
    .slice(0, 8);
  return links;
}

export async function buildReplica(rawUrl: string): Promise<StoreReplica> {
  const fetched = await safeFetchHtml(rawUrl);
  const url = fetched?.finalUrl ?? rawUrl;
  const domain = fetched?.finalHost ?? (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const shopify = fetched ? detectShopify(fetched.html) : false;
  const html = fetched?.html ?? "";
  const base = (() => { try { return new URL(url); } catch { return new URL("https://" + url); } })();

  const title = fetched ? extractTitle(html) : "";
  const brandName = title.split(/[|–—·-]/)[0]?.trim() || title || beheading(domain) || domain;

  // --- Imágenes reales (en orden de aparición, absolutas) ---
  const imgsSrc: string[] = [];
  for (const m of html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)) {
    const abs = absolutize(m[1], base);
    if (abs) imgsSrc.push(abs);
  }
  const goodImgs = imgsSrc.filter((u) => !/\.(svg|ico|gif)$/i.test(u) && !u.includes("sprite") && u.length > 12);

  // Logo real: primer img del header que parezca logo, o el primer img si solo hay uno pequeño.
  const headerHtml = html.match(/<header[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? "";
  const headerImgs = [...headerHtml.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const logoUrl = absolutize(
    headerImgs.find((s) => /logo|brand|icon/i.test(s)) ??
      headerImgs[0] ??
      imgsSrc.find((s) => /logo|brand/i.test(s)) ??
      "",
    base
  );

  // Hero: primer h1/h2 + imagen real / lifestyle (primera que NO sea el logo).
  const heroHeadline = stripTags(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] ?? "") || brandName;
  const heroSub = stripTags(html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i)?.[0] ?? "")
    .slice(0, 160) || "";
  const heroImage =
    goodImgs.find((u) => u !== logoUrl && !/logo|brand|icon/i.test(u)) ?? goodImgs[0] ?? null;
  const ctaHref =
    html.match(/<(?:button|a)[^>]*class="[^"]*(?:btn|cta|button|shop)[^"]*"/i)?.[0]
      ?.match(/href=["']([^"']+)["']/)?.[1] ?? "#";

  // --- Secciones: agrupar los h2/p/img siguientes a la hero ---
  const sections: ReplicaSection[] = [];
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].slice(0, 8);
  for (let i = 0; i < headings.length; i++) {
    const h = stripTags(headings[i][1]);
    if (!h) continue;
    const para = html.match(new RegExp(`<p[^>]*>([\\s\\S]{0,400}?)</p>`, "i"))?.[1] ?? "";
    const img =
      [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)].map((m) => absolutize(m[1], base)).find(Boolean) ?? null;
    sections.push({
      type: ["beneficios", "productos", "testimonios", "faq"].find((t) => h.toLowerCase().includes(t)) ?? "info",
      heading: h,
      text: stripTags(para).slice(0, 300),
      imageUrl: img,
      items: stripTags(para).split(/\.\s+|\n/).filter((s) => s && s.length > 4).slice(0, 3).map((s) => ({ title: s.slice(0, 40), text: s })),
    });
  }

  // --- Producto: primera tarjeta con precio ---
  const priceMatch = html.match(/€\s*([0-9]+(?:\.[0-9]{1,2})?|[0-9]+,[0-9]{1,2})/) ??
    html.match(/EUR\s*([0-9.,]+)/i) ??
    html.match(/[\s(]([0-9]+(?:\.[0-9]{2})?)\s*€/);
  const price = priceMatch ? parseFloat(String(priceMatch[1]).replace(",", ".")) : null;
  const productImg =
    goodImgs.find((u) => u !== logoUrl && u !== heroImage && !/logo|brand|icon/i.test(u)) ?? null;
  const productTitle = stripTags(html.match(/[^>]*>(.{10,90})<\/h2>/i)?.[1] ?? "").slice(0, 80) || "Producto destacado";

  // --- Footer ---
  const footerHtml = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/i)?.[0] ?? "";
  const footerLinks = [...footerHtml.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ text: stripTags(m[2]).slice(0, 40), href: m[1] }))
    .filter((l) => l.text && !/^(#|javascript:)/i.test(l.href))
    .slice(0, 8);

  const colors = [
    ...cssVarColors(html),
    ...(pickColor(firstCssColor(html, "background")) ? [pickColor(firstCssColor(html, "background"))!] : []),
  ].filter(Boolean).slice(0, 6);

  return {
    url,
    domain,
    shopify,
    brand: {
      name: brandName,
      logoUrl: logoUrl || null,
      colors,
      fontFamily: null,
    },
    header: { logoText: logoUrl ? "" : brandName, menu: collectMenu(html) },
    hero: { headline: heroHeadline, subheadline: heroSub, ctaLabel: "Comprar ahora", ctaHref, imageUrl: heroImage },
    sections,
    product: {
      title: productTitle,
      price,
      compareAt: null,
      currency: "EUR",
      description: "",
      imageUrl: productImg,
      ctaLabel: "Añadir al carrito",
      badge: shopify ? "Shopify" : null,
    },
    footer: { about: stripTags(footerHtml).slice(0, 200) || brandName, links: footerLinks, newsletter: /newsletter|email|suscr/i.test(html) },
    extraImages: goodImgs.slice(1, 12),
  };
}

function beheading(host: string): string {
  const part = (host || "").split(".")[0] || "";
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function firstCssColor(html: string, prop: "background" | "color"): string | null {
  const re = new RegExp(`(?:\\.|body|header|a|button)[^}]{0,120}?${prop}\\s*:\\s*([#0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))`, "i");
  const m = html.match(re);
  return m?.[1] ?? null;
}