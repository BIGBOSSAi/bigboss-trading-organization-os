import { describe, expect, it } from "vitest";
import { formatAgentOutputAsMarkdown, generateAgentOutput } from "./agentOutputs";
import { createHermesBridge } from "./hermesBridge";
import { enhanceOutputWithProvider } from "./providerGeneration";

describe("enhanceOutputWithProvider", () => {
  it("saves a local model response as edited Markdown", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T14:00:00.000Z") });
    const task = await bridge.createTask("Build a liquidity lesson for AI Trading College");
    const output = generateAgentOutput(task);

    const result = await enhanceOutputWithProvider({
      task,
      output,
      model: "qwen3-coder:latest",
      generate: async ({ prompt }) => ({
        status: "complete",
        response: `${prompt.includes("Education only") ? "# Enhanced Lesson" : "bad"}`,
      }),
    });

    expect(result.status).toBe("complete");
    expect(result.output.editedMarkdown).toBe("# Enhanced Lesson");
    expect(formatAgentOutputAsMarkdown(result.output)).toBe("# Enhanced Lesson");
  });

  it("preserves original output when provider generation fails", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T14:01:00.000Z") });
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");
    const output = generateAgentOutput(task);

    const result = await enhanceOutputWithProvider({
      task,
      output,
      model: "missing",
      generate: async () => ({
        status: "failed",
        response: "Local model request failed.",
      }),
    });

    expect(result.status).toBe("failed");
    expect(result.output).toBe(output);
    expect(result.message).toContain("Local model request failed");
  });

  it("includes task context and guardrails in the provider prompt", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T14:02:00.000Z") });
    const task = await bridge.createTask("Write and publish a LinkedIn post about central banks");
    const output = generateAgentOutput(task);
    let capturedPrompt = "";

    await enhanceOutputWithProvider({
      task,
      output,
      model: "qwen3-coder:latest",
      generate: async ({ prompt }) => {
        capturedPrompt = prompt;
        return { status: "complete", response: "# Enhanced Content" };
      },
    });

    expect(capturedPrompt).toContain("Agent: voice");
    expect(capturedPrompt).toContain("Risk: high");
    expect(capturedPrompt).toContain("Publishing requires human approval.");
    expect(capturedPrompt).toContain("Do not add live trading instructions");
  });
});
