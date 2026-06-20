import { describe, expect, it, vi } from "vitest";
import { createLlmClient } from "./llmClient";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("llmClient.health", () => {
  it("reports available with the active provider", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ primary: "fcc", providers: [{ id: "fcc", label: "FCC", status: "healthy", detail: "ok" }] }),
    );
    const client = createLlmClient(fetchImpl as unknown as typeof fetch);

    const report = await client.health();

    expect(fetchImpl).toHaveBeenCalledWith("/api/llm/health", { method: "GET" });
    expect(report.available).toBe(true);
    expect(report.primary).toBe("fcc");
  });

  it("falls back to unavailable when the gateway is offline", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    const client = createLlmClient(fetchImpl as unknown as typeof fetch);

    const report = await client.health();

    expect(report.available).toBe(false);
    expect(report.primary).toBe("none");
  });
});

describe("llmClient.generate", () => {
  it("returns generated text and the provider used", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ status: "complete", text: "Generated lesson.", provider: "fcc", model: "deepseek-v4-flash" }),
    );
    const client = createLlmClient(fetchImpl as unknown as typeof fetch);

    const result = await client.generate({ prompt: "Write a lesson" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/llm/generate",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
    );
    expect(result.status).toBe("complete");
    expect(result.text).toBe("Generated lesson.");
    expect(result.provider).toBe("fcc");
  });

  it("reports failure when the gateway cannot be reached", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const client = createLlmClient(fetchImpl as unknown as typeof fetch);

    const result = await client.generate({ prompt: "Write a lesson" });

    expect(result.status).toBe("failed");
    expect(result.provider).toBe("none");
  });
});
