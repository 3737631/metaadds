import type { AIProvider, AIProviderInput, AIProviderResult } from "./types";
import { OpenRouterProvider } from "./openrouter";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";

export class AIService {
  private providers: AIProvider[] = [];

  constructor() {
    const gemKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const orKey = process.env.OPENROUTER_API_KEY;
    const oaiKey = process.env.OPENAI_API_KEY;
    // Gemini y Groq primero: sus niveles gratuitos permiten usar IA sin tarjeta.
    if (gemKey) this.providers.push(new GeminiProvider(gemKey));
    if (groqKey) this.providers.push(new GroqProvider(groqKey));
    if (orKey) this.providers.push(new OpenRouterProvider(orKey));
    if (oaiKey) this.providers.push(new OpenAIProvider(oaiKey));
  }

  get available(): boolean {
    return this.providers.length > 0;
  }

  get providerNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  async generate(input: AIProviderInput): Promise<AIProviderResult> {
    if (this.providers.length === 0) {
      throw new Error(
        "No hay proveedores de IA configurados. Añade GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY u OPENAI_API_KEY en .env.local"
      );
    }

    let lastError: Error | null = null;
    const maxAttempts = Math.min(this.providers.length, 3);

    for (let i = 0; i < maxAttempts; i++) {
      const provider = this.providers[i];
      try {
        return await provider.generate(input);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[AIService] ${provider.name} falló (intento ${i + 1}/${maxAttempts}):`,
          lastError.message
        );
      }
    }

    throw new Error(
      `Todos los proveedores fallaron. Último error: ${lastError?.message ?? "desconocido"}`
    );
  }

  async stream(
    input: AIProviderInput,
    onDelta: (chunk: string) => void
  ): Promise<AIProviderResult> {
    if (this.providers.length === 0) {
      throw new Error(
        "No hay proveedores de IA configurados. Añade GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY u OPENAI_API_KEY en .env.local"
      );
    }

    let lastError: Error | null = null;
    const maxAttempts = Math.min(this.providers.length, 3);

    for (let i = 0; i < maxAttempts; i++) {
      const provider = this.providers[i];
      try {
        if (provider.stream) {
          return await provider.stream(input, onDelta);
        }
        // Sin streaming: entrega el texto completo de una vez (aún funciona,
        // solo que no es incremental).
        const res = await provider.generate(input);
        onDelta(res.content);
        return res;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[AIService] ${provider.name} falló en stream (intento ${i + 1}/${maxAttempts}):`,
          lastError.message
        );
      }
    }

    throw new Error(
      `Todos los proveedores fallaron en stream. Último error: ${lastError?.message ?? "desconocido"}`
    );
  }
}

let _service: AIService | null = null;

export function getAIService(): AIService {
  if (!_service) _service = new AIService();
  return _service;
}
