import { describe, expect, it } from "vitest";
import { createHermesBridge } from "./hermesBridge";
import { createLocalBrainStore } from "./localBrainStore";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("createLocalBrainStore", () => {
  it("saves and loads HermesBridge task records", async () => {
    const storage = new MemoryStorage();
    const store = createLocalBrainStore(storage);
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T20:30:00.000Z") });
    const task = await bridge.createTask("Build a liquidity lesson for AI Trading College");

    store.saveTasks([task]);

    expect(store.loadTasks()).toEqual([task]);
  });

  it("creates local memory entries from routed task records", async () => {
    const storage = new MemoryStorage();
    const store = createLocalBrainStore(storage);
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T20:31:00.000Z") });
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");

    const entry = store.createMemoryEntryFromTask(task);
    store.saveMemoryEntries([entry]);

    expect(store.loadMemoryEntries()).toEqual([entry]);
    expect(entry.folderId).toBe("evidence");
    expect(entry.summary).toContain("Forge");
  });

  it("returns empty state when stored JSON is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem("bigboss.hermes.tasks.v1", "{bad json");
    storage.setItem("bigboss.hermes.memory.v1", "{bad json");
    const store = createLocalBrainStore(storage);

    expect(store.loadTasks()).toEqual([]);
    expect(store.loadMemoryEntries()).toEqual([]);
  });

  it("migrates saved task records that do not have workflow state yet", async () => {
    const storage = new MemoryStorage();
    const bridge = createHermesBridge({ now: () => new Date("2026-06-08T20:32:00.000Z") });
    const task = await bridge.createTask("Backtest this MT5 bot and tell me if it is live ready");
    const legacyTask = { ...task, workflow: undefined };
    storage.setItem("bigboss.hermes.tasks.v1", JSON.stringify([legacyTask]));
    const store = createLocalBrainStore(storage);

    const [loadedTask] = store.loadTasks();

    expect(loadedTask.workflow.status).toBe("needs-approval");
    expect(loadedTask.workflow.history[0]?.action).toBe("created");
  });
});
