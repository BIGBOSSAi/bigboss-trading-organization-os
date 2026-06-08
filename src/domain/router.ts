import { agents, type Agent, type RiskLevel } from "./agents";

export type Intent =
  | "education"
  | "trade_review"
  | "bot_research"
  | "content"
  | "research"
  | "product"
  | "operations";

export interface RouteResult {
  agent: Agent;
  intent: Intent;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  summary: string;
  nextActions: string[];
  memoryTargets: string[];
}

const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent])) as Record<string, Agent>;

const matchAny = (command: string, keywords: string[]) =>
  keywords.some((keyword) => {
    if (/^[a-z0-9]+$/i.test(keyword)) {
      return new RegExp(`\\b${keyword}\\b`, "i").test(command);
    }

    return command.includes(keyword);
  });

export function routeCommand(rawCommand: string): RouteResult {
  const command = rawCommand.trim().toLowerCase();

  if (matchAny(command, ["mt5", "bot", "backtest", "pine", "ea", "live ready", "strategy tester"])) {
    return buildResult("forge", "bot_research", command);
  }

  if (matchAny(command, ["trade review", "journal", "risk", "discipline", "psychology", "mistake"])) {
    return buildResult("ledger", "trade_review", command);
  }

  if (matchAny(command, ["lesson", "curriculum", "college", "quiz", "student", "teach"])) {
    return buildResult("dean", "education", command);
  }

  if (matchAny(command, ["publish", "linkedin", "substack", "youtube", "email", "post", "script"])) {
    return buildResult("voice", "content", command);
  }

  if (matchAny(command, ["offer", "funnel", "sales page", "pricing", "lead magnet", "launch"])) {
    return buildResult("launch", "product", command);
  }

  if (matchAny(command, ["research", "trend", "pain point", "audience", "market"])) {
    return buildResult("scout", "research", command);
  }

  return buildResult("scout", "operations", command);
}

function buildResult(agentId: string, intent: Intent, command: string): RouteResult {
  const highRisk =
    matchAny(command, ["publish", "send", "live ready", "deploy", "price", "financial claim"]) ||
    intent === "bot_research";

  return {
    agent: agentById[agentId],
    intent,
    riskLevel: highRisk ? "high" : intent === "product" ? "medium" : "low",
    approvalRequired: highRisk,
    summary: `${agentById[agentId].name} will handle this ${intent.replace("_", " ")} command.`,
    nextActions: [
      "Clarify missing inputs if needed",
      "Create a structured first draft",
      "Save useful decisions into shared memory",
    ],
    memoryTargets: ["Decision log", "Task queue", intent === "bot_research" ? "Bot evidence" : "Product memory"],
  };
}
