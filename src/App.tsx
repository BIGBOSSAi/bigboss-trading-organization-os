import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatAgentOutputAsMarkdown,
  generateAgentOutput,
  getAgentOutputFilename,
  updateAgentOutputMarkdown,
  type AgentOutputDraft,
} from "./domain/agentOutputs";
import { agents, productVault, type AgentId } from "./domain/agents";
import { createHermesBridge, transitionTask, type HermesTaskRecord, type ProviderStatusReport, type TaskWorkflowAction } from "./domain/hermesBridge";
import { createLocalBrainStore, type LocalMemoryEntry } from "./domain/localBrainStore";
import { createDurableMemoryClient } from "./domain/durableMemoryClient";
import type { DurableMemoryEntry, DurableMemoryStatus } from "./domain/durableMemory";
import { createLocalModelClient, type ModelDiscoveryResult } from "./domain/localModelClient";
import { getOllamaGuidance } from "./domain/ollamaGuidance";
import { enhanceOutputWithProvider } from "./domain/providerGeneration";
import { createLlmClient, type LlmHealthReport } from "./domain/llmClient";
import { planMission } from "./domain/missionPlanner";
import { runMission } from "./domain/missionRunner";
import { renderMissionMarkdown, type Mission } from "./domain/mission";
import { createSpeechController, interpretVoiceCommand, stripMarkdownForSpeech } from "./domain/voice";
import { routeCommand, type RouteResult } from "./domain/router";
import { resolveTaskSelection } from "./domain/taskSelection";

const starterCommands = [
  "Build a liquidity lesson for AI Trading College",
  "Backtest this MT5 bot and tell me if it is live ready",
  "Write a LinkedIn post about central banks moving markets",
];

const hermesBridge = createHermesBridge();
const localModelClient = createLocalModelClient();
const localBrainStore = typeof window !== "undefined" ? createLocalBrainStore(window.localStorage) : null;
const durableMemoryClient = createDurableMemoryClient();
const llmClient = createLlmClient();
const speech = createSpeechController();

function durableToLocalMemoryEntry(entry: DurableMemoryEntry): LocalMemoryEntry {
  return {
    id: entry.id,
    folderId: entry.folderId,
    summary: entry.summary,
    sourceTaskId: entry.sourceTaskId,
    agentId: entry.agentId as AgentId,
    createdAt: entry.createdAt,
  };
}

function mergeMemoryEntries(durable: DurableMemoryEntry[], local: LocalMemoryEntry[]): LocalMemoryEntry[] {
  const seen = new Set<string>();
  const merged: LocalMemoryEntry[] = [];
  for (const entry of [...durable.map(durableToLocalMemoryEntry), ...local]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged.slice(0, 24);
}

function toDurableMemoryEntry(entry: LocalMemoryEntry, title: string, intent: string): DurableMemoryEntry {
  return {
    id: entry.id,
    folderId: entry.folderId,
    title,
    summary: entry.summary,
    agentId: entry.agentId,
    sourceTaskId: entry.sourceTaskId,
    createdAt: entry.createdAt,
    tags: [intent, entry.agentId],
  };
}

export default function App() {
  const [command, setCommand] = useState(starterCommands[0]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [tasks, setTasks] = useState<HermesTaskRecord[]>(() => localBrainStore?.loadSnapshot().tasks ?? []);
  const [memoryEntries, setMemoryEntries] = useState<LocalMemoryEntry[]>(
    () => localBrainStore?.loadSnapshot().memoryEntries ?? [],
  );
  const [outputs, setOutputs] = useState<AgentOutputDraft[]>(() => localBrainStore?.loadSnapshot().outputs ?? []);
  const [durableMemory, setDurableMemory] = useState<DurableMemoryStatus | null>(null);
  const [aiBrain, setAiBrain] = useState<LlmHealthReport | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [isRunningMission, setIsRunningMission] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(speech.ttsSupported);
  const [providerReport, setProviderReport] = useState<ProviderStatusReport | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(() => localBrainStore?.loadSnapshot().tasks[0]?.id);
  const [isEditingOutput, setIsEditingOutput] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [modelDiscovery, setModelDiscovery] = useState<ModelDiscoveryResult | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [brainPrompt, setBrainPrompt] = useState("Explain liquidity in one sentence for a beginner trader.");
  const [brainResponse, setBrainResponse] = useState("");
  const [isTestingBrain, setIsTestingBrain] = useState(false);
  const [commandCopyStatus, setCommandCopyStatus] = useState("");
  const [isEnhancingOutput, setIsEnhancingOutput] = useState(false);

  useEffect(() => {
    let active = true;
    hermesBridge.checkProviders().then((report) => {
      if (active) setProviderReport(report);
    });
    localModelClient.listModels().then((result) => {
      if (!active) return;
      setModelDiscovery(result);
      setSelectedModel(result.models[0] ?? "");
    });
    durableMemoryClient.load().then((result) => {
      if (!active) return;
      setDurableMemory(result.status);
      if (result.entries.length > 0) {
        setMemoryEntries((current) => mergeMemoryEntries(result.entries, current));
      }
    });
    llmClient.health().then((report) => {
      if (active) setAiBrain(report);
    });

    return () => {
      active = false;
    };
  }, []);

  const { activeTask, activeOutput } = resolveTaskSelection(tasks, outputs, selectedTaskId);
  const activeRoute = activeTask?.route ?? routes[0] ?? routeCommand(command);
  const ollamaGuidance = getOllamaGuidance(modelDiscovery);
  const openTasks = useMemo(
    () =>
      activeRoute.nextActions.map((action, index) => ({
        id: `${activeRoute.agent.id}-${index}`,
        text: action,
      })),
    [activeRoute],
  );

  async function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await routeAndCreate(command);
  }

  async function routeAndCreate(rawCommand: string) {
    const trimmed = rawCommand.trim();
    if (!trimmed || isRouting) return;
    setCommand(trimmed);
    setIsRouting(true);

    try {
      const checkedProviders = await hermesBridge.checkProviders();
      const task = await hermesBridge.createTask(trimmed, checkedProviders);
      const memoryEntry = localBrainStore?.createMemoryEntryFromTask(task);
      const output = generateAgentOutput(task);
      setProviderReport(checkedProviders);
      setSelectedTaskId(task.id);
      setTasks((current) => {
        if (current[0]?.command === task.command && current[0]?.agentId === task.agentId) {
          return current;
        }
        const nextTasks = [task, ...current].slice(0, 12);
        localBrainStore?.saveTasks(nextTasks);
        return nextTasks;
      });
      if (memoryEntry) {
        setMemoryEntries((current) => {
          if (current.some((entry) => entry.id === memoryEntry.id)) {
            return current;
          }
          const nextEntries = [memoryEntry, ...current].slice(0, 24);
          localBrainStore?.saveMemoryEntries(nextEntries);
          return nextEntries;
        });
        durableMemoryClient
          .save(toDurableMemoryEntry(memoryEntry, output.title, task.intent))
          .then((status) => setDurableMemory(status));
      }
      setOutputs((current) => {
        if (current.some((draft) => draft.id === output.id)) {
          return current;
        }
        const nextOutputs = [output, ...current].slice(0, 12);
        localBrainStore?.saveOutputs(nextOutputs);
        return nextOutputs;
      });
      setRoutes((current) => [task.route, ...current].slice(0, 6));
      setExportStatus("");
      setIsEditingOutput(false);
      if (task.approval.status === "required") {
        speakIfEnabled(`Approval required for ${task.command}.`);
      } else {
        speakIfEnabled(`${output.title}. ${output.summary}`);
      }
    } finally {
      setIsRouting(false);
    }
  }

  function updateActiveTask(action: Exclude<TaskWorkflowAction, "created" | "blocked">) {
    if (!activeTask) return;
    const updatedTask = transitionTask(activeTask, action);
    setTasks((current) => {
      const nextTasks = current.map((task) => (task.id === updatedTask.id ? updatedTask : task));
      localBrainStore?.saveTasks(nextTasks);
      return nextTasks;
    });
  }

  function startEditingOutput() {
    if (!activeOutput) return;
    setDraftMarkdown(formatAgentOutputAsMarkdown(activeOutput));
    setIsEditingOutput(true);
    setExportStatus("");
  }

  function saveOutputEdits() {
    if (!activeOutput) return;
    const editedOutput = updateAgentOutputMarkdown(activeOutput, draftMarkdown);
    setOutputs((current) => {
      const nextOutputs = current.map((output) => (output.id === editedOutput.id ? editedOutput : output));
      localBrainStore?.saveOutputs(nextOutputs);
      return nextOutputs;
    });
    setIsEditingOutput(false);
    setExportStatus("Saved edited Markdown locally.");
  }

  async function copyActiveOutput() {
    if (!activeOutput) return;
    const markdown = formatAgentOutputAsMarkdown(activeOutput);

    try {
      await navigator.clipboard.writeText(markdown);
      setExportStatus("Copied Markdown to clipboard.");
    } catch {
      setExportStatus("Clipboard was blocked by the browser. Use Download instead.");
    }
  }

  function downloadActiveOutput() {
    if (!activeOutput) return;
    const markdown = formatAgentOutputAsMarkdown(activeOutput);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getAgentOutputFilename(activeOutput);
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus(`Downloaded ${link.download}.`);
  }

  async function refreshLocalModels() {
    const result = await localModelClient.listModels();
    setModelDiscovery(result);
    setSelectedModel((current) => current || result.models[0] || "");
    setBrainResponse(result.detail);
  }

  async function testLocalBrain() {
    const prompt = brainPrompt.trim();
    if (!selectedModel || !prompt || isTestingBrain) return;
    setIsTestingBrain(true);
    setBrainResponse("Thinking locally...");

    try {
      const result = await localModelClient.generate({ model: selectedModel, prompt });
      setBrainResponse(result.response);
    } finally {
      setIsTestingBrain(false);
    }
  }

  async function copyRepairCommand(commandText: string) {
    try {
      await navigator.clipboard.writeText(commandText);
      setCommandCopyStatus(`Copied: ${commandText}`);
    } catch {
      setCommandCopyStatus("Clipboard was blocked by the browser. Select and copy the command manually.");
    }
  }

  async function enhanceActiveOutput() {
    if (!activeTask || !activeOutput || isEnhancingOutput) return;
    if (!aiBrain?.available && !selectedModel) return;
    setIsEnhancingOutput(true);
    setExportStatus("Asking the AI brain to enhance this draft...");
    let usedProvider = "ai-brain";

    try {
      const result = await enhanceOutputWithProvider({
        task: activeTask,
        output: activeOutput,
        model: aiBrain?.primary ?? selectedModel ?? "ai-brain",
        generate: async ({ prompt }) => {
          const generated = await llmClient.generate({ prompt });
          usedProvider = generated.provider;
          return { status: generated.status, response: generated.text };
        },
      });
      if (result.status === "complete") {
        setOutputs((current) => {
          const nextOutputs = current.map((output) => (output.id === result.output.id ? result.output : output));
          localBrainStore?.saveOutputs(nextOutputs);
          return nextOutputs;
        });
        setExportStatus(`Enhanced via ${usedProvider}. Saved locally.`);
      } else {
        setExportStatus(result.message);
      }
    } finally {
      setIsEnhancingOutput(false);
    }
  }

  async function runMissionFromCommand(goalArg?: string) {
    const goal = (goalArg ?? command).trim();
    if (!goal || isRunningMission) return;
    setCommand(goal);
    setIsRunningMission(true);

    try {
      const plan = planMission(goal);
      const result = await runMission(plan, { generate: (request) => llmClient.generate(request) });
      setMission(result);
      // Persist the full transcript (final result + every agent output + the log) to the vault.
      durableMemoryClient
        .save({
          id: result.id,
          folderId: "tasks",
          title: `Mission: ${result.goal}`,
          summary: renderMissionMarkdown(result),
          agentId: result.results[0]?.agentId ?? "scout",
          sourceTaskId: result.id,
          createdAt: result.createdAt,
          tags: ["mission", ...result.results.map((subtaskResult) => subtaskResult.agentId)],
        })
        .then((status) => setDurableMemory(status));
      // Communication-first: the brain speaks the result, or asks for approval.
      if (result.approvalRequired) {
        speakIfEnabled(`Approval required before completing the mission for ${result.goal}. Here is the draft: ${result.finalResult}`);
      } else {
        speakIfEnabled(`Mission complete for ${result.goal}. ${result.finalResult}`);
      }
    } finally {
      setIsRunningMission(false);
    }
  }

  function speakIfEnabled(text: string) {
    if (voiceReplies && speech.ttsSupported && text.trim()) {
      speech.speak(stripMarkdownForSpeech(text));
    }
  }

  function toggleListening() {
    if (!speech.sttSupported) {
      setVoiceStatus("Voice input is not supported in this browser (try Chrome/Edge).");
      return;
    }
    if (isListening) {
      speech.stopListening();
      return;
    }
    setVoiceStatus("Listening... say e.g. 'mission turn this lesson into a funnel'.");
    setIsListening(true);
    speech.startListening({
      onTranscript: (transcript) => {
        const command = interpretVoiceCommand(transcript);
        setCommand(command.text);
        setVoiceStatus(`Heard (${command.action}): "${transcript}"`);
        if (command.action === "mission") void runMissionFromCommand(command.text);
        else if (command.action === "route") void routeAndCreate(command.text);
      },
      onEnd: () => setIsListening(false),
      onError: (message) => {
        setVoiceStatus(`Voice error: ${message}`);
        setIsListening(false);
      },
    });
  }

  function speakActive() {
    const spoken = activeOutput
      ? `${activeOutput.title}. ${stripMarkdownForSpeech(formatAgentOutputAsMarkdown(activeOutput))}`
      : mission?.summary ?? "";
    if (spoken.trim()) speech.speak(stripMarkdownForSpeech(spoken));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BIGBoss Trading Organization OS</p>
          <h1>Agent Workforce Command Center</h1>
        </div>
        <div className="status-pills">
          <div className="status-pill">
            {providerReport ? `Provider: ${providerReport.primary.label}` : "Checking local brain"}
          </div>
          <div className="status-pill">
            {aiBrain ? `AI Brain: ${aiBrain.available ? aiBrain.primary : "offline"}` : "Checking AI brain"}
          </div>
        </div>
      </header>

      <section className="command-grid">
        <form className="command-panel" onSubmit={submitCommand}>
          <label htmlFor="command">Command the brain</label>
          <textarea
            id="command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            rows={5}
          />
          <div className="command-actions">
            <button type="submit" disabled={isRouting || !command.trim()}>
              {isRouting ? "Routing..." : "Route Command"}
            </button>
            <select value={command} onChange={(event) => setCommand(event.target.value)}>
              {starterCommands.map((starter) => (
                <option key={starter} value={starter}>
                  {starter}
                </option>
              ))}
            </select>
          </div>
          <div className="voice-row">
            <button
              type="button"
              className={isListening ? "voice-button listening" : "voice-button"}
              onClick={toggleListening}
            >
              {isListening ? "🎤 Listening… (tap to stop)" : "🎤 Speak a command"}
            </button>
            <label className="voice-toggle">
              <input
                type="checkbox"
                checked={voiceReplies}
                onChange={(event) => setVoiceReplies(event.target.checked)}
                disabled={!speech.ttsSupported}
              />
              Voice replies
            </label>
            {voiceStatus ? <span className="voice-status">{voiceStatus}</span> : null}
          </div>
        </form>

        <section className="route-panel">
          <p className="panel-label">Brain Router</p>
          <h2>{activeRoute.agent.name}</h2>
          <p>{activeRoute.summary}</p>
          <div className="route-meta">
            <span>{activeRoute.intent.replace("_", " ")}</span>
            <span className={`risk-${activeRoute.riskLevel}`}>{activeRoute.riskLevel} risk</span>
            <span>{activeRoute.approvalRequired ? "Approval required" : "No approval gate"}</span>
            {activeTask ? <span>{activeTask.providerId.replace("-", " ")}</span> : null}
          </div>
        </section>
      </section>

      <section className="bridge-grid">
        <section className="panel">
          <p className="panel-label">HermesBridge Providers</p>
          <div className="provider-list">
            {(providerReport?.providers ?? []).map((provider) => (
              <article className="provider-row" key={provider.id}>
                <div>
                  <h3>{provider.label}</h3>
                  <p>{provider.detail}</p>
                </div>
                <span className={`provider-status status-${provider.status}`}>{provider.status}</span>
              </article>
            ))}
            {!providerReport ? <p>Checking Ollama, backup routes, and local candidates...</p> : null}
          </div>
        </section>

        <section className="panel">
          <p className="panel-label">Task Detail</p>
          <h2>{activeTask ? activeTask.workflow.status.replace("-", " ") : "Clear For Drafting"}</h2>
          <p>{activeTask ? activeTask.command : "No active task yet."}</p>
          <div className="workflow-actions">
            <button type="button" onClick={() => updateActiveTask("approve")} disabled={!activeTask || activeTask.workflow.status !== "needs-approval"}>
              Approve
            </button>
            <button type="button" onClick={() => updateActiveTask("reject")} disabled={!activeTask || activeTask.workflow.status === "completed"}>
              Reject
            </button>
            <button
              type="button"
              onClick={() => updateActiveTask("complete")}
              disabled={!activeTask || activeTask.workflow.status === "needs-approval" || activeTask.workflow.status === "rejected" || activeTask.workflow.status === "completed"}
            >
              Complete
            </button>
          </div>
          <ul className="task-list">
            {(activeTask?.workflow.history ?? [{ action: "created", note: "No high-risk action requested.", at: "", status: "drafted" }]).slice(-3).map(
              (event) => (
                <li key={`${event.action}-${event.at}`}>
                  <strong>{event.action}</strong> {event.note}
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="panel">
          <p className="panel-label">Shared Memory</p>
          <h2>{memoryEntries.length} Saved</h2>
          <p>
            {durableMemory?.available
              ? `Durable on disk: ${durableMemory.root ?? "memory store"}.`
              : durableMemory
                ? `${durableMemory.detail} Browser-only fallback in use.`
                : "Checking durable memory store..."}
          </p>
        </section>
      </section>

      <section className="workspace-grid">
        <section className="panel mission-panel">
          <div className="workspace-heading">
            <div>
              <p className="panel-label">Multi-Agent Mission</p>
              <h2>{mission ? mission.goal : "No mission yet"}</h2>
              <p>{mission ? mission.summary : "Decompose one goal across multiple agents running in parallel."}</p>
            </div>
            <button type="button" onClick={() => runMissionFromCommand()} disabled={isRunningMission || !command.trim()}>
              {isRunningMission ? "Running mission..." : "Run Mission From Command"}
            </button>
          </div>
          {mission ? (
            <>
              {mission.approvalRequired ? (
                <p className="export-status">Approval required before any high-risk action in this mission.</p>
              ) : null}
              {mission.finalResult ? (
                <div className="mission-final">
                  <div className="workspace-heading">
                    <p className="panel-label">Final Result (brain-synthesized)</p>
                    <button
                      type="button"
                      onClick={() => speech.speak(stripMarkdownForSpeech(mission.finalResult))}
                      disabled={!speech.ttsSupported}
                    >
                      🔊 Read final result
                    </button>
                  </div>
                  <p>{mission.finalResult}</p>
                </div>
              ) : null}
              <div className="mission-lanes">
                {mission.results.map((result) => (
                  <article className="mission-lane" key={result.subtaskId}>
                    <h3>
                      {agents.find((agent) => agent.id === result.agentId)?.name ?? result.agentId}
                      <span className="status-pill">{result.provider}</span>
                    </h3>
                    <p>{result.output}</p>
                  </article>
                ))}
              </div>
              <div className="mission-log">
                <p className="panel-label">Inter-Agent Log</p>
                <ul className="task-list">
                  {mission.messages.map((message, index) => (
                    <li key={`${message.from}-${index}`}>
                      <strong>
                        {message.from} → {message.to}
                      </strong>{" "}
                      {message.summary}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </section>
      </section>

      <section className="workspace-grid">
        <section className="panel output-workspace">
          <p className="panel-label">Agent Output Workspace</p>
          {activeOutput ? (
            <>
              <div className="workspace-heading">
                <div>
                  <h2>{activeOutput.title}</h2>
                  <p>{activeOutput.summary}</p>
                </div>
                <div className="workspace-actions">
                  <span className="status-pill">{activeOutput.agentId}</span>
                  <button type="button" onClick={copyActiveOutput}>
                    Copy Markdown
                  </button>
                  <button type="button" onClick={downloadActiveOutput}>
                    Download .md
                  </button>
                  <button type="button" onClick={speakActive} disabled={!speech.ttsSupported}>
                    🔊 Read aloud
                  </button>
                  {isEditingOutput ? (
                    <button type="button" onClick={() => setIsEditingOutput(false)}>
                      Preview
                    </button>
                  ) : (
                    <button type="button" onClick={startEditingOutput}>
                      Edit Draft
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={enhanceActiveOutput}
                    disabled={isEnhancingOutput || (!aiBrain?.available && !selectedModel)}
                  >
                    {isEnhancingOutput ? "Enhancing..." : "Enhance With AI Brain"}
                  </button>
                </div>
              </div>
              {isEditingOutput ? (
                <div className="editor-panel">
                  <textarea
                    aria-label="Edit output Markdown"
                    value={draftMarkdown}
                    onChange={(event) => setDraftMarkdown(event.target.value)}
                    rows={14}
                  />
                  <button type="button" onClick={saveOutputEdits}>
                    Save Edits
                  </button>
                </div>
              ) : (
                <>
                  <div className="output-sections">
                    {activeOutput.sections.map((section) => (
                      <article className="output-section" key={section.heading}>
                        <h3>{section.heading}</h3>
                        <ul>
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                  <div className="guardrail-strip">
                    {activeOutput.guardrails.map((guardrail) => (
                      <span key={guardrail}>{guardrail}</span>
                    ))}
                    {activeOutput.editedMarkdown ? <span>Edited version saved locally.</span> : null}
                  </div>
                </>
              )}
              {exportStatus ? <p className="export-status">{exportStatus}</p> : null}
            </>
          ) : (
            <p>Route a command to generate the first structured agent draft.</p>
          )}
        </section>
      </section>

      <section className="workspace-grid">
        <section className="panel local-brain-panel">
          <p className="panel-label">Local Brain Test</p>
          <div className="workspace-heading">
            <div>
              <h2>{modelDiscovery?.status === "healthy" ? "Ollama Ready" : "Ollama Offline"}</h2>
              <p>{modelDiscovery?.detail ?? "Checking local model runtime..."}</p>
            </div>
            <button type="button" onClick={refreshLocalModels}>
              Refresh Models
            </button>
          </div>
          <div className="brain-test-grid">
            <label>
              Model
              <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                {modelDiscovery?.models.length ? (
                  modelDiscovery.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))
                ) : (
                  <option value="">No local model found</option>
                )}
              </select>
            </label>
            <label>
              Test prompt
              <textarea value={brainPrompt} onChange={(event) => setBrainPrompt(event.target.value)} rows={4} />
            </label>
            <button type="button" onClick={testLocalBrain} disabled={!selectedModel || !brainPrompt.trim() || isTestingBrain}>
              {isTestingBrain ? "Thinking..." : "Ask Local Brain"}
            </button>
          </div>
          {brainResponse ? <pre className="brain-response">{brainResponse}</pre> : null}
          <div className="guidance-panel">
            <div>
              <h3>{ollamaGuidance.title}</h3>
              <p>{ollamaGuidance.summary}</p>
            </div>
            {ollamaGuidance.commands.length ? (
              <div className="command-snippets">
                {ollamaGuidance.commands.map((commandText) => (
                  <div className="command-snippet-row" key={commandText}>
                    <code>{commandText}</code>
                    <button type="button" onClick={() => copyRepairCommand(commandText)}>
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <ul>
              {ollamaGuidance.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
            {commandCopyStatus ? <p className="export-status">{commandCopyStatus}</p> : null}
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <p className="panel-label">Agent roster</p>
          <div className="agent-list">
            {agents.map((agent) => (
              <article className={agent.id === activeRoute.agent.id ? "agent-card active" : "agent-card"} key={agent.id}>
                <h3>{agent.name}</h3>
                <p>{agent.title}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="panel-label">Task queue</p>
          <ul className="task-list">
            {(activeTask ? tasks : openTasks).map((task) => (
              <li className={"text" in task ? undefined : task.id === activeTask?.id ? "selected-task" : undefined} key={task.id}>
                {"text" in task ? (
                  task.text
                ) : (
                  <button className="task-select-button" type="button" onClick={() => setSelectedTaskId(task.id)}>
                    <span>{task.route.agent.name}: {task.command}</span>
                    <strong>{task.workflow.status}</strong>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <p className="panel-label">Shared memory folders</p>
          <ul className="memory-list">
            {memoryEntries.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.folderId}</strong>
                <span>{entry.summary}</span>
              </li>
            ))}
            {memoryEntries.length === 0 ? hermesBridge.memoryFolders.map((folder) => (
              <li key={folder.id}>
                <strong>{folder.label}</strong>
                <span>{folder.path}</span>
              </li>
            )) : null}
          </ul>
        </section>

        <section className="panel">
          <p className="panel-label">Product vault</p>
          <ul className="vault-list">
            {productVault.map((product) => (
              <li key={product}>{product}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
