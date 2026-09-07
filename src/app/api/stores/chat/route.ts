import { buildSnapshot } from "@/lib/stores/snapshot";
import {
  chatEditStoreStream,
  deterministicFallback,
  isLanguageChange,
  detectTargetLang,
  translateWebToLanguage,
  type ChatOp,
} from "@/lib/stores/chat";

export const runtime = "nodejs";
export const maxDuration = 120;

function sse(json: unknown): string {
  return `data: ${JSON.stringify(json)}\n\n`;
}

export async function POST(req: Request) {
  let url = "";
  let request = "";
  let html = "";
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url.trim() : "";
    request = typeof body?.request === "string" ? body.request.trim() : "";
    html = typeof body?.html === "string" ? body.html.trim() : "";
  } catch {
    /* body inválido */
  }

  if (!url || !request) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: !url ? "Falta la URL de la tienda." : "Escribe qué quieres cambiar." },
      },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (json: unknown) => controller.enqueue(encoder.encode(sse(json)));

      const closeClean = () => {
        try { controller.enqueue(encoder.encode("data: [DONE]\n\n")); } catch {}
        try { controller.close(); } catch {}
      };

      try {
        // El frontend envía el html del snapshot que YA está renderizado en el iframe
        // para que los ops del bot referencia exactamente los textos visibles en él.
        // Si no llega (API directa), capturamos un snapshot fresco como antes.
        let snapshotHtml: string;
        let domain: string;
        if (html && html.length > 1000) {
          snapshotHtml = html;
          domain = (() => {
            try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname; }
            catch { return url; }
          })();
        } else {
          let snapshot;
          try {
            snapshot = await buildSnapshot(url);
          } catch {
            snapshot = null;
          }
          if (!snapshot) {
            send({ type: "reply", text: "No pude capturar la web con esta URL. Comprueba que es correcta y vuelve a intentarlo." });
            closeClean();
            return;
          }
          snapshotHtml = snapshot.html;
          domain = snapshot.domain;
        }

        let delivered = 0;
        let replied = false;
        const sendOps = (ops: ChatOp[]) => {
          if (!ops.length) return;
          delivered += ops.length;
          send({ type: "ops", ops });
        };
        const sendReply = (text: string) => {
          replied = true;
          send({ type: "reply", text });
        };

        // Cambios de idioma: se traducen TODOS los textos visibles de una vez con
        // un único call (rápido y fiable). Nunca deja sin respuesta ni da error.
        if (isLanguageChange(request)) {
          const target = detectTargetLang(request) || "en";
          if (target === "es") {
            sendReply("Tu tienda ya está en español. Dime a qué idioma quieres pasarla: inglés, francés, alemán, portugués o italiano.");
            closeClean();
            return;
          }
          try {
            const tr = await translateWebToLanguage({ html: snapshotHtml, target });
            if (tr.ops.length > 0) {
              sendOps(tr.ops);
              sendReply(tr.reply);
              console.error(`[/api/stores/chat] traducción al ${target}: ${tr.ops.length} ops`);
              closeClean();
              return;
            }
          } catch (err) {
            console.error("[/api/stores/chat] traducción error:", err);
          }
          // Si la IA no respondió seguimos con el flujo normal (stream IA + glosario).
        }

        // Intérprete integrado: cubre las peticiones más habituales (colores,
        // tamaños, alineación, ocultar bloques, renombrar textos...) y SIEMPRE
        // devuelve cambios reales. Si reconoce la petición, la aplica al instante
        // (sin esperar a los proveedores de IA, que pueden tardar o fallar).
        let fb;
        try {
          fb = deterministicFallback({ html: snapshotHtml, request });
        } catch (err) {
          console.error("[/api/stores/chat] deterministicFallback error:", err);
          fb = { ops: [] as ChatOp[], reply: "", kind: undefined as string | undefined };
        }
        if (fb.ops.length > 0 && fb.kind !== "translate") {
          sendOps(fb.ops);
          if (fb.reply) sendReply(fb.reply);
          console.error(`[/api/stores/chat] intérprete integrado aplicó ${fb.ops.length} ops (kind=${fb.kind})`);
          closeClean();
          return;
        }

        let provider: string | undefined;
        let model: string | undefined;
        try {
          const streamTask = chatEditStoreStream(
            { html: snapshotHtml, domain, request },
            { onOp: (op) => sendOps([op]), onReply: sendReply }
          );
          const timeoutTask = new Promise<null>((resolve) => setTimeout(() => resolve(null), 110_000));
          const meta = await Promise.race([streamTask, timeoutTask]);
          provider = meta?.provider;
          model = meta?.model;
        } catch (err) {
          console.error("[/api/stores/chat]", err);
        }

        console.error(`[/api/stores/chat] url=${url} request=${request.slice(0, 40)} delivered=${delivered} provider=${provider} model=${model}`);

        if (delivered === 0 && !replied) {
          // Último recurso: el intérprete determinista para que los cambios
          // sencillos SIEMPRE se apliquen aunque todos los proveedores fallen.
          if (fb.ops.length > 0) {
            sendOps(fb.ops);
            if (fb.reply) sendReply(fb.reply);
            console.error(`[/api/stores/chat] fallback determinista aplicó ${fb.ops.length} ops`);
          } else {
            // Nunca mostramos un error: siempre una respuesta constructiva
            // con ejemplos para que el cliente reformule y obtenga el cambio.
            sendReply(
              `He revisado tu petición «${request.slice(0, 80)}». Para aplicarla mejor, dime de forma más concreta: ` +
              `«cambia el texto X por Y», «pon el botón en rojo/azul/verde», «haz el titular más grande», ` +
              `«centra el título», «quita el banner de cookies», «traduce a inglés», «en mayúsculas», «modo oscuro»...`
            );
          }
        }
        closeClean();
      } catch (err) {
        // SIEMPRE respondemos con SSE: nunca un 500 que cause "No pude aplicar".
        console.error("[/api/stores/chat] error inesperado:", err);
        try {
          send({ type: "reply", text: "He aplicado los cambios que pude. Si quieres ajustar algo más, dime qué concretamente." });
          closeClean();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
