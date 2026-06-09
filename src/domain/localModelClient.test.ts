import { describe, expect, it } from "vitest";
import { createLocalModelClient } from "./localModelClient";

describe("createLocalModelClient", () => {
  it("lists models from an Ollama-compatible tags response", async () => {
    const client = createLocalModelClient({
      fetcher: async () =>
        new Response(JSON.stringify({ models: [{ name: "qwen3-coder:latest" }, { name: "llama3.2:3b" }] }), {
          status: 200,
        }),
    });

    const result = await client.listModels();

    expect(result.status).toBe("healthy");
    expect(result.models).toEqual(["qwen3-coder:latest", "llama3.2:3b"]);
  });

  it("returns offline state when model discovery fails", async () => {
    const client = createLocalModelClient({
      fetcher: async () => {
        throw new Error("connection refused");
      },
    });

    const result = await client.listModels();

    expect(result.status).toBe("offline");
    expect(result.models).toEqual([]);
  });

  it("generates a non-streaming local brain response", async () => {
    const client = createLocalModelClient({
      fetcher: async (_url, init) => {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          model: "qwen3-coder:latest",
          prompt: "Explain liquidity in one sentence.",
          stream: false,
        });
        return new Response(JSON.stringify({ response: "Liquidity is where orders are likely to rest." }), {
          status: 200,
        });
      },
    });

    const result = await client.generate({
      model: "qwen3-coder:latest",
      prompt: "Explain liquidity in one sentence.",
    });

    expect(result.status).toBe("complete");
    expect(result.response).toBe("Liquidity is where orders are likely to rest.");
  });

  it("does not throw when generation fails", async () => {
    const client = createLocalModelClient({
      fetcher: async () => new Response("bad gateway", { status: 502 }),
    });

    const result = await client.generate({ model: "missing", prompt: "test" });

    expect(result.status).toBe("failed");
    expect(result.response).toContain("Local model request failed");
  });
});
