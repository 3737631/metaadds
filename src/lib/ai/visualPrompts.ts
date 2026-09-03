import { modelById, type AIModel } from "@/lib/ai/models";

/**
 * Generador de prompts de imagen (visuales) por modelo IA.
 * Los visuales mantienen continuidad del producto para usarse como
 * referencia en el vídeo.
 */

export interface VisualDef {
  id: string; // Visual_1 ...
  title: string;
  desc: string; // qué representa
}

export function visualDefs(product: string, category?: string): VisualDef[] {
  return [
    { id: "Visual_1", title: "Producto frontal", desc: `El ${product} centrado sobre fondo limpio.` },
    { id: "Visual_2", title: "Producto en uso", desc: `Una persona usando el ${product} en un entorno real.` },
    { id: "Visual_3", title: "Resultado", desc: `El resultado conseguido con el ${product}.` },
    { id: "Visual_4", title: "Lifestyle", desc: `Escena de estilo de vida con el ${product}.` },
    { id: "Visual_5", title: "Close-up", desc: `Primer plano muy cercano del ${product} y su textura.` },
  ];
}

export function buildImagePrompt(opts: {
  product: string;
  category?: string;
  model: string;
  visualTitle: string;
  visualDesc: string;
  ratio?: string;
}): string {
  const model: AIModel = modelById(opts.model) ?? modelById("nano-banana")!;
  const ratio = opts.ratio || "9:16";
  return [
    `# ${model.name.toUpperCase()} — IMAGEN PUBLICITARIA (${ratio})`,
    ``,
    `Crea una imagen fotorrealista vertical ${ratio} para anuncio del producto «${opts.product}».`,
    `TIPOLOGÍA: ${opts.visualTitle}.`,
    `DESCRIPCIÓN: ${opts.visualDesc}`,
    `SUBJECT: el ${opts.product} como protagonista, nítido y bien centrado.`,
    `ENVIRONMENT: entorno luminoso, limpio y moderno coherente con la categoría del producto.`,
    `COMPOSITION: composición equilibrada con aire en la zona superior para superponer texto.`,
    `CAMERA: lente de 35mm, profundidad de campo suave, encuadre vertical.`,
    `LIGHTING: luz natural suave, pequeños reflejos para añadir premium feel sin desenfocar el producto.`,
    `STYLING: estética premium y limpia, fiel al producto real.`,
    `PRODUCT INSTRUCTIONS: conserva el ${opts.product} EXACTAMENTE igual a la imagen de referencia: misma forma, color, tamaño y packaging. No lo rediseñes.`,
    `REALISM: fotorrealista, sin deformaciones, sin texto incorrecto ni letras raras.`,
    `ASPECT RATIO: ${ratio}.`,
    ``,
    `CONSEJO ${model.name}: ${model.notes}`.replace(/\s+/g, " ").trim(),
  ].join("\n");
}
