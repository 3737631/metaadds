/**
 * Lógica de regeneración: parte del prompt anterior (vídeo o imagen) y del
 * cambio solicitado para generar un prompt nuevo coherciante, manteniendo la
 * continuidad del producto.
 */

export interface RegenerateOption {
  id: string;
  label: string;
  /** Instrucción de cambio en lenguaje natural para el modelo. */
  instruction: string;
}

export const REGENERATE_OPTIONS: RegenerateOption[] = [
  { id: "realista", label: "Más realista", instruction: "Aumenta el fotorrealismo: piel natural, texturas reales, luces físicamente plausibles y sin aspecto generado." },
  { id: "persona", label: "Cambiar persona", instruction: "Cambia a una persona distinta (otro género/edad/etnia) manteniendo la misma acción y ropa adecuada." },
  { id: "escenario", label: "Cambiar escenario", instruction: "Cambia el escenario por uno nuevo (hazlo más luminoso, moderno o acorde al estilo de vida del producto)." },
  { id: "ropa", label: "Cambiar ropa", instruction: "Cambia la ropa de la persona que aparece por prendas distintas y coherentes con la escena." },
  { id: "iluminacion", label: "Cambiar iluminación", instruction: "Ajusta la iluminación para que mantenga la continuidad pero con una luz más favorecedora (luz dorada o natural suave)." },
  { id: "camara", label: "Cambiar cámara", instruction: "Cambia el plano/encuadre (p. ej. más cerca del producto, o un ángulo ligeramente más alto) manteniendo la composición." },
  { id: "producto-identico", label: "Mantener producto idéntico", instruction: "Refuerza que el PRODUCTO debe permanecer EXACTAMENTE idéntico a la referencia en forma, color, tamaño y packaging." },
  { id: "otro", label: "Otro cambio", instruction: "" },
];

export function regeneratePrompt(opts: {
  previousPrompt: string;
  changeId: string;
  customChange?: string;
  product: string;
}): string {
  const opt = REGENERATE_OPTIONS.find((o) => o.id === opts.changeId);
  const instruction = opt?.instruction || opts.customChange || "";
  const productLine = `PRODUCTO: mantén «${opts.product}» exactamente igual, solo aplica el cambio pedido.`;
  const lines = [
    opts.previousPrompt,
    ``,
    `### CAMBIO SOLICITADO (regeneración)`,
    instruction ? instruction : opts.customChange || "Aplica un cambio razonable.",
    productLine,
  ];
  return lines.join("\n");
}
