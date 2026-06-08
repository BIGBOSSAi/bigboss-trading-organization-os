import { FormEvent, useEffect, useMemo, useState } from "react";
import { agents, productVault } from "./domain/agents";
import { createHermesBridge, type HermesTaskRecord, type ProviderStatusReport } from "./domain/hermesBridge";
import { routeCommand, type RouteResult } from "./domain/router";

const starterCommands = [
  "Build a liquidity lesson for AI Trading College",
  "Backtest this MT5 bot and tell me if it is live ready",
  "Write a LinkedIn post about central banks moving markets",
];

const hermesBridge = createHermesBridge();

export default function App() {
  const [command, setCommand] = useState(starterCommands[0]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [tasks, setTasks] = useState<HermesTaskRecord[]>([]);
  const [providerReport, setProviderReport] = useState<ProviderStatusReport | null>(null);

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
    if (!trimmed) return;
    const task = await hermesBridge.createTask(trimmed);
    setTasks((current) => [task, ...current].slice(0, 6));
    setRoutes((current) => [task.route, ...current].slice(0, 6));
    setProviderReport(await hermesBridge.checkProviders());
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
            <button type="submit">Route Command</button>
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
          <p className="panel-label">Approval Gate</p>
          <h2>{activeTask?.approval.status === "required" ? "Review Required" : "Clear For Drafting"}</h2>
          <ul className="task-list">
            {(activeTask?.approval.reasons.length ? activeTask.approval.reasons : ["No high-risk action requested."]).map(
              (reason) => (
                <li key={reason}>{reason}</li>
              ),
            )}
          </ul>
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
                {"text" in task ? task.text : `${task.route.agent.name}: ${task.command}`}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <p className="panel-label">Shared memory folders</p>
          <ul className="memory-list">
            {hermesBridge.memoryFolders.map((folder) => (
              <li key={folder.id}>
                <strong>{folder.label}</strong>
                <span>{folder.path}</span>
              </li>
            ))}
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
