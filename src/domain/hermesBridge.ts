import { routeCommand, type RouteResult } from "./router";
import type { AgentId, RiskLevel } from "./agents";

export type ProviderId = "mock" | "ollama-local" | "fcc-backup" | "mimo-local";
export type ProviderStatus = "healthy" | "limited" | "offline" | "not-installed";

export interface ModelProviderHealth {
  id: ProviderId;
  label: string;
  status: ProviderStatus;
  detail: string;
  endpoint?: string;
}

export type ModelProviderProbe = () => Promise<Pick<ModelProviderHealth, "status" | "detail">>;

export interface ProviderStatusReport {
  primary: ModelProviderHealth;
  providers: ModelProviderHealth[];
}

export interface MemoryFolder {
  id: "profile" | "organization" | "tasks" | "evidence" | "skills";
  label: string;
  path: string;
  purpose: string;
}

export type ApprovalStatus = "not-required" | "required";

export interface ApprovalGate {
  status: ApprovalStatus;
  reasons: string[];
}

export interface HermesTaskRecord {
  id: string;
  command: string;
  agentId: AgentId;
  intent: RouteResult["intent"];
  riskLevel: RiskLevel;
  route: RouteResult;
  approval: ApprovalGate;
  providerId: ProviderId;
  createdAt: string;
  memoryTargets: string[];
}

export interface HermesBridgeOptions {
  now?: () => Date;
  probeOllama?: ModelProviderProbe;
}

const defaultMemoryFolders: MemoryFolder[] = [
  {
    id: "profile",
    label: "Profile Memory",
    path: "memory/profile",
    purpose: "Who BIGBoss is, values, preferences, and operating style.",
  },
  {
    id: "organization",
    label: "Organization Memory",
    path: "memory/organization",
    purpose: "AI Trading College, BIGBoss Trader OS, products, offers, and strategy.",
  },
  {
    id: "tasks",
    label: "Task Memory",
    path: "memory/tasks",
    purpose: "Active tasks, decisions, approval records, and follow-ups.",
  },
  {
    id: "evidence",
    label: "Trading Evidence",
    path: "memory/evidence",
    purpose: "Trade reviews, bot tests, backtest evidence, and readiness notes.",
  },
  {
    id: "skills",
    label: "Skill Library",
    path: "memory/skills",
    purpose: "Repeatable workflows for agents and business operations.",
  },
];

const mockProvider: ModelProviderHealth = {
  id: "mock",
  label: "Safe Mock Provider",
  status: "healthy",
  detail: "Always available for routing, task records, and UI testing.",
};

const fccProvider: ModelProviderHealth = {
  id: "fcc-backup",
  label: "FCC Backup Provider",
  status: "limited",
  detail: "Backup only because upstream provider connections can fail.",
  endpoint: "http://127.0.0.1:8082/admin",
};

const mimoProvider: ModelProviderHealth = {
  id: "mimo-local",
  label: "MiMo Local Candidate",
  status: "not-installed",
  detail: "Candidate reasoning model; install only after a local runtime benchmark.",
};

async function defaultOllamaProbe(): Promise<Pick<ModelProviderHealth, "status" | "detail">> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", { method: "GET" });
    if (!response.ok) {
      return { status: "limited", detail: `Ollama responded with HTTP ${response.status}.` };
    }

    const payload = (await response.json()) as { models?: unknown[] };
    const modelCount = Array.isArray(payload.models) ? payload.models.length : 0;
    return {
      status: "healthy",
      detail: modelCount > 0 ? `${modelCount} local model(s) available.` : "Ollama is running with no local models listed.",
    };
  } catch {
    return { status: "offline", detail: "Ollama API is not reachable at http://127.0.0.1:11434." };
  }
}

export function createHermesBridge(options: HermesBridgeOptions = {}) {
  const now = options.now ?? (() => new Date());
  const probeOllama = options.probeOllama ?? defaultOllamaProbe;

  async function checkProviders(): Promise<ProviderStatusReport> {
    const ollamaResult = await probeOllama();
    const ollamaProvider: ModelProviderHealth = {
      id: "ollama-local",
      label: "Local Ollama",
      endpoint: "http://127.0.0.1:11434",
      ...ollamaResult,
    };
    const providers = [mockProvider, ollamaProvider, fccProvider, mimoProvider];
    const primary = ollamaProvider.status === "healthy" ? ollamaProvider : mockProvider;

    return { primary, providers };
  }

  async function createTask(command: string): Promise<HermesTaskRecord> {
    const route = routeCommand(command);
    const providerReport = await checkProviders();
    const approval = buildApprovalGate(route);
    const createdAt = now().toISOString();

    return {
      id: `${route.agent.id}-${createdAt}`,
      command: command.trim(),
      agentId: route.agent.id,
      intent: route.intent,
      riskLevel: route.riskLevel,
      route,
      approval,
      providerId: providerReport.primary.id,
      createdAt,
      memoryTargets: route.memoryTargets,
    };
  }

  return {
    memoryFolders: defaultMemoryFolders,
    checkProviders,
    createTask,
  };
}

function buildApprovalGate(route: RouteResult): ApprovalGate {
  if (!route.approvalRequired) {
    return { status: "not-required", reasons: [] };
  }

  const reasons = ["high-risk trading or publishing workflow"];

  if (route.intent === "bot_research") {
    reasons.push("bot evidence must be reviewed before live-readiness decisions");
  }

  return { status: "required", reasons };
}
