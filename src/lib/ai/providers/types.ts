export interface AIProviderInput {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export interface AIProviderResult {
  content: string;
  model: string;
  provider: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  generate(input: AIProviderInput): Promise<AIProviderResult>;
  /** Streaming opcional: entrega el texto por fragmentos a medida que se genera. */
  stream?(input: AIProviderInput, onDelta: (chunk: string) => void): Promise<AIProviderResult>;
}
