import type { ModelDiscoveryResult } from "./localModelClient";

export interface OllamaGuidance {
  title: string;
  summary: string;
  commands: string[];
  nextActions: string[];
}

export function getOllamaGuidance(discovery: ModelDiscoveryResult | null): OllamaGuidance {
  if (!discovery || discovery.status === "offline") {
    return {
      title: "Start Ollama Locally",
      summary: "The dashboard cannot reach Ollama on http://127.0.0.1:11434 yet.",
      commands: ["ollama serve", "Invoke-RestMethod http://127.0.0.1:11434/api/tags"],
      nextActions: [
        "Open a new PowerShell window.",
        "Run `ollama serve` and leave that window open.",
        "Return here and click Refresh Models.",
      ],
    };
  }

  if (discovery.models.length === 0) {
    return {
      title: "Install A Local Model",
      summary: "Ollama is running, but it did not report any installed local models.",
      commands: ["ollama pull qwen3-coder:latest", "ollama list"],
      nextActions: [
        "Pull one coding/reasoning model first.",
        "Use a smaller model if the laptop is slow or low on memory.",
        "Return here and click Refresh Models.",
      ],
    };
  }

  return {
    title: "Local Brain Ready",
    summary: `${discovery.models.length} local model(s) are available for prompt testing.`,
    commands: [],
    nextActions: ["Choose a model.", "Send a short test prompt.", "Use provider-backed generation after this test is reliable."],
  };
}
