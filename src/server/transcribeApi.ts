// Vite dev/preview middleware that proxies browser audio to the local Whisper server
// (faster-whisper, loaded once in .whisper/server.py). Keeps transcription local and
// private; if the Whisper server is not running, returns 503 so the cockpit falls back
// to the browser Web Speech API.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";

export interface TranscribeApiOptions {
  whisperUrl?: string;
}

export function transcribeApiPlugin(options: TranscribeApiOptions = {}): Plugin {
  const whisperUrl = (options.whisperUrl ?? "http://127.0.0.1:8378").replace(/\/$/, "");

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/api/transcribe/health" && req.method === "GET") {
      fetch(`${whisperUrl}/health`)
        .then(async (response) => {
          if (!response.ok) return sendJson(res, 503, { available: false });
          const payload = await response.json();
          sendJson(res, 200, { available: true, ...payload });
        })
        .catch(() => sendJson(res, 503, { available: false, detail: "Whisper server offline." }));
      return;
    }

    if (path === "/api/transcribe" && req.method === "POST") {
      readRaw(req)
        .then(async (buffer) => {
          const response = await fetch(`${whisperUrl}/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: new Uint8Array(buffer),
          });
          const body = await response.text();
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        })
        .catch(() => sendJson(res, 503, { error: "Whisper server offline." }));
      return;
    }

    next();
  };

  return {
    name: "bigboss-transcribe-api",
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

function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
