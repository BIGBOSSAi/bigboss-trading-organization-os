// Node-side LLM gateway. Calls the local FCC proxy (Anthropic Messages API, which
// routes to the NVIDIA NIM model configured in the FCC Admin UI), falling back to a
// local Ollama model, then to a clear "no provider" result. Runs server-side so the
// API key never reaches the browser and there is no cross-origin problem.

export type LlmProviderId = "fcc" | "ollama" | "none";

export interface LlmGatewayOptions {
  fccBaseUrl?: string;
  fccModel?: string;
  fccApiKey?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  defaultMaxTokens?: number;
}

export interface LlmGenerateRequest {
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface LlmGenerateResult {
  status: "complete" | "failed";
  text: string;
  provider: LlmProviderId;
  model?: string;
}

export interface LlmProviderHealth {
  id: Exclude<LlmProviderId, "none">;
  label: string;
  status: "healthy" | "offline";
  detail: string;
}

export interface LlmHealthReport {
  primary: LlmProviderId;
  providers: LlmProviderHealth[];
}

export interface LlmGateway {
  generate: (request: LlmGenerateRequest) => Promise<LlmGenerateResult>;
  health: () => Promise<LlmHealthReport>;
}

export function createLlmGateway(options: LlmGatewayOptions = {}): LlmGateway {
  const fccBaseUrl = (options.fccBaseUrl ?? "http://127.0.0.1:8082").replace(/\/$/, "");
  const fccModel = options.fccModel ?? "nvidia_nim/deepseek-ai/deepseek-v4-flash";
  const fccApiKey = options.fccApiKey ?? "";
  const ollamaBaseUrl = (options.ollamaBaseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const ollamaModel = options.ollamaModel ?? "qwen3-coder";
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 90000;
  // Reasoning models (e.g. deepseek-v4-flash) spend tokens on hidden "thinking"
  // blocks first, so the budget must leave room for the actual answer afterward.
  const defaultMaxTokens = options.defaultMaxTokens ?? 4096;

  async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function callFcc(request: LlmGenerateRequest): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(`${fccBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          // FCC checks x-api-key against ANTHROPIC_AUTH_TOKEN (no-op if unset).
          "x-api-key": fccApiKey || "local",
        },
        body: JSON.stringify({
          model: fccModel,
          max_tokens: request.maxTokens ?? defaultMaxTokens,
          stream: true,
          ...(request.system ? { system: request.system } : {}),
          messages: [{ role: "user", content: request.prompt }],
        }),
      });

      if (!response.ok) return null;
      const text = extractAnthropicText(await response.text());
      // FCC wraps upstream failures in a normal 200 stream whose text is the error
      // message. Treat those as failures so we fall back instead of surfacing them.
      if (!text || isProviderErrorText(text)) return null;
      return text;
    } catch {
      return null;
    }
  }

  async function callOllama(request: LlmGenerateRequest): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: request.system ? `${request.system}\n\n${request.prompt}` : request.prompt,
          stream: false,
        }),
      });

      if (!response.ok) return null;
      const payload = (await response.json()) as { response?: string };
      const text = payload.response?.trim();
      return text || null;
    } catch {
      return null;
    }
  }

  async function generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    // One retry absorbs transient upstream (NVIDIA NIM) connection errors.
    let fccText = await callFcc(request);
    if (!fccText) fccText = await callFcc(request);
    if (fccText) {
      return { status: "complete", text: fccText, provider: "fcc", model: fccModel };
    }

    const ollamaText = await callOllama(request);
    if (ollamaText) {
      return { status: "complete", text: ollamaText, provider: "ollama", model: ollamaModel };
    }

    return {
      status: "failed",
      text: "No LLM provider was reachable. Start FCC (Start-FCC-Backup.cmd) or Ollama, then retry.",
      provider: "none",
    };
  }

  async function health(): Promise<LlmHealthReport> {
    const [fcc, ollama] = await Promise.all([probeFcc(), probeOllama()]);
    const primary: LlmProviderId = fcc.status === "healthy" ? "fcc" : ollama.status === "healthy" ? "ollama" : "none";
    return { primary, providers: [fcc, ollama] };
  }

  async function probeFcc(): Promise<LlmProviderHealth> {
    try {
      const response = await fetchWithTimeout(`${fccBaseUrl}/health`, { method: "GET" });
      return response.ok
        ? { id: "fcc", label: `FCC proxy (${fccModel})`, status: "healthy", detail: `Reachable at ${fccBaseUrl}.` }
        : { id: "fcc", label: "FCC proxy", status: "offline", detail: `FCC responded with HTTP ${response.status}.` };
    } catch {
      return { id: "fcc", label: "FCC proxy", status: "offline", detail: `FCC not reachable at ${fccBaseUrl}.` };
    }
  }

  async function probeOllama(): Promise<LlmProviderHealth> {
    try {
      const response = await fetchWithTimeout(`${ollamaBaseUrl}/api/tags`, { method: "GET" });
      return response.ok
        ? { id: "ollama", label: "Local Ollama", status: "healthy", detail: `Reachable at ${ollamaBaseUrl}.` }
        : { id: "ollama", label: "Local Ollama", status: "offline", detail: `Ollama responded with HTTP ${response.status}.` };
    } catch {
      return { id: "ollama", label: "Local Ollama", status: "offline", detail: `Ollama not reachable at ${ollamaBaseUrl}.` };
    }
  }

  return { generate, health };
}

// Detect FCC's upstream-failure payloads, which arrive as a normal 200 stream whose
// text content is the error message rather than a model answer.
export function isProviderErrorText(text: string): boolean {
  return /Provider API request failed|Provider exception:/i.test(text);
}

// Accumulate the text from an Anthropic Messages stream (SSE). Falls back to parsing
// a non-streaming Anthropic message body if no stream deltas are present. Exported for
// unit testing without a live network.
export function extractAnthropicText(raw: string): string {
  const parts: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const payload = trimmed.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
        content?: Array<{ type?: string; text?: string }>;
      };

      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        parts.push(event.delta.text);
      } else if (Array.isArray(event.content)) {
        // Non-streaming message object that slipped through as a data line.
        for (const block of event.content) {
          if (block.type === "text" && block.text) parts.push(block.text);
        }
      }
    } catch {
      // Ignore keep-alive or non-JSON lines.
    }
  }

  if (parts.length > 0) return parts.join("").trim();

  // Last resort: a plain non-streaming JSON body.
  try {
    const body = JSON.parse(raw) as { content?: Array<{ type?: string; text?: string }> };
    if (Array.isArray(body.content)) {
      return body.content
        .filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("")
        .trim();
    }
  } catch {
    // Not JSON either.
  }

  return "";
}
