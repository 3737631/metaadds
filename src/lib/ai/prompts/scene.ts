import type { SceneData } from "../schemas";

export function buildRegenerateSceneSystemPrompt(): string {
  return `Eres un experto en creación de anuncios para redes sociales.
Modificas una escena individual de un anuncio según la instrucción del usuario.

REGLAS:
- Modifica SOLO lo que el usuario pide.
- Mantén la coherencia con el resto del anuncio.
- Todo en español de España.
- Sé específico en las descripciones visuales.

Devuelve SIEMPRE un JSON válido con la escena modificada:
{
  "order": número de escena,
  "start": segundo inicio,
  "end": segundo fin,
  "visual": "qué se ve",
  "action": "qué ocurre",
  "camera": "plano y movimiento",
  "lighting": "iluminación",
  "audio": "sonido",
  "dialogue": "diálogo",
  "onScreenText": "texto en pantalla",
  "transition": "transición",
  "prompt": "prompt detallado para IA"
}`;
}

export function buildRegenerateSceneUserPrompt(
  scene: SceneData,
  instruction: string,
  productName: string,
  context: { platform: string; style: string; duration: number }
): string {
  return `ESCENA ACTUAL:
- Escena ${scene.order} (${scene.start}s–${scene.end}s)
- Visual: ${scene.visual}
- Acción: ${scene.action}
- Cámara: ${scene.camera}
- Iluminación: ${scene.lighting}
- Audio: ${scene.audio}
- Diálogo: ${scene.dialogue}
- Texto en pantalla: ${scene.onScreenText}
- Transición: ${scene.transition}
- Prompt actual: ${scene.prompt}

CONTEXTO:
- Producto: ${productName}
- Plataforma: ${context.platform}
- Estilo: ${context.style}
- Duración total: ${context.duration}s

INSTRUCCIÓN DEL USUARIO: "${instruction}"

Modifica la escena según la instrucción. Devuelve la escena completa con el JSON.`;
}

export function buildNaturalEditSystemPrompt(): string {
  return `Eres un editor de anuncios para redes sociales.
Recibes una solicitud en lenguaje natural y modificas el anuncio completo.

REGLAS:
- Interpreta la intención del usuario.
- Modifica solo lo necesario.
- Mantén la estructura JSON.
- Todo en español de España.

Devuelve el JSON COMPLETO del anuncio con los cambios aplicados.`;
}

export function buildNaturalEditUserPrompt(
  creative: string,
  instruction: string,
  productName: string
): string {
  return `ANUNCIO ACTUAL:
${creative}

PRODUCTO: ${productName}

INSTRUCCIÓN: "${instruction}"

Devuelve el JSON del anuncio modificado.`;
}
