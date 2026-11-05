# RDU Developer Agent: Architectural Plan & Requirements Prompt

> **Platform:** Nido Live Music Catalog & Agent Ecosystem (`ezvibes/nido-api`)
> **Identity:** **RDU** (Raleigh-Durham) — Senior Software Engineer & Dedicated Multi-Agent Builder
> **Associated Issue:** [#181](https://github.com/ezvibes/nido-api/issues/181)
> **Framework:** `@google/adk` (Node.js/TypeScript), NestJS, TypeORM, Vue 3 + Vite

---

## 🎯 Executive Mission & Philosophy

**RDU** is Nido's dedicated **Full-Stack Engineering & QA Worker Agent**, named after the Research Triangle (Raleigh-Durham-Chapel Hill) where Nido is rooted.

While **Frankfurt** serves as the high-level Mission Coordinator and Outcome Orchestrator, **RDU** is the master craftsperson that writes code, authors tests, refactors architectures, fixes bugs, and collaborates with the entire city-agent network to deliver clean, reviewable pull requests.

---

## 🏗️ Multi-Agent Interaction Model

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Human Maintainer / Operator                       │
 │      (Issues tasks via `agent:rdu` label, CLI, or Supervisor UI)       │
 └───────────────────────────────────▲────────────────────────────────────┘
                                     │ Direct Dispatch
 ┌───────────────────────────────────┴────────────────────────────────────┐
 │               Frankfurt (Mission Coordinator / Orchestrator)           │
 │   - Triage, requirement decomposition & bounded task contract          │
 │   - Staff Architect 3-Optimization + 1-Concern evaluation              │
 └───────────────────────────────────▲────────────────────────────────────┘
                                     │ Task Delegation & Verification
 ┌───────────────────────────────────┴────────────────────────────────────┐
 │                   RDU (Dedicated Engineering & QA Agent)                │
 │   - Frontier reasoning: Gemini 3.8 Flash / Gemini 2.5 Pro               │
 │   - Bounded tools: File read/write/edit, Git, Jest/Vitest runners       │
 │   - MCP tool connectivity: PostgreSQL MCP, GitHub MCP, DevTools MCP     │
 │   - Fast inner loop: npm run test:changed, scripts/check-hygiene.mjs    │
 └─────────────────┬──────────────────┬──────────────────┬────────────────┘
                   │                  │                  │
         ┌─────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
         │ Venezia (Ingest) │ │ Firenze (News) │ │ Bologna (Docs) │
         │ OCR adapters,    │ │ Beehiiv staged │ │ 4-B session    │
         │ deduplication    │ │ pipes, co-bill │ │ living docs    │
         └──────────────────┘ └────────────────┘ └────────────────┘
```

---

## 🛠️ Detailed Implementation Plan

### Milestone 1: Agent Persona & Operating Contracts
- Define `.agents/agents/rdu-builder-agent/agent.md` and `.agents/skills/rdu-builder/SKILL.md`.
- Update `AGENTS.md` and `developer-docs/catalog-operating-system/agent-context-map.md`.
- Establish RDU's engineering rules:
  1. Follow existing NestJS, TypeORM, and Vue 3 patterns before introducing dependencies.
  2. Maintain `DB_SYNCHRONIZE=false`; always create reversible TypeORM migrations.
  3. Never commit without running inner-loop tests (`npm run test:changed`) and self-healing hygiene (`scripts/check-hygiene.mjs --fix`).
  4. Preserve human authority: RDU stages PRs and reports to Decision Center; only maintainers merge or deploy.

### Milestone 2: Dedicated Autonomous Runner (`run-rdu-builder.ts`)
- Implement `src/scripts/run-rdu-builder.ts` leveraging `@google/adk`.
- Support dual execution modes:
  - Local CLI: `npm run dev:rdu -- --issue <number> [--task "..."] [--model gemini-3.8-flash] [--dry-run]`
  - GitHub CI: `.github/workflows/rdu-mission.yml` triggered on `agent:rdu` label.
- Add bounded filesystem and execution tools with strict timeout and pipe protection.
- Author unit test suite `src/scripts/run-rdu-builder.spec.ts`.

### Milestone 3: Supervisor Fleet Integration & Telemetry
- Register RDU in `AgentSupervisorService` (`/admin/agents`) with dynamic states (`IDLE`, `BUILDING`, `TESTING`, `WAITING_FOR_REVIEW`).
- Broadcast real-time RDU activity over Server-Sent Events (`/admin/agents/stream`).
- Display RDU tasks in the Decision Center drawer.

### Milestone 4: Cross-Agent Collaboration & MCP Connector
- Connect RDU to shared tooling used by Venezia, Firenze, and Munchen.
- Add pluggable MCP connectivity options (PostgreSQL MCP, GitHub MCP).
