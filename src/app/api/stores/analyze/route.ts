import { NextResponse } from "next/server";
import { StoreAnalyzeRequestSchema } from "@/lib/stores/schemas";
import { analyzeStore, calculateStoreSimilarity } from "@/lib/stores/analyzer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = StoreAnalyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "URL inválida. Introduce una URL http(s) válida." } },
        { status: 400 }
      );
    }

    const analysis = await analyzeStore(parsed.data.url);
    if (!analysis) {
      return NextResponse.json(
        { success: false, error: { code: "FETCH_ERROR", message: "No pudimos acceder a esa tienda. Comprueba que la URL es correcta y pública." } },
        { status: 422 }
      );
    }

    const similarity = calculateStoreSimilarity({
      title: analysis.title ?? "",
      snippet: analysis.description ?? "",
      category: "online store",
      productName: "",
      productDescription: "",
    });

    return NextResponse.json({ success: true, data: { analysis, similarity: { score: similarity.score, reason: similarity.reason } } });
  } catch (err) {
    console.error("[/api/stores/analyze]", err);
    return NextResponse.json(
      { success: false, error: { code: "ANALYZE_ERROR", message: "No pudimos analizar la tienda." } },
      { status: 500 }
    );
  }
}
