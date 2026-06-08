# Operator Cockpit V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working BIGBoss Trading Organization OS operator cockpit with deterministic agent routing, task creation, memory preview, product vault, and approval gates.

**Architecture:** Use a local-first React app with a small typed domain layer. Keep the Brain Router deterministic for V1 so it is fast, testable, and safe before any external AI/API integrations are added.

**Tech Stack:** Vite, React, TypeScript, Vitest, CSS modules or plain CSS, local browser state only.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `index.html`: Vite entry document.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: TypeScript and Vite configuration.
- Create `src/main.tsx`: React entry.
- Create `src/App.tsx`: cockpit shell and state orchestration.
- Create `src/styles.css`: dark command-center visual system.
- Create `src/domain/agents.ts`: agent roster, approval rules, memory categories, and product vault seed data.
- Create `src/domain/router.ts`: deterministic command classifier and routing logic.
- Create `src/domain/router.test.ts`: router and approval-gate tests.
- Modify `PROJECT_MAP.md`: record selected stack and commands.
- Modify `TASKS.md`: mark scaffold/first cockpit work.
- Modify `CHANGELOG.md`: record build work.

## Security And Reliability Rules

- No API keys in source code.
- No live trading or order execution.
- No external publish/send actions in V1.
- All high-risk outputs must show an approval gate.
- Deterministic router tests must pass before claiming the cockpit works.
- Commit after each working checkpoint.

### Task 1: Scaffold Local React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Add package configuration**

Create `package.json`:

```json
{
  "name": "bigboss-trading-organization-os",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "test": "vitest run",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2"
  }
}
```

- [ ] **Step 2: Add Vite entry files**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BIGBoss Trading Organization OS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Add TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Add a minimal App**

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">BIGBoss Trading Organization OS</p>
        <h1>Agent Workforce Command Center</h1>
        <p>
          The first working cockpit will route founder commands to specialist
          trading, education, content, product, and bot-research agents.
        </p>
      </section>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #f7f4ea;
  background: #090909;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #090909;
}

button,
textarea,
input {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
  background:
    linear-gradient(135deg, rgba(212, 175, 55, 0.12), transparent 35%),
    #090909;
}

.hero-panel {
  max-width: 760px;
  border: 1px solid rgba(212, 175, 55, 0.26);
  background: rgba(20, 20, 20, 0.9);
  border-radius: 8px;
  padding: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #d4af37;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: 38px;
  line-height: 1.05;
}

p {
  color: #c7c1ad;
  line-height: 1.6;
}
```

- [ ] **Step 5: Install dependencies and verify scaffold**

Run:

```powershell
npm install
npm run build
```

Expected: dependencies install and `npm run build` exits with code `0`.

- [ ] **Step 6: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/App.tsx src/styles.css
git commit -m "Scaffold operator cockpit app"
git push
```

Expected: commit and push succeed.

### Task 2: Add Deterministic Brain Router

**Files:**
- Create: `src/domain/agents.ts`
- Create: `src/domain/router.ts`
- Create: `src/domain/router.test.ts`

- [ ] **Step 1: Add failing router tests**

Create `src/domain/router.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { routeCommand } from "./router";

describe("routeCommand", () => {
  it("routes curriculum requests to Dean", () => {
    const result = routeCommand("Build a liquidity lesson for AI Trading College");
    expect(result.agent.id).toBe("dean");
    expect(result.intent).toBe("education");
    expect(result.approvalRequired).toBe(false);
  });

  it("routes MT5 bot research to Forge with a trading safety gate", () => {
    const result = routeCommand("Backtest this MT5 bot and tell me if it is live ready");
    expect(result.agent.id).toBe("forge");
    expect(result.intent).toBe("bot_research");
    expect(result.approvalRequired).toBe(true);
    expect(result.riskLevel).toBe("high");
  });

  it("routes publishing requests to Voice with an approval gate", () => {
    const result = routeCommand("Write and publish a LinkedIn post about central banks");
    expect(result.agent.id).toBe("voice");
    expect(result.intent).toBe("content");
    expect(result.approvalRequired).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/domain/router.test.ts
```

Expected: FAIL because `src/domain/router.ts` does not exist yet.

- [ ] **Step 3: Add agent roster and seed data**

Create `src/domain/agents.ts`:

```ts
export type AgentId = "dean" | "ledger" | "forge" | "voice" | "scout" | "launch";

export type RiskLevel = "low" | "medium" | "high";

export interface Agent {
  id: AgentId;
  name: string;
  title: string;
  mission: string;
  responsibilities: string[];
}

export const agents: Agent[] = [
  {
    id: "dean",
    name: "Dean",
    title: "AI Trading College",
    mission: "Build lessons, curriculum paths, quizzes, and student explanations.",
    responsibilities: ["Lessons", "Curriculum", "Quizzes", "Student explanations"],
  },
  {
    id: "ledger",
    name: "Ledger",
    title: "Trade Review",
    mission: "Review trades, journal behavior, risk, psychology, and readiness.",
    responsibilities: ["Trade journals", "Risk behavior", "Psychology", "Readiness gates"],
  },
  {
    id: "forge",
    name: "Forge",
    title: "Bot Research",
    mission: "Plan MT5 validation, Pine-to-MT5 diagnosis, backtests, and bot comparisons.",
    responsibilities: ["MT5 bots", "Backtests", "Pine conversions", "Evidence summaries"],
  },
  {
    id: "voice",
    name: "Voice",
    title: "Brand Content",
    mission: "Create brand voice content for LinkedIn, Substack, YouTube, email, and communities.",
    responsibilities: ["LinkedIn", "Substack", "YouTube scripts", "Emails"],
  },
  {
    id: "scout",
    name: "Scout",
    title: "Market Research",
    mission: "Find audience pain points, trends, research angles, and product opportunities.",
    responsibilities: ["Pain points", "Trends", "Audience questions", "Offer angles"],
  },
  {
    id: "launch",
    name: "Launch",
    title: "Product Engine",
    mission: "Build offers, funnels, pricing, sales pages, and launch plans.",
    responsibilities: ["Offers", "Funnels", "Pricing", "Lead magnets"],
  },
];

export const productVault = [
  "AI Trading College",
  "BIGBoss Trader OS",
  "Market Structure Lessons",
  "Trade Review System",
  "MT5 Bot Research Lab",
  "Content and Launch Engine",
];
```

- [ ] **Step 4: Add deterministic router implementation**

Create `src/domain/router.ts`:

```ts
import { agents, type Agent, type RiskLevel } from "./agents";

export type Intent =
  | "education"
  | "trade_review"
  | "bot_research"
  | "content"
  | "research"
  | "product"
  | "operations";

export interface RouteResult {
  agent: Agent;
  intent: Intent;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  summary: string;
  nextActions: string[];
  memoryTargets: string[];
}

const agentById = Object.fromEntries(agents.map((agent) => [agent.id, agent])) as Record<string, Agent>;

const matchAny = (command: string, keywords: string[]) =>
  keywords.some((keyword) => command.includes(keyword));

export function routeCommand(rawCommand: string): RouteResult {
  const command = rawCommand.trim().toLowerCase();

  if (matchAny(command, ["mt5", "bot", "backtest", "pine", "ea", "live ready", "strategy tester"])) {
    return buildResult("forge", "bot_research", command);
  }

  if (matchAny(command, ["trade review", "journal", "risk", "discipline", "psychology", "mistake"])) {
    return buildResult("ledger", "trade_review", command);
  }

  if (matchAny(command, ["lesson", "curriculum", "college", "quiz", "student", "teach"])) {
    return buildResult("dean", "education", command);
  }

  if (matchAny(command, ["publish", "linkedin", "substack", "youtube", "email", "post", "script"])) {
    return buildResult("voice", "content", command);
  }

  if (matchAny(command, ["offer", "funnel", "sales page", "pricing", "lead magnet", "launch"])) {
    return buildResult("launch", "product", command);
  }

  if (matchAny(command, ["research", "trend", "pain point", "audience", "market"])) {
    return buildResult("scout", "research", command);
  }

  return buildResult("scout", "operations", command);
}

function buildResult(agentId: string, intent: Intent, command: string): RouteResult {
  const highRisk =
    matchAny(command, ["publish", "send", "live ready", "deploy", "price", "financial claim"]) ||
    intent === "bot_research";

  return {
    agent: agentById[agentId],
    intent,
    riskLevel: highRisk ? "high" : intent === "product" ? "medium" : "low",
    approvalRequired: highRisk,
    summary: `${agentById[agentId].name} will handle this ${intent.replace("_", " ")} command.`,
    nextActions: [
      "Clarify missing inputs if needed",
      "Create a structured first draft",
      "Save useful decisions into shared memory",
    ],
    memoryTargets: ["Decision log", "Task queue", intent === "bot_research" ? "Bot evidence" : "Product memory"],
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- src/domain/router.test.ts
npm run build
```

Expected: tests pass and build exits with code `0`.

- [ ] **Step 6: Commit router**

Run:

```powershell
git add src/domain/agents.ts src/domain/router.ts src/domain/router.test.ts
git commit -m "Add deterministic brain router"
git push
```

Expected: commit and push succeed.

### Task 3: Build First Operator Cockpit UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Replace App with cockpit**

Update `src/App.tsx`:

```tsx
import { FormEvent, useMemo, useState } from "react";
import { agents, productVault } from "./domain/agents";
import { routeCommand, type RouteResult } from "./domain/router";

const starterCommands = [
  "Build a liquidity lesson for AI Trading College",
  "Backtest this MT5 bot and tell me if it is live ready",
  "Write a LinkedIn post about central banks moving markets",
];

export default function App() {
  const [command, setCommand] = useState(starterCommands[0]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);

  const activeRoute = routes[0] ?? routeCommand(command);
  const openTasks = useMemo(
    () =>
      activeRoute.nextActions.map((action, index) => ({
        id: `${activeRoute.agent.id}-${index}`,
        text: action,
      })),
    [activeRoute],
  );

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    setRoutes((current) => [routeCommand(trimmed), ...current].slice(0, 6));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BIGBoss Trading Organization OS</p>
          <h1>Agent Workforce Command Center</h1>
        </div>
        <div className="status-pill">Local-first V1</div>
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
            {openTasks.map((task) => (
              <li key={task.id}>{task.text}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <p className="panel-label">Shared memory targets</p>
          <ul className="memory-list">
            {activeRoute.memoryTargets.map((target) => (
              <li key={target}>{target}</li>
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
```

- [ ] **Step 2: Replace CSS with cockpit styling**

Update `src/styles.css`:

```css
:root {
  color: #f7f4ea;
  background: #090909;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #090909;
}

button,
textarea,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(circle at 18% 10%, rgba(212, 175, 55, 0.14), transparent 28%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent 35%),
    #090909;
}

.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.eyebrow,
.panel-label {
  margin: 0 0 8px;
  color: #d4af37;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: clamp(30px, 5vw, 54px);
  line-height: 1.02;
}

h2 {
  margin-bottom: 10px;
  font-size: 32px;
}

h3 {
  margin-bottom: 4px;
  font-size: 16px;
}

p,
li {
  color: #c7c1ad;
  line-height: 1.55;
}

.status-pill,
.route-meta span {
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: 999px;
  padding: 8px 12px;
  color: #f7f4ea;
  background: rgba(20, 20, 20, 0.84);
  white-space: nowrap;
}

.command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
  gap: 18px;
  margin-bottom: 18px;
}

.command-panel,
.route-panel,
.panel {
  border: 1px solid rgba(212, 175, 55, 0.2);
  background: rgba(17, 17, 17, 0.92);
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
}

.command-panel label {
  display: block;
  margin-bottom: 10px;
  font-weight: 800;
}

textarea,
select {
  width: 100%;
  border: 1px solid rgba(212, 175, 55, 0.24);
  border-radius: 8px;
  color: #f7f4ea;
  background: #0d0d0d;
}

textarea {
  min-height: 132px;
  resize: vertical;
  padding: 14px;
}

select {
  min-height: 44px;
  padding: 0 12px;
}

textarea:focus,
select:focus {
  outline: 2px solid rgba(212, 175, 55, 0.42);
  outline-offset: 2px;
}

.command-actions {
  display: grid;
  grid-template-columns: minmax(160px, 0.35fr) minmax(0, 0.65fr);
  gap: 10px;
  margin-top: 12px;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  color: #090909;
  background: #d4af37;
  font-weight: 900;
  cursor: pointer;
}

button:hover {
  background: #f0ca52;
}

.route-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.route-meta .risk-high {
  border-color: rgba(220, 53, 69, 0.55);
  color: #ffb4bd;
}

.route-meta .risk-medium {
  border-color: rgba(244, 184, 76, 0.55);
  color: #ffd38a;
}

.route-meta .risk-low {
  border-color: rgba(40, 167, 69, 0.55);
  color: #9ee6af;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1.25fr) repeat(3, minmax(220px, 1fr));
  gap: 18px;
  align-items: start;
}

.agent-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.agent-card {
  min-height: 92px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.035);
}

.agent-card.active {
  border-color: rgba(212, 175, 55, 0.72);
  background: rgba(212, 175, 55, 0.12);
}

.agent-card p {
  margin-bottom: 0;
}

.task-list,
.memory-list,
.vault-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-list li,
.memory-list li,
.vault-list li {
  border-left: 3px solid #d4af37;
  border-radius: 6px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
}

@media (max-width: 1100px) {
  .command-grid,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .app-shell {
    padding: 16px;
  }

  .topbar,
  .command-actions {
    grid-template-columns: 1fr;
    display: grid;
  }

  .agent-list {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Verify UI build**

Run:

```powershell
npm test
npm run build
```

Expected: tests pass and build exits with code `0`.

- [ ] **Step 4: Start local dev server**

Run:

```powershell
npm run dev
```

Expected: Vite serves the app locally, usually at `http://127.0.0.1:5173/`.

- [ ] **Step 5: Browser verification**

Open the local app and verify:

- The command input renders.
- Clicking `Route Command` selects the correct agent.
- Bot/live-ready language shows an approval gate.
- Agent roster, task queue, memory targets, and product vault render without overlap.

- [ ] **Step 6: Commit cockpit**

Run:

```powershell
git add src/App.tsx src/styles.css
git commit -m "Build operator cockpit v1"
git push
```

Expected: commit and push succeed.

### Task 4: Update Project Docs

**Files:**
- Modify: `PROJECT_MAP.md`
- Modify: `TASKS.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `PROJECT_MAP.md`**

Record:

```markdown
## Detected Stack And Tooling

- Vite
- React
- TypeScript
- Vitest
- Local deterministic routing for V1

## Known Commands

- Run: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Deploy: not configured
```

- [ ] **Step 2: Update `TASKS.md`**

Mark:

```markdown
- [x] Create implementation plan.
- [x] Choose stack for V1 web app.
- [x] Scaffold project structure.
- [x] Build first working operator cockpit screen.
```

- [ ] **Step 3: Update `CHANGELOG.md`**

Add:

```markdown
- Added Vite React TypeScript app scaffold.
- Added deterministic Brain Router with Vitest coverage.
- Built first operator cockpit screen.
- Verified with tests and production build.
```

- [ ] **Step 4: Final verification and commit**

Run:

```powershell
npm test
npm run build
git status --short
git add PROJECT_MAP.md TASKS.md CHANGELOG.md docs/superpowers/plans/2026-06-08-operator-cockpit-v1.md
git commit -m "Document operator cockpit v1 build"
git push
```

Expected: tests/build pass, docs commit pushes, and local branch is clean.

## Self-Review

- Spec coverage: The plan implements the first cockpit slice, agent roster, deterministic routing, task queue, shared memory preview, product vault preview, and approval gates. Live trading, publishing, and external integrations remain out of scope.
- Placeholder scan: No placeholder tokens or vague future implementation steps remain.
- Type consistency: `AgentId`, `RiskLevel`, `Intent`, and `RouteResult` are defined before UI usage.
