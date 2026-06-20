// Deterministic mission planner: decomposes a goal into specialist subtasks and the
// dependency edges between them (knowledge agents first, packaging agents after).

import { agents, type AgentId, type RiskLevel } from "./agents";
import type { Intent } from "./router";
import type { MissionPlan, MissionSubtask } from "./mission";

const agentKeywords: Record<AgentId, string[]> = {
  forge: ["mt5", "bot", "backtest", "pine", "ea", "strategy tester", "live ready"],
  ledger: ["trade review", "journal", "risk", "discipline", "psychology", "mistake"],
  dean: ["lesson", "curriculum", "college", "quiz", "student", "teach", "liquidity", "course", "module"],
  voice: ["publish", "linkedin", "substack", "youtube", "email", "post", "script", "content"],
  launch: ["offer", "funnel", "sales page", "pricing", "price", "lead magnet", "launch", "product", "$"],
  scout: ["research", "trend", "pain point", "audience", "market"],
};

const agentIntent: Record<AgentId, Intent> = {
  dean: "education",
  ledger: "trade_review",
  forge: "bot_research",
  voice: "content",
  scout: "research",
  launch: "product",
};

// Packaging agents consume the work of the knowledge agents, so they run later.
const packagers: AgentId[] = ["voice", "launch"];

const highRiskKeywords = ["publish", "send", "live ready", "deploy", "price", "financial claim"];

const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

function matchAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => {
    if (/^[a-z0-9]+$/i.test(keyword)) {
      return new RegExp(`\\b${keyword}\\b`, "i").test(text);
    }
    return text.includes(keyword);
  });
}

export function planMission(goal: string): MissionPlan {
  const normalized = goal.trim().toLowerCase();

  let matched = (Object.keys(agentKeywords) as AgentId[]).filter((agentId) =>
    matchAny(normalized, agentKeywords[agentId]),
  );

  // Always have at least one agent; default to Scout running operations.
  const fallback = matched.length === 0;
  if (fallback) matched = ["scout"];

  const producers = matched.filter((agentId) => !packagers.includes(agentId));

  const subtasks: MissionSubtask[] = matched.map((agentId) => {
    const intent: Intent = fallback && agentId === "scout" ? "operations" : agentIntent[agentId];
    const riskLevel = riskFor(agentId, intent, normalized);
    // Packaging agents depend on whichever knowledge agents are also in the mission.
    const dependsOn = packagers.includes(agentId) ? producers : [];

    return {
      id: `sub-${agentId}`,
      agentId,
      intent,
      objective: `${agentById[agentId].mission} Focus specifically on this goal: "${goal.trim()}".`,
      riskLevel,
      approvalRequired: riskLevel === "high",
      dependsOn,
    };
  });

  return {
    goal: goal.trim(),
    subtasks,
    approvalRequired: subtasks.some((subtask) => subtask.approvalRequired),
  };
}

function riskFor(agentId: AgentId, intent: Intent, normalized: string): RiskLevel {
  if (intent === "bot_research") return "high";
  if (packagers.includes(agentId) && matchAny(normalized, highRiskKeywords)) return "high";
  if (intent === "product") return "medium";
  return "low";
}
