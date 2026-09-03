"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Store, Loader2, Pencil } from "lucide-react";

/**
 * Vista en miniatura de la web REAL de la tienda, renderizada en un iframe aislado.
 * Por defecto se ve EXACTAMENTE igual que la tienda (HTML+CSS capturados).
 *
 * En modo edición (por defecto) se inyecta un pequeño "click-to-edit" dentro del
 * iframe: al pulsar cualquier texto o imagen puedes cambiarlo en vivo. Los cambios
 * se notifican al padre mediante postMessage (protocolo {type:'snapshot-edit'}).
 *
 * Seguridad: buildSnapshot quita scripts, atributos on* e iframes; el iframe va con
 * sandbox="allow-scripts" (SIN allow-same-origin) para que el HTML capturado no pueda
 * escapar ni tocar cookies. Solo corre nuestro script de edición.
 */
const BASE_WIDTH = 1200; // ancho lógico sobre el que está maquetada la miniweb

/** Script de click-to-edit que se inyecta dentro del iframe (corre aislado). */
const EDITOR_SCRIPT = `
(function () {
  var BOOT = '__ED__';
  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function isTextEl(el) {
    if (!el) return false;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT' || el.tagName === 'SVG') return false;
    if (el.closest('form')) return false;
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (text.length < 1) return false;
    // Solo elementos que son "hojas" (poca descendencia directa de texto editable)
    var tag = el.tagName.toLowerCase();
    return ['h1','h2','h3','h4','h5','p','li','a','span','td','th','button','strong','em','b','figcaption','blockquote','small','label','div'].indexOf(tag) >= 0;
  }

  // 1) Marcar textos e imágenes editables
  var EDITABLE_SEL = 'h1,h2,h3,h4,h5,p,li,a,span,td,th,button,strong,em,b,figcaption,blockquote,small,label,div';
  var eid = 0;
  function tag() {
    qa(EDITABLE_SEL).forEach(function (el) {
      if (el.getAttribute(BOOT)) return;
      if (el.hasAttribute('data-eid')) return;
      if (!isTextEl(el)) return;
      el.setAttribute('data-eid', 't' + (++eid));
      el.setAttribute(BOOT, '1');
    });
    // imágenes
    qa('img, picture, [style*="background-image"]').forEach(function (el) {
      if (el.getAttribute('data-eid')) return;
      el.setAttribute('data-eid', 'i' + (++eid));
    });
  }

  // 2) Inyectar estilos de edición
  var st = document.createElement('style');
  st.textContent = [
    '[data-eid][data-edit="1"] { outline:1.5px dashed rgba(59,130,246,.75) !important; outline-offset:1px; cursor:text !important; transition: background .15s; }',
    '[data-eid][data-edit="1"]:hover { background: rgba(59,130,246,.08); }',
    '[data-eid][data-img="1"] { cursor:pointer; }',
    '.ed-banner { position:fixed; top:0; left:0; right:0; z-index:99999; background:#2563eb; color:#fff; text-align:center; font:600 12px/20px system-ui,sans-serif; letter-spacing:.2px; }'
  ].join('\\n');
  document.head.appendChild(st);

  // Banner informativo
  var banner = document.createElement('div');
  banner.className = 'ed-banner';
  banner.textContent = 'Clic para editar: toca cualquier texto o imagen de la web';
  banner.style.pointerEvents = 'none';
  document.body.appendChild(banner);

  function activateText(el) {
    var was = el.textContent;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-edit', '1');
    el.focus();
    // Seleccionar todo el texto
    try {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
    } catch (e) {}
    function done() {
      el.removeAttribute('contenteditable');
      var now = el.textContent || '';
      if (now !== was) {
        el.setAttribute('data-edit', '1');
        parent.postMessage({ type: 'snapshot-edit', mode: 'text', eid: el.getAttribute('data-eid'), value: now }, '*');
      } else {
        el.setAttribute('data-edit', '1');
      }
      document.removeEventListener('click', outside, true);
      el.removeEventListener('blur', done);
      el.addEventListener('keydown', function (k) { if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); el.blur(); } });
      el.focus();
    }
    function outside(e) {
      if (!el.contains(e.target)) { done(); }
    }
    setTimeout(function () { document.addEventListener('click', outside, true); }, 50);
    el.addEventListener('blur', done);
  }

  function pickImage(el) {
    var current = el.tagName === 'IMG' ? (el.getAttribute('src') || '') : '';
    var url = window.prompt('Nueva URL de la imagen:', current);
    if (!url) return;
    function apply(src) {
      if (el.tagName === 'IMG') { el.setAttribute('src', src); }
      else { el.style.backgroundImage = 'url(' + src + ')'; }
      parent.postMessage({ type: 'snapshot-edit', mode: 'img', eid: el.getAttribute('data-eid'), value: src }, '*');
    }
    if (/^https?:\\/\\//i.test(url)) apply(url);
    else apply(url);
  }

  // Delegación de clics (captura). Los enlaces NO navegan si son editables; el
  // propio preventDefault lo garantiza; los no-editables conservan su href.
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t === banner) return;
    var el = t && t.closest ? t.closest('[data-eid]') : null;
    if (!el) return;
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || /background-image/.test(el.getAttribute('style') || '')) {
      e.preventDefault(); e.stopPropagation(); pickImage(el); return;
    }
    if (isTextEl(el)) {
      e.preventDefault(); e.stopPropagation(); activateText(el);
    }
  }, true);

  tag();
  // Re-etiquetar contenido que aparezca tarde (muy pocos sites usan AJAX sin scripts, pero por si acaso)
  var t = setInterval(function () { tag(); if (document.querySelector('[data-eid]')) clearInterval(t); }, 4000);
})();
`;

export default function StoreFrame({
  html,
  title,
  shopify,
  domain,
  editMode = false,
}: {
  html: string;
  title: string;
  shopify: boolean;
  domain: string;
  editMode?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [width, setWidth] = useState<number>(380);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recibir notificaciones de edición desde dentro del iframe.
  const onEdit = useCallback((eid: string, mode: string, value: string) => {
    // Podríamos registrar aquí el histórico; de momento no hacemos nada en el padre
    // porque el iframe ya muestra el cambio en vivo.
  }, []);

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (d && d.type === "snapshot-edit") {
        onEdit(String(d.eid), String(d.mode), String(d.value));
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEdit]);

  const editableSrc = useMemo(() => {
    // Sin modo edición: mostramos la web real tal cual (con sus scripts y animaciones).
    if (!editMode) return html;
    // En modo edición inyectamos nuestro script de editor justo antes de </body>.
    const marker = "</body>";
    const idx = html.lastIndexOf(marker);
    if (idx === -1) return html;
    // Usamos '' + concatenación (no template literal) para que el cierre sea un `</script>` REAL
    // que cierre la etiqueta en el HTML del srcdoc; un `<\/script>` escapado dejaría el <script>
    // abierto y el parser se tragaría el resto del HTML (no ejecutaría nuestro editor).
    return html.slice(0, idx) + "<script>" + EDITOR_SCRIPT + "</script>" + html.slice(idx);
  }, [html, editMode]);

  const scale = width > 0 ? width / BASE_WIDTH : 1;
  const viewportH = 520;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-dim">
          <Store className="h-4 w-4 shrink-0 text-accent2" />
          <span className="truncate">{domain || title}</span>
        </div>
        {shopify && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            Shopify
          </span>
        )}
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height: viewportH }}>
        {width === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-surface text-sm text-dim">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando mini web…
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            style={{ height: viewportH, width: "100%" }}
          >
            <iframe
              ref={iframeRef}
              title={title || domain || "Vista de la tienda"}
sandbox="allow-scripts allow-modals"
              scrolling="yes"
              srcDoc={editableSrc}
              style={{
                width: BASE_WIDTH,
                height: Math.ceil(viewportH / scale),
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: "none",
                background: "#ffffff",
                pointerEvents: "auto",
              }}
            />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <Pencil className="h-3 w-3" />{" "}
        {editMode
          ? "Modo edición: clic sobre cualquier texto o imagen para cambiarlo en vivo."
          : "Web exacta de la tienda real. Pulsa EDITAR para modificar sus textos e imágenes."}
      </p>
    </div>
  );
}