import { buildSnapshot } from "@/lib/stores/snapshot";
import { chatEditStoreStream, deterministicFallback, type ChatOp } from "@/lib/stores/chat";

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
          send({ type: "error", code: "SNAPSHOT_ERROR", message: "No pudimos capturar la web de la tienda." });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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

      // Intérprete integrado: cubre las peticiones más habituales (colores,
      // tamaños, alineación, ocultar bloques, renombrar textos...) y SIEMPRE
      // devuelve cambios reales. Si reconoce la petición, la aplica al instante
      // (sin esperar a los proveedores de IA, que pueden tardar o fallar).
      const fb = deterministicFallback({ html: snapshotHtml, request });
      if (fb.ops.length > 0 && fb.kind !== "translate") {
        sendOps(fb.ops);
        if (fb.reply) sendReply(fb.reply);
        console.error(`[/api/stores/chat] intérprete integrado aplicó ${fb.ops.length} ops (kind=${fb.kind})`);
        send({ type: "done", provider: undefined, model: undefined });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
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
          // Nunca mostramos un error: respondemos con una ayuda constructiva
          // para que el cliente reformule y obtenga el cambio que quiere.
          send({
            type: "reply",
            text: `No logré traducir «${request}» en cambios automáticos. Dime de forma sencilla qué quieres: «cambia el texto X por Y», «pon el botón en rojo/azul/verde», «haz el titular más grande», «centra el título», «quita el banner de cookies», «en mayúsculas», «modo oscuro»...`,
          });
        }
      }
      send({ type: "done", provider, model });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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
