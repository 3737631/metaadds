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

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/gi;

/**
 * Incrusta como base64 `data:` los ficheros de fuentes (woff2/woff/ttf) que
 * referencian los @font-face, para que la tipografía se vea EXACTA aun dentro
 * del iframe aislado (origen 'null' bloquea por CORS las fuentes remotas).
 * Devuelve el CSS con las urls sustituidas cuando se pudo bajar la fuente.
 */
async function inlineFontFaces(css: string, base: string): Promise<string> {
  const blocks = css.match(FONT_FACE_RE) ?? [];
  if (blocks.length === 0) return css;

  // Robust: recopila las URLs de fuentes a bajar y las sustituye por base64.
  const replacements: { url: string; base64: string }[] = [];
  const jobs: { url: string; abs: string }[] = [];
  const seenJobs = new Set<string>();
  for (const block of blocks) {
    if (jobs.length >= 10) break;
    block.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (_m, _q, u) => {
      const clean = u.trim();
      if (/^(data:|#|about:|blob:|http)/i.test(clean)) return _m;
      let abs: string;
      try {
        abs = new URL(clean, base).href;
      } catch {
        return _m;
      }
      if (!/\.(woff2?|ttf|otf)(\?|#|$)/i.test(abs)) return _m;
      if (seenJobs.has(abs)) return _m;
      seenJobs.add(abs);
      jobs.push({ url: `${_q || '"'}${clean}${_q || '"'}`, abs });
      return _m;
    });
  }

  await Promise.all(
    jobs.map(async (j) => {
      try {
        const buf = await safeFetchBytes(j.abs);
        if (!buf) return;
        const mime = /\.woff2(\?|#|$)/i.test(j.abs)
          ? "font/woff2"
          : /\.ttf(\?|#|$)/i.test(j.abs)
            ? "font/ttf"
            : /\.otf(\?|#|$)/i.test(j.abs)
              ? "font/otf"
              : "font/woff";
        replacements.push({ url: j.url, base64: `url(data:${mime};base64,${buf.toString("base64")})` });
      } catch {
        /* si no pudo bajar la fuente, se queda la url remota */
      }
    })
  );

  if (replacements.length === 0) return css;
  return css.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (m, q, u) => {
    const clean = u.trim();
    if (!/\.(woff2?|ttf|otf)(\?|#|$)/i.test(clean)) return m;
    const r = replacements.find((x) => x.url === `${q || '"'}${clean}${q || '"'}` || x.url === `${clean}`);
    return r ? r.base64 : m;
  });
}

/** Script que fuerza la carga inmediata de TODAS las imágenes y fondos (aunque la tienda sea perezosa). */
const EAGER_SCRIPT = `<script>
(function(){
  function eager(){
    try{
      document.querySelectorAll('img[loading="lazy"]').forEach(function(im){ im.loading='eager'; if(im.decoding){ im.decoding='sync'; } });
      document.querySelectorAll('img[data-src],img[data-lazy-src],img[data-original],img[data-lazyload],img[data-loaded-src]').forEach(function(im){
        var s = im.getAttribute('data-src')||im.getAttribute('data-lazy-src')||im.getAttribute('data-original')||im.getAttribute('data-lazyload');
        if(s && !im.getAttribute('src')){ im.setAttribute('src', s); }
        var ss = im.getAttribute('data-srcset')||im.getAttribute('data-lazy-srcset');
        if(ss) im.setAttribute('srcset', ss);
      });
      document.querySelectorAll('[data-background-image]').forEach(function(el){
        var b = el.getAttribute('data-background-image'); if(b) el.style.backgroundImage='url('+b+')';
      });
      document.querySelectorAll('[data-bg]').forEach(function(el){
        var b = el.getAttribute('data-bg'); if(b) el.style.backgroundImage='url('+b+')';
      });
      document.querySelectorAll('[style*="content-visibility:auto"],.content-visibility-auto').forEach(function(el){
        try{ el.style.contentVisibility='visible'; }catch(e){}
      });
    }catch(e){}
  }
  eager();
  window.addEventListener('load', eager);
  setTimeout(eager, 600);
  setTimeout(eager, 2500);
})();
<\/script>`;

function injectEager(html: string): string {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return html;
  return html.slice(0, headEnd) + EAGER_SCRIPT + html.slice(headEnd);
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

  // Cargamos en paralelo y sustituimos cada <link> por su <style>. Además
  // incrustamos las fuentes en línea (base64) para que la tipografía se vea
  // exacta aun con el iframe aislado (CORS bloquea las fuentes remotas).
  const loaded = await Promise.all(
    cssLinks.slice(0, 40).map(async ({ abs }) => {
      if (!/\.css(?:\?|#|$)/i.test(abs)) return null;
      const buf = await safeFetchBytes(abs);
      if (!buf) return null;
      let css = buf.toString("utf8");
      if (css.length < 8) return null;
      css = await inlineFontFaces(css, abs);
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

  // 6) Forzar la carga inmediata de TODAS las imágenes y fondos (la tienda usa
  //    carga perezosa; sin esto la miniatura quedaría con huecos en blanco).
  html = injectEager(html);

  return {
    url,
    domain,
    shopify,
    title,
    html,
    cssInlined,
  };
}