import { getAIService } from "@/lib/ai/providers/ai-service";
import { buildStoreGenerateSystemPrompt, buildStoreGenerateUserPrompt, buildStoreEditSystemPrompt, buildStoreEditUserPrompt } from "./prompts";
import type { StoreAnalysis, StoreTheme } from "./types";

function repairJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) cleaned = cleaned.slice(a, b + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function generateStoreTheme(opts: {
  url: string;
  analysis: StoreAnalysis | null;
  productName?: string;
  brandName?: string;
  preferences?: string;
}): Promise<StoreTheme | null> {
  const service = getAIService();
  if (!service.available) return null;

  const result = await service.generate({
    systemPrompt: buildStoreGenerateSystemPrompt(),
    userPrompt: buildStoreGenerateUserPrompt(opts.analysis, opts.productName ?? "", opts.brandName ?? "", opts.preferences ?? ""),
    responseFormat: "json",
    temperature: 0.7,
    maxTokens: 2000,
  });

  const json = repairJson(result.content);
  if (!json) return null;
  return json as unknown as StoreTheme;
}

export async function editStoreTheme(opts: {
  theme: StoreTheme;
  instruction: string;
}): Promise<StoreTheme | null> {
  const service = getAIService();
  if (!service.available) return null;

  const result = await service.generate({
    systemPrompt: buildStoreEditSystemPrompt(),
    userPrompt: buildStoreEditUserPrompt(opts.theme, opts.instruction),
    responseFormat: "json",
    temperature: 0.5,
    maxTokens: 2200,
  });

  const json = repairJson(result.content);
  if (!json) return null;
  return json as unknown as StoreTheme;
}
