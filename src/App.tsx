import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatAgentOutputAsMarkdown,
  generateAgentOutput,
  getAgentOutputFilename,
  updateAgentOutputMarkdown,
  type AgentOutputDraft,
} from "./domain/agentOutputs";
import { agents, productVault } from "./domain/agents";
import { createHermesBridge, transitionTask, type HermesTaskRecord, type ProviderStatusReport, type TaskWorkflowAction } from "./domain/hermesBridge";
import { createLocalBrainStore, type LocalMemoryEntry } from "./domain/localBrainStore";
import { createLocalModelClient, type ModelDiscoveryResult } from "./domain/localModelClient";
import { getOllamaGuidance } from "./domain/ollamaGuidance";
import { enhanceOutputWithProvider } from "./domain/providerGeneration";
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

export default function App() {
  const [command, setCommand] = useState(starterCommands[0]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [tasks, setTasks] = useState<HermesTaskRecord[]>(() => localBrainStore?.loadSnapshot().tasks ?? []);
  const [memoryEntries, setMemoryEntries] = useState<LocalMemoryEntry[]>(
    () => localBrainStore?.loadSnapshot().memoryEntries ?? [],
  );
  const [outputs, setOutputs] = useState<AgentOutputDraft[]>(() => localBrainStore?.loadSnapshot().outputs ?? []);
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
    const trimmed = command.trim();
    if (!trimmed || isRouting) return;
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
    if (!activeTask || !activeOutput || !selectedModel || isEnhancingOutput) return;
    setIsEnhancingOutput(true);
    setExportStatus("Asking local brain to enhance this draft...");

    try {
      const result = await enhanceOutputWithProvider({
        task: activeTask,
        output: activeOutput,
        model: selectedModel,
        generate: localModelClient.generate,
      });
      if (result.status === "complete") {
        setOutputs((current) => {
          const nextOutputs = current.map((output) => (output.id === result.output.id ? result.output : output));
          localBrainStore?.saveOutputs(nextOutputs);
          return nextOutputs;
        });
      }
      setExportStatus(result.message);
    } finally {
      setIsEnhancingOutput(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BIGBoss Trading Organization OS</p>
          <h1>Agent Workforce Command Center</h1>
        </div>
        <div className="status-pill">
          {providerReport ? `Provider: ${providerReport.primary.label}` : "Checking local brain"}
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
          <p className="panel-label">Local Memory</p>
          <h2>{memoryEntries.length} Saved</h2>
          <p>Task records and memory entries are stored in this browser only.</p>
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
                  {isEditingOutput ? (
                    <button type="button" onClick={() => setIsEditingOutput(false)}>
                      Preview
                    </button>
                  ) : (
                    <button type="button" onClick={startEditingOutput}>
                      Edit Draft
                    </button>
                  )}
                  <button type="button" onClick={enhanceActiveOutput} disabled={!selectedModel || isEnhancingOutput}>
                    {isEnhancingOutput ? "Enhancing..." : "Enhance With Local Brain"}
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
