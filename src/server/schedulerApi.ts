// Server-side automation: generates a daily content draft via the AI brain and saves it
// to the vault as an approval-pending draft (it is NOT auto-published). Exposes status
// and a manual "run now". Runs while the Vite dev/preview server is up (local-first).

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createLlmGateway, type LlmGatewayOptions } from "./llmGateway";
import { createMemoryStore } from "./memoryStore";
import { buildDailyContentPrompt, msUntilNextRun, pickDailyTopic } from "../domain/contentScheduler";

export interface SchedulerOptions extends LlmGatewayOptions {
  memoryRoot: string;
  hourLocal?: number;
  enabled?: boolean;
}

interface SchedulerState {
  enabled: boolean;
  hourLocal: number;
  running: boolean;
  lastRunAt: string | null;
  lastTitle: string | null;
  nextRunAt: string | null;
  recent: Array<{ id: string; title: string; createdAt: string }>;
}

export function schedulerApiPlugin(options: SchedulerOptions): Plugin {
  const gateway = createLlmGateway(options);
  const store = createMemoryStore({ root: options.memoryRoot });
  const hourLocal = options.hourLocal ?? 9;
  const enabled = options.enabled ?? true;

  const state: SchedulerState = {
    enabled,
    hourLocal,
    running: false,
    lastRunAt: null,
    lastTitle: null,
    nextRunAt: null,
    recent: [],
  };

  async function runOnce(trigger: string): Promise<void> {
    if (state.running) return;
    state.running = true;
    try {
      const now = new Date();
      const topic = pickDailyTopic(now);
      const createdAt = now.toISOString();
      const id = `scheduled-${createdAt}`;
      const title = `Daily content draft — ${topic}`;

      let text: string;
      try {
        const generated = await gateway.generate({ prompt: buildDailyContentPrompt(topic) });
        text = generated.status === "complete" && generated.text.trim()
          ? generated.text.trim()
          : `(offline fallback) Draft a social post about ${topic}.`;
      } catch {
        text = `(offline fallback) Draft a social post about ${topic}.`;
      }

      store.writeEntry({
        id,
        folderId: "organization",
        title,
        summary: text,
        agentId: "voice",
        sourceTaskId: id,
        createdAt,
        tags: ["scheduled", "content", "draft", trigger],
      });

      state.lastRunAt = createdAt;
      state.lastTitle = title;
      state.recent = [{ id, title, createdAt }, ...state.recent].slice(0, 10);
    } finally {
      state.running = false;
    }
  }

  function scheduleNext(): void {
    const delay = msUntilNextRun(new Date(), hourLocal);
    state.nextRunAt = new Date(Date.now() + delay).toISOString();
    const timer: ReturnType<typeof setTimeout> = setTimeout(async () => {
      await runOnce("scheduled");
      scheduleNext();
    }, delay);
    // Never let the daily timer hold the process open (clean test/exit behavior).
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/api/scheduler" && req.method === "GET") {
      sendJson(res, 200, state);
      return;
    }
    if (path === "/api/scheduler/run" && req.method === "POST") {
      runOnce("manual")
        .then(() => sendJson(res, 200, { ok: true, ...state }))
        .catch((error) => sendJson(res, 500, { error: error instanceof Error ? error.message : "run failed" }));
      return;
    }
    next();
  };

  return {
    name: "bigboss-scheduler",
    configureServer(server) {
      if (enabled) scheduleNext();
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
