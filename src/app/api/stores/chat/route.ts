import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/stores/snapshot";
import { chatEditStore } from "@/lib/stores/chat";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const request = typeof body?.request === "string" ? body.request.trim() : "";
    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Falta la URL de la tienda." } },
        { status: 400 }
      );
    }
    if (!request) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Escribe qué quieres cambiar." } },
        { status: 400 }
      );
    }

    const snapshot = await buildSnapshot(url);
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: { code: "SNAPSHOT_ERROR", message: "No pudimos capturar la web de la tienda." } },
        { status: 404 }
      );
    }

    const result = await chatEditStore({ html: snapshot.html, domain: snapshot.domain, request });
    if (!result || result.ops.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "AI_ERROR", message: "No pude traducir tu petición en cambios concretos. Reformúlalo (ej: cambia el titular, cambia el color a rojo, quita el banner de cookies)." } },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[/api/stores/chat]", err);
    return NextResponse.json(
      { success: false, error: { code: "CHAT_ERROR", message: "Error procesando tu petición." } },
      { status: 500 }
    );
  }
}