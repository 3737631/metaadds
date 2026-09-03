import { NextResponse } from "next/server";
import { GenerateRequestSchema, CreativeSchema } from "@/lib/ai/schemas";
import { getAIService } from "@/lib/ai/providers/ai-service";
import {
  buildCreativeSystemPrompt,
  buildCreativeUserPrompt,
} from "@/lib/ai/prompts/creative";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Datos de entrada inválidos.", details: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const service = getAIService();
    if (!service.available) {
      return NextResponse.json(
        { success: false, error: { code: "AI_NOT_CONFIGURED", message: "No hay proveedores de IA configurados. Añade OPENROUTER_API_KEY o OPENAI_API_KEY." } },
        { status: 503 }
      );
    }

    const result = await service.generate({
      systemPrompt: buildCreativeSystemPrompt(),
      userPrompt: buildCreativeUserPrompt(parsed.data),
      responseFormat: "json",
      temperature: 0.7,
      maxTokens: 4096,
    });

    let json: unknown;
    try {
      json = JSON.parse(result.content);
    } catch {
      const repaired = repairJson(result.content);
      if (!repaired) {
        return NextResponse.json(
          { success: false, error: { code: "AI_INVALID_RESPONSE", message: "La IA devolvió un JSON inválido. Inténtalo de nuevo." } },
          { status: 502 }
        );
      }
      json = repaired;
    }

    const validated = CreativeSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: { code: "AI_SCHEMA_ERROR", message: "La respuesta de la IA no tiene el formato esperado.", details: validated.error.flatten().fieldErrors } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        creative: validated.data,
        meta: { provider: result.provider, model: result.model, usage: result.usage },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[/api/creatives/generate]", msg);
    return NextResponse.json(
      { success: false, error: { code: "AI_PROVIDER_ERROR", message: "No hemos podido generar el contenido. Inténtalo de nuevo." } },
      { status: 500 }
    );
  }
}

function repairJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
