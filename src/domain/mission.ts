// Types for multi-agent missions: one goal decomposed into subtasks across agents
// that run in dependency waves and exchange messages.

import type { AgentId, RiskLevel } from "./agents";
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
}
