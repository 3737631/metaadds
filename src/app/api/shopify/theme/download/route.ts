import { NextResponse } from "next/server";
import { generateShopifyThemeZip } from "@/lib/shopify/theme-generator";
import type { StoreTheme } from "@/lib/stores/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const theme = body?.theme as StoreTheme | undefined;
    if (!theme || typeof theme !== "object") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Falta el tema de la tienda." } },
        { status: 400 }
      );
    }

    const { zip, name } = await generateShopifyThemeZip(theme);

    return new NextResponse(new Blob([zip as unknown as BlobPart]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/shopify/theme/download]", err);
    return NextResponse.json(
      { success: false, error: { code: "ZIP_ERROR", message: "No pudimos generar el tema Shopify." } },
      { status: 500 }
    );
  }
}
