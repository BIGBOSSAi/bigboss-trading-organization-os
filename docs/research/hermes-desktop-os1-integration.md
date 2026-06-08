# Hermes Desktop OS1 Integration Research

Source cloned to: `work/hermes-desktop-os1`

Repository: `https://github.com/nickvasilescu/hermes-desktop-os1.git`

Inspected on: 2026-06-08

## What Hermes OS1 Is

Hermes Desktop OS1 is a native macOS SwiftUI operator app for controlling a Hermes Agent running on a remote computer. It is designed around a cloud-computer/agent workflow, not a simple local chatbot.

It provides:

- Connections to Orgo VMs and SSH hosts.
- Hermes Agent install/update flows.
- Interactive remote terminal via SwiftTerm.
- Session browser and transcript viewer.
- Chat invocation against the Hermes CLI.
- Remote file browser/editor with conflict checks.
- Skills browser/editor.
- Cron job manager.
- Kanban board.
- Knowledge-base vault sync.
- Provider credentials and OpenRouter OAuth.
- OpenAI Realtime voice mode.
- Orgo MCP tool bridge for voice.
- Mail, Telegram/messaging, Composio connectors, and health/doctor views.

## Stack

- Swift Package app named `OS1`.
- macOS 14+ target.
- SwiftUI UI.
- Vendored `SwiftTerm`.
- Tests under `Tests/OS1Tests`.
- Build commands from the repo:
  - `swift test`
  - `./scripts/build-macos-app.sh`

This cannot be fully built or run from the current Windows workspace because it is a macOS SwiftUI app.

## Core Architecture

The central pattern is:

1. User selects a connection profile.
2. `AppState` owns the active connection and all view models/services.
3. Services call a shared `RemoteTransport`.
4. `MultiplexedRemoteTransport` routes calls to either SSH or Orgo.
5. Services run remote Python scripts or shell commands.
6. Results are decoded into typed Swift models and shown in native views.

The most important abstraction is:

```text
ConnectionProfile -> RemoteTransport -> Service -> Typed model -> View
```

## Key Services

- `RemoteHermesService`: discovers the remote Hermes workspace, profiles, memory files, session stores, cron jobs, and kanban database.
- `HermesChatService`: runs `hermes chat --quiet --query <prompt>` remotely and returns stdout/stderr.
- `SessionBrowserService`: reads Hermes sessions from SQLite or JSONL artifacts.
- `FileEditorService`: reads/writes remote UTF-8 files with content hashes and size limits.
- `SkillBrowserService`: lists, creates, and updates Hermes skills.
- `CronBrowserService`: lists, creates, pauses, resumes, removes, and runs cron jobs.
- `KanbanBrowserService`: loads board/tasks and mutates tasks by create/comment/assign/block/complete/archive/delete.
- `KnowledgeBaseService`: syncs a markdown vault with size and naming limits.
- `OrgoTransport`: talks to Orgo `/bash`, `/exec`, direct VM URLs, terminal websocket, and VNC websocket.
- `SSHTransport`: runs non-interactive SSH commands and uses control sockets for background service calls.
- `RealtimeVoiceSessionServer`: starts a local loopback HTTP endpoint for OpenAI Realtime voice.
- `RealtimeOrgoMCPBridge`: exposes bounded Orgo MCP tools to voice mode through stdio MCP.

## Security Model

Important safety practices:

- Provider keys are stored in macOS Keychain.
- Orgo API key is stored in macOS Keychain.
- Profile-scoped provider keys are supported, with default fallback.
- Realtime voice keeps `OPENAI_API_KEY` server-side in the Swift app.
- Orgo credentials stay in the Swift app and local MCP subprocess.
- Voice defaults expose only `core,screen,files`.
- File upload is disabled by default.
- Shell/admin toolsets require explicit opt-in.
- Hermes chat detects command approval requests and surfaces them instead of silently approving unless `autoApproveCommands` is enabled.
- Remote file writes use content hashes and atomic writes to avoid overwriting newer changes.

## What BIGBoss OS Should Reuse Conceptually

We should copy the architecture ideas, not paste the macOS app into our React app.

Best concepts to reuse:

- A `BrainProvider` or `HermesBridge` interface.
- A safe command invocation boundary.
- Separate session, memory, skill, file, cron, and task services.
- Approval gates for high-risk actions.
- Profile-scoped credentials.
- Read-only defaults for powerful tools.
- Memory files as first-class objects.
- Task/kanban state as part of the operating system, not just chat output.

## What Not To Copy Directly

- Do not copy macOS SwiftUI code into the web app.
- Do not expose keys in browser JavaScript.
- Do not enable shell/admin tools by default.
- Do not let a browser call Hermes/Orgo/OpenAI directly with secrets.
- Do not build live trading or broker execution through Hermes V1.

## Recommended Integration Direction

For BIGBoss Trading Organization OS, the next safe step is a local backend bridge:

```text
React Cockpit
  -> Local API server
  -> HermesBridge interface
  -> Local Hermes CLI or remote Hermes/Orgo later
```

The first bridge should be local and conservative:

- Detect whether `hermes` is installed.
- Send a prompt through a controlled backend endpoint, not from the browser.
- Support `autoApproveCommands = false` by default.
- Return structured output with stdout, stderr, exit code, duration, and approval-needed state.
- Persist no API keys in frontend code.
- Add tests around command construction and approval detection.

## Proposed Next Build Slice

Build `HermesBridge V1` in our app:

- Add a Node backend or Vite dev proxy API boundary.
- Add `src/server/hermesBridge.ts` or equivalent backend-only module.
- Add a frontend provider status panel: `Hermes: detected / missing / blocked`.
- Add a safe test mode that does not execute real shell/admin actions.
- Keep the existing deterministic Brain Router as fallback when Hermes is unavailable.

## Strategic Fit

Hermes can become the execution brain behind BIGBoss OS, while BIGBoss OS remains the trading-business cockpit.

Hermes should handle:

- Long-running agent sessions.
- Local/remote task execution.
- File and memory operations.
- Skills.
- Cron/automation.
- Knowledge base.

BIGBoss OS should handle:

- Trading organization product logic.
- Agent roster and routing.
- Trade review workflows.
- Bot evidence gates.
- AI Trading College content.
- Product launch workflows.
- Human approval UI.
