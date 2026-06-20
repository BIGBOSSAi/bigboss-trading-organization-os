// Vite dev/preview middleware exposing the LLM gateway to the browser at
// /api/llm. Keeps the FCC key and provider calls server-side.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { createLlmGateway, type LlmGatewayOptions } from "./llmGateway";

const GENERATE_ENDPOINT = "/api/llm/generate";
const HEALTH_ENDPOINT = "/api/llm/health";

export function llmApiPlugin(options: LlmGatewayOptions = {}): Plugin {
  const gateway = createLlmGateway(options);

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === HEALTH_ENDPOINT && req.method === "GET") {
      gateway
        .health()
        .then((report) => sendJson(res, 200, report))
        .catch((error: unknown) => sendJson(res, 500, { error: messageOf(error) }));
      return;
    }

    if (path === GENERATE_ENDPOINT && req.method === "POST") {
      readBody(req)
        .then((body) => {
          const request = body as { prompt?: string; system?: string; maxTokens?: number };
          if (!request || typeof request.prompt !== "string" || !request.prompt.trim()) {
            sendJson(res, 400, { error: "A non-empty 'prompt' is required." });
            return;
          }
          return gateway
            .generate({ prompt: request.prompt, system: request.system, maxTokens: request.maxTokens })
            .then((result) => sendJson(res, result.status === "complete" ? 200 : 502, result));
        })
        .catch((error: unknown) => sendJson(res, 500, { error: messageOf(error) }));
      return;
    }

    next();
  };

  return {
    name: "bigboss-llm-api",
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
  return error instanceof Error ? error.message : "LLM gateway error.";
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
