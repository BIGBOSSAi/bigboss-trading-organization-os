import { describe, expect, it } from "vitest";
import { getOllamaGuidance } from "./ollamaGuidance";

describe("getOllamaGuidance", () => {
  it("returns start and verify commands when Ollama is offline", () => {
    const guidance = getOllamaGuidance({ status: "offline", models: [], detail: "not reachable" });

    expect(guidance.title).toBe("Start Ollama Locally");
    expect(guidance.commands).toContain("ollama serve");
    expect(guidance.commands).toContain("Invoke-RestMethod http://127.0.0.1:11434/api/tags");
  });

  it("returns model pull guidance when Ollama has no models", () => {
    const guidance = getOllamaGuidance({ status: "healthy", models: [], detail: "no models" });

    expect(guidance.title).toBe("Install A Local Model");
    expect(guidance.commands).toContain("ollama pull qwen3-coder:latest");
  });

  it("returns a ready state when models exist", () => {
    const guidance = getOllamaGuidance({ status: "healthy", models: ["qwen3-coder:latest"], detail: "ready" });

    expect(guidance.title).toBe("Local Brain Ready");
    expect(guidance.commands).toEqual([]);
  });
});
