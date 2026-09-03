/**
 * Catálogo de plataformas de IA para creación de anuncios y sus convenciones.
 * Los nombres son marcas propias (Veo, Kling, Seedance, Runway, Sora,
 * Nano Banana, Gemini, ChatGPT Images, Flux) y se usan como identificadores.
 */

export type AIKind = "video" | "image";

export interface AIModel {
  id: string;
  name: string;
  kind: AIKind;
  /** Convenciones específicas introducidas en el prompt. */
  notes: string;
  /** Ratios de aspecto soportados. */
  ratios: string[];
  /** Duración recomendada (s). */
  maxDurationSec?: number;
  /** Si el modelo suele necesitar instrucciones extra de continuidad/producto. */
  continuityHints: boolean;
}

export const VIDEO_MODELS: AIModel[] = [
  {
    id: "veo",
    name: "Veo",
    kind: "video",
    notes:
      "Veo valora indicaciones de cámara y movimiento muy explícitas. Usa términos como slow push-in, natural hand-held, gentle tracking. Da tiempo por segundo con precisión.",
    ratios: ["9:16", "16:9", "1:1"],
    maxDurationSec: 15,
    continuityHints: true,
  },
  {
    id: "kling",
    name: "Kling",
    kind: "video",
    notes:
      "Kling se beneficia de descripciones de acción física clara y de mantener el producto anclado visualmente. Especifica la rotación o demostración del producto.",
    ratios: ["9:16", "16:9"],
    maxDurationSec: 10,
    continuityHints: true,
  },
  {
    id: "seedance",
    name: "Seedance",
    kind: "video",
    notes:
      "Seedance permite secuencias de movimiento más largas. Describe el flujo entre escenas y transiciones suaves con continuidad de color y entorno.",
    ratios: ["9:16", "16:9", "4:5"],
    maxDurationSec: 12,
    continuityHints: true,
  },
  {
    id: "runway",
    name: "Runway",
    kind: "video",
    notes:
      "Runway responde bien a prompts con estructura cinematográfica: lens, depth of field, color grade y motion. Aporta dirección de cámara concreto.",
    ratios: ["9:16", "16:9"],
    maxDurationSec: 10,
    continuityHints: true,
  },
  {
    id: "sora",
    name: "Sora",
    kind: "video",
    notes:
      "Sora destaca con lenguaje natural sobre la escena y el movimiento, manteniendo consistencia entre tomas. Describe el mundo y la continuidad del objeto.",
    ratios: ["9:16", "16:9"],
    maxDurationSec: 15,
    continuityHints: true,
  },
];

export const IMAGE_MODELS: AIModel[] = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    kind: "image",
    notes:
      "Nano Banana (Gemini 2.5 Flash Image) es rápido y editable; describe composición clara y sujeto único. Responde a edición iterativa por referencia.",
    ratios: ["9:16", "1:1", "4:5"],
    continuityHints: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    kind: "image",
    notes:
      "Gemini (Nano Banana / Imagen) soporta referencia de imagen para respetar el producto exacto. Pide realismo fotográfico y lighting natural.",
    ratios: ["9:16", "4:5", "1:1"],
    continuityHints: true,
  },
  {
    id: "chatgpt-images",
    name: "ChatGPT Images",
    kind: "image",
    notes:
      "ChatGPT Images (GPT-4o) interpreta bien referencias; usa lenguaje descriptivo y detalla el fondo, la luz y el estilo para resultados consistentes.",
    ratios: ["9:16", "1:1", "4:5"],
    continuityHints: true,
  },
  {
    id: "flux",
    name: "Flux",
    kind: "image",
    notes:
      "Flux requiere prompts muy precisos y sin ambigüedad. Para continuidad de producto, describe forma, color y packaging con exactitud.",
    ratios: ["9:16", "4:5", "1:1"],
    continuityHints: true,
  },
];

export const ALL_MODELS: Record<string, AIModel> = Object.fromEntries(
  [...VIDEO_MODELS, ...IMAGE_MODELS].map((m) => [m.id, m])
);

export function modelById(id: string): AIModel | undefined {
  return ALL_MODELS[id];
}
