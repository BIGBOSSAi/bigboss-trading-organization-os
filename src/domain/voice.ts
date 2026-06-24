// Voice control: a thin, feature-detecting wrapper around the browser Web Speech API
// (SpeechRecognition for commands, speechSynthesis for read-back). The pure helpers
// (command interpretation, markdown-to-speech) are unit-tested; the controller is
// browser-only and degrades to no-ops when the APIs are unavailable.

export interface VoiceCommand {
  action: "mission" | "route" | "approve" | "fill";
  text: string;
}

const missionTriggers = ["run mission", "start mission", "mission", "whole team", "all agents"];
const routeTriggers = ["route command", "route", "ask", "single agent"];
const approveTriggers = ["approve and publish", "approve", "approved", "publish it", "publish this", "ship it", "send it"];

export function interpretVoiceCommand(transcript: string): VoiceCommand {
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // "approve" is a standalone action — no payload text needed.
  if (approveTriggers.some((trigger) => lower === trigger || lower.startsWith(`${trigger} `) || lower.startsWith(`${trigger}.`))) {
    return { action: "approve", text: "" };
  }

  for (const trigger of missionTriggers) {
    if (lower.startsWith(trigger)) return { action: "mission", text: stripTrigger(text, trigger) };
  }
  for (const trigger of routeTriggers) {
    if (lower.startsWith(trigger)) return { action: "route", text: stripTrigger(text, trigger) };
  }
  return { action: "fill", text };
}

function stripTrigger(text: string, trigger: string): string {
  const rest = text
    .slice(trigger.length)
    .replace(/^[\s:,\-]+/, "")
    .replace(/^(to|for|that|please)\s+/i, "")
    .trim();
  return rest || text.trim();
}

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>#]/g, " ")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SpeechHandlers {
  onTranscript: (transcript: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export interface SpeechController {
  sttSupported: boolean;
  ttsSupported: boolean;
  startListening: (handlers: SpeechHandlers) => void;
  stopListening: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
}

interface MinimalRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function createSpeechController(): SpeechController {
  const globalWindow =
    typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : undefined;
  const RecognitionCtor = globalWindow
    ? ((globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition) as
        | (new () => MinimalRecognition)
        | undefined)
    : undefined;
  const synth = globalWindow ? (globalWindow.speechSynthesis as SpeechSynthesis | undefined) : undefined;
  let recognition: MinimalRecognition | null = null;

  return {
    sttSupported: Boolean(RecognitionCtor),
    ttsSupported: Boolean(synth),
    startListening(handlers) {
      if (!RecognitionCtor) {
        handlers.onError?.("Speech recognition is not supported in this browser.");
        return;
      }
      recognition = new RecognitionCtor();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (transcript) handlers.onTranscript(transcript);
      };
      recognition.onerror = (event) => handlers.onError?.(event.error ?? "speech error");
      recognition.onend = () => handlers.onEnd?.();
      recognition.start();
    },
    stopListening() {
      recognition?.stop();
    },
    speak(text) {
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      utterance.lang = "en-US";
      utterance.rate = 1;
      synth.speak(utterance);
    },
    cancelSpeech() {
      synth?.cancel();
    },
  };
}
