# Project Map

## Purpose

Build BIGBoss Trading Organization OS: an AI brain for running a trading education and product business around AI Trading College, BIGBoss Trader OS, content creation, trade review, MT5 bot research, and education products.

## Current Structure

- `README.md`: project overview.
- `PROJECT_MAP.md`: this map.
- `PROJECT_PLAN.md`: phased plan.
- `TASKS.md`: task status.
- `RULES.md`: project rules.
- `CHANGELOG.md`: change history.
- `AGENTS.md`: Codex operating instructions for this project.
- `docs/PRD.md`: product brief.
- `docs/superpowers/specs/2026-06-08-bigboss-trading-organization-os-design.md`: approved design spec.
- `docs/research/hermes-desktop-os1-integration.md`: Hermes OS1 integration research.
- `docs/research/local-hermes-mimo-installation.md`: local-first Hermes and MiMo installation strategy.
- `src/domain/localBrainStore.ts`: browser-local task and memory persistence for HermesBridge V1.
- `outputs/`: user-facing deliverables.
- `work/`: drafts, scratch files, and intermediate work.
- `.superpowers/brainstorm/`: local brainstorming companion artifacts.

## Detected Stack And Tooling

- Vite
- React
- TypeScript
- Vitest
- Local deterministic Brain Router for V1
- HermesBridge V1 domain layer with mock, Ollama local, FCC backup, and MiMo candidate provider statuses
- Browser-local task and memory persistence; no API keys, live trading, or external publishing integrations yet

## Known Commands

- Run: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Deploy: unknown.

## Local Model Provider Notes

- Primary safe fallback: mock provider.
- Local Ollama health endpoint: `http://127.0.0.1:11434/api/tags`.
- Provider checks time out quickly so the command button does not hang when local or cloud providers are unavailable.
- FCC is represented as a backup-only provider because upstream cloud provider requests may fail.
- MiMo is represented as a candidate provider, not installed or active in V1.

## Assumptions

- V1 should focus on trading organization workflows, not the architecture/construction opportunity.
- The first implementation slice should create a working operator cockpit and agent routing model before deeper integrations.
- Existing dashboard example at `E:\1 Pending Projects\BIGBoss_Trader_OS_Operator_Dashboard.html` is a visual/product reference, not source code to overwrite.
- Hermes Desktop OS1 is cloned under `work/hermes-desktop-os1` for research only; do not vendor it into this app without a separate integration plan.
