import { describe, expect, it, vi } from "vitest";
import { createNexusClient } from "./nexusClient";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("nexusClient (browser)", () => {
  it("reports status and connected accounts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ available: true, accounts: [{ id: "a1", platform: "telegram", username: "big_bosszgh" }], detail: "ok" }),
    );
    const client = createNexusClient(fetchImpl as unknown as typeof fetch);
    const status = await client.health();
    expect(status.available).toBe(true);
    expect(status.accounts[0].platform).toBe("telegram");
  });

  it("creates a draft and returns the post id", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ postId: "p123" }, true, 201));
    const client = createNexusClient(fetchImpl as unknown as typeof fetch);
    const result = await client.draft("hello", "a1");
    expect(fetchImpl).toHaveBeenCalledWith("/api/nexus/draft", expect.objectContaining({ method: "POST" }));
    expect(result.postId).toBe("p123");
  });

  it("publishes a post", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, message: "Published to 1 platforms, 0 failed" }));
    const client = createNexusClient(fetchImpl as unknown as typeof fetch);
    const result = await client.publish("p123");
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Published");
  });

  it("throws a clear error when draft fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Nexus offline" }, false, 502));
    const client = createNexusClient(fetchImpl as unknown as typeof fetch);
    await expect(client.draft("x", "a1")).rejects.toThrow(/Nexus offline/);
  });

  it("degrades gracefully when the bridge is unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("down"));
    const client = createNexusClient(fetchImpl as unknown as typeof fetch);
    const status = await client.health();
    expect(status.available).toBe(false);
  });
});
