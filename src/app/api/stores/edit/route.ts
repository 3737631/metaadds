import { NextResponse } from "next/server";
import { StoreEditRequestSchema } from "@/lib/stores/schemas";
import { editStoreTheme } from "@/lib/stores/generator";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = StoreEditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Datos de entrada inválidos." } },
        { status: 400 }
      );
    }

    const theme = await editStoreTheme({ theme: parsed.data.theme, instruction: parsed.data.instruction });
    if (!theme) {
      return NextResponse.json(
        { success: false, error: { code: "AI_ERROR", message: "No pudimos aplicar el cambio." } },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: { theme } });
  } catch (err) {
    console.error("[/api/stores/edit]", err);
    return NextResponse.json(
      { success: false, error: { code: "EDIT_ERROR", message: "No pudimos aplicar el cambio." } },
      { status: 500 }
    );
  }
}
