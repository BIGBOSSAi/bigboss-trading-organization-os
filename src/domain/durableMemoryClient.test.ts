import { describe, expect, it, vi } from "vitest";
import { createDurableMemoryClient } from "./durableMemoryClient";
import type { DurableMemoryEntry } from "./durableMemory";

function makeEntry(): DurableMemoryEntry {
  return {
    id: "memory-dean-1",
    folderId: "organization",
    title: "Dean routed education",
    summary: "Build a liquidity lesson for AI Trading College.",
    agentId: "dean",
    sourceTaskId: "dean-1",
    createdAt: "2026-06-20T00:00:00.000Z",
    tags: ["education", "dean"],
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("durableMemoryClient", () => {
  it("loads entries and reports the durable root", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ root: "E:/AI-Brain/Memory", entries: [makeEntry()] }));
    const client = createDurableMemoryClient(fetchImpl as unknown as typeof fetch);

    const result = await client.load();

    expect(fetchImpl).toHaveBeenCalledWith("/api/memory", { method: "GET" });
    expect(result.status.available).toBe(true);
    expect(result.status.root).toBe("E:/AI-Brain/Memory");
    expect(result.entries).toHaveLength(1);
  });

  it("falls back to unavailable when the API cannot be reached", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const client = createDurableMemoryClient(fetchImpl as unknown as typeof fetch);

    const result = await client.load();

    expect(result.status.available).toBe(false);
    expect(result.entries).toEqual([]);
  });

  it("posts an entry and reports the save location", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, root: "E:/AI-Brain/Memory" }, true, 201));
    const client = createDurableMemoryClient(fetchImpl as unknown as typeof fetch);

    const status = await client.save(makeEntry());

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/memory",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
    );
    expect(status.available).toBe(true);
    expect(status.root).toBe("E:/AI-Brain/Memory");
  });

  it("reports unavailable when a save fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, false, 500));
    const client = createDurableMemoryClient(fetchImpl as unknown as typeof fetch);

    const status = await client.save(makeEntry());

    expect(status.available).toBe(false);
  });
});
