/**
 * Generador de copy publicitario: hook, texto principal, titular y CTA,
 * en varias variantes, en español (España). Basado en el producto y en las
 * señales observadas, sin copiar literalmente anuncios de terceros.
 */

export interface CopyVariant {
  hook: string;
  primaryText: string;
  headline: string;
  cta: string;
}

const CTA_POOL = ["Comprar ahora", "Descúbrelo", "Lo quiero", "Pedir hoy", "Ver oferta"];

export function buildCopy(opts: { product: string; category?: string; numVariants?: number }): CopyVariant[] {
  const n = Math.max(1, opts.numVariants ?? 3);
  const p = opts.product;
  const variants: CopyVariant[] = [
    {
      hook: `Nadie te habla de esto con el «${p}»…`,
      primaryText: `Esto es lo que necesitas para simplificarte el día. Probado, útil y con envío rápido.`,
      headline: `Descubre el ${p}`,
      cta: CTA_POOL[0],
    },
    {
      hook: `El truco que usan ya miles de personas con el ${p}.`,
      primaryText: `Cómpralo una vez y olvídate del problema para siempre. Calidad premium a buen precio.`,
      headline: `${p} — la solución fácil`,
      cta: CTA_POOL[1],
    },
    {
      hook: `Se acabó complicarte. ${capitalize(p)}, sin líos.`,
      primaryText: `Sencillo, eficaz y pensado para tu día a día. Pruébalo sin riesgo y devuelve si no encanta.`,
      headline: `${p} al mejor precio`,
      cta: CTA_POOL[2],
    },
  ];
  return variants.slice(0, n).map((v, i) => ({
    ...v,
    cta: CTA_POOL[i % CTA_POOL.length],
  }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
