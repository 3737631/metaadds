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
  var EDIT_ON = false;
  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function setEdit(on) {
    EDIT_ON = !!on;
    document.documentElement.classList.toggle('__META_ED', EDIT_ON);
    if (EDIT_ON) { tag(); }
    else { closeImageBar(); }
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'mode') setEdit(d.edit);
  });

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

  // 2) Inyectar estilos de edición (solo visibles con html.__META_ED = modo edición)
  var st = document.createElement('style');
  st.textContent = [
    'html.__META_ED [data-eid][data-edit="1"] { outline:1.5px dashed rgba(59,130,246,.75) !important; outline-offset:1px; cursor:text !important; transition: background .15s; }',
    'html.__META_ED [data-eid][data-edit="1"]:hover { background: rgba(59,130,246,.08); }',
    'html.__META_ED [data-eid][data-img="1"] { cursor:pointer; }',
    'html.__META_ED [data-drop="1"] { outline:3px dashed #22c55e !important; outline-offset:2px; }',
    '.ed-banner { position:fixed; top:0; left:0; right:0; z-index:99999; display:none; background:#2563eb; color:#fff; text-align:center; font:600 12px/20px system-ui,sans-serif; letter-spacing:.2px; }',
    'html.__META_ED .ed-banner { display:block; }'
  ].join('\\n');
  document.head.appendChild(st);

  // Banner informativo (visible solo en modo edición)
  var banner = document.createElement('div');
  banner.className = 'ed-banner';
  banner.textContent = 'Clic para editar: toca cualquier texto o imagen · arrastra una foto encima para cambiarla';
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

  // --- Edición de fotos simple: subir desde el navegador/galería (drag & drop o
  // clic), pegar URL o borrar. El botón de la imagen abre una barra con acciones.
  function readFileAsDataURL(file, cb) {
    var r = new FileReader();
    r.onload = function () { cb(String(r.result || '')); };
    r.readAsDataURL(file);
  }

  function applyImage(el, src) {
    try {
      // Hueco "Foto eliminada": lo sustituimos por una imagen real con el mismo eid.
      if (el.getAttribute && el.getAttribute('data-img') === '1') {
        var nh = document.createElement('img');
        nh.setAttribute('data-eid', el.getAttribute('data-eid'));
        nh.setAttribute('data-img', '1');
        nh.src = src;
        el.parentNode.replaceChild(nh, el);
        el = nh;
      }
      if (el.tagName === 'IMG') { el.setAttribute('src', src); el.removeAttribute('srcset'); }
      else if (/background-image/.test(el.getAttribute('style') || '')) { el.style.backgroundImage = 'url(' + src + ')'; }
      else if (el.tagName === 'PICTURE') {
        var im = el.querySelector('img');
        if (im) { im.setAttribute('src', src); im.removeAttribute('srcset'); }
      }
      else if (el.tagName === 'IMG') { el.setAttribute('src', src); }
    } catch (e) {}
    parent.postMessage({ type: 'snapshot-edit', mode: 'img', eid: el.getAttribute('data-eid'), value: src }, '*');
  }

  function deleteImage(el) {
    if (el.tagName === 'IMG') {
      var holder = document.createElement('div');
      holder.setAttribute('data-eid', el.getAttribute('data-eid'));
      holder.setAttribute('data-img', '1');
      holder.style.cssText = 'aspect-ratio:16/9;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font:500 13px system-ui,sans-serif;border:1.5px dashed #cbd5e1;border-radius:12px;min-height:80px;';
      holder.textContent = 'Foto eliminada';
      el.parentNode.replaceChild(holder, el);
    } else if (/background-image/.test(el.getAttribute('style') || '')) {
      el.style.backgroundImage = '';
    }
    parent.postMessage({ type: 'snapshot-edit', mode: 'img', eid: el.getAttribute('data-eid'), value: '' }, '*');
  }

  var imageBarIds = [];
  function openImageBar(el) {
    closeImageBar();
    var bar = document.createElement('div');
    bar.setAttribute('data-eid', 'bar' + (++eid));
    bar.style.cssText = 'position:absolute;z-index:2147483000;display:flex;gap:6px;padding:6px 8px;background:rgba(17,24,39,.92);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-family:system-ui,sans-serif;transform:translateY(-110%);transition:opacity .12s;top:0;left:0;';
    var mk = function (label, onClick) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'border:0;background:#ffffff;color:#111827;font:600 11px/1 system-ui,sans-serif;padding:7px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;';
      b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); onClick(); };
      return b;
    };
    var fileBtn = mk('📁 Elegir foto', function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.className = '__ed_file';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = function () {
        var f = inp.files && inp.files[0];
        if (f) readFileAsDataURL(f, function (src) { applyImage(el, src); closeImageBar(); });
        if (inp.parentNode) inp.parentNode.removeChild(inp);
      };
      inp.click();
    });
    var urlBtn = mk('🔗 URL', function () {
      var val = window.prompt('URL de la foto:', el.tagName === 'IMG' ? (el.getAttribute('src') || '') : '');
      closeImageBar();
      if (val) applyImage(el, val);
    });
    var delBtn = mk('🗑️ Borrar', function () { deleteImage(el); closeImageBar(); });
    bar.appendChild(fileBtn);
    bar.appendChild(urlBtn);
    bar.appendChild(delBtn);
    el.setAttribute('data-eid-bar', '1');
    var posEl = el;
    bar.style.position = 'absolute';
    var rect = posEl.getBoundingClientRect();
    bar.style.top = (rect.top + window.scrollY - 42) + 'px';
    bar.style.left = (rect.left + window.scrollX) + 'px';
    document.body.appendChild(bar);
    imageBarIds.push(bar);
    // Cerrar al hacer clic fuera.
    setTimeout(function () {
      document.addEventListener('click', function (e) {
        if (e.target && e.target !== bar && !bar.contains(e.target)) closeImageBar();
      });
    }, 60);
  }

  function closeImageBar() {
    imageBarIds.forEach(function (b) { if (b && b.parentNode) b.parentNode.removeChild(b); });
    imageBarIds = [];
  }

  // Drag & drop: arrastrar una foto de tu navegador sobre una imagen la reemplaza.
  document.addEventListener('dragover', function (e) {
    if (!EDIT_ON) return;
    var el = e.target && e.target.closest ? e.target.closest('[data-eid]') : null;
    if (el && e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
      e.preventDefault();
      el.setAttribute('data-drop', '1');
    }
  }, true);
  document.addEventListener('dragleave', function (e) {
    if (!EDIT_ON) return;
    var el = e.target && e.target.closest ? e.target.closest('[data-drop]') : null;
    if (el) el.removeAttribute('data-drop');
  }, true);
  document.addEventListener('drop', function (e) {
    if (!EDIT_ON) return;
    var el = e.target && e.target.closest ? e.target.closest('[data-eid]') : null;
    if (!el || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    var f = e.dataTransfer.files[0];
    if (f && /^image\\//i.test(f.type || '')) {
      e.preventDefault();
      var im = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!im && /background-image/.test(el.getAttribute('style') || '')) im = el;
      var target = im || el;
      readFileAsDataURL(f, function (src) { applyImage(target, src); target.removeAttribute('data-drop'); });
    }
  }, true);

  // Delegación de clics (captura). Los enlaces NO navegan si son editables; el
  // propio preventDefault lo garantiza; los no-editables conservan su href.
  document.addEventListener('click', function (e) {
    if (!EDIT_ON) return;
    var t = e.target;
    if (t && t === banner) return;
    // Los clics sobre la barra de acciones de foto (Elegir/Borrar/URL) no se
    // interceptan: sus botones tienen su propio handler.
    if (t && t.closest && t.closest('[data-eid^="bar"]')) return;
    var el = t && t.closest ? t.closest('[data-eid]') : null;
    if (!el) return;
    if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || /background-image/.test(el.getAttribute('style') || '') || el.getAttribute('data-img') === '1') {
      e.preventDefault(); e.stopPropagation(); openImageBar(el); return;
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
/**
 * Bootstrap silencioso. Se inyecta MUY pronto (justo tras <head>) para que ejecute
 * ANTES que los scripts del tema de la tienda. Su objetivo es silenciar los errores
 * de consola típicos del entorno aislado (sandbox sin allow-same-origin) que NO
 * afectan a la vista previa:
 *   - Acceso a document.cookie (el sandbox lo bloquea al no poder leer la cookie).
 *   - Peticiones del tema a endpoints de carrito/analytics (fallan por CORS aquí).
 *   - Avisos/errores internos del tema (storefrontBaseUrl "null", etc).
 * En la vista previa queremos un iframe limpio: sin errores en F12.
 */
const QUIET_SCRIPT = `
(function () {
  try {
    var noisy = /storefrontBaseUrl|Access-Control-Allow-Origin|Failed to load resource|net::ERR_FAILED|cookie|removeAttr|\\/api\\/collect|\\/cart\\.js|\\/services\\/javascripts|\\/conversion\\.js|shopifysvc\\.com|otlp|\\/v1\\/metrics|\\/v1\\/logs|preflight|The document is sandboxed/i;
    var oErr = console.error.bind(console);
    var oWarn = console.warn.bind(console);
    console.error = function () {
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        try { if (noisy.test(String(a && a.message !== undefined ? a.message : a))) return; } catch (e) {}
      }
      return oErr.apply(console, arguments);
    };
    console.warn = function () {
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        try { if (noisy.test(String(a && a.message !== undefined ? a.message : a))) return; } catch (e) {}
      }
      return oWarn.apply(console, arguments);
    };
    window.addEventListener('error', function (e) {
      try { if (e && e.error && noisy.test(String(e.error && e.error.message ? e.error.message : e.error))) { e.stopImmediatePropagation(); e.preventDefault(); } } catch (x) {}
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      try { if (e && e.reason && noisy.test(String(e.reason && e.reason.message ? e.reason.message : e.reason))) { e.preventDefault(); } } catch (x) {}
    }, true);
    var _fetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var u = typeof input === 'string' ? input : (input && input.url) || '';
      if (/\\/api\\/collect|\\/cart\\.js|\\/services\\/javascripts|\\/conversion\\.js|shopifysvc\\.com|otlp-http|\\/v1\\/metrics|\\/v1\\/logs/i.test(u)) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return _fetch(input, init);
    };
    var beaconUrls = /shopifysvc\\.com|otlp-http|\\/v1\\/metrics|\\/v1\\/logs|\\/api\\/collect|\\/cart\\.js|\\/services\\/javascripts|\\/conversion\\.js/i;
    if (navigator && navigator.sendBeacon) {
      var _beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try { if (beaconUrls.test(String(url))) return true; } catch (e) {}
        return _beacon.apply(this, arguments);
      };
    }
    try {
      var _xopen = XMLHttpRequest.prototype.open;
      var _xsend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { this.__qurl = String(url); } catch (e) {}
        return _xopen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        try { if (beaconUrls.test(String(this.__qurl || ''))) return; } catch (e) {}
        return _xsend.apply(this, arguments);
      };
    } catch (e) {}
    try { Object.defineProperty(document, 'cookie', { configurable: true, get: function () { return ''; }, set: function () {} }); } catch (e) {}
  } catch (e) {}
})();
`;

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
        var norm = function (s) { return String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); };
        var want = norm(op.text);
        if (!want) return { ok: false, selector: op.text };
        var allEls = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,li,strong,em,label,legend,figcaption,div');
        // Reemplaza TODAS las ocurrencias del texto (un mismo rótulo suele aparecer
        // en header, menú móvil, footer...). Para no pisar contenedores anidados,
        // se salta un elemento cuyo padre también coincide (su padre ya se reemplaza).
        var candidates = [];
        for (var ti = 0; ti < allEls.length; ti++) {
          var cand = allEls[ti];
          if (cand.tagName === 'SCRIPT' || cand.tagName === 'STYLE' || cand.tagName === 'NOSCRIPT') continue;
          if (norm(cand.textContent) !== want) continue;
          if (cand.parentElement && norm(cand.parentElement.textContent) === want) continue;
          candidates.push(cand);
        }
        if (candidates.length) {
          for (var ci2 = 0; ci2 < candidates.length; ci2++) candidates[ci2].textContent = op.newText;
          return { ok: true, selector: op.text };
        }
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
// Evita que el iframe NAVEgue al sitio real al hacer clic en un enlace (o el
  // navegador mostraría dentro del editor la página nativa de "conexión rechazada"
  // y se perdería la vista editable). Los anclajes internos (#) se dejan pasar.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:/i.test(href)) return;
    try {
      var host = new URL(href, document.baseURI).hostname;
      if (host && host !== (location.hostname || '#')) {
        e.preventDefault();
        e.stopPropagation();
      }
    } catch (ex) {}
  }, true);

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d) return;
    // Aplicar operaciones del chatbot.
    if (d.type === 'apply-ops' && Array.isArray(d.ops)) {
      var ops = d.ops;
      var applied = 0, failed = 0;
      ops.forEach(function (op) {
        var r = apply(op);
        if (r && r.ok) applied++; else failed++;
      });
      if (parent && parent !== window) {
        parent.postMessage({ type: 'ops-applied', applied: applied, failed: failed }, '*');
      }
      return;
    }
    // Serializar el DOM modificado para que el padre lo reutilice al cambiar de modo.
    if (d.type === 'request-state') {
      // Trabajamos sobre un CLON limpio: así el modo edición en vivo (banner,
      // data-eid, __META_ED) se queda intacto en pantalla.
      var clone = document.documentElement.cloneNode(true);
      if (clone.classList) clone.classList.remove('__META_ED');
      ['__meta_ops', '__meta_editor', '__meta_quiet'].forEach(function (id) {
        var s = clone.querySelector ? clone.querySelector('script#' + id) : null;
        if (s && s.parentNode) s.parentNode.removeChild(s);
      });
      var markerEls = clone.querySelectorAll ? clone.querySelectorAll('.ed-banner, [data-eid^="bar"], .__ed_file') : [];
      for (var mi = 0; mi < markerEls.length; mi++) {
        var me = markerEls[mi];
        if (me && me.parentNode) me.parentNode.removeChild(me);
      }
      var tagged = clone.querySelectorAll ? clone.querySelectorAll('[data-eid], [data-edit], [contenteditable], [__ED__]') : [];
      for (var ti = 0; ti < tagged.length; ti++) {
        var cel = tagged[ti];
        cel.removeAttribute('data-eid');
        cel.removeAttribute('data-edit');
        cel.removeAttribute('contenteditable');
        cel.removeAttribute('__ED__');
      }
      if (parent && parent !== window) {
        parent.postMessage({ type: 'iframe-state', html: clone.outerHTML }, '*');
      }
    }
  });

  // El iframe está listo: el padre reenvía el modo de edición actual (por si se
  // ha recargado el iframe y el script vuelve a nacer con el modo desactivado).
  setTimeout(function () {
    if (parent && parent !== window) parent.postMessage({ type: 'iframe-ready' }, '*');
  }, 300);
})();
`;

export default function StoreFrame({
  html,
  title,
  shopify,
  domain,
  editMode = false,
  opsRef,
  stateRef,
  onState,
}: {
  html: string;
  title: string;
  shopify: boolean;
  domain: string;
  editMode?: boolean;
  opsRef?: RefObject<((ops: ChatOp[]) => void) | null>;
  stateRef?: RefObject<(() => void) | null>;
  onState?: (html: string) => void;
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

  // Exponer al padre un disparador para pedir el estado del iframe (serializa el DOM ya modificado).
  useEffect(() => {
    if (!stateRef) return;
    stateRef.current = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: "request-state" }, "*");
    };
    return () => {
      if (stateRef) stateRef.current = null;
    };
  }, [stateRef]);

  // Recibir notificaciones de edición desde dentro del iframe.
  const onEdit = useCallback((eid: string, mode: string, value: string) => {
    // Podríamos registrar aquí el histórico; de momento no hacemos nada en el padre
    // porque el iframe ya muestra el cambio en vivo.
  }, []);

  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (!d) return;
      if (d.type === "iframe-ready") {
        // El iframe acaba de recargarse: restauramos el modo de edición vigente.
        iframeRef.current?.contentWindow?.postMessage({ type: "mode", edit: editModeRef.current }, "*");
        return;
      }
      if (d.type === "snapshot-edit") {
        onEdit(String(d.eid), String(d.mode), String(d.value));
      }
      if (d.type === "iframe-state" && typeof d.html === "string" && onState) {
        onState(d.html);
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEdit, onState]);

  const editableSrc = useMemo(() => {
    // Siempre inyectamos el receptor de operaciones del chatbot y el editor
    // click-to-edit; el modo edición se activa/desactiva en vivo con {type:'mode'}
    // para NO recargar el iframe al pulsar EDITAR/LISTO (mantiene scroll y cambios).
    if (html.indexOf("</body>") === -1) return html;
    const headIdx = html.indexOf("<head>");
    const quietInjected =
      headIdx !== -1
        ? html.slice(0, headIdx + "<head>".length) +
          '<script id="__meta_quiet">' + QUIET_SCRIPT + "</script>" +
          html.slice(headIdx + "<head>".length)
        : html;
    const bidx = quietInjected.lastIndexOf("</body>");
    const receiver = '<script id="__meta_ops">' + OPS_RECEIVER + "</script>";
    const editor = '<script id="__meta_editor">' + EDITOR_SCRIPT + "</script>";
    return quietInjected.slice(0, bidx) + receiver + editor + quietInjected.slice(bidx);
  }, [html]);

  // Sincroniza el modo de edición con el iframe (sin recargar la página).
  const editModeRef = useRef(editMode);
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "mode", edit: editMode }, "*");
  }, [editMode]);

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