import { NextResponse } from "next/server";
import { buildReplica } from "@/lib/stores/replica";

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

    const replica = await buildReplica(url);

    // Si no pudimos leer nada real, es honesto decirlo.
    const hadData =
      replica.header.menu.length > 0 || replica.hero.headline !== replica.brand.name || replica.brand.logoUrl || replica.brand.colors.length > 0;

    return NextResponse.json({ success: true, data: { replica, hadData } });
  } catch (err) {
    console.error("[/api/stores/replica]", err);
    return NextResponse.json(
      { success: false, error: { code: "REPLICA_ERROR", message: "No pudimos reconstruir la web de la tienda." } },
      { status: 500 }
    );
  }
}