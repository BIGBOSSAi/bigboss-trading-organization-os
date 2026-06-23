// Browser client for the cockpit's Nexus bridge (/api/nexus/*). Lets the cockpit draft
// social content, then publish it after human approval. Degrades gracefully when the
// Nexus app is offline.

export interface NexusAccount {
  id: string;
  platform: string;
  username: string;
  displayName?: string;
}

export interface NexusStatus {
  available: boolean;
  accounts: NexusAccount[];
  detail: string;
}

export interface NexusClient {
  health: () => Promise<NexusStatus>;
  draft: (content: string, accountId: string) => Promise<{ postId: string }>;
  publish: (postId: string) => Promise<{ ok: boolean; message: string }>;
}

export function createNexusClient(fetchImpl: typeof fetch = fetch): NexusClient {
  return {
    async health(): Promise<NexusStatus> {
      try {
        const response = await fetchImpl("/api/nexus/health", { method: "GET" });
        if (!response.ok) return { available: false, accounts: [], detail: "Nexus bridge error." };
        const payload = (await response.json()) as NexusStatus;
        return {
          available: Boolean(payload.available),
          accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
          detail: payload.detail ?? "",
        };
      } catch {
        return { available: false, accounts: [], detail: "Nexus bridge not reachable." };
      }
    },

    async draft(content: string, accountId: string): Promise<{ postId: string }> {
      const response = await fetchImpl("/api/nexus/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, accountId }),
      });
      const payload = (await response.json()) as { postId?: string; error?: string };
      if (!response.ok || !payload.postId) {
        throw new Error(payload.error || "Failed to create draft in Nexus.");
      }
      return { postId: payload.postId };
    },

    async publish(postId: string): Promise<{ ok: boolean; message: string }> {
      const response = await fetchImpl("/api/nexus/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Publish failed.");
      }
      return { ok: Boolean(payload.success), message: payload.message || "Published." };
    },
  };
}
