import type { AgentOutputDraft } from "./agentOutputs";
import type { HermesTaskRecord } from "./hermesBridge";

export interface TaskSelection {
  activeTask?: HermesTaskRecord;
  activeOutput?: AgentOutputDraft;
}

export function resolveTaskSelection(
  tasks: HermesTaskRecord[],
  outputs: AgentOutputDraft[],
  selectedTaskId?: string,
): TaskSelection {
  const activeTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const activeOutput = outputs.find((output) => output.taskId === activeTask?.id) ?? outputs[0];

  return {
    activeTask,
    activeOutput,
  };
}
