import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  private apiKey: string;
  private defaultModel?: string;

  constructor(apiKey: string, opts?: { model?: string }) {
    this.apiKey = apiKey;
    this.defaultModel = opts?.model;
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    // Por defecto usamos el router free de OpenRouter: elige automáticamente un
    // modelo gratis disponible que soporte structured output (JSON). Evitamos
    // fijar un :free concreto porque se retiran constantemente (404).
    const model = input.model ?? this.defaultModel ?? "openrouter/free";
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

  async stream(
    input: AIProviderInput,
    onDelta: (chunk: string) => void
  ): Promise<AIProviderResult> {
    const t0 = Date.now();
    let firstContentMs = -1;
    const firstContent = () => {
      if (firstContentMs < 0) firstContentMs = Date.now() - t0;
    };
    const model = input.model ?? this.defaultModel ?? "openrouter/free";
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      temperature: input.temperature ?? 0.7,
      max_tokens: Math.max(input.maxTokens ?? 1600, 3200),
      stream: true,
    };
    // NO enviamos response_format:json_object en streaming: muchos modelos
    // (minimax) bufferizan toda la salida JSON y no emiten deltas incrementales,
    // lo que anula la aplicación en vivo. Aquí el JSON se exige por prompt y se
    // parsea incrementalmente con extractCompleteOps/repairJson.

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://meta-winners.vercel.app",
        "X-Title": "Meta Winners AI",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenRouter stream ${res.status}: ${err.slice(0, 200)}`);
    }
    if (!res.body) throw new Error("OpenRouter stream: sin cuerpo");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let out = "";
    let deltas = 0;
    let firstDeltaLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta;
          const text = delta?.content ?? delta?.reasoning_content ?? "";
          if (typeof text === "string" && text) {
            out += text;
            firstContent();
            if (deltas === 0) firstDeltaLen = text.length;
            deltas++;
            onDelta(text);
          }
        } catch {
          /* fragmento parcial: se ignora */
        }
      }
    }
    console.log(`[or-stream] model=${model} ttft=${firstContentMs} dur=${Date.now() - t0} deltas=${deltas} firstDeltaLen=${firstDeltaLen} outLen=${out.length} head=${out.slice(0, 160).replace(/\\s+/g, ' ')}`);

    return {
      content: out,
      model,
      provider: this.id,
    };
  }
}
