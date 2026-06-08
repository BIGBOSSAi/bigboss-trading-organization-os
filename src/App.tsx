import { FormEvent, useEffect, useMemo, useState } from "react";
import { agents, productVault } from "./domain/agents";
import { createHermesBridge, transitionTask, type HermesTaskRecord, type ProviderStatusReport, type TaskWorkflowAction } from "./domain/hermesBridge";
import { createLocalBrainStore, type LocalMemoryEntry } from "./domain/localBrainStore";
import { routeCommand, type RouteResult } from "./domain/router";

const starterCommands = [
  "Build a liquidity lesson for AI Trading College",
  "Backtest this MT5 bot and tell me if it is live ready",
  "Write a LinkedIn post about central banks moving markets",
];

const hermesBridge = createHermesBridge();
const localBrainStore = typeof window !== "undefined" ? createLocalBrainStore(window.localStorage) : null;

export default function App() {
  const [command, setCommand] = useState(starterCommands[0]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [tasks, setTasks] = useState<HermesTaskRecord[]>(() => localBrainStore?.loadSnapshot().tasks ?? []);
  const [memoryEntries, setMemoryEntries] = useState<LocalMemoryEntry[]>(
    () => localBrainStore?.loadSnapshot().memoryEntries ?? [],
  );
  const [providerReport, setProviderReport] = useState<ProviderStatusReport | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  useEffect(() => {
    let active = true;
    hermesBridge.checkProviders().then((report) => {
      if (active) setProviderReport(report);
    });

    return () => {
      active = false;
    };
  }, []);

  const activeTask = tasks[0];
  const activeRoute = activeTask?.route ?? routes[0] ?? routeCommand(command);
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
      setProviderReport(checkedProviders);
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
      setRoutes((current) => [task.route, ...current].slice(0, 6));
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
              <li key={task.id}>
                {"text" in task ? task.text : `${task.route.agent.name}: ${task.command} (${task.workflow.status})`}
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
