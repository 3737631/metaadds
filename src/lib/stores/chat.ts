import { getAIService } from "@/lib/ai/providers/ai-service";
import type { AIProviderResult } from "@/lib/ai/providers/types";

/**
 * Operación de edición concreta que la IA devuelve para aplicar sobre la
 * mini-web real (HTML+CSS capturados). Cada op actúa en vivo dentro del iframe.
 */
export type ChatOp =
  | { op: "replaceText"; selector: string; text: string }
  | { op: "replaceByText"; text: string; newText: string }
  | { op: "replaceInner"; selector: string; html: string }
  | { op: "setStyle"; selector: string; prop: string; value: string }
  | { op: "setImage"; selector: string; src: string }
  | { op: "setAttr"; selector: string; attr: string; value: string }
  | { op: "hide"; selector: string }
  | { op: "remove"; selector: string }
  | { op: "injectCss"; css: string };

export interface ChatEditResult {
  reply: string;
  ops: ChatOp[];
  provider?: string;
  model?: string;
}

/** Limpia JSON salido de un LLM: quita comentarios // y /* *\/ y comas finales, sin tocar strings. */
function cleanJsonLLM(raw: string): string {
  let out = "";
  let inStr = false;
  let i = 0;
  const s = raw;
  while (i < s.length) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (ch === "\\") {
        out += i + 1 < s.length ? s[i + 1] : "";
        i += 2;
        continue;
      }
      if (ch === '"') inStr = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === "," && (s[i + 1] === "}" || s[i + 1] === "]")) {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function repairJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(cleanJsonLLM(s));
    } catch {
      return null;
    }
  };

  // Array de ops directo.
  if (cleaned.startsWith("[")) {
    const arr = tryParse(cleaned);
    if (arr) return arr;
  }

  // Extrae el primer objeto JSON balanceando llaves (más robusto que
  // lastIndexOf: si hay texto después o un cierre extra, igual lo encaja).
  const start = cleaned.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (inStr) {
        if (c === "\\") {
          i += 1;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          const obj = tryParse(cleaned.slice(start, i + 1));
          if (obj) return obj;
          break;
        }
      }
    }
    const obj = tryParse(cleaned.slice(start));
    if (obj) return obj;
  }

  return null;
}

function buildSystemPrompt(): string {
  return `Eres un experto editor frontend y estratega de ecommerce. Recibes el HTML+CSS real capturado de una tienda online (parcialmente limpio) y una instrucción en lenguaje natural del usuario.

Debes convertir la instrucción en una lista de OPERACIONES DOM concretas que transformen la mini-web. La reselemos fielmente: la web se ve igual a la original; el usuario quiere que hagas cambios puntuales (textos, colores, imágenes, secciones, quitar avisos/cookies, etc.).

Devuelve SOLO JSON válido con la siguiente forma EXACTA:
{
  "reply": "breve mensaje en español explicando qué vas a cambiar (máx 2 frases), sin markdown",
  "ops": [
    { "op": "replaceText", "selector": "CSS selector único", "text": "nuevo texto" },
    { "op": "replaceByText", "text": "texto actual EXACTO visible", "newText": "nuevo texto" },
    { "op": "setStyle", "selector": "CSS selector", "prop": "color", "value": "#e11d48" },
    { "op": "setImage", "selector": "CSS selector img", "src": "https://url.nueva/imagen.jpg" },
    { "op": "setAttr", "selector": "CSS selector", "attr": "href", "value": "https://..." },
    { "op": "replaceInner", "selector": "CSS selector", "html": "HTML de reemplazo" },
    { "op": "hide", "selector": "CSS selector" },
    { "op": "remove", "selector": "CSS selector" },
    { "op": "injectCss", "css": "reglas CSS globales que transforman TODA la web" }
  ]
}

REGLAS:
- Los selectores deben apuntar a elementos EXISTENTES en el HTML que se te envía (usa texto visible entre comillas si ayuda, p. ej. 'a:has-text(...)' NO existe; usa selectores CSS reales: h1, .clase, #id, [data-*], o el Nº de índice). Prefiere selectores robustos y únicos: etiqueta (h1), .clase conocida, o [título de sección].
- Para cambios GLOBALES de toda la web (cambiar TODOS los rojos por azul, cambiar la tipografía, el color de fondo general, tamaños, espaciados) usa UNA op 'injectCss' con reglas CSS universales (body, h1,h2,h3, p, a, .btn, *). Por ejemplo para cambiar todos los rojos a azul: {"op":"injectCss","css":"*{color:#0055ff !important} a,#btn{color:#0055ff} .some-red-bg{background:#0055ff}"}. Eso es mucho más fiable que decenas de setStyle.
- Cuando el cambio afecte a un solo elemento (p. ej. cambiar el titular principal) usa replaceText/setStyle puntuales.
- Si la instrucción pide quitar banners de cookies, popups de newsletter, avisos legales o "basura", añade ops 'remove' con selectores basados en clases/texto típicas (p.ej. '#onetrust-banner-sdk', '.cookie-consent', '#cookie-banner', '#newsletter-popup', '.mailpoet_popup', div cuyo texto contenga 'aceptar cookies'). Selecciona por clase/id si los ves, y si no por un selector de atributo data o por índice; es aceptable un selector que cubra los candidatos razonables.
- No inventes selectores que no existan: si no puedes decidir, usa el más probable y añade en "reply" que revises la parte concreta.
- Mantén el promedio. No cambies nada que la instrucción no pida.
- El texto base de la web va en español salvo que la instrucción diga otra cosa.
- TRADUCCIÓN DE IDIOMA: si el usuario pide 'pon la web en inglés' (u otro idioma), emite UNA op 'replaceByText' por cada TEXTO VISIBLE listado en la sección 'TEXTOS VISIBLES DE LA WEB' del prompt de usuario, con "text" = el texto español exacto y "newText" = su traducción al idioma pedido (p.ej. 'ACERCA DE NOSOTROS'→'ABOUT US', '¡LINDO SOFA!'→'NICE SOFA!', 'INICIO'→'HOME', 'Comprar ahora'→'Buy now'). Traduce TODOS los textos visibles de la lista, uno por uno, sin saltarte ninguno. No necesitas selector CSS: usa replaceByText con el texto exacto. NO te limites a responder ni a poner solo el atributo lang; traduce el contenido visible.`;
}

function buildUserPrompt(html: string, domain: string, request: string): string {
  const bodyOnly = extractBody(html);
  const safe = bodyOnly.slice(0, 12000);
  const visible = extractVisibleTexts(bodyOnly);
  const list = visible.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return `TENDA / DOMINIO: ${domain}

INSTRUCCIÓN DEL USUARIO: ${request}

HTML capturado de la tienda (recortado; usa selectores reales que existan aquí):
${safe}

TEXTOS VISIBLES DE LA WEB (usa estos EXACTOS con la op replaceByText cuando haya que traducir o renombrar texto):
${list || "(ninguno extraído)"}

Devuelve el JSON.`;
}

/**
 * Extrae los textos visibles más relevantes de la web (titulares, botones,
 * enlaces, párrafos) para que la IA los traduzca/renombre de forma fiable.
 */
function extractVisibleTexts(body: string): string[] {
  const out: string[] = [];
  const regex = /<(\w+)\b[^>]*>([^<]{2,120})<\/(\1)>/gi;
  let m: RegExpExecArray | null;
  const tags = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "span", "li", "strong", "em"]);
  const seen = new Set<string>();
  while ((m = regex.exec(body)) !== null && out.length < 45) {
    const tag = m[1].toLowerCase();
    if (!tags.has(tag)) continue;
    let txt = m[2].replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&aacute;|&eacute;|&iacute;|&oacute;|&uacute;|&ntilde;/gi, "").trim();
    if (!txt) continue;
    const allLower = txt.replace(/\s+/g, " ").trim();
    if (allLower.length < 2) continue;
    if (/^[\s\W_]+$/.test(txt)) continue;
    if (seen.has(txt)) continue;
    seen.add(txt);
    out.push(txt);
  }
  return out;
}

/** Detecta si el usuario pide cambiar el idioma de la web (necesita más tokens y ops replaceByText). */
function isLanguageChange(request: string): boolean {
  const r = request.toLowerCase();
  return (
    /\bingl[ée]s\b/.test(r) ||
    /\benglish\b/.test(r) ||
    /\bfranc[ée]s\b/.test(r) ||
    /\bfrench\b/.test(r) ||
    /\bportugu[ée]s\b/.test(r) ||
    /\bialem[aá]n\b/.test(r) ||
    /\bitaliano\b/.test(r) ||
    /\bidioma\b/.test(r) ||
    /\blenguaje\b/.test(r) ||
    /traduc/.test(r) ||
    /\ben espa[ñn]ol\b/.test(r) ||
    /\bin spanish\b/.test(r) ||
    /\bin english\b/.test(r) ||
    /idioma de la web|idioma de la p[aá]gina|cambiar el idioma/.test(r)
  );
}

/** Extrae el <body> (y algo del <head> para clases globales) sin scripts pesados. */
function extractBody(html: string): string {
  const b = html.toLowerCase().indexOf("<body");
  const be = html.toLowerCase().lastIndexOf("</body>");
  if (b < 0 || be < b) return html.slice(0, 12000);
  return html.slice(b, be + 7);
}

export async function chatEditStore(opts: {
  html: string;
  domain: string;
  request: string;
}): Promise<ChatEditResult | null> {
  const service = getAIService();
  if (!service.available) return null;

  const result = await service.generate({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(opts.html, opts.domain, opts.request),
    responseFormat: "json",
    temperature: 0.4,
    maxTokens: 2048,
  });

  const json = repairJson(result.content);
  if (!json) {
    console.error("[/chat] JSON no parseable. provider:", result.provider, "model:", result.model, "raw:", result.content.slice(0, 2000));
    return null;
  }

  // Normaliza el sobre: {reply,ops[]}, {reply,changes[]}, ops[] directo, o un
  // solo op {selector,...}. También tolera un "action" como operación única.
  let reply = "";
  let opsArr: unknown[] = [];
  if (Array.isArray(json)) {
    opsArr = json;
  } else if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (typeof obj.reply === "string") reply = obj.reply;
    if (Array.isArray(obj.ops)) opsArr = obj.ops;
    else if (Array.isArray(obj.changes)) opsArr = obj.changes;
    else if (
      obj.selector || obj.op || obj.action || obj.type || obj.tipo || obj.accion ||
      obj.css || obj.css_code || obj.cssCode || obj.css_text || obj.rule ||
      obj.text || obj.html || obj.src || obj.style || obj.styles || obj.attr ||
      obj.hide === true || obj.hidden === true || obj.remove === true ||
      obj.display !== undefined
    )
      opsArr = [json];
  }

  // Aplana cada op entrante: un objeto con "style" anidado (ej.
  // {prop:"color", value:"navy"} o {color:"navy", ...}) produce varias
  // operaciones setStyle.
  const ops = chatOpsFromArray(opsArr);
  if (ops.length === 0) {
    console.error("[/chat] sin ops aplicables. Respuesta IA:", result.content.slice(0, 3000));
  }
  return {
    reply: reply || "He aplicado tus cambios.",
    ops,
    provider: result.provider,
    model: result.model,
  };
}

/** Convierte una lista de operaciones en bruto al formato ChatOp canónico. */
function chatOpsFromArray(opsArr: unknown[]): ChatOp[] {
  const flat: ChatOp[] = [];
  const pushOp = (op: ChatOp | null) => {
    if (op) flat.push(op);
  };
  for (const o of opsArr) {
    if (o && typeof o === "object") {
      const c = o as Record<string, unknown>;
      const styleSource =
        c.style && typeof c.style === "object" && !Array.isArray(c.style)
          ? c.style
          : c.css && typeof c.css === "object" && !Array.isArray(c.css)
            ? c.css
            : c.styles && typeof c.styles === "object" && !Array.isArray(c.styles)
              ? c.styles
              : null;
      if (styleSource) {
        const base = stylePropsToSetStyle(o);
        if (base) {
          const entries = Object.entries(styleSource as Record<string, unknown>);
          if (entries.length) {
            entries.forEach(([prop, value]) => {
              if (prop === "display" && /^\s*none\s*!?important/i.test(String(value))) {
                pushOp({ op: "hide", selector: base.selector });
              } else if (typeof value === "string" || typeof value === "number") {
                pushOp({ op: "setStyle", selector: base.selector, prop, value: String(value) });
              }
            });
            continue;
          }
        }
      }
    }
    pushOp(toChatOp(o));
  }
  return flat.filter((o): o is ChatOp => o !== null);
}

/** Normaliza un nombre de operación que la IA pueda escribir de varias formas. */
function normOp(op: string): string {
  const key = op.toLowerCase().replace(/[\s_/-]/g, "");
  switch (key) {
    case "replacetext":
    case "settext":
    case "setcontent":
    case "changetext":
    case "modifytext":
    case "updatetext":
    case "edittext":
    case "text":
    case "change":
      return "replaceText";
    case "replaceinner":
    case "setinner":
    case "sethtml":
      return "replaceInner";
    case "setstyle":
    case "style":
    case "setcss":
    case "modifystyle":
    case "updatestyle":
    case "changestyle":
    case "css":
      return "setStyle";
    case "setimage":
    case "image":
    case "setimg":
    case "changeimage":
      return "setImage";
    case "setattr":
    case "setattribute":
    case "attr":
      return "setAttr";
    case "hide":
    case "hidden":
    case "displaynone":
      return "hide";
    case "remove":
    case "delete":
    case "rm":
      return "remove";
    default:
      return op;
  }
}

/**
 * Si `o` trae un `style` anidado (objeto clave/valor) devuelve el selector base
 * (para generar un setStyle por propiedad), o null si no hay selector usable.
 */
function stylePropsToSetStyle(o: unknown): { selector: string } | null {
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  let selector: unknown = c.selector;
  if (typeof selector !== "string") selector = c.sel;
  if (typeof selector !== "string" || !selector.trim()) return null;
  const st =
    c.style && typeof c.style === "object" && !Array.isArray(c.style)
      ? c.style
      : c.css && typeof c.css === "object" && !Array.isArray(c.css)
        ? c.css
        : c.styles && typeof c.styles === "object" && !Array.isArray(c.styles)
          ? c.styles
          : null;
  if (!st || typeof st !== "object" || Array.isArray(st)) return null;
  if (!Object.keys(st as Record<string, unknown>).length) return null;
  return { selector: selector.trim() };
}

/** Devuelve un ChatOp canónico si `o` es una op válida (tolera aliases de campos). */
function toChatOp(o: unknown): ChatOp | null {
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  // Tolerar campos en español: tipo/accion/estilo/valor.
  const op0 = typeof c.op === "string" ? c.op : typeof c.action === "string" ? c.action : typeof c.type === "string" ? c.type : typeof c.tipo === "string" ? c.tipo : typeof c.accion === "string" ? c.accion : "";
  let op = op0 ? normOp(op0) : "";
  if (op) {
    // injectCss no necesita selector: se aplica como <style> global.
    if (op === "injectCss" || op === "injectcss" || op === "css" || op === "styleblock" || op === "addstyle") {
      let css =
        typeof c.css === "string" ? c.css
          : typeof c.css_code === "string" ? c.css_code
            : typeof c.cssCode === "string" ? c.cssCode
              : typeof c.css_text === "string" ? c.css_text
                : typeof c.rule === "string" ? c.rule
                  : typeof c.value === "string" ? c.value
                    : "";
      css = String(css ?? "").trim();
      return css ? { op: "injectCss", css: css as string } : null;
    }
  }
  // replaceByText: sustituye por coincidencia de texto visible (sin selector CSS).
  if (op === "replaceByText" || op === "replacebytext" || op === "replacetextbymatch" || op === "translate") {
    const src = typeof c.text === "string" ? c.text.trim() : null;
    const dst = src ? (typeof c.newText === "string" ? c.newText : typeof c.value === "string" ? c.value : typeof c.textoNuevo === "string" ? c.textoNuevo : null) : null;
    return src && dst ? { op: "replaceByText", text: src, newText: dst } : null;
  }
  // Obtiene el CSS en forma de bloque (string) tolerando claves comunes.
  const rawCss = typeof c.css === "string" ? c.css
    : typeof c.css_code === "string" ? c.css_code
      : typeof c.cssCode === "string" ? c.cssCode
        : typeof c.css_text === "string" ? c.css_text
          : typeof c.rule === "string" ? c.rule
            : "";
  const rawSel = c.selector ?? c.sel;
  const cssSel = typeof rawSel === "string" ? rawSel.trim() : "";
  if (rawCss.trim() && cssSel) {
    return { op: "injectCss", css: `${cssSel} { ${rawCss} }` };
  }
  // Dialecto: {css: "h2 { color: ... }"} sin selector (bloque CSS completo).
  if (rawCss.trim() && rawCss.includes("{")) {
    return { op: "injectCss", css: rawCss.trim() };
  }
  // Si no hay op/action explícito, deduce por heurística según campos presentes.
  if (!op) {
    if (c.style && typeof c.style === "object" && !Array.isArray(c.style)) op = "setStyle";
    else if (c.src && typeof c.src === "string") op = "setImage";
    else if (c.attr && typeof c.attr === "string") op = "setAttr";
    else if (typeof c.html === "string") op = "replaceInner";
    else if (c.hide === true || c.hidden === true) op = "hide";
    else if (c.remove === true) op = "remove";
    else if (typeof c.text === "string") op = "replaceText";
    else if (c.display && String(c.display).toLowerCase().includes("none")) op = "hide";
  }
  if (!op) return null;

  let selector: unknown = c.selector;
  if (typeof selector !== "string") selector = c.sel;
  if (typeof selector !== "string" || !selector.trim()) return null;
  const prop = typeof c.prop === "string" ? c.prop : typeof c.estilo === "string" ? c.estilo : "";
  let value: unknown = c.value;
  if (typeof value !== "string") value = typeof c.valor === "string" ? c.valor : c.text;
  if (typeof value !== "string" && typeof value !== "number") value = String(value ?? "");
  switch (op) {
    case "replaceText":
      return { op: "replaceText", selector, text: String(value) };
    case "replaceInner":
      return { op: "replaceInner", selector, html: String(typeof c.html === "string" ? c.html : value) };
    case "setStyle":
      return prop ? { op: "setStyle", selector, prop, value: String(value) } : null;
    case "setImage":
      return { op: "setImage", selector, src: String(value) };
    case "setAttr":
      return (typeof c.attr === "string" ? c.attr : prop)
        ? { op: "setAttr", selector, attr: (typeof c.attr === "string" ? c.attr : prop) as string, value: String(value) }
        : null;
    case "hide":
      return { op: "hide", selector };
    case "remove":
      return { op: "remove", selector };
    default:
      return null;
  }
}

/** ¿Parece un objeto de operación (y no el envoltorio {reply, ops})? */
function looksLikeOp(o: Record<string, unknown>): boolean {
  return !!(
    o.op || o.action || o.tipo || o.accion || o.selector || o.replaceByText ||
    o.css || o.css_code || o.cssCode || o.css_text || o.rule ||
    o.text || o.html || o.src || o.style || o.styles || o.attr ||
    o.newText ||
    o.hide === true || o.hidden === true || o.remove === true ||
    o.display !== undefined
  );
}

/**
 * Extrae las operaciones completas que ya se pueden leer del array "ops" (o
 * "changes") del JSON que está llegando por streaming, y también los dialectos
 * directos: array de ops a nivel superior o un solo op a nivel superior.
 * Devuelve objetos en bruto en orden.
 */
function extractCompleteOps(buf: string): unknown[] {
  const out: unknown[] = [];

  // Elementos balanceados de llaves dentro de un array.
  const scanBraceElements = (arrStart: number, arrEnd: number) => {
    let i = arrStart + 1;
    while (i <= arrEnd && i < buf.length) {
      if (buf[i] !== "{") {
        i += 1;
        continue;
      }
      let depth = 0;
      let j = i;
      let eStr = false;
      let complete = false;
      while (j <= arrEnd && j < buf.length) {
        const c = buf[j];
        if (eStr) {
          if (c === "\\") {
            j += 2;
            continue;
          }
          if (c === '"') eStr = false;
          j += 1;
          continue;
        }
        if (c === '"') eStr = true;
        else if (c === "{") depth += 1;
        else if (c === "}") {
          depth -= 1;
          if (depth === 0) {
            complete = true;
            break;
          }
        }
        j += 1;
      }
      if (!complete) return;
      const raw = buf.slice(i, j + 1);
      const parsed = tryParseRaw(raw);
      if (parsed && typeof parsed === "object") {
        out.push(parsed);
      } else {
        return; // op incompleta/inválida: el resto llegará con más texto
      }
      i = j + 1;
    }
  };

  // 1) Envoltorio {reply, ops:[...]} / {reply, changes:[...]}.
  for (const key of ['"ops"', '"changes"']) {
    const keyIdx = buf.indexOf(key);
    if (keyIdx < 0) continue;
    const arrStart = buf.indexOf("[", keyIdx);
    if (arrStart < 0) continue;
    // Hallamos el cierre del array para no pasarnos del envoltorio.
    let depth = 0;
    let eStr = false;
    let arrEnd = arrStart;
    while (arrEnd < buf.length) {
      const c = buf[arrEnd];
      if (eStr) {
        if (c === "\\") {
          arrEnd += 2;
          continue;
        }
        if (c === '"') eStr = false;
        arrEnd += 1;
        continue;
      }
      if (c === '"') eStr = true;
      else if (c === "[") depth += 1;
      else if (c === "]") {
        depth -= 1;
        if (depth === 0) break;
      }
      arrEnd += 1;
    }
    const before = out.length;
    scanBraceElements(arrStart, arrEnd);
    if (out.length > before) return out;
  }

  // 2) Dialectos directos: array de ops a nivel superior o un solo op a nivel
  // superior. Escaneamos todos los objetos balanceados y nos quedamos con los
  // que parezcan operaciones (evitando así el envoltorio que no trae "ops").
  if (buf.indexOf("{") >= 0 || buf.trimStart().startsWith("[")) {
    let i = 0;
    let inStr = false;
    while (i < buf.length) {
      const ch = buf[i];
      if (inStr) {
        if (ch === "\\") i += 2;
        else if (ch === '"') inStr = false;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        i += 1;
        continue;
      }
      if (ch !== "{") {
        i += 1;
        continue;
      }
      let depth = 0;
      let j = i;
      let eStr = false;
      let complete = false;
      while (j < buf.length) {
        const c = buf[j];
        if (eStr) {
          if (c === "\\") {
            j += 2;
            continue;
          }
          if (c === '"') eStr = false;
          j += 1;
          continue;
        }
        if (c === '"') eStr = true;
        else if (c === "{") depth += 1;
        else if (c === "}") {
          depth -= 1;
          if (depth === 0) {
            complete = true;
            break;
          }
        }
        j += 1;
      }
      if (!complete) break;
      const raw = buf.slice(i, j + 1);
      const parsed = tryParseRaw(raw);
      if (parsed && typeof parsed === "object" && looksLikeOp(parsed as Record<string, unknown>)) {
        out.push(parsed);
      }
      i = j + 1;
    }
  }

  return out;
}

function tryParseRaw(s: string): unknown | null {
  try {
    return JSON.parse(cleanJsonLLM(s));
  } catch {
    return null;
  }
}

export interface ChatStreamHandlers {
  /** Se llama por cada operación nueva a medida que el modelo la genera. */
  onOp: (op: ChatOp) => void;
  /** Se llama una vez que se conoce la respuesta textual ("reply"). */
  onReply: (reply: string) => void;
}

/**
 * Versión en streaming de chatEditStore: conforme el modelo va generando el
 * JSON, va entregando cada operación en cuanto se completa, para poder
 * aplicarla en vivo sin esperar a toda la respuesta.
 */
export async function chatEditStoreStream(
  opts: { html: string; domain: string; request: string },
  handlers: ChatStreamHandlers
): Promise<{ provider?: string; model?: string } | null> {
  const service = getAIService();
  if (!service.available) return null;

  const maxAttempts = Math.min(service.providerCount, 3);
  const ATTEMPT_TIMEOUT = 65_000;

  // Reintentamos proveedor a proveedor hasta conseguir al menos una operación
  // real: si un modelo responde con 0 ops o se cuelga, descartamos y probamos
  // con el siguiente.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let buf = "";
    let emitted = 0;
    let replySent = false;
    const delivered: ChatOp[] = [];

    let streamTask: Promise<AIProviderResult | null>;
    try {
      streamTask = service
        .streamAt(
          attempt,
          {
            systemPrompt: buildSystemPrompt(),
            userPrompt: buildUserPrompt(opts.html, opts.domain, opts.request),
            responseFormat: "json",
            temperature: 0.4,
            maxTokens: isLanguageChange(opts.request) ? 5000 : 2048,
          },
          (delta) => {
            buf += delta;

            // reply: se envía cuando la cadena del campo "reply" queda cerrada.
            if (!replySent) {
              const m = buf.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              if (m && m[1] !== undefined) {
                replySent = true;
                const reply = m[1].replace(/\\n/g, " ").trim();
                if (reply) handlers.onReply(reply);
              }
            }

            // ops: enviamos solo las operaciones completas nuevas, en vivo.
            const complete = extractCompleteOps(buf);
            if (complete.length > emitted) {
              for (const raw of complete.slice(emitted)) {
                for (const op of chatOpsFromArray([raw])) {
                  delivered.push(op);
                  handlers.onOp(op);
                }
              }
              emitted = complete.length;
            }
          }
        )
        .catch((err) => {
          console.warn(`[chatStream] intento ${attempt + 1}/${maxAttempts} falló:`, err);
          return null;
        });
    } catch (err) {
      console.warn(`[chatStream] intento ${attempt + 1}/${maxAttempts} no pudo arrancar:`, err);
      continue;
    }

    const TIMEOUT = Symbol("timeout");
    const timeoutTask = new Promise<symbol>((resolve) => setTimeout(() => resolve(TIMEOUT), ATTEMPT_TIMEOUT));
    const outcome = await Promise.race([streamTask, timeoutTask]);

    let result: AIProviderResult | null = null;
    if (!outcome || outcome === TIMEOUT) {
      console.warn(
        `[chatStream] intento ${attempt + 1}/${maxAttempts} ${outcome === TIMEOUT ? `agotó ${ATTEMPT_TIMEOUT / 1000}s sin terminar` : "terminó sin resultado (error)"}, paso al siguiente`
      );
      continue;
    }
    result = outcome as AIProviderResult;

    // Barrido final por si algo quedó en el buffer entre eventos.
    {
      const complete = extractCompleteOps(buf);
      if (complete.length > emitted) {
        for (const raw of complete.slice(emitted)) {
          for (const op of chatOpsFromArray([raw])) {
            delivered.push(op);
            handlers.onOp(op);
          }
        }
        emitted = complete.length;
      }

      if (!replySent) {
        const m = buf.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (m && m[1] !== undefined) {
          const reply = m[1].replace(/\\n/g, " ").trim();
          if (reply) handlers.onReply(reply);
        }
      }

      // Fallback batch: si el streaming no extrajo ninguna op (dialecto no
      // reconocido, respuesta envuelta en markdown, etc.), parseamos el buf
      // completo con repairJson + normalize (mismo camino que el batch).
      if (emitted === 0) {
        try {
          const repaired = repairJson(buf);
          if (repaired && typeof repaired === "object") {
            let fReply = "";
            let fOpsArr: unknown[] = [];
            if (Array.isArray(repaired)) {
              fOpsArr = repaired;
            } else {
              const robj = repaired as Record<string, unknown>;
              if (typeof robj.reply === "string") fReply = robj.reply;
              if (Array.isArray(robj.ops)) fOpsArr = robj.ops;
              else if (Array.isArray(robj.changes)) fOpsArr = robj.changes;
              else if (
                robj.selector || robj.op || robj.action || robj.type || robj.tipo || robj.accion ||
                robj.css || robj.css_code || robj.cssCode || robj.css_text || robj.rule ||
                robj.text || robj.html || robj.src || robj.style || robj.styles || robj.attr ||
                robj.newText || robj.hide === true || robj.hidden === true || robj.remove === true || robj.display !== undefined
              ) {
                fOpsArr = [robj];
              }
            }
            const fOps = chatOpsFromArray(fOpsArr);
            if (fOps.length > 0) {
              for (const op of fOps) {
                delivered.push(op);
                handlers.onOp(op);
              }
              if (fReply && !replySent) handlers.onReply(fReply);
              emitted = fOps.length;
              console.warn(`[chatStream] intento ${attempt + 1}/${maxAttempts} fallback OK: ${fOps.length} ops`);
            }
          }
        } catch (fbErr) {
          console.error("[chatStream] fallback error:", fbErr);
        }
      }
    }

    if (delivered.length === 0) {
      console.warn(
        `[chatStream] intento ${attempt + 1}/${maxAttempts} dio 0 ops (${result!.provider}/${result!.model}) — reintentando con el siguiente proveedor`
      );
      if (isLanguageChange(opts.request)) {
        console.error("[chatStream][DEBUG] lang-change raw buf:", buf.slice(0, 6000));
      }
      continue;
    }

    console.warn(`[chatStream] intento ${attempt + 1}/${maxAttempts} OK: ${delivered.length} ops (${result!.provider}/${result!.model})`);
    return { provider: result!.provider, model: result!.model };
  }

  console.error("[chatStream] todos los proveedores terminaron sin producir ops");
  return { provider: undefined, model: undefined };
}