import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    // Por defecto usamos el router free de OpenRouter: elige automáticamente un
    // modelo gratis disponible que soporte structured output (JSON). Evitamos
    // fijar un :free concreto porque se retiran constantemente (404).
    const model = input.model ?? "openrouter/free";
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      temperature: input.temperature ?? 0.7,
      // Margen para modelos "thinking" (gemini-2.5, razoning): nunca por
      // debajo de 3200 tokens para que la respuesta final no se corte.
      max_tokens: Math.max(input.maxTokens ?? 1600, 3200),
    };

    if (input.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://meta-winners.vercel.app",
        "X-Title": "Meta Winners AI",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = (choice?.message?.content ?? "").trim();
    // Algunos modelos reasoning dejan el texto final en `reasoning`/
    // `reasoning_content` si se corta el presupuesto. Usamos cualquiera.
    const reasoning = String(
      choice?.message?.reasoning ?? choice?.message?.reasoning_content ?? ""
    ).trim();
    const out = content || reasoning;
    if (!out) {
      throw new Error("OpenRouter: respuesta vacía");
    }

    return {
      content: out,
      model: data.model ?? model,
      provider: this.id,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }
}
