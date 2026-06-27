// Happi: generates a 200-prompt pack for a niche via the AI brain (deepseek-v4-flash),
// deduped, and saves it to the vault. Parallel batches for speed, sequential top-ups to
// reliably reach the target.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createLlmGateway, type LlmGatewayOptions } from "./llmGateway";
import { createMemoryStore } from "./memoryStore";
import { buildBatchPrompt, mergeUnique, parsePromptItems, renderPackMarkdown, type PromptItem, type RawPromptItem } from "../domain/promptPack";

export interface HappiOptions extends LlmGatewayOptions {
  memoryRoot: string;
}

export function happiApiPlugin(options: HappiOptions): Plugin {
  const gateway = createLlmGateway(options);
  const store = createMemoryStore({ root: options.memoryRoot });

  // Distinct sub-themes per batch keep prompts unique so we reach the target without
  // the model repeating itself across batches.
  const focuses = [
    "hooks, captions & opening lines",
    "content ideas & photoshoot/visual concepts",
    "monetization, brand deals & offers",
    "audience growth & engagement tactics",
    "reels/shorts & story scripts",
    "profile, bio & positioning optimization",
    "hashtags, SEO & discovery strategy",
    "collaboration & outreach messages",
    "analytics, planning & content calendars",
    "trends, seasonal angles & campaigns",
  ];

  async function genBatch(topic: string, count: number, focus?: string): Promise<RawPromptItem[]> {
    const result = await gateway.generate({ prompt: buildBatchPrompt(topic, count, focus), maxTokens: 6000 });
    return result.status === "complete" ? parsePromptItems(result.text) : [];
  }

  async function generatePack(topic: string, target = 200): Promise<PromptItem[]> {
    // All angle-seeded batches run in parallel (≈ one batch's wall-time), then a couple of
    // sequential top-ups only if dedup left us short.
    const parallel = await Promise.all(focuses.map((focus) => genBatch(topic, 40, focus)));
    let items = mergeUnique(parallel, target);
    for (let guard = 0; items.length < target && guard < 3; guard += 1) {
      const focus = focuses[guard % focuses.length];
      const more = await genBatch(topic, target - items.length + 20, focus);
      items = mergeUnique([items.map(({ id: _id, ...rest }) => rest), more], target);
    }
    return items;
  }

  // Generation takes minutes (the provider serializes calls), so run it as a background
  // job and let the client poll — the request never hangs.
  type Job = { status: "running" | "done" | "error"; topic: string; count: number; items?: PromptItem[]; error?: string };
  const jobs = new Map<string, Job>();

  function startJob(topic: string): string {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    jobs.set(id, { status: "running", topic, count: 0 });
    void (async () => {
      try {
        const items = await generatePack(topic, 200);
        const createdAt = new Date().toISOString();
        store.writeEntry({
          id: `promptpack-${createdAt}`,
          folderId: "organization",
          title: `Prompt Pack: ${topic} (${items.length})`,
          summary: renderPackMarkdown(topic, items),
          agentId: "happi",
          sourceTaskId: `promptpack-${createdAt}`,
          createdAt,
          tags: ["prompt-pack", topic],
        });
        jobs.set(id, { status: "done", topic, count: items.length, items });
      } catch (error) {
        jobs.set(id, { status: "error", topic, count: 0, error: messageOf(error) });
      }
    })();
    return id;
  }

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/api/happi/generate" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          const topic = (body as { topic?: string }).topic?.trim();
          if (!topic) {
            sendJson(res, 400, { error: "topic is required." });
            return;
          }
          sendJson(res, 202, { jobId: startJob(topic) });
        })
        .catch((error) => sendJson(res, 500, { error: messageOf(error) }));
      return;
    }

    if (path === "/api/happi/status" && req.method === "GET") {
      const jobId = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("jobId") ?? "";
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: "job not found" });
        return;
      }
      sendJson(res, 200, job);
      return;
    }

    next();
  };

  return {
    name: "bigboss-happi-api",
    configureServer(server) {
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
  return error instanceof Error ? error.message : "Happi error.";
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
