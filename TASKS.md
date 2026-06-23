# Tasks

## Completed

- [x] Selected Option B: Trading Organization OS.
- [x] Selected Agent Workforce First as the V1 architecture.
- [x] Approved V1 agent roster.
- [x] Approved command-to-execution operating loop.
- [x] Created required project-control files.
- [x] Saved PRD summary.
- [x] Saved design spec.
- [x] Prepared repository ignore rules for GitHub publishing.
- [x] Connected local repository to GitHub remote.
- [x] Pushed initial design foundation to GitHub.
- [x] Review the written design spec.
- [x] Create implementation plan.
- [x] Choose stack for V1 web app.
- [x] Scaffold project structure.
- [x] Build first working operator cockpit screen.
- [x] Merge operator cockpit V1 into `main`.
- [x] Clone and inspect Hermes Desktop OS1.
- [x] Document Hermes integration research.
- [x] Plan local-first Hermes and MiMo installation strategy.
- [x] Build HermesBridge V1 backend integration.
- [x] Connect a local model runtime health check.
- [x] Stabilize command routing clicks with provider timeout and visible loading state.
- [x] Persist HermesBridge task records and memory entries to browser storage.
- [x] Add approval workflow state and task detail controls.
- [x] Add output workspace for agent-generated drafts.
- [x] Add per-agent task templates for Dean, Ledger, Forge, Voice, Scout, and Launch.
- [x] Add export/copy actions for generated drafts.
- [x] Add task selection so task detail and output workspace follow clicked task rows.
- [x] Add editable output workspace with local Markdown saves.
- [x] Add Local Brain Test panel for Ollama model discovery and safe prompt testing.
- [x] Add Ollama start/repair guidance when local brain is offline.
- [x] Add one-click copy buttons for Ollama repair commands.
- [x] Add provider-backed generation when a local model is healthy.
- [x] Add durable shared memory storage (filesystem Markdown store via Vite API, writing into the AI-Brain Obsidian vault, with browser-only fallback).
- [x] Wire real LLM generation through the FCC proxy (NVIDIA NIM) with Ollama fallback, server-proxied via a `/api/llm` Vite boundary so keys stay server-side.

- [x] Parallel multi-agent missions: decompose one goal into subtasks across agents, run them in dependency waves (parallel within a wave) with an inter-agent message log, persist the mission to shared memory.

- [x] Voice command control: push-to-talk speech-to-text for commands ("route ..."/"mission ...") and text-to-speech read-back of agent output (Web Speech API, feature-detected).
- [x] One-click launcher (`Start-BIGBoss-OS.cmd`/`.ps1`): starts Ollama + FCC proxy + cockpit and opens the dashboard.
- [x] Set NVIDIA NIM model profile (balanced power): cockpit + FCC tiers use verified-live model IDs (deepseek-v4-pro / qwen3.5-397b / deepseek-v4-flash).
- [x] Persist full mission transcript (final result + per-agent outputs + inter-agent log) to the vault as one Markdown note.
- [x] Autonomous communication-first mission flow: the brain synthesizes a single final deliverable from all agents (auto-enhanced before reaching the human); voice read-back of results and spoken approval requests; "Voice replies" toggle.

- [x] Product templates: one-click Product Builder (Launch agent) scaffolds 7 product types via the AI brain (deterministic fallback) and saves each asset to the vault.
- [x] Local Whisper voice (faster-whisper): private on-device speech-to-text via a persistent model server, proxied through `/api/transcribe`; cockpit mic prefers Whisper and falls back to the browser Web Speech API.
- [x] BIGBoss → Nexus social bridge: cockpit drafts agent content, you approve, and it publishes to connected channels (live Telegram). Server-side `/api/nexus/{health,draft,publish}` proxy keeps Nexus creds off the browser.
- [x] One-click launcher now also starts the Nexus app (true single-launch: Ollama + FCC + Whisper + Nexus + cockpit).
- [x] Vault/mission browser in the cockpit: browse and view all saved memory (missions, products, drafts) from the vault.
- [x] Scheduled automation: daily AI content draft generated on a cadence, saved to the vault as approval-pending (review in Vault Browser, publish via Social); manual "run now" too.

## Next
- [ ] Social media content shipping for lead-gen (wire the Nexus Social dashboard / connectors so Voice can publish to get leads — approval-gated).
- [ ] Configure direct FCC providers (Groq, Cerebras, Gemini, etc.): add key in Admin UI + Refresh models.
- [ ] Surface durable memory / mission notes in the cockpit (browse + edit).
- [ ] Add richer agent output sections and version history.
- [ ] Add GitHub-backed export path after local file export is proven.
- [ ] Add model selection persistence and preferred local model setting.
