import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    const model = input.model ?? "openai/gpt-4o";
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 1600,
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
    if (!choice?.message?.content) {
      throw new Error("OpenRouter: respuesta vacía");
    }

    return {
      content: choice.message.content,
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
