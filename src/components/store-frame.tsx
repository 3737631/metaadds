"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Store, Loader2, Pencil } from "lucide-react";
import type { ChatOp } from "@/lib/stores/chat";

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

/**
 * Receptor de operaciones del chatbot. Se inyecta SIEMPRE (incluso en modo vista)
 * para que el usuario pueda pedir cambios por chat sin entrar en modo edición.
 * Escucha mensajes del padre {type:'apply-ops', ops: ChatOp[]} y los aplica en vivo.
 */
const OPS_RECEIVER = `
(function () {
  var apply = function (op) {
    try {
      if (op.op === 'injectCss' && op.css) {
        var st = document.createElement('style');
        st.textContent = op.css;
        (document.head || document.documentElement).appendChild(st);
        return { ok: true, selector: 'CSS' };
      }
      var sel = typeof op.selector === 'string' && op.selector.trim() ? op.selector.trim() : null;
      var val = op.value !== undefined ? op.value : (op.text !== undefined ? op.text : (op.src !== undefined ? op.src : (op.html !== undefined ? op.html : '')));
      if (op.op === 'replaceByText') {
        var want = String(op.text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        if (!want) return { ok: false, selector: op.text };
        var norm = function (s) { return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); };
        var allEls = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,li,strong,em,div');
        var best = null, bestDepth = -1;
        for (var ti = 0; ti < allEls.length; ti++) {
          var cand = allEls[ti];
          if (norm(cand.textContent) !== want) continue;
          if (cand.tagName === 'SCRIPT' || cand.tagName === 'STYLE' || cand.tagName === 'NOSCRIPT') continue;
          var d = 0, n = cand;
          while (n.parentElement) { d++; n = n.parentElement; }
          if (d > bestDepth) { best = cand; bestDepth = d; }
        }
        if (best) { best.textContent = op.newText; return { ok: true, selector: op.text }; }
        // Fallback: contenedor pequeño cuyo texto normalizado CONTIENE el buscado
        // (p. ej. párrafo con puntuación o espacios distinta a la extraída).
        for (var ci = 0; ci < allEls.length; ci++) {
          var cc = allEls[ci];
          if (cc.children.length > 3) continue;
          var cct = norm(cc.textContent);
          if (cct.indexOf(want) !== -1 && cct.length <= want.length * 2 + 12) {
            cc.textContent = op.newText;
            return { ok: true, selector: op.text };
          }
        }
        return { ok: false, selector: op.text };
      }
      if (!sel) return { ok: false, selector: null };
      var els = [];
      try { els = Array.prototype.slice.call(document.querySelectorAll(sel)); }
      catch (e) { return { ok: false, selector: sel, err: String(e) }; }
      if (!els.length) {
        return { ok: false, selector: sel };
      }
      els.forEach(function (el) {
        switch (op.op) {
          case 'replaceText': el.textContent = val; break;
          case 'replaceInner': el.innerHTML = val; break;
          case 'setStyle': if (el.style) { el.style[op.prop] = val; } break;
          case 'setImage':
            if (el.tagName === 'IMG') el.setAttribute('src', val);
            else if (el.style) el.style.backgroundImage = 'url(' + val + ')';
            break;
          case 'setAttr': el.setAttribute(op.attr || op.prop || 'href', val); break;
          case 'hide': if (el.style) el.style.display = 'none'; break;
          case 'remove': el.remove(); break;
        }
      });
      return { ok: true, selector: sel };
    } catch (e) {
      return { ok: false, selector: op && op.selector, err: String(e) };
    }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'apply-ops') return;
    var ops = Array.isArray(d.ops) ? d.ops : [];
    var applied = 0, failed = 0;
    ops.forEach(function (op) {
      var r = apply(op);
      if (r && r.ok) applied++; else failed++;
    });
    if (parent && parent !== window) {
      parent.postMessage({ type: 'ops-applied', applied: applied, failed: failed }, '*');
    }
  });
})();
`;

export default function StoreFrame({
  html,
  title,
  shopify,
  domain,
  editMode = false,
  opsRef,
}: {
  html: string;
  title: string;
  shopify: boolean;
  domain: string;
  editMode?: boolean;
  opsRef?: RefObject<((ops: ChatOp[]) => void) | null>;
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

  // Exponer al padre un manejador para aplicar operaciones del chatbot en el iframe.
  useEffect(() => {
    if (!opsRef) return;
    opsRef.current = (ops: ChatOp[]) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "apply-ops", ops }, "*");
    };
    return () => {
      if (opsRef) opsRef.current = null;
    };
  }, [opsRef]);

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
    // Siempre inyectamos el receptor de operaciones del chatbot para poder aplicar
    // cambios por chat aunque no estemos en modo edición.
    const idx = html.lastIndexOf("</body>");
    if (idx === -1) return html;
    // Concatenación simple (no template literal) para obtener un `</script>` REAL que
    // cierre la etiqueta en el srcdoc; un `<\/script>` escapado dejaría el <script>
    // abierto y el parser se tragaría el resto del HTML.
    const receiver = "<script>" + OPS_RECEIVER + "</script>";
    if (!editMode) {
      return html.slice(0, idx) + receiver + html.slice(idx);
    }
    // En modo edición añadimos además el editor click-to-edit.
    const editor = "<script>" + EDITOR_SCRIPT + "</script>";
    return html.slice(0, idx) + receiver + editor + html.slice(idx);
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