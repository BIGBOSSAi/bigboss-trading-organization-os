import { describe, expect, it, vi } from "vitest";
import { createLlmGateway, extractAnthropicText, isProviderErrorText } from "./llmGateway";

const FCC_ERROR_SSE = [
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Provider API request failed.\\n\\nProvider exception:\\nConnection error."}}',
  "",
].join("\n");

const SSE_SAMPLE = [
  "event: message_start",
  'data: {"type":"message_start"}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
  "",
  "event: content_block_delta",
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" trader"}}',
  "",
  "event: message_stop",
  'data: {"type":"message_stop"}',
  "",
].join("\n");

function streamResponse(body: string, ok = true, status = 200): Response {
  return { ok, status, text: async () => body } as Response;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("extractAnthropicText", () => {
  it("accumulates text_delta chunks from an SSE stream", () => {
    expect(extractAnthropicText(SSE_SAMPLE)).toBe("Hello trader");
  });

  it("falls back to a non-streaming message body", () => {
    const body = JSON.stringify({ content: [{ type: "text", text: "Direct answer." }] });
    expect(extractAnthropicText(body)).toBe("Direct answer.");
  });

  it("returns empty string when there is no usable content", () => {
    expect(extractAnthropicText("event: ping\n\n")).toBe("");
  });
});

describe("createLlmGateway.generate", () => {
  it("uses FCC when it responds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(streamResponse(SSE_SAMPLE));
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await gateway.generate({ prompt: "Hi" });

    expect(result.provider).toBe("fcc");
    expect(result.status).toBe("complete");
    expect(result.text).toBe("Hello trader");
    expect(fetchImpl.mock.calls[0][0]).toContain("/v1/messages");
  });

  it("falls back to Ollama when FCC is down", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/v1/messages")) throw new Error("connection refused");
      return jsonResponse({ response: "Local fallback answer." });
    });
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await gateway.generate({ prompt: "Hi" });

    expect(result.provider).toBe("ollama");
    expect(result.text).toBe("Local fallback answer.");
  });

  it("treats an FCC upstream-error payload as failure (not a successful answer)", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/v1/messages")) return streamResponse(FCC_ERROR_SSE);
      throw new Error("ollama offline");
    });
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await gateway.generate({ prompt: "Hi" });

    // Must NOT surface the error text as a completed FCC result.
    expect(result.provider).not.toBe("fcc");
    expect(result.text).not.toContain("Provider API request failed");
  });

  it("retries FCC once on a transient failure, then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/v1/messages")) {
        calls += 1;
        if (calls === 1) return streamResponse(FCC_ERROR_SSE); // transient error first
        return streamResponse(SSE_SAMPLE); // succeeds on retry
      }
      throw new Error("ollama offline");
    });
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await gateway.generate({ prompt: "Hi" });

    expect(calls).toBe(2);
    expect(result.provider).toBe("fcc");
    expect(result.text).toBe("Hello trader");
  });

  it("detects provider-error text", () => {
    expect(isProviderErrorText("Provider API request failed. Connection error.")).toBe(true);
    expect(isProviderErrorText("Market liquidity is how easily you can trade.")).toBe(false);
  });

  it("reports no provider when both are unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await gateway.generate({ prompt: "Hi" });

    expect(result.provider).toBe("none");
    expect(result.status).toBe("failed");
  });
});

describe("createLlmGateway.health", () => {
  it("marks FCC primary when its health endpoint is ok", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/health")) return jsonResponse({ status: "healthy" });
      if (url.includes("/api/tags")) throw new Error("offline");
      return jsonResponse({});
    });
    const gateway = createLlmGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const report = await gateway.health();

    expect(report.primary).toBe("fcc");
    expect(report.providers.find((provider) => provider.id === "fcc")?.status).toBe("healthy");
    expect(report.providers.find((provider) => provider.id === "ollama")?.status).toBe("offline");
  });
});
