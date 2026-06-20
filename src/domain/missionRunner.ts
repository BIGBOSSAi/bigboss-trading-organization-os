// Executes a mission: runs subtasks in dependency waves (parallel within a wave),
// feeds each agent the outputs of the agents it depends on (inter-agent messages),
// and aggregates the result. Generation is injected so it can run against the real
// LLM gateway or a deterministic stub in tests.

import { agents, type AgentId } from "./agents";
import type { Mission, MissionMessage, MissionPlan, MissionSubtask, MissionSubtaskResult } from "./mission";

export interface MissionGenerateResult {
  status: "complete" | "failed";
  text: string;
  provider?: string;
}

export interface RunMissionOptions {
  generate: (request: { prompt: string; system?: string }) => Promise<MissionGenerateResult>;
  now?: () => Date;
  fallback?: (subtask: MissionSubtask) => string;
}

const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

export async function runMission(plan: MissionPlan, options: RunMissionOptions): Promise<Mission> {
  const now = options.now ?? (() => new Date());
  const fallback = options.fallback ?? defaultFallback;
  const createdAt = now().toISOString();

  const planned = new Set(plan.subtasks.map((subtask) => subtask.agentId));
  const results: MissionSubtaskResult[] = [];
  const messages: MissionMessage[] = [];
  const resultByAgent = new Map<AgentId, MissionSubtaskResult>();
  const done = new Set<AgentId>();

  let remaining = [...plan.subtasks];

  while (remaining.length > 0) {
    // A subtask is ready when every dependency it shares with this mission is done.
    let wave = remaining.filter((subtask) =>
      subtask.dependsOn.every((dep) => !planned.has(dep) || done.has(dep)),
    );
    // Break any dependency cycle by forcing progress.
    if (wave.length === 0) wave = remaining;

    const waveResults = await Promise.all(
      wave.map((subtask) => runSubtask(subtask, resultByAgent, options.generate, fallback)),
    );

    for (let index = 0; index < wave.length; index += 1) {
      const subtask = wave[index];
      const result = waveResults[index];
      results.push(result);
      resultByAgent.set(subtask.agentId, result);
      done.add(subtask.agentId);
      messages.push({
        from: subtask.agentId,
        to: "all",
        summary: `${agentById[subtask.agentId].name}: ${snippet(result.output)}`,
        at: now().toISOString(),
      });
    }

    const waveAgents = new Set(wave.map((subtask) => subtask.agentId));
    remaining = remaining.filter((subtask) => !waveAgents.has(subtask.agentId));
  }

  messages.push({
    from: "router",
    to: "all",
    summary: `Synthesized ${results.length} agent result(s) for the goal.`,
    at: now().toISOString(),
  });

  return {
    id: `mission-${createdAt}`,
    goal: plan.goal,
    createdAt,
    approvalRequired: plan.approvalRequired,
    subtasks: plan.subtasks,
    results,
    messages,
    summary: buildSummary(plan, results),
  };
}

async function runSubtask(
  subtask: MissionSubtask,
  resultByAgent: Map<AgentId, MissionSubtaskResult>,
  generate: RunMissionOptions["generate"],
  fallback: (subtask: MissionSubtask) => string,
): Promise<MissionSubtaskResult> {
  const inbox = subtask.dependsOn
    .map((dep) => resultByAgent.get(dep))
    .filter((result): result is MissionSubtaskResult => Boolean(result));

  const context = inbox.length
    ? `\n\nInputs from other agents:\n${inbox.map((result) => `- ${agentById[result.agentId].name}: ${result.output}`).join("\n")}`
    : "";

  const prompt = `${subtask.objective}${context}`;

  try {
    const generated = await generate({ prompt });
    if (generated.status === "complete" && generated.text.trim()) {
      return {
        subtaskId: subtask.id,
        agentId: subtask.agentId,
        status: "complete",
        output: generated.text.trim(),
        provider: generated.provider ?? "llm",
      };
    }
  } catch {
    // fall through to deterministic fallback
  }

  return {
    subtaskId: subtask.id,
    agentId: subtask.agentId,
    status: "complete",
    output: fallback(subtask),
    provider: "fallback",
  };
}

function defaultFallback(subtask: MissionSubtask): string {
  return `${agentById[subtask.agentId].name} draft (offline fallback): ${subtask.objective}`;
}

function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 140 ? `${oneLine.slice(0, 137)}...` : oneLine;
}

function buildSummary(plan: MissionPlan, results: MissionSubtaskResult[]): string {
  const names = results.map((result) => agentById[result.agentId].name).join(", ");
  return `${results.length} agent(s) completed the mission "${plan.goal}": ${names}.`;
}
