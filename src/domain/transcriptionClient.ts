// Browser client for local Whisper transcription. Records mic audio with MediaRecorder,
// posts it to /api/transcribe (which proxies to the local Whisper server), and returns
// the transcript. Feature-detected; the cockpit falls back to the Web Speech API when
// Whisper is unavailable.

const HEALTH_ENDPOINT = "/api/transcribe/health";
const TRANSCRIBE_ENDPOINT = "/api/transcribe";

export interface TranscriptionHealth {
  available: boolean;
  model?: string;
}

export interface TranscriptionHandlers {
  onResult: (transcript: string) => void;
  onStart?: () => void;
  onError?: (message: string) => void;
}

export interface TranscriptionController {
  supported: boolean;
  health: () => Promise<TranscriptionHealth>;
  start: (handlers: TranscriptionHandlers) => Promise<void>;
  stop: () => void;
}

// Pure, testable: POST an audio blob and return the transcript.
export async function transcribeBlob(blob: Blob, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(`Transcription failed with HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as { text?: string };
  return (payload.text ?? "").trim();
}

export async function checkTranscriptionHealth(fetchImpl: typeof fetch = fetch): Promise<TranscriptionHealth> {
  try {
    const response = await fetchImpl(HEALTH_ENDPOINT, { method: "GET" });
    if (!response.ok) return { available: false };
    const payload = (await response.json()) as { available?: boolean; model?: string };
    return { available: Boolean(payload.available), model: payload.model };
  } catch {
    return { available: false };
  }
}

export function createTranscriptionController(fetchImpl: typeof fetch = fetch): TranscriptionController {
  const hasMedia =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stream: MediaStream | null = null;

  return {
    supported: hasMedia,
    health: () => checkTranscriptionHealth(fetchImpl),
    async start(handlers) {
      if (!hasMedia) {
        handlers.onError?.("Microphone recording is not supported in this browser.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = async () => {
          stream?.getTracks().forEach((track) => track.stop());
          stream = null;
          try {
            const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
            const transcript = await transcribeBlob(blob, fetchImpl);
            if (transcript) handlers.onResult(transcript);
            else handlers.onError?.("No speech detected.");
          } catch (error) {
            handlers.onError?.(error instanceof Error ? error.message : "Transcription failed.");
          }
        };
        recorder.start();
        handlers.onStart?.();
      } catch (error) {
        handlers.onError?.(error instanceof Error ? error.message : "Could not access the microphone.");
      }
    },
    stop() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder = null;
    },
  };
}
