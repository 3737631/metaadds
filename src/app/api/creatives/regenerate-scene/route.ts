import { NextResponse } from "next/server";
import { RegenerateSceneRequestSchema, SceneSchema } from "@/lib/ai/schemas";
import { getAIService } from "@/lib/ai/providers/ai-service";
import {
  buildRegenerateSceneSystemPrompt,
  buildRegenerateSceneUserPrompt,
} from "@/lib/ai/prompts/scene";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RegenerateSceneRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Datos de entrada inválidos.", details: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const service = getAIService();
    if (!service.available) {
      return NextResponse.json(
        { success: false, error: { code: "AI_NOT_CONFIGURED", message: "No hay proveedores de IA configurados." } },
        { status: 503 }
      );
    }

    const { scenes, sceneOrder, instruction, productName, platform, style, duration } = parsed.data;
    const targetScene = scenes.find((s) => s.order === sceneOrder);
    if (!targetScene) {
      return NextResponse.json(
        { success: false, error: { code: "SCENE_NOT_FOUND", message: `Escena ${sceneOrder} no encontrada.` } },
        { status: 404 }
      );
    }

    const result = await service.generate({
      systemPrompt: buildRegenerateSceneSystemPrompt(),
      userPrompt: buildRegenerateSceneUserPrompt(targetScene, instruction, productName, { platform, style, duration }),
      responseFormat: "json",
      temperature: 0.8,
      maxTokens: 2048,
    });

    let json: unknown;
    try {
      json = JSON.parse(result.content);
    } catch {
      const cleaned = result.content.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = fenceMatch ? fenceMatch[1].trim() : cleaned;
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try { json = JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch { /* fail */ }
      }
      if (!json) {
        return NextResponse.json(
          { success: false, error: { code: "AI_INVALID_RESPONSE", message: "La IA devolvió JSON inválido." } },
          { status: 502 }
        );
      }
    }

    const validated = SceneSchema.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: { code: "AI_SCHEMA_ERROR", message: "La escena no tiene el formato esperado." } },
        { status: 502 }
      );
    }

    const updatedScenes = scenes.map((s) =>
      s.order === sceneOrder ? { ...s, ...validated.data, order: sceneOrder } : s
    );

    return NextResponse.json({
      success: true,
      data: {
        scene: validated.data,
        scenes: updatedScenes,
        meta: { provider: result.provider, model: result.model },
      },
    });
  } catch (err) {
    console.error("[/api/creatives/regenerate-scene]", err);
    return NextResponse.json(
      { success: false, error: { code: "AI_PROVIDER_ERROR", message: "Error al regenerar la escena." } },
      { status: 500 }
    );
  }
}
