import { formatAgentOutputAsMarkdown, updateAgentOutputMarkdown, type AgentOutputDraft } from "./agentOutputs";
import type { HermesTaskRecord } from "./hermesBridge";
import type { GenerateRequest, GenerateResult } from "./localModelClient";

export interface ProviderEnhancementRequest {
  task: HermesTaskRecord;
  output: AgentOutputDraft;
  model: string;
  generate: (request: GenerateRequest) => Promise<GenerateResult>;
}

export interface ProviderEnhancementResult {
  status: GenerateResult["status"];
  output: AgentOutputDraft;
  message: string;
}

export async function enhanceOutputWithProvider(request: ProviderEnhancementRequest): Promise<ProviderEnhancementResult> {
  const prompt = buildProviderPrompt(request.task, request.output);
  const result = await request.generate({
    model: request.model,
    prompt,
  });

  if (result.status !== "complete") {
    return {
      status: "failed",
      output: request.output,
      message: result.response,
    };
  }

  return {
    status: "complete",
    output: updateAgentOutputMarkdown(request.output, result.response),
    message: "Enhanced draft saved locally.",
  };
}

function buildProviderPrompt(task: HermesTaskRecord, output: AgentOutputDraft): string {
  return [
    "You are enhancing a BIGBoss Trading Organization OS draft.",
    "",
    `Agent: ${task.agentId}`,
    `Intent: ${task.intent}`,
    `Risk: ${task.riskLevel}`,
    `Approval required: ${task.approval.status === "required" ? "yes" : "no"}`,
    `Task command: ${task.command}`,
    "",
    "Guardrails:",
    "- Preserve the user's trading education business focus.",
    "- Do not add live trading instructions, order execution steps, or financial promises.",
    "- Keep human approval requirements explicit for publishing, bot readiness, pricing, and high-risk claims.",
    ...output.guardrails.map((guardrail) => `- ${guardrail}`),
    "",
    "Improve the draft below into clean Markdown. Return only the improved Markdown.",
    "",
    formatAgentOutputAsMarkdown(output),
  ].join("\n");
}
