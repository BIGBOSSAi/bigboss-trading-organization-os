// Browser-side client for the durable memory API. Degrades gracefully: if the API
// is unreachable (e.g. running a static build with no Vite server), it reports
// unavailable so the cockpit can fall back to browser-only memory.

import type { DurableMemoryEntry, DurableMemoryStatus } from "./durableMemory";

const ENDPOINT = "/api/memory";

export interface DurableMemoryLoadResult {
  status: DurableMemoryStatus;
  entries: DurableMemoryEntry[];
}

export interface DurableMemoryClient {
  load: () => Promise<DurableMemoryLoadResult>;
  save: (entry: DurableMemoryEntry) => Promise<DurableMemoryStatus>;
}

export function createDurableMemoryClient(fetchImpl: typeof fetch = fetch): DurableMemoryClient {
  async function load(): Promise<DurableMemoryLoadResult> {
    try {
      const response = await fetchImpl(ENDPOINT, { method: "GET" });
      if (!response.ok) {
        return { status: unavailable(`Memory API responded with HTTP ${response.status}.`), entries: [] };
      }

      const payload = (await response.json()) as { root?: string; entries?: DurableMemoryEntry[] };
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      return {
        status: { available: true, root: payload.root, detail: `Durable memory at ${payload.root ?? "disk"}.` },
        entries,
      };
    } catch {
      return { status: unavailable("Durable memory API is not reachable; using browser-only memory."), entries: [] };
    }
  }

  async function save(entry: DurableMemoryEntry): Promise<DurableMemoryStatus> {
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        return unavailable(`Memory write failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as { root?: string };
      return { available: true, root: payload.root, detail: `Saved to ${payload.root ?? "disk"}.` };
    } catch {
      return unavailable("Durable memory API is not reachable; entry kept in browser only.");
    }
  }

  return { load, save };
}

function unavailable(detail: string): DurableMemoryStatus {
  return { available: false, detail };
}
