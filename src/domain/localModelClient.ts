export type ModelDiscoveryStatus = "healthy" | "offline";
export type GenerationStatus = "complete" | "failed";

export interface LocalModelClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export interface ModelDiscoveryResult {
  status: ModelDiscoveryStatus;
  models: string[];
  detail: string;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
}

export interface GenerateResult {
  status: GenerationStatus;
  response: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface OllamaGenerateResponse {
  response?: string;
}

export function createLocalModelClient(options: LocalModelClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:11434";
  const fetcher = options.fetcher ?? fetch;

  async function listModels(): Promise<ModelDiscoveryResult> {
    try {
      const response = await fetcher(`${baseUrl}/api/tags`);
      if (!response.ok) {
        return {
          status: "offline",
          models: [],
          detail: `Ollama returned HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as OllamaTagsResponse;
      const models = (payload.models ?? []).map((model) => model.name).filter(Boolean) as string[];

      return {
        status: "healthy",
        models,
        detail: models.length ? `${models.length} model(s) available.` : "Ollama is reachable but no models are installed.",
      };
    } catch {
      return {
        status: "offline",
        models: [],
        detail: "Ollama is not reachable at http://127.0.0.1:11434.",
      };
    }
  }

  async function generate(request: GenerateRequest): Promise<GenerateResult> {
    try {
      const response = await fetcher(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        return {
          status: "failed",
          response: `Local model request failed with HTTP ${response.status}.`,
        };
      }

      const payload = (await response.json()) as OllamaGenerateResponse;

      return {
        status: "complete",
        response: payload.response?.trim() || "The local model returned an empty response.",
      };
    } catch {
      return {
        status: "failed",
        response: "Local model request failed before a usable response was returned.",
      };
    }
  }

  return {
    baseUrl,
    generate,
    listModels,
  };
}
