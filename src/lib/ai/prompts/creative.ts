import type { GenerateRequest } from "../schemas";

export function buildCreativeSystemPrompt(): string {
  return `Eres un experto en marketing digital y creación de anuncios para redes sociales.
Generas anuncios estructurados en formato JSON para plataformas como TikTok, Instagram Reels, Facebook, YouTube Shorts.

REGLAS:
- Todo el texto debe estar en español de España.
- Sé específico: describe exactamente qué ocurre visualmente en cada segundo.
- El hook debe capturar atención en los primeros 2-3 segundos.
- Cada escena debe tener una acción visual clara y concreta.
- Los prompts de imagen/vídeo deben ser descriptivos y profesionales.
- El CTA debe ser directo y urgente.
- NUNCA uses genéricos como "producto increíble" o "no te lo pierdas".
- Describe personas, entornos, iluminación, cámara y acciones concretas.

Devuelve SIEMPRE un JSON válido con esta estructura exacta:
{
  "title": "título del anuncio",
  "hook": "gancho principal en una línea",
  "angle": "ángulo de venta (problema/solución, beneficio, urgencia, etc.)",
  "cta": "llamada a la acción",
  "scenes": [
    {
      "order": 1,
      "start": 0,
      "end": 3,
      "visual": "qué se ve en pantalla",
      "action": "qué ocurre (acción concreta)",
      "camera": "plano y movimiento de cámara",
      "lighting": "iluminación",
      "audio": "sonido/música",
      "dialogue": "diálogo o voz en off",
      "onScreenText": "texto en pantalla si aplica",
      "transition": "transición a la siguiente escena",
      "prompt": "prompt detallado para generar esta escena con IA"
    }
  ],
  "adCopy": "texto principal del anuncio",
  "headline": "título del anuncio",
  "description": "descripción adicional"
}`;
}

export function buildCreativeUserPrompt(req: GenerateRequest): string {
  const audienceBlock = req.audience
    ? `
PÚBLICO OBJETIVO:
- Edad: ${req.audience.age || "general"}
- Género: ${req.audience.gender || "todos"}
- Intereses: ${req.audience.interests || "general"}
- Problema que tiene: ${req.audience.problem || "no especificado"}
- Deseo: ${req.audience.desire || "no especificado"}`
    : "";

  return `CREA UN ANUNCIO COMPLETO:

PRODUCTO: ${req.productName}
${req.productDescription ? `DESCRIPCIÓN: ${req.productDescription}` : ""}
${req.productUrl ? `URL: ${req.productUrl}` : ""}

PLATAFORMA: ${req.platform}
FORMATO: ${req.format}
ESTILO: ${req.style}
OBJETIVO: ${req.objective}
DURACIÓN: ${req.duration} segundos
PAÍS: ${req.country}
IDIOMA: ${req.language}
${audienceBlock}

INSTRUCCIONES:
- Genera entre 3 y 6 escenas que cubran toda la duración (${req.duration}s).
- Cada escena debe tener un prompt detallado para generación visual con IA.
- Adapta el estilo al formato y plataforma elegidos.
- El tono debe ser ${req.style === "UGC" ? "casual y auténtico, como un usuario real" : req.style === "Premium" ? "elegante y sofisticado" : "profesional y directo"}.
- El total de segundos de las escenas debe sumar exactamente ${req.duration}s.

Devuelve el JSON con la estructura completa.`;
}
