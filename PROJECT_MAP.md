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
- `src/domain/agentOutputs.ts`: deterministic per-agent structured output drafts for the V1 workforce.
- `src/domain/localModelClient.ts`: Ollama-compatible local model discovery and prompt test client.
- `src/domain/ollamaGuidance.ts`: repair guidance for starting Ollama and installing a local model.
- `src/domain/localBrainStore.ts`: browser-local task and memory persistence for HermesBridge V1.
- `src/domain/durableMemory.ts`: shared, runtime-agnostic types for durable shared memory.
- `src/domain/durableMemoryClient.ts`: browser client for the durable memory API with browser-only fallback.
- `src/server/memoryStore.ts`: Node filesystem store that writes one Markdown note per memory entry into `<root>/<folderId>/`.
- `src/server/memoryApi.ts`: Vite dev/preview middleware exposing `GET`/`POST /api/memory`.
- `src/server/llmGateway.ts`: Node LLM gateway calling the FCC proxy (NVIDIA NIM) with Ollama fallback and Anthropic SSE parsing.
- `src/server/llmApi.ts`: Vite dev/preview middleware exposing `POST /api/llm/generate` and `GET /api/llm/health`.
- `src/domain/llmClient.ts`: browser client for the LLM gateway with graceful fallback to deterministic drafts.
- `src/domain/mission.ts`: types for multi-agent missions (subtasks, messages, results).
- `src/domain/missionPlanner.ts`: deterministic decomposition of a goal into agent subtasks with dependency edges.
- `src/domain/missionRunner.ts`: runs mission subtasks in dependency waves with inter-agent message passing and deterministic fallback.
- `src/domain/voice.ts`: Web Speech API wrapper for voice commands (STT) and read-back (TTS), with pure command-interpretation helpers.
- `src/domain/transcriptionClient.ts`: browser MediaRecorder client for local Whisper transcription (with health check + fallback).
- `src/server/transcribeApi.ts`: Vite middleware proxying `/api/transcribe` to the local Whisper server.
- `.whisper/server.py`: persistent faster-whisper model server (loads once, serves :8378); `.whisper/transcribe.py`: one-shot CLI.
- `src/domain/productTemplates.ts`: registry of product types + deterministic scaffold + prompt builder.
- `src/domain/productBuilder.ts`: AI-brain-filled product scaffold with deterministic fallback.
- `Start-BIGBoss-OS.ps1` / `Start-BIGBoss-OS.cmd`: one-click launcher for Ollama + FCC proxy + cockpit, then opens the dashboard.
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
- Browser-local task persistence plus durable shared memory written to disk as Markdown via a local Vite API (defaults to the AI-Brain Obsidian vault at `E:/AI-Brain/Memory` through `BIGBOSS_MEMORY_ROOT` in `.env.local`); no API keys, live trading, or external publishing integrations yet
- Approval workflow states: `drafted`, `needs-approval`, `approved`, `rejected`, and `completed`
- Agent Output Workspace with deterministic templates for Dean, Ledger, Forge, Voice, Scout, and Launch
- Generated drafts can be copied as Markdown or downloaded as `.md` files from the browser.
- Generated drafts can be edited as Markdown and saved locally in browser storage.
- Task queue rows can be selected to inspect the matching workflow state and generated output.
- Local Brain Test panel can discover Ollama models and send non-streaming test prompts when Ollama is running.
- Local Brain Test panel shows start/repair guidance when Ollama is offline or has no models.
- Ollama repair commands can be copied from the dashboard.
- Agent Output Workspace can enhance the active draft through the selected local Ollama model when one is available.

## Known Commands

- Run: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Deploy: unknown.

## Local Model Provider Notes

- Primary safe fallback: mock provider.
- Local Ollama health endpoint: `http://127.0.0.1:11434/api/tags`.
- Provider checks time out quickly so the command button does not hang when local or cloud providers are unavailable.
- FCC is now an active generation provider via `src/server/llmGateway.ts`: the cockpit calls `/api/llm/generate`, which forwards to the FCC proxy `/v1/messages` (Anthropic API, streaming) using the NVIDIA NIM model selected in the FCC Admin UI, falling back to local Ollama, then to a deterministic draft. The NVIDIA key stays inside FCC; the app only talks to `127.0.0.1:8082`.
- MiMo is represented as a candidate provider, not installed or active in V1.

## Assumptions

- V1 should focus on trading organization workflows, not the architecture/construction opportunity.
- The first implementation slice should create a working operator cockpit and agent routing model before deeper integrations.
- Existing dashboard example at `E:\1 Pending Projects\BIGBoss_Trader_OS_Operator_Dashboard.html` is a visual/product reference, not source code to overwrite.
- Hermes Desktop OS1 is cloned under `work/hermes-desktop-os1` for research only; do not vendor it into this app without a separate integration plan.
