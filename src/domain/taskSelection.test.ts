import { describe, expect, it } from "vitest";
import { generateAgentOutput } from "./agentOutputs";
import { createHermesBridge } from "./hermesBridge";
import { resolveTaskSelection } from "./taskSelection";

describe("resolveTaskSelection", () => {
  it("selects the requested task and matching output", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T12:00:00.000Z") });
    const deanTask = await bridge.createTask("Build a liquidity lesson for AI Trading College");
    const voiceTask = await bridge.createTask("Write a LinkedIn post about central banks");
    const outputs = [generateAgentOutput(deanTask), generateAgentOutput(voiceTask)];

    const selection = resolveTaskSelection([voiceTask, deanTask], outputs, deanTask.id);

    expect(selection.activeTask?.id).toBe(deanTask.id);
    expect(selection.activeOutput?.taskId).toBe(deanTask.id);
    expect(selection.activeOutput?.agentId).toBe("dean");
  });

  it("falls back to the newest task when selected id is missing", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-09T12:01:00.000Z") });
    const task = await bridge.createTask("Create an offer for BIGBoss Trader OS");
    const output = generateAgentOutput(task);

    const selection = resolveTaskSelection([task], [output], "missing-task");

    expect(selection.activeTask?.id).toBe(task.id);
    expect(selection.activeOutput?.taskId).toBe(task.id);
  });

  it("can show the latest output when there are no tasks", () => {
    const selection = resolveTaskSelection([], [], undefined);

    expect(selection.activeTask).toBeUndefined();
    expect(selection.activeOutput).toBeUndefined();
  });
});
