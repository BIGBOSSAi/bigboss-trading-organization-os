import { describe, expect, it } from "vitest";
import { formatAgentOutputAsMarkdown, generateAgentOutput, getAgentOutputFilename, updateAgentOutputMarkdown } from "./agentOutputs";
import { createHermesBridge } from "./hermesBridge";

describe("generateAgentOutput", () => {
  it("creates a lesson workspace draft for Dean", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T22:00:00.000Z") });
    const task = await bridge.createTask("Build a liquidity lesson for AI Trading College");

    const output = generateAgentOutput(task);

    expect(output.agentId).toBe("dean");
    expect(output.title).toBe("AI Trading College Lesson Draft");
    expect(output.sections.map((section) => section.heading)).toContain("Lesson Objective");
    expect(output.guardrails).toContain("Education only; no trade signals or live execution.");
  });

  it("creates a bot research workspace draft for Forge with approval guardrails", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T22:01:00.000Z") });
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");

    const output = generateAgentOutput(task);

    expect(output.agentId).toBe("forge");
    expect(output.title).toBe("MT5 Bot Research Plan");
    expect(output.sections.map((section) => section.heading)).toContain("Evidence Checklist");
    expect(output.guardrails).toContain("Requires human approval before any live-readiness claim.");
  });

  it("creates distinct templates for every V1 agent", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T22:02:00.000Z") });
    const commands = [
      "Build a liquidity lesson for AI Trading College",
      "Review my trade journal for risk mistakes",
      "Backtest this MT5 bot",
      "Write a LinkedIn post about central banks",
      "Research audience pain points around liquidity",
      "Create an offer for BIGBoss Trader OS",
    ];

    const outputs = await Promise.all(commands.map(async (command) => generateAgentOutput(await bridge.createTask(command))));

    expect(outputs.map((output) => output.agentId)).toEqual(["dean", "ledger", "forge", "voice", "scout", "launch"]);
    expect(new Set(outputs.map((output) => output.title)).size).toBe(6);
  });

  it("formats an output draft as portable Markdown", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T22:03:00.000Z") });
    const output = generateAgentOutput(await bridge.createTask("Create an offer for BIGBoss Trader OS"));

    const markdown = formatAgentOutputAsMarkdown(output);

    expect(markdown).toContain("# Product Offer Plan");
    expect(markdown).toContain("## Offer Promise");
    expect(markdown).toContain("## Guardrails");
    expect(markdown).toContain("- No guaranteed income or performance promises.");
  });

  it("creates a safe markdown filename for export", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T22:04:00.000Z") });
    const output = generateAgentOutput(await bridge.createTask("Write a LinkedIn post about central banks"));

    expect(getAgentOutputFilename(output)).toBe("voice-brand-content-draft.md");
  });

  it("prefers saved edited Markdown when formatting output", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T13:00:00.000Z") });
    const output = generateAgentOutput(await bridge.createTask("Build a liquidity lesson for AI Trading College"));

    const edited = updateAgentOutputMarkdown(output, "# Custom Lesson\n\nMy edited draft.");

    expect(formatAgentOutputAsMarkdown(edited)).toBe("# Custom Lesson\n\nMy edited draft.");
    expect(edited.updatedAt).toBeTruthy();
  });
});
