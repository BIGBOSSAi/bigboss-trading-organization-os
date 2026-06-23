# Changelog

## 2026-06-22

- Bridged the cockpit to the standalone Nexus Social app so agents can ship content for lead-gen: `src/server/nexusClient.ts` (logs into Nexus, caches JWT, draft/publish/accounts) + `src/server/nexusApi.ts` (Vite `/api/nexus/{health,draft,publish}` proxy, credentials stay server-side) + browser `src/domain/nexusClient.ts`. New cockpit "Social Publishing" panel: pick a connected account, pull the latest agent output, "Draft to Nexus", then "Approve & Publish" (human approval gate). Verified end-to-end through the cockpit: draft → publish → live Telegram post in @big_bosszgh. 97 tests passing, build clean.

## 2026-06-21

- Integrated local Whisper transcription (faster-whisper) for private, on-device, multilingual voice. A persistent model server (`.whisper/server.py`, loads `base` once on CPU/int8) is proxied via `src/server/transcribeApi.ts` (`/api/transcribe` + `/api/transcribe/health`); the browser `src/domain/transcriptionClient.ts` records mic audio (MediaRecorder) and posts it. The cockpit mic now prefers Whisper and falls back to the browser Web Speech API when the server is offline. One-click launcher starts the Whisper server too. Verified server path end-to-end (SAPI-generated sample → exact transcript, ~5.5s warm on this CPU); 92 tests passing, build clean.
- Fixed LLM gateway robustness: FCC wraps upstream (NVIDIA NIM) failures in a 200 stream whose text is the error message; the gateway now detects those provider-error payloads (`isProviderErrorText`) and treats them as failures, and retries FCC once on a transient error before falling back to Ollama / deterministic output. Previously the raw error could surface as a "successful" result.
- Added a one-click Product Builder for the Launch agent (`src/domain/productTemplates.ts` + `src/domain/productBuilder.ts`): a registry of 7 product types (course, lead magnet, funnel, ebook, signal/education service, masterclass, email sequence), each scaffolded by the AI brain from the command-box topic with a deterministic fallback, then saved to the vault under `organization`. Cockpit panel supports copy / download / read-aloud. 85 tests passing; build clean.

## 2026-06-20

- Made missions autonomous and communication-first: the mission runner now adds a brain synthesis pass that combines and enhances all agent outputs into one final deliverable before it reaches the human (`finalResult`), and `renderMissionMarkdown` writes the full transcript (final result + every agent output + inter-agent log) to the vault as one Markdown note. The cockpit shows the synthesized Final Result, auto-speaks the result (or a spoken approval request when required) via a "Voice replies" toggle, and adds read-back buttons — so a spoken goal runs the whole multi-agent mission and reports back by voice with no manual typing. Approval gates remain human. Verified with `npm test` (77 passing) and `npm run build`.
- Upgraded model selection to verified-live NVIDIA NIM models (FCC's NIM key already exposes the top model from every family). Cockpit `FCC_MODEL` set to `nvidia_nim/deepseek-ai/deepseek-v4-pro`; FCC tiers set to MODEL/OPUS=`deepseek-v4-pro`, SONNET=`qwen/qwen3.5-397b-a17b`, HAIKU=`deepseek-v4-flash` (in `~/.fcc/.env`, backup at `~/.fcc/.env.bak.20260620`; FCC restart needed for tier changes). Verified a real `deepseek-v4-pro` generation through the cockpit gateway. Other direct providers still need their own key + Admin UI "Refresh models" for real IDs.
- Added voice control (`src/domain/voice.ts`): push-to-talk speech-to-text turns spoken commands into actions ("mission ..." runs a multi-agent mission, "route ..." routes a single agent, otherwise fills the command box) and text-to-speech reads agent output aloud, all via the feature-detected Web Speech API with pure helpers unit-tested. Added a mic button + status to the command panel and a "Read aloud" button to the output workspace.
- Added a one-click launcher (`Start-BIGBoss-OS.cmd` / `Start-BIGBoss-OS.ps1`) that starts Ollama, the FCC proxy, and the cockpit (only if not already running) and opens the dashboard — so the whole stack launches from a single double-click.
- Added parallel multi-agent missions: `src/domain/missionPlanner.ts` decomposes one goal into specialist subtasks with dependency edges (knowledge agents first, packaging agents after), and `src/domain/missionRunner.ts` runs them in dependency waves (parallel within a wave), feeds each agent the outputs of the agents it depends on as inter-agent messages, aggregates a summary, and degrades to deterministic drafts when the LLM is unavailable (`src/domain/mission.ts` holds the shared types). The cockpit gained a "Run Mission From Command" panel showing per-agent lanes (with the provider used) and the inter-agent log, and each mission is persisted to durable shared memory. Verified with `npm test` (68 passing), `npm run build`, and a live FCC→NVIDIA generation plus a real inter-agent handoff.
- Fixed FCC integration after live testing: set `FCC_API_KEY=freecc` (FCC's default `ANTHROPIC_AUTH_TOKEN`) and raised the gateway's default `max_tokens` to 4096 because the reasoning model spends budget on hidden "thinking" blocks before emitting answer text.
- Wired real LLM generation through the local FCC proxy (Anthropic Messages API, streaming, routing to the NVIDIA NIM model selected in the FCC Admin UI) with Ollama fallback and a clear no-provider result. Added `src/server/llmGateway.ts` (FCC SSE parsing + provider selection), `src/server/llmApi.ts` (Vite `/api/llm/generate` + `/api/llm/health` middleware, keeping keys server-side), and `src/domain/llmClient.ts` (browser client with graceful fallback). The Agent Output Workspace "Enhance With AI Brain" action now uses real generation, and the topbar shows AI-brain provider health. Configured via `.env.local` (`FCC_BASE_URL`, `FCC_MODEL`, `FCC_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`). Verified with `npm test` (61 passing), `npm run build`, and live `/api/llm/health` + `/api/llm/generate` probes (graceful-degradation path with providers offline).
- Added durable shared memory storage: a filesystem-backed Markdown store (`src/server/memoryStore.ts`) exposed over a local Vite dev/preview API boundary (`src/server/memoryApi.ts`), with a browser client (`src/domain/durableMemoryClient.ts`) that falls back to browser-only memory when the API is unavailable.
- Memory entries are now written as one Obsidian-compatible Markdown note per entry into `<BIGBOSS_MEMORY_ROOT>/<folderId>/`, defaulting (via `.env.local`) to the BIGBoss AI-Brain Obsidian vault at `E:/AI-Brain/Memory`.
- Cockpit now loads durable memory on start, persists each routed task's memory entry to disk, and shows durable-vs-browser status in the Shared Memory panel.
- Added Vitest coverage for the memory store (write/list/round-trip/path-safety) and the durable memory client (load/save/fallback). Verified with `npm test` (50 passing) and `npm run build`.

## 2026-06-08

- Created initial project-control files.
- Captured PRD summary for BIGBoss Trading Organization OS.
- Wrote the V1 design spec for the Agent Workforce First architecture.
- Recorded the approved agent roster and operating loop.
- Added repository ignore rules so GitHub keeps project files without local brainstorming scratch artifacts.
- Connected the local project to `BIGBOSSAi/bigboss-trading-organization-os`.
- Pushed the initial project foundation to GitHub.
- Wrote the Operator Cockpit V1 implementation plan.
- Added Vite React TypeScript app scaffold.
- Added deterministic Brain Router with Vitest coverage.
- Built the first operator cockpit screen.
- Verified with `npm audit --audit-level=moderate`, `npm test`, and `npm run build`.
- Merged operator cockpit V1 into `main` and pushed it to GitHub.
- Cloned and researched Hermes Desktop OS1 as a candidate local AI brain layer.
- Added a local-first Hermes and MiMo installation strategy for running the AI brain from the desktop before any paid hosting.
- Added HermesBridge V1 with provider health checks, local memory folder manifest, approval-gated task records, and cockpit provider status UI.
- Stabilized command routing so offline or stuck model providers time out quickly, failed probes fall back to the mock provider, and the route button shows a loading state instead of feeling unresponsive.
- Added browser-local persistence for HermesBridge task records and memory entries so the cockpit can remember recent routed work after refresh.
- Added task workflow states, approval/rejection/completion transitions, task detail controls, and migration for older saved task records.
- Added deterministic per-agent output drafts and an Agent Output Workspace for Dean, Ledger, Forge, Voice, Scout, and Launch.
- Fixed router keyword matching so words containing `ea` no longer get misrouted as Expert Advisor bot work.
- Added Markdown copy and `.md` download actions for generated agent drafts.
- Added clickable task selection so the task detail panel and output workspace can inspect older routed work.
- Added editable Markdown mode for agent output drafts, with local save support and copy/download using the edited version.
- Added a Local Brain Test panel with Ollama model discovery, safe prompt testing, and offline fallback messaging.
- Added Ollama start/repair guidance with Windows commands and next actions inside the Local Brain Test panel.
- Added one-click copy buttons for Ollama repair commands in the Local Brain Test panel.
- Added provider-backed draft enhancement so a healthy local Ollama model can improve the active agent output while preserving deterministic fallback behavior.
