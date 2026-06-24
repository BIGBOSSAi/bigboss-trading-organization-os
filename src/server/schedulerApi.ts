// Server-side automation: generates a daily content draft via the AI brain, saves it to
// the vault, and either notifies you on Telegram that approval is pending — or, when
// auto-approve is enabled, publishes it straight to your channel via Nexus and tells you.
// Runs while the Vite dev/preview server is up (local-first).

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createLlmGateway, type LlmGatewayOptions } from "./llmGateway";
import { createMemoryStore } from "./memoryStore";
import { createNexusClient } from "./nexusClient";
import { buildDailyContentPrompt, msUntilNextRun, pickDailyTopic } from "../domain/contentScheduler";

export interface SchedulerOptions extends LlmGatewayOptions {
  memoryRoot: string;
  hourLocal?: number;
  enabled?: boolean;
  autoApprove?: boolean;
  telegramToken?: string;
  telegramChat?: string;
  nexusBaseUrl?: string;
  nexusEmail?: string;
  nexusPassword?: string;
}

interface SchedulerState {
  enabled: boolean;
  hourLocal: number;
  autoApprove: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastTitle: string | null;
  lastOutcome: string | null;
  nextRunAt: string | null;
  recent: Array<{ id: string; title: string; createdAt: string; outcome: string }>;
}

export function schedulerApiPlugin(options: SchedulerOptions): Plugin {
  const gateway = createLlmGateway(options);
  const store = createMemoryStore({ root: options.memoryRoot });
  const nexus = createNexusClient({
    baseUrl: options.nexusBaseUrl,
    email: options.nexusEmail,
    password: options.nexusPassword,
  });
  const hourLocal = options.hourLocal ?? 9;
  const enabled = options.enabled ?? true;
  const telegramToken = options.telegramToken ?? "";
  const telegramChat = options.telegramChat ?? "";

  const state: SchedulerState = {
    enabled,
    hourLocal,
    autoApprove: options.autoApprove ?? false,
    running: false,
    lastRunAt: null,
    lastTitle: null,
    lastOutcome: null,
    nextRunAt: null,
    recent: [],
  };

  async function notify(text: string): Promise<void> {
    if (!telegramToken || !telegramChat) return;
    try {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChat, text }),
      });
    } catch {
      /* notification is best-effort */
    }
  }

  async function autoPublish(text: string): Promise<boolean> {
    try {
      const health = await nexus.health();
      const account = health.accounts.find((entry) => entry.platform === "telegram") ?? health.accounts[0];
      if (!account) return false;
      const { postId } = await nexus.draftPost(text, account.id);
      await nexus.publishPost(postId);
      return true;
    } catch {
      return false;
    }
  }

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
        text =
          generated.status === "complete" && generated.text.trim()
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

      let outcome: string;
      if (state.autoApprove) {
        const published = await autoPublish(text);
        outcome = published ? "auto-published" : "auto-publish-failed (saved to vault)";
        await notify(
          published
            ? `✅ Auto-published your daily post:\n\n${title}`
            : `⚠️ Daily draft saved but auto-publish failed — approve it in the dashboard:\n\n${title}`,
        );
      } else {
        outcome = "pending-approval";
        await notify(`📋 Approval pending — a new daily draft is waiting:\n\n${title}\n\nOpen the BIGBoss dashboard to approve & publish.`);
      }

      state.lastRunAt = createdAt;
      state.lastTitle = title;
      state.lastOutcome = outcome;
      state.recent = [{ id, title, createdAt, outcome }, ...state.recent].slice(0, 10);
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
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/api/scheduler" && req.method === "GET") {
      sendJson(res, 200, state);
      return;
    }

    if (path === "/api/scheduler/auto-approve" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          state.autoApprove = Boolean((body as { enabled?: boolean }).enabled);
          sendJson(res, 200, state);
        })
        .catch((error) => sendJson(res, 500, { error: messageOf(error) }));
      return;
    }

    if (path === "/api/scheduler/run" && req.method === "POST") {
      runOnce("manual")
        .then(() => sendJson(res, 200, { ok: true, ...state }))
        .catch((error) => sendJson(res, 500, { error: messageOf(error) }));
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "scheduler error";
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body was not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}
