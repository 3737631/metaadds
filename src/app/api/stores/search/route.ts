import { NextResponse } from "next/server";
import { StoreSearchRequestSchema } from "@/lib/stores/schemas";
import { searchStores } from "@/lib/stores/search";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = StoreSearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Datos de entrada inválidos." } },
        { status: 400 }
      );
    }

    const result = await searchStores(parsed.data);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[/api/stores/search]", err);
    return NextResponse.json(
      { success: false, error: { code: "SEARCH_ERROR", message: "No pudimos buscar tiendas. Inténtalo de nuevo." } },
      { status: 500 }
    );
  }
}
