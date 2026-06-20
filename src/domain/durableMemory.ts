// Shared, runtime-agnostic types for durable shared memory.
// Imported by both the browser client and the Node-side memory store, so it must
// contain no DOM or Node APIs — types and pure helpers only.

export const memoryFolderIds = ["profile", "organization", "tasks", "evidence", "skills"] as const;

export type DurableMemoryFolderId = (typeof memoryFolderIds)[number];

export interface DurableMemoryEntry {
  id: string;
  folderId: DurableMemoryFolderId;
  title: string;
  summary: string;
  agentId: string;
  sourceTaskId: string;
  createdAt: string;
  tags?: string[];
}

export interface DurableMemoryStatus {
  available: boolean;
  root?: string;
  detail: string;
}

export function isMemoryFolderId(value: string): value is DurableMemoryFolderId {
  return (memoryFolderIds as readonly string[]).includes(value);
}
