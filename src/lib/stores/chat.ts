import { getAIService } from "@/lib/ai/providers/ai-service";

/**
 * Operación de edición concreta que la IA devuelve para aplicar sobre la
 * mini-web real (HTML+CSS capturados). Cada op actúa en vivo dentro del iframe.
 */
export type ChatOp =
  | { op: "replaceText"; selector: string; text: string }
  | { op: "replaceInner"; selector: string; html: string }
  | { op: "setStyle"; selector: string; prop: string; value: string }
  | { op: "setImage"; selector: string; src: string }
  | { op: "setAttr"; selector: string; attr: string; value: string }
  | { op: "hide"; selector: string }
  | { op: "remove"; selector: string };

export interface ChatEditResult {
  reply: string;
  ops: ChatOp[];
}

function repairJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  // Si es un array de ops (la IA a veces no envuelve en {reply,ops}), intenta parsearlo directamente.
  if (cleaned.startsWith("[")) {
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) cleaned = cleaned.slice(a, b + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function buildSystemPrompt(): string {
  return `Eres un experto editor frontend y estratega de ecommerce. Recibes el HTML+CSS real capturado de una tienda online (parcialmente limpio) y una instrucción en lenguaje natural del usuario.

Debes convertir la instrucción en una lista de OPERACIONES DOM concretas que transformen la mini-web. La reselemos fielmente: la web se ve igual a la original; el usuario quiere que hagas cambios puntuales (textos, colores, imágenes, secciones, quitar avisos/cookies, etc.).

Devuelve SOLO JSON válido con la siguiente forma EXACTA:
{
  "reply": "breve mensaje en español explicando qué vas a cambiar (máx 2 frases), sin markdown",
  "ops": [
    { "op": "replaceText", "selector": "CSS selector único", "text": "nuevo texto" },
    { "op": "setStyle", "selector": "CSS selector", "prop": "color", "value": "#e11d48" },
    { "op": "setImage", "selector": "CSS selector img", "src": "https://url.nueva/imagen.jpg" },
    { "op": "setAttr", "selector": "CSS selector", "attr": "href", "value": "https://..." },
    { "op": "replaceInner", "selector": "CSS selector", "html": "HTML de reemplazo" },
    { "op": "hide", "selector": "CSS selector" },
    { "op": "remove", "selector": "CSS selector" }
  ]
}

REGLAS:
- Los selectores deben apuntar a elementos EXISTENTES en el HTML que se te envía (usa texto visible entre comillas si ayuda, p. ej. 'a:has-text(...)' NO existe; usa selectores CSS reales: h1, .clase, #id, [data-*], o el Nº de índice). Prefiere selectores robustos y únicos: etiqueta (h1), .clase conocida, o [título de sección].
- Si la instrucción pide quitar banners de cookies, popups de newsletter, avisos legales o "basura", añade ops 'remove' con selectores basados en clases/texto típicas (p.ej. '#onetrust-banner-sdk', '.cookie-consent', '#cookie-banner', '#newsletter-popup', '.mailpoet_popup', div cuyo texto contenga 'aceptar cookies'). Selecciona por clase/id si los ves, y si no por un selector de atributo data o por índice; es aceptable un selector que cubra los candidatos razonables.
- No inventes selectores que no existan: si no puedes decidir, usa el más probable y añade en "reply" que revises la parte concreta.
- Mantén el promedio. No cambies nada que la instrucción no pida.
- El texto base de la web va en español salvo que la instrucción diga otra cosa.`;
}

function buildUserPrompt(html: string, domain: string, request: string): string {
  const bodyOnly = extractBody(html);
  const safe = bodyOnly.slice(0, 12000);
  return `TENDA / DOMINIO: ${domain}

INSTRUCCIÓN DEL USUARIO: ${request}

HTML capturado de la tienda (recortado; usa selectores reales que existan aquí):
${safe}

Devuelve el JSON.`;
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
    maxTokens: 2000,
  });

  const json = repairJson(result.content);
  if (!json) return null;

  // Normaliza el sobre: {reply,ops[]}, ops[] directo, o un solo op {selector,...}.
  let reply = "";
  let opsArr: unknown[] = [];
  if (Array.isArray(json)) {
    opsArr = json;
  } else if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (typeof obj.reply === "string") reply = obj.reply;
    if (Array.isArray(obj.ops)) opsArr = obj.ops;
    else if (obj.selector) opsArr = [json];
  }

  const ops = opsArr
    .map((o) => toChatOp(o))
    .filter((o): o is ChatOp => o !== null);
  if (ops.length === 0) {
    console.error("[/chat] sin ops aplicables. Respuesta IA:", result.content.slice(0, 3000));
  }
  return {
    reply: reply || "He aplicado tus cambios.",
    ops,
  };
}

/** Normaliza un nombre de operación que la IA pueda escribir de varias formas. */
function normOp(op: string): string {
  const key = op.toLowerCase().replace(/[\s_-]/g, "");
  switch (key) {
    case "replacetext":
    case "settext":
    case "setcontent":
      return "replaceText";
    case "replaceinner":
      return "replaceInner";
    case "setstyle":
    case "style":
    case "setcss":
      return "setStyle";
    case "setimage":
    case "image":
    case "setimg":
      return "setImage";
    case "setattr":
    case "setattribute":
      return "setAttr";
    case "hide":
    case "hidden":
      return "hide";
    case "remove":
    case "delete":
    case "rm":
      return "remove";
    default:
      return op;
  }
}

/** Devuelve un ChatOp canónico si `o` es una op válida (tolera aliases de campos). */
function toChatOp(o: unknown): ChatOp | null {
  if (!o || typeof o !== "object") return null;
  const c = o as Record<string, unknown>;
  const op0 = typeof c.op === "string" ? c.op : typeof c.action === "string" ? c.action : c.type;
  if (typeof op0 !== "string") return null;
  const op = normOp(op0);
  let selector: unknown = c.selector;
  if (typeof selector !== "string") selector = c.sel;
  if (typeof selector !== "string" || !selector.trim()) return null;
  let value: unknown = c.value;
  if (typeof value !== "string") value = c.text;
  if (typeof value !== "string" && typeof value !== "number") value = String(value ?? "");
  switch (op) {
    case "replaceText":
      return { op: "replaceText", selector, text: String(value) };
    case "replaceInner":
      return { op: "replaceInner", selector, html: String(typeof c.html === "string" ? c.html : value) };
    case "setStyle":
      return typeof c.prop === "string" ? { op: "setStyle", selector, prop: c.prop, value: String(value) } : null;
    case "setImage":
      return { op: "setImage", selector, src: String(value) };
    case "setAttr":
      return typeof c.attr === "string" ? { op: "setAttr", selector, attr: c.attr, value: String(value) } : null;
    case "hide":
      return { op: "hide", selector };
    case "remove":
      return { op: "remove", selector };
    default:
      return null;
  }
}