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

export type TaskWorkflowStatus = "drafted" | "needs-approval" | "approved" | "rejected" | "completed";
export type TaskWorkflowAction = "created" | "approve" | "reject" | "complete" | "blocked";

export interface TaskWorkflowEvent {
  action: TaskWorkflowAction;
  status: TaskWorkflowStatus;
  at: string;
  note: string;
}

export interface TaskWorkflow {
  status: TaskWorkflowStatus;
  history: TaskWorkflowEvent[];
}

export interface HermesTaskRecord {
  id: string;
  command: string;
  agentId: AgentId;
  intent: RouteResult["intent"];
  riskLevel: RiskLevel;
  route: RouteResult;
  approval: ApprovalGate;
  workflow: TaskWorkflow;
  providerId: ProviderId;
  createdAt: string;
  memoryTargets: string[];
}

export interface HermesBridgeOptions {
  now?: () => Date;
  probeOllama?: ModelProviderProbe;
  providerTimeoutMs?: number;
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
  const providerTimeoutMs = options.providerTimeoutMs ?? 1200;

  async function checkProviders(): Promise<ProviderStatusReport> {
    const ollamaResult = await probeWithTimeout(probeOllama, providerTimeoutMs);
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

  async function createTask(command: string, checkedProviders?: ProviderStatusReport): Promise<HermesTaskRecord> {
    const route = routeCommand(command);
    const providerReport = checkedProviders ?? (await checkProviders());
    const approval = buildApprovalGate(route);
    const createdAt = now().toISOString();
    const workflow = buildInitialWorkflow(approval, createdAt);

    return {
      id: `${route.agent.id}-${createdAt}`,
      command: command.trim(),
      agentId: route.agent.id,
      intent: route.intent,
      riskLevel: route.riskLevel,
      route,
      approval,
      workflow,
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

export function transitionTask(task: HermesTaskRecord, action: Exclude<TaskWorkflowAction, "created" | "blocked">, at = new Date()): HermesTaskRecord {
  const timestamp = at.toISOString();
  const currentStatus = task.workflow.status;

  if (action === "approve") {
    if (currentStatus !== "needs-approval") {
      return appendWorkflowEvent(task, "blocked", currentStatus, timestamp, "Only tasks waiting for approval can be approved.");
    }

    return appendWorkflowEvent(task, "approve", "approved", timestamp, "Human approved this task to proceed.");
  }

  if (action === "reject") {
    if (currentStatus === "completed") {
      return appendWorkflowEvent(task, "blocked", currentStatus, timestamp, "Completed tasks cannot be rejected.");
    }

    return appendWorkflowEvent(task, "reject", "rejected", timestamp, "Human rejected this task.");
  }

  if (action === "complete") {
    if (currentStatus === "needs-approval") {
      return appendWorkflowEvent(task, "blocked", currentStatus, timestamp, "Approval is required before this task can be completed.");
    }

    if (currentStatus === "rejected") {
      return appendWorkflowEvent(task, "blocked", currentStatus, timestamp, "Rejected tasks cannot be completed.");
    }

    return appendWorkflowEvent(task, "complete", "completed", timestamp, "Task marked complete.");
  }

  return task;
}

function buildInitialWorkflow(approval: ApprovalGate, createdAt: string): TaskWorkflow {
  const status: TaskWorkflowStatus = approval.status === "required" ? "needs-approval" : "drafted";

  return {
    status,
    history: [
      {
        action: "created",
        status,
        at: createdAt,
        note: approval.status === "required" ? "Task created with human approval required." : "Task created and ready for drafting.",
      },
    ],
  };
}

function appendWorkflowEvent(
  task: HermesTaskRecord,
  action: TaskWorkflowAction,
  status: TaskWorkflowStatus,
  at: string,
  note: string,
): HermesTaskRecord {
  return {
    ...task,
    workflow: {
      status,
      history: [...task.workflow.history, { action, status, at, note }],
    },
  };
}

async function probeWithTimeout(
  probe: ModelProviderProbe,
  timeoutMs: number,
): Promise<Pick<ModelProviderHealth, "status" | "detail">> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      probe(),
      new Promise<Pick<ModelProviderHealth, "status" | "detail">>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            status: "offline",
            detail: `Ollama provider check timed out after ${timeoutMs}ms.`,
          });
        }, timeoutMs);
      }),
    ]);
  } catch {
    return {
      status: "offline",
      detail: "Ollama provider check failed before a usable response was returned.",
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
