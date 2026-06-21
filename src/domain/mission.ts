// Types for multi-agent missions: one goal decomposed into subtasks across agents
// that run in dependency waves and exchange messages.

import { agents, type AgentId, type RiskLevel } from "./agents";
import type { Intent } from "./router";

export interface MissionSubtask {
  id: string;
  agentId: AgentId;
  intent: Intent;
  objective: string;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  dependsOn: AgentId[];
}

export interface MissionPlan {
  goal: string;
  subtasks: MissionSubtask[];
  approvalRequired: boolean;
}

export type SubtaskStatus = "complete" | "failed";

export interface MissionSubtaskResult {
  subtaskId: string;
  agentId: AgentId;
  status: SubtaskStatus;
  output: string;
  provider: string;
}

export interface MissionMessage {
  from: AgentId | "router";
  to: AgentId | "all";
  summary: string;
  at: string;
}

export interface Mission {
  id: string;
  goal: string;
  createdAt: string;
  approvalRequired: boolean;
  subtasks: MissionSubtask[];
  results: MissionSubtaskResult[];
  messages: MissionMessage[];
  summary: string;
  finalResult: string;
}

const agentNameById = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));

// Full mission transcript as a single Obsidian-friendly Markdown note.
export function renderMissionMarkdown(mission: Mission): string {
  const lines: string[] = [];
  lines.push(`# Mission: ${mission.goal}`, "");
  lines.push(`- Created: ${mission.createdAt}`);
  lines.push(`- Approval required: ${mission.approvalRequired ? "yes" : "no"}`);
  lines.push(`- Agents: ${mission.results.map((result) => agentNameById[result.agentId] ?? result.agentId).join(", ")}`, "");

  lines.push("## Final Result", "", mission.finalResult || mission.summary, "");

  lines.push("## Agent Outputs", "");
  for (const result of mission.results) {
    lines.push(`### ${agentNameById[result.agentId] ?? result.agentId} (${result.provider})`, "", result.output, "");
  }

  lines.push("## Inter-Agent Log", "");
  for (const message of mission.messages) {
    lines.push(`- **${message.from} → ${message.to}** ${message.summary}`);
  }
  lines.push("");

  return lines.join("\n");
}
