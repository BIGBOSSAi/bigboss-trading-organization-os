# Changelog

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
