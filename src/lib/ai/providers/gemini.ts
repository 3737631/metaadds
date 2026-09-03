import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";

/**
 * Proveedor de Google Gemini usando la API REST gratuita.
 * La clave se obtiene gratis (sin tarjeta) en Google AI Studio
 * -> https://aistudio.google.com/apikey
 *
 * Modelo por defecto: gemini-3.6-flash (incluido en el nivel gratuito actual).
 * Si el prompt pide JSON, se usa responseMimeType application/json.
 */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly name = "Gemini";

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    const model = input.model ?? "gemini-3.6-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const parts = [{ text: input.userPrompt }];
    const contents = [{ role: "user", parts }];

    const generationConfig: Record<string, unknown> = {
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxTokens ?? 1600,
    };

    if (input.responseFormat === "json") {
      generationConfig.responseMimeType = "application/json";
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };

    // En el nivel gratuito Gemini devuelve 503/429 transitorios por alta
    // demanda. Reintentamos unas pocas veces con backoff antes de ceder.
    const maxAttempts = 3;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();

        if (!text) {
          const blockReason = data?.promptFeedback?.blockReason ?? "desconocido";
          throw new Error(`Gemini: respuesta vacía (blockReason: ${blockReason})`);
        }

        return {
          content: text,
          model: data.modelVersion ?? model,
          provider: this.id,
          usage: data.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount ?? 0,
                completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
              }
            : undefined,
        };
      }

      lastStatus = res.status;
      const transient =
        res.status === 503 || res.status === 429 || res.status === 500 || res.status === 502 || res.status === 504;
      if (!transient || attempt === maxAttempts) {
        const err = (await res.text().catch(() => "")).slice(0, 200);
        throw new Error(`Gemini ${res.status}: ${err}`);
      }

      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }

    throw new Error(`Gemini ${lastStatus}: agotado el número de reintentos`);
  }
}
