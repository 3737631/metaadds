import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/stores/snapshot";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Falta la URL de la tienda." } },
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

    return NextResponse.json({ success: true, data: snapshot });
  } catch (err) {
    console.error("[/api/stores/snapshot]", err);
    return NextResponse.json(
      { success: false, error: { code: "SNAPSHOT_ERROR", message: "No pudimos capturar la web de la tienda." } },
      { status: 500 }
    );
  }
}