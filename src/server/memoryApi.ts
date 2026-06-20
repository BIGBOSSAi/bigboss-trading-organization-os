// Vite dev/preview middleware exposing the durable memory store over a small HTTP
// boundary, so the browser never touches the filesystem directly. Local-first by
// design: it only runs while the Vite server is running.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createMemoryStore } from "./memoryStore";
import { isMemoryFolderId, type DurableMemoryEntry } from "../domain/durableMemory";

const ENDPOINT = "/api/memory";

export interface MemoryApiOptions {
  root: string;
}

export function memoryApiPlugin(options: MemoryApiOptions): Plugin {
  const store = createMemoryStore({ root: options.root });

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    if (!url.split("?")[0].startsWith(ENDPOINT)) {
      next();
      return;
    }

    if (req.method === "GET") {
      sendJson(res, 200, { root: store.baseDir, entries: store.listEntries() });
      return;
    }

    if (req.method === "POST") {
      readBody(req)
        .then((body) => {
          const entry = body as Partial<DurableMemoryEntry>;
          if (!entry || typeof entry.id !== "string" || !entry.folderId || !isMemoryFolderId(entry.folderId)) {
            sendJson(res, 400, { error: "Invalid memory entry." });
            return;
          }

          const { path } = store.writeEntry({
            id: entry.id,
            folderId: entry.folderId,
            title: entry.title ?? entry.id,
            summary: entry.summary ?? "",
            agentId: entry.agentId ?? "",
            sourceTaskId: entry.sourceTaskId ?? "",
            createdAt: entry.createdAt ?? new Date().toISOString(),
            tags: entry.tags,
          });
          sendJson(res, 201, { ok: true, path, root: store.baseDir });
        })
        .catch((error: unknown) => {
          sendJson(res, 500, { error: error instanceof Error ? error.message : "Memory write failed." });
        });
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  };

  return {
    name: "bigboss-memory-api",
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
