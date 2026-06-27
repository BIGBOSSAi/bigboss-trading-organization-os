// Browser client for Happi's prompt-pack engine (/api/happi).

import type { PromptItem } from "./promptPack";

export interface PromptPack {
  topic: string;
  count: number;
  items: PromptItem[];
}

export interface HappiClient {
  generate: (topic: string) => Promise<PromptPack>;
}

export function createHappiClient(fetchImpl: typeof fetch = fetch): HappiClient {
  return {
    async generate(topic: string): Promise<PromptPack> {
      const response = await fetchImpl("/api/happi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const payload = (await response.json()) as Partial<PromptPack> & { error?: string };
      if (!response.ok || !Array.isArray(payload.items)) {
        throw new Error(payload.error || "Happi generation failed.");
      }
      return { topic: payload.topic ?? topic, count: payload.count ?? payload.items.length, items: payload.items };
    },
  };
}
