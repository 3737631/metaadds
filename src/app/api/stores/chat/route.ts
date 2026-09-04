import { buildSnapshot } from "@/lib/stores/snapshot";
import { chatEditStoreStream, type ChatOp } from "@/lib/stores/chat";

export const runtime = "nodejs";

function sse(json: unknown): string {
  return `data: ${JSON.stringify(json)}\n\n`;
}

export async function POST(req: Request) {
  let url = "";
  let request = "";
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url.trim() : "";
    request = typeof body?.request === "string" ? body.request.trim() : "";
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

      let delivered = 0;
      const sendOps = (ops: ChatOp[]) => {
        if (!ops.length) return;
        delivered += ops.length;
        send({ type: "ops", ops });
      };
      const sendReply = (text: string) => send({ type: "reply", text });

      let provider: string | undefined;
      let model: string | undefined;
      try {
        const streamTask = chatEditStoreStream(
          { html: snapshot.html, domain: snapshot.domain, request },
          { onOp: (op) => sendOps([op]), onReply: sendReply }
        );
        const timeoutTask = new Promise<null>((resolve) => setTimeout(() => resolve(null), 90_000));
        const meta = await Promise.race([streamTask, timeoutTask]);
        provider = meta?.provider;
        model = meta?.model;
      } catch (err) {
        console.error("[/api/stores/chat]", err);
      }

      console.error(`[/api/stores/chat] url=${url} request=${request.slice(0,40)} delivered=${delivered} provider=${provider} model=${model}`);

      if (delivered === 0) {
        send({
          type: "error",
          code: "AI_ERROR",
          message: "No pude traducir tu petición en cambios concretos. Reformúlalo (ej: cambia el titular, cambia el color a rojo, quita el banner de cookies).",
        });
      } else {
        send({ type: "done", provider, model });
      }
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
