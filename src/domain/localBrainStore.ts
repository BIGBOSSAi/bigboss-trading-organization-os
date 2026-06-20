import type { AgentId } from "./agents";
import type { AgentOutputDraft } from "./agentOutputs";
import type { HermesTaskRecord, MemoryFolder, TaskWorkflow } from "./hermesBridge";

const taskStorageKey = "bigboss.hermes.tasks.v1";
const memoryStorageKey = "bigboss.hermes.memory.v1";
const outputStorageKey = "bigboss.hermes.outputs.v1";
const settingsStorageKey = "bigboss.hermes.settings.v1";

export type MemoryFolderId = MemoryFolder["id"];

export interface LocalMemoryEntry {
  id: string;
  folderId: MemoryFolderId;
  summary: string;
  sourceTaskId: string;
  agentId: AgentId;
  createdAt: string;
}

export interface LocalBrainSnapshot {
  tasks: HermesTaskRecord[];
  memoryEntries: LocalMemoryEntry[];
  outputs: AgentOutputDraft[];
  settings: LocalBrainSettings;
}

export interface LocalBrainSettings {
  preferredModel?: string;
}

export function createLocalBrainStore(storage: Pick<Storage, "getItem" | "setItem">) {
  function loadTasks(): HermesTaskRecord[] {
    return readArray<Partial<HermesTaskRecord>>(storage, taskStorageKey).map(normalizeTask);
  }

  function saveTasks(tasks: HermesTaskRecord[]): void {
    storage.setItem(taskStorageKey, JSON.stringify(tasks.slice(0, 20)));
  }

  function loadMemoryEntries(): LocalMemoryEntry[] {
    return readArray<LocalMemoryEntry>(storage, memoryStorageKey);
  }

  function saveMemoryEntries(entries: LocalMemoryEntry[]): void {
    storage.setItem(memoryStorageKey, JSON.stringify(entries.slice(0, 50)));
  }

  function loadOutputs(): AgentOutputDraft[] {
    return readArray<AgentOutputDraft>(storage, outputStorageKey);
  }

  function saveOutputs(outputs: AgentOutputDraft[]): void {
    storage.setItem(outputStorageKey, JSON.stringify(outputs.slice(0, 20)));
  }

  function loadSettings(): LocalBrainSettings {
    return readObject<LocalBrainSettings>(storage, settingsStorageKey) ?? {};
  }

  function saveSettings(settings: LocalBrainSettings): void {
    storage.setItem(settingsStorageKey, JSON.stringify(settings));
  }

  function loadSnapshot(): LocalBrainSnapshot {
    return {
      tasks: loadTasks(),
      memoryEntries: loadMemoryEntries(),
      outputs: loadOutputs(),
      settings: loadSettings(),
    };
  }

  function createMemoryEntryFromTask(task: HermesTaskRecord): LocalMemoryEntry {
    return {
      id: `memory-${task.id}`,
      folderId: chooseMemoryFolder(task),
      summary: `${task.route.agent.name} routed ${task.intent.replace("_", " ")}: ${task.command}`,
      sourceTaskId: task.id,
      agentId: task.agentId,
      createdAt: task.createdAt,
    };
  }

  return {
    createMemoryEntryFromTask,
    loadMemoryEntries,
    loadOutputs,
    loadSettings,
    loadSnapshot,
    loadTasks,
    saveMemoryEntries,
    saveOutputs,
    saveSettings,
    saveTasks,
  };
}

function readArray<T>(storage: Pick<Storage, "getItem">, key: string): T[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function readObject<T>(storage: Pick<Storage, "getItem">, key: string): T | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

function chooseMemoryFolder(task: HermesTaskRecord): MemoryFolderId {
  if (task.intent === "bot_research" || task.intent === "trade_review") {
    return "evidence";
  }

  if (task.intent === "education" || task.intent === "content" || task.intent === "product") {
    return "organization";
  }

  return "tasks";
}

function normalizeTask(task: Partial<HermesTaskRecord>): HermesTaskRecord {
  const createdAt = task.createdAt ?? new Date(0).toISOString();
  const approvalRequired = task.approval?.status === "required";
  const workflow: TaskWorkflow = task.workflow ?? {
    status: approvalRequired ? "needs-approval" : "drafted",
    history: [
      {
        action: "created",
        status: approvalRequired ? "needs-approval" : "drafted",
        at: createdAt,
        note: approvalRequired ? "Migrated task with human approval required." : "Migrated task ready for drafting.",
      },
    ],
  };

  return {
    ...(task as HermesTaskRecord),
    workflow,
  };
}
