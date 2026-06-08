import type { AgentId } from "./agents";
import type { HermesTaskRecord, MemoryFolder, TaskWorkflow } from "./hermesBridge";

const taskStorageKey = "bigboss.hermes.tasks.v1";
const memoryStorageKey = "bigboss.hermes.memory.v1";

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

  function loadSnapshot(): LocalBrainSnapshot {
    return {
      tasks: loadTasks(),
      memoryEntries: loadMemoryEntries(),
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
    loadSnapshot,
    loadTasks,
    saveMemoryEntries,
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
