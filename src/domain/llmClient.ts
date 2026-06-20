// Browser client for the server-side LLM gateway (/api/llm). Degrades gracefully
// when the API is unreachable so the cockpit keeps working with deterministic drafts.

export type LlmProviderId = "fcc" | "ollama" | "none";

export interface LlmGenerateResult {
  status: "complete" | "failed";
  text: string;
  provider: LlmProviderId;
  model?: string;
}

export interface LlmProviderHealth {
  id: "fcc" | "ollama";
  label: string;
  status: "healthy" | "offline";
  detail: string;
}

export interface LlmHealthReport {
  available: boolean;
  primary: LlmProviderId;
  providers: LlmProviderHealth[];
  detail: string;
}

export interface LlmClient {
  health: () => Promise<LlmHealthReport>;
  generate: (request: { prompt: string; system?: string; maxTokens?: number }) => Promise<LlmGenerateResult>;
}

const GENERATE_ENDPOINT = "/api/llm/generate";
const HEALTH_ENDPOINT = "/api/llm/health";

export function createLlmClient(fetchImpl: typeof fetch = fetch): LlmClient {
  async function health(): Promise<LlmHealthReport> {
    try {
      const response = await fetchImpl(HEALTH_ENDPOINT, { method: "GET" });
      if (!response.ok) {
        return offlineReport(`Gateway responded with HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as { primary?: LlmProviderId; providers?: LlmProviderHealth[] };
      const primary = payload.primary ?? "none";
      const providers = Array.isArray(payload.providers) ? payload.providers : [];
      return {
        available: primary !== "none",
        primary,
        providers,
        detail: primary === "none" ? "No LLM provider reachable." : `Active provider: ${primary}.`,
      };
    } catch {
      return offlineReport("LLM gateway is not reachable; using deterministic drafts only.");
    }
  }

  async function generate(request: { prompt: string; system?: string; maxTokens?: number }): Promise<LlmGenerateResult> {
    try {
      const response = await fetchImpl(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await response.json()) as Partial<LlmGenerateResult>;
      if (!response.ok || payload.status !== "complete" || typeof payload.text !== "string") {
        return { status: "failed", text: payload.text ?? "LLM generation failed.", provider: payload.provider ?? "none" };
      }
      return { status: "complete", text: payload.text, provider: payload.provider ?? "none", model: payload.model };
    } catch {
      return { status: "failed", text: "LLM gateway is not reachable.", provider: "none" };
    }
  }

  return { health, generate };
}

function offlineReport(detail: string): LlmHealthReport {
  return { available: false, primary: "none", providers: [], detail };
}
