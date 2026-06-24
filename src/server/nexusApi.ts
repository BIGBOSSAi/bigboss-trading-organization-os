// Vite dev/preview middleware bridging the cockpit to the Nexus Social app.
// Exposes /api/nexus/{health,draft,publish}; keeps Nexus credentials server-side.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createNexusClient, type NexusClientOptions } from "./nexusClient";

export function nexusApiPlugin(options: NexusClientOptions = {}): Plugin {
  const client = createNexusClient(options);

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/api/nexus/health" && req.method === "GET") {
      client
        .health()
        .then((health) => sendJson(res, 200, health))
        .catch((error) => sendJson(res, 500, { available: false, accounts: [], detail: messageOf(error) }));
      return;
    }

    if (path === "/api/nexus/draft" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          const { content, accountId } = body as { content?: string; accountId?: string };
          if (!content?.trim() || !accountId) {
            sendJson(res, 400, { error: "content and accountId are required." });
            return;
          }
          return client.draftPost(content, accountId).then((result) => sendJson(res, 201, result));
        })
        .catch((error) => sendJson(res, 502, { error: messageOf(error) }));
      return;
    }

    if (path === "/api/nexus/request-approval" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          const { postId } = body as { postId?: string };
          if (!postId) {
            sendJson(res, 400, { error: "postId is required." });
            return;
          }
          return client.requestApproval(postId).then((ok) => sendJson(res, ok ? 200 : 502, { ok }));
        })
        .catch((error) => sendJson(res, 502, { error: messageOf(error) }));
      return;
    }

    if (path === "/api/nexus/publish" && req.method === "POST") {
      readBody(req)
        .then((body) => {
          const { postId } = body as { postId?: string };
          if (!postId) {
            sendJson(res, 400, { error: "postId is required." });
            return;
          }
          return client.publishPost(postId).then((result) => sendJson(res, 200, result));
        })
        .catch((error) => sendJson(res, 502, { error: messageOf(error) }));
      return;
    }

    next();
  };

  return {
    name: "bigboss-nexus-api",
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
  return error instanceof Error ? error.message : "Nexus bridge error.";
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
