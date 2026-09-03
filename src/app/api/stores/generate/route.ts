import { NextResponse } from "next/server";
import { StoreGenerateRequestSchema } from "@/lib/stores/schemas";
import { generateStoreTheme } from "@/lib/stores/generator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = StoreGenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Datos de entrada inválidos." } },
        { status: 400 }
      );
    }

    const theme = await generateStoreTheme({
      url: parsed.data.url,
      analysis: parsed.data.analysis ?? null,
      productName: parsed.data.productName,
      brandName: parsed.data.brandName,
      preferences: parsed.data.userPreferences,
    });

    if (!theme) {
      return NextResponse.json(
        { success: false, error: { code: "AI_ERROR", message: "No pudimos generar la tienda." } },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: { theme } });
  } catch (err) {
    console.error("[/api/stores/generate]", err);
    return NextResponse.json(
      { success: false, error: { code: "GENERATE_ERROR", message: "No pudimos generar la tienda." } },
      { status: 500 }
    );
  }
}
