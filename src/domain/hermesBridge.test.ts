import { describe, expect, it } from "vitest";
import { createHermesBridge, transitionTask, type ModelProviderProbe } from "./hermesBridge";

describe("createHermesBridge", () => {
  it("keeps mock online when Ollama is offline", async () => {
    const offlineProbe: ModelProviderProbe = async () => ({
      status: "offline",
      detail: "Connection refused",
    });
    const bridge = createHermesBridge({ probeOllama: offlineProbe });

    const status = await bridge.checkProviders();

    expect(status.primary.id).toBe("mock");
    expect(status.providers.map((provider) => provider.id)).toEqual(["mock", "ollama-local", "fcc-backup", "mimo-local"]);
    expect(status.providers.find((provider) => provider.id === "ollama-local")?.status).toBe("offline");
  });

  it("creates approval-gated task records for risky routed commands", async () => {
    const bridge = createHermesBridge();

    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");

    expect(task.agentId).toBe("forge");
    expect(task.approval.status).toBe("required");
    expect(task.workflow.status).toBe("needs-approval");
    expect(task.approval.reasons).toContain("high-risk trading or publishing workflow");
  });

  it("creates drafted task records for low-risk commands", async () => {
    const bridge = createHermesBridge();

    const task = await bridge.createTask("Build a liquidity lesson for AI Trading College");

    expect(task.workflow.status).toBe("drafted");
    expect(task.approval.status).toBe("not-required");
  });

  it("moves high-risk tasks through approve then complete", async () => {
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T21:00:00.000Z") });
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");

    const approved = transitionTask(task, "approve", new Date("2026-06-08T21:01:00.000Z"));
    const completed = transitionTask(approved, "complete", new Date("2026-06-08T21:02:00.000Z"));

    expect(approved.workflow.status).toBe("approved");
    expect(completed.workflow.status).toBe("completed");
    expect(completed.workflow.history.map((event) => event.action)).toEqual(["created", "approve", "complete"]);
  });

  it("does not complete a high-risk task before approval", async () => {
    const bridge = createHermesBridge();
    const task = await bridge.createTask("Write and publish a LinkedIn post about central banks");

    const completed = transitionTask(task, "complete", new Date("2026-06-08T21:02:00.000Z"));

    expect(completed.workflow.status).toBe("needs-approval");
    expect(completed.workflow.history[completed.workflow.history.length - 1]?.action).toBe("blocked");
  });

  it("moves tasks to rejected state", async () => {
    const bridge = createHermesBridge();
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");

    const rejected = transitionTask(task, "reject", new Date("2026-06-08T21:03:00.000Z"));

    expect(rejected.workflow.status).toBe("rejected");
  });

  it("can create a task from an already checked provider report without probing again", async () => {
    let probeCalls = 0;
    const bridge = createHermesBridge({
      probeOllama: async () => {
        probeCalls += 1;
        return { status: "healthy", detail: "Ready" };
      },
    });
    const providerReport = await bridge.checkProviders();

    const task = await bridge.createTask("Build a liquidity lesson", providerReport);

    expect(task.providerId).toBe("ollama-local");
    expect(probeCalls).toBe(1);
  });

  it("marks Ollama offline when the provider probe fails", async () => {
    const bridge = createHermesBridge({
      probeOllama: async () => {
        throw new Error("Provider API request failed");
      },
    });

    const status = await bridge.checkProviders();

    expect(status.primary.id).toBe("mock");
    expect(status.providers.find((provider) => provider.id === "ollama-local")?.status).toBe("offline");
  });

  it("marks Ollama offline when the provider probe times out", async () => {
    const bridge = createHermesBridge({
      providerTimeoutMs: 1,
      probeOllama: () => new Promise(() => undefined),
    });

    const status = await bridge.checkProviders();

    expect(status.primary.id).toBe("mock");
    expect(status.providers.find((provider) => provider.id === "ollama-local")?.detail).toContain("timed out");
  });

  it("exposes the local memory folders HermesBridge owns", () => {
    const bridge = createHermesBridge();

    expect(bridge.memoryFolders.map((folder) => folder.id)).toEqual([
      "profile",
      "organization",
      "tasks",
      "evidence",
      "skills",
    ]);
  });
});
