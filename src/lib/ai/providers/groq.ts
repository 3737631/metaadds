import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";

/**
 * Proveedor de Groq (https://groq.com). Ofrece modelos Llama de alta velocidad
 * con un nivel gratuito muy generoso. La clave se obtiene en
 * -> https://console.groq.com/keys
 *
 * Modelo por defecto: openai/gpt-oss-20b (gratuito, muy capaz, devuelve JSON
 * fiable con response_format json_object).
 * Nota: los modelos GPT-OSS son "reasoning": consumen tokens internos antes de
 * la respuesta final. Por eso se garantiza un presupuesto mínimo para que el
 * razonamiento no se coma toda la salida dejando content vacío.
 */
export class GroqProvider implements AIProvider {
  readonly id = "groq";
  readonly name = "Groq";

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    const model = input.model ?? "openai/gpt-oss-20b";
    // Margen extra frente a otros proveedores: el razonamiento consume tokens
    // antes del JSON, así que nunca vamos por debajo de 3200.
    const maxTokens = Math.max(input.maxTokens ?? 1600, 3200);
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      temperature: input.temperature ?? 0.7,
      max_tokens: maxTokens,
    };

    if (input.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = (choice?.message?.content ?? "").trim();
    // En los modelos reasoning el texto final puede viajar en `content` o, al
    // cortarse por presupuesto, quedar en `reasoning`. Usamos cualquiera.
    const reasoning = (choice?.message?.reasoning ?? "").trim();
    const out = content || reasoning;
    if (!out) {
      throw new Error("Groq: respuesta vacía");
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