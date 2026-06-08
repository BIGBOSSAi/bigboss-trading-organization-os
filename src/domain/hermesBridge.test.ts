import { describe, expect, it } from "vitest";
import { createHermesBridge, type ModelProviderProbe } from "./hermesBridge";

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
    expect(task.approval.reasons).toContain("high-risk trading or publishing workflow");
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
