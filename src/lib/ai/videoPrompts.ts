import { modelById, type AIModel } from "@/lib/ai/models";

/**
 * Generador de prompts de vídeo por escenas, adaptado a la plataforma IA
 * elegida. Proporciona un guion profesional: duración, ratio, escena,
 * segundos exactos, cámara, iluminación, entorno, persona, acción, audio,
 * diálogo, texto en pantalla, transición y continuidad del producto.
 */

export interface Scene {
  num: number;
  label: string;
  beat: string;
  from: number;
  to: number;
  duration: number;
  shot: string;
  ref: string | null; // referencia visual a usar, p. ej. "PRODUCTO_01"
}

export interface VideoPrompt {
  model: string;
  durationSec: number;
  ratio: string;
  scenes: Scene[];
  /** Texto completo listo para COPIAR. */
  promptText: string;
}

const SCENE_TEMPLATES: Array<{
  label: string;
  beat: string;
  shot: (p: string) => string;
  ref: string;
}> = [
  {
    label: "SCENE 1", beat: "HOOK",
    shot: (p) => `Abre en un primer plano atractivo y rápido que capture la atención mostrando el ${p} de forma intrigante. Cámara: push-in lento desde un plano medio.`,
    ref: "USO_01",
  },
  {
    label: "SCENE 2", beat: "PROBLEMA",
    shot: (p) => `Muestra el problema cotidiano que el ${p} resuelve. Cámara: plano medio estático, ligero hand-held. Persona reacciona con frustración leve y luego curiosidad.`,
    ref: "ENTORNO_01",
  },
  {
    label: "SCENE 3", beat: "DEMOSTRACIÓN",
    shot: (p) => `Demostración clara y cercana del ${p}: la persona lo usa y la cámara hace tracking mostrando el antes/después. Cámara: plano detalle del producto en acción.`,
    ref: "PRODUCTO_01",
  },
  {
    label: "SCENE 4", beat: "RESULTADO",
    shot: (p) => `Primer plano del resultado conseguido con el ${p}. Cámara: leve orbitación. Persona sonríe satisfecha y señala el producto.`,
    ref: "RESULTADO_01",
  },
  {
    label: "SCENE 5", beat: "CTA",
    shot: (p) => `El ${p} centrado sobre un fondo limpio y luminoso con texto en pantalla destacando la oferta y la llamada a la acción (CTA). Cámara: plano fijo.`,
    ref: "PRODUCTO_01",
  },
];

function distribute(total: number): number[] {
  const n = SCENE_TEMPLATES.length;
  const base = Math.floor(total / n);
  const rem = total - base * n;
  const lens: number[] = [];
  for (let i = 0; i < n; i++) lens.push(base + (i < rem ? 1 : 0));
  return lens;
}

/**
 * Construye los bloques de instrucción comunes, con continuidad de producto.
 */
function productGuard(model: AIModel, product: string): string {
  const base =
    `PRODUCTO: el ${product} mostrado debe permanecer exactamente idéntico en forma, color, tamaño y ` +
    `packaging en TODAS las tomas. No lo modifiques, rediseñes ni sustituyas.`;
  if (model.continuityHints) {
    return base + " Mantén la continuidad de iluminación, paleta de color y entorno entre escenas.";
  }
  return base;
}

export function buildVideoPrompt(opts: {
  product: string;
  category?: string;
  model: string;
  durationSec?: number;
  ratio?: string;
  format9to16?: boolean;
}): VideoPrompt {
  const model = modelById(opts.model) ?? modelById("veo")!;
  const duration = Math.min(
    opts.durationSec ?? 15,
    model.maxDurationSec ?? 15
  );
  const ratio = opts.ratio || "9:16";
  const lens = distribute(duration);

  const scenes: Scene[] = SCENE_TEMPLATES.map((t, i) => {
    const from = lens.slice(0, i).reduce((a, b) => a + b, 0);
    const len = lens[i];
    return {
      num: i + 1,
      label: `${t.label} — ${formatTime(from)}–${formatTime(from + len)}`,
      beat: t.beat,
      from,
      to: from + len,
      duration: len,
      shot: t.shot(opts.product),
      ref: t.ref,
    };
  });

  const lines: string[] = [
    `# ${model.name.toUpperCase()} — ${ratio} — ${duration}s`,
    ``,
    `Crea un anuncio en vídeo vertical ${ratio} para el producto «${opts.product}».`,
    `Estilo: realista, luminoso, enfoque de producto, coherente y optimizado para feed de redes sociales.`,
    ``,
  ];

  for (const s of scenes) {
    lines.push(`## ${s.label}`);
    lines.push(`### ${s.beat}`);
    lines.push(`DURACIÓN: ${s.duration}s (${formatTime(s.from)}–${formatTime(s.to)})`);
    lines.push(`ACCION / TOMA:`);
    lines.push(s.shot);
    lines.push(`CAMARA: primer plano / plano detalle con estabilización y leve movimiento tipográfico según el beat.`);
    lines.push(`LIGHTING: luz natural suave de ventana, sin sombras duras, producto bien iluminado.`);
    if (s.ref) lines.push(`REFERENCIA VISUAL: usa la imagen de referencia «${s.ref}» si se proporciona.`);
    lines.push(``);
  }

  lines.push(`### CONTINUIDAD Y PRODUCTO`);
  lines.push(productGuard(model, opts.product));
  lines.push(``);
  lines.push(`### AUDIO Y DIÁLOGO`);
  lines.push(
    `Audio: voz en off entusiasta en español (España). Diálogo corto y directo que acompaña cada beat (gancho, problema, solución, resultado, CTA). Sin música estridente.`
  );
  lines.push(`TEXT ON SCREEN: texto corto y grande en español clave por beat (p. ej. el gancho y el CTA final).`);
  lines.push(`TRANSITION: cortes limpios entre escenas; la última termina con un frame congelado del producto y el CTA.`);
  lines.push(
    `NEGATIVE CONSTRAINTS: sin desenfocar el producto, sin cambiar su apariencia entre tomas, sin texto incorrecto en español, sin manos que tapen el producto durante la demo.`
  );

  return {
    model: model.name,
    durationSec: duration,
    ratio,
    scenes,
    promptText: lines.join("\n"),
  };
}

function formatTime(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
