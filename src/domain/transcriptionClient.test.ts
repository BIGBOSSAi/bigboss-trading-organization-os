import { describe, expect, it, vi } from "vitest";
import { checkTranscriptionHealth, transcribeBlob } from "./transcriptionClient";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe("transcriptionClient", () => {
  it("posts audio and returns the transcript", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ text: "  run mission build a funnel  " }));
    const blob = { type: "audio/webm" } as Blob;

    const text = await transcribeBlob(blob, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith("/api/transcribe", expect.objectContaining({ method: "POST" }));
    expect(text).toBe("run mission build a funnel");
  });

  it("throws when transcription fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "x" }, false, 503));
    await expect(transcribeBlob({} as Blob, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/HTTP 503/);
  });

  it("reports healthy when the Whisper server is up", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ available: true, model: "base" }));
    const health = await checkTranscriptionHealth(fetchImpl as unknown as typeof fetch);
    expect(health.available).toBe(true);
    expect(health.model).toBe("base");
  });

  it("reports unavailable when the server is offline", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const health = await checkTranscriptionHealth(fetchImpl as unknown as typeof fetch);
    expect(health.available).toBe(false);
  });
});
