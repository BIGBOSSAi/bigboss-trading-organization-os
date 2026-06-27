// Browser client for Happi's prompt-pack engine (/api/happi).

import type { PromptItem } from "./promptPack";

export interface PromptPack {
  topic: string;
  count: number;
  items: PromptItem[];
}

export interface HappiClient {
  // Starts a background job and polls until done (generation takes a few minutes).
  generate: (topic: string, onTick?: (seconds: number) => void) => Promise<PromptPack>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createHappiClient(fetchImpl: typeof fetch = fetch): HappiClient {
  return {
    async generate(topic: string, onTick?: (seconds: number) => void): Promise<PromptPack> {
      const start = await fetchImpl("/api/happi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const started = (await start.json()) as { jobId?: string; error?: string };
      if (!start.ok || !started.jobId) throw new Error(started.error || "Could not start Happi.");

      const begin = Date.now();
      for (;;) {
        await sleep(5000);
        onTick?.(Math.round((Date.now() - begin) / 1000));
        const res = await fetchImpl(`/api/happi/status?jobId=${started.jobId}`);
        const job = (await res.json()) as { status?: string; topic?: string; count?: number; items?: PromptItem[]; error?: string };
        if (job.status === "done" && Array.isArray(job.items)) {
          return { topic: job.topic ?? topic, count: job.count ?? job.items.length, items: job.items };
        }
        if (job.status === "error") throw new Error(job.error || "Happi generation failed.");
      }
    },
  };
}
