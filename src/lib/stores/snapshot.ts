/**
 * Réplica FIEL de una tienda real: captura el HTML y CSS reales que sirve la
 * tienda y devuelve un documento autocontenido y seguro para previsualizarlo
 * en miniatura dentro de un iframe aislado. Nada se reconstruye: se conserva
 * el formato, los colores, las fuentes y el maquetado exactos de la web.
 */

import { safeFetchHtml, safeFetchBytes, extractTitle, detectShopify } from "./safe-fetch";

export interface StoreSnapshot {
  url: string;
  domain: string;
  shopify: boolean;
  title: string;
  html: string;
  cssInlined: number;
}

const HEAD_RE = /(<head[^>]*>)/i;
const LINK_INLINE_RE = /<link\b(?=[^>]*rel=["']stylesheet["'])[^>]*?href=["']([^"']+)["'][^>]*\/?\s*>/gi;
const IFRAME_TAG = /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>|<iframe\b[^>]*\/>/gi;
const FORM_TAG = /<\/?form\b[^>]*>/gi;
const BASE_TAG = /<base\b[^>]*\/?\s*>/gi;
const META_REFRESH = /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*>/gi;
const PRELOAD_LINK = /<link\b[^>]*rel=["'](?:preload|prefetch|modulepreload|preconnect|dns-prefetch)["'][^>]*\/?\s*>/gi;

function absolutizeCssUrls(source: string, base: string): string {
  // Convierte url(...) relativos en la hoja de estilos a absolutos respecto a su base.
  return source.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (m, q, u) => {
    const clean = u.trim();
    if (/^(data:|#|about:|blob:)/i.test(clean)) return m;
    try {
      return `url(${q}${new URL(clean, base).href}${q})`;
    } catch {
      return m;
    }
  });
}

function sanitizeCss(css: string): string {
  // Evita que el texto `</style>` dentro del CSS cierre nuestro <style> prematuramente.
  return css.replace(/<\//g, "<\\/");
}

export async function buildSnapshot(rawUrl: string): Promise<StoreSnapshot | null> {
  const fetched = await safeFetchHtml(rawUrl);
  if (!fetched || !fetched.ok) return null;

  const url = fetched.finalUrl;
  const domain = fetched.finalHost;
  const shopify = detectShopify(fetched.html);
  const title = extractTitle(fetched.html);

  let html = fetched.html;

  // 1) Marcar los relativos correctos: base = URL final de la página.
  html = html.replace(BASE_TAG, "");
  const baseHref = url.endsWith("/") ? url : url;
  html = html.replace(HEAD_RE, (m, head) => `${head}<base href="${baseHref}">`);
  // 2) CONSERVAMOS los scripts y los manejadores on* de la web real (sin reconstrucción):
  //    son los que cargan las imágenes perezosas, ejecutan las animaciones y eligen
  //    menús/estados exactos de la tienda.
  //    La seguridad la garantiza el iframe con sandbox="allow-scripts" SIN allow-same-origin:
  //    el código de la tienda corre aislado (origen opaco), no puede tocar cookies ni el
  //    DOM del padre ni escapar. Solo quitamos los elementos de navegación/embebido.
  html = html.replace(IFRAME_TAG, "");
  html = html.replace(META_REFRESH, "");
  // 3) Formularios → nada de envíos.
  html = html.replace(FORM_TAG, "");

  // 4) Incrustar en línea las hojas de estilo reales (máx. un número razonable).
  const cssLinks: { abs: string; tag: string }[] = [];
  let cssInlined = 0;
  html = html.replace(LINK_INLINE_RE, (tag, href) => {
    let abs = href;
    try {
      abs = new URL(href, baseHref).href;
    } catch {
      /* usamos el href crudo */
    }
    cssLinks.push({ abs, tag });
    return tag;
  });

  // Cargamos en paralelo y sustituimos cada <link> por su <style>.
  const loaded = await Promise.all(
    cssLinks.slice(0, 40).map(async ({ abs }) => {
      if (!/\.css(?:\?|#|$)/i.test(abs)) return null;
      const buf = await safeFetchBytes(abs);
      if (!buf) return null;
      const css = buf.toString("utf8");
      if (css.length < 8) return null;
      return absolutizeCssUrls(css, abs);
    })
  );

  let li = 0;
  html = html.replace(LINK_INLINE_RE, () => {
    const css = loaded[li++];
    if (!css) {
      // fallback: no se pudo cargar; dejamos el <link> absoluto (ya resuelto por <base>).
      return cssLinks[li - 1]?.tag ?? "";
    }
    cssInlined++;
    return `<style>${sanitizeCss(css)}</style>`;
  });

  // 5) Quitar links de precarga/iconos que no aportan y pueden frenar la carga.
  html = html.replace(PRELOAD_LINK, "");

  return {
    url,
    domain,
    shopify,
    title,
    html,
    cssInlined,
  };
}