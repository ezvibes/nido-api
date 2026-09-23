# GEAR 2: Google Agent Development Kit (ADK) Architecture Guide

This document captures core principles, runtime conventions, and multi-agent coordination patterns learned from **Google Cloud GEAR Level 2: Developer Agents with ADK** ("Engineer AI Agents with ADK"), applied directly to the **Nido Concert Intelligence Platform** and EZ Vibes agent ecosystem.

---

## 1. The Foundational Agent Formula

$$\text{Agent} = \text{Model} + \text{Tools} + \text{Orchestration}$$

1. **Model (Reasoning Brain):** The underlying foundation model (e.g., `gemini-3.6-flash`) responsible for natural language comprehension, tool selection, reasoning, and synthesis.
2. **Tools (Action Capabilities):** Structured executable interfaces (Node/TypeScript `FunctionTool` via `@google/adk`, or Python functions with type hints) connecting the agent to databases, APIs, and search engines.
3. **Orchestration (ReAct Loop & Session Runtime):** The execution engine (`Runner`, `SessionService`, or graph orchestrator) managing state persistence, message history, feedback critiques, and multi-agent delegation.

---

## 2. The Four Core Parameters of an ADK Agent

Every `LlmAgent` (or `Agent` in `@google/adk` and `google-adk`) is governed by four primary parameters:

```python
from google.adk.agents import Agent

root_agent = Agent(
    model="gemini-3.6-flash",          # 1. Reasoning engine (Required)
    name="scene_scout_agent",          # 2. Internal unique identifier (Required)
    description="...",                 # 3. External routing summary (Multi-agent)
    instruction="...",                 # 4. Internal behavioral blueprint (Persona & constraints)
    tools=[...]
)
```

### Parameter Breakdown

| Parameter | Type | Required? | Primary Audience | Core Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`model`** | `string` | **Yes** | Execution Runtime | The underlying LLM engine powering decisions. In Google AI Studio / Vertex AI, use current active generation models (e.g., `gemini-3.6-flash`). |
| **`name`** | `string` | **Yes** | ADK Runtime / Observability | Unique system identifier used across logging, traces, debugging, and multi-agent graph topologies. |
| **`description`** | `string` | Optional (Recommended) | **Other Agents** | Concise semantic description of capabilities used by router/dispatcher agents to decide delegation. |
| **`instruction`** | `string` | Optional (Critical) | **This Agent Itself** | The behavioral blueprint, persona, rules of engagement, and step-by-step operating guidelines. |

---

## 3. The Golden Rule: `description` vs. `instruction`

The single most critical architectural distinction in multi-agent ADK systems is the difference between who reads `description` and who reads `instruction`:

```
                  ┌───────────────────────────────┐
                  │       Orchestrator Agent      │
                  │   (e.g., Root Catalog Agent)  │
                  └───────────────┬───────────────┘
                                  │
         Reads "description" to   │ "Should I route this task
         evaluate capabilities    │  to the Venue Scout or
                                  │  the Newsletter Curator?"
                                  ▼
                  ┌───────────────────────────────┐
                  │    Specialized Worker Agent   │
                  │  (e.g., EZ Vibes Venue Scout) │
                  ├───────────────────────────────┤
                  │ Reads its own "instruction"   │
                  │ to guide tone, boundaries,    │
                  │ and step-by-step actions      │
                  └───────────────────────────────┘
```

### Quick Reference Matrix

| Feature | `description` | `instruction` |
| :--- | :--- | :--- |
| **Audience** | **Peer / Parent Agents** | **The Agent Itself** |
| **Core Question Answered** | *"Should I delegate this task here?"* | *"How do I behave and execute this job?"* |
| **Perspective** | Third-person semantic summary | Second-person persona & operating rules |
| **Good Example** | `"Verifies North Carolina music venues against the Nido curated catalog and pulls scheduled concerts."` | `"You are the EZ Vibes Scene Scout. Always verify the venue in the catalog before querying upcoming shows. Never assume a room is verified without calling lookupCuratedVenue."` |

---

## 4. The `root_agent` Entry-Point Convention

When building in Python ADK:
- The ADK CLI tools (`adk web`, `adk run`) and Google Cloud Agent Platform runtimes look for a specific top-level Python variable named **`root_agent`** in `agent.py`.
- While the internal parameter `name` can be specific (e.g. `name="math_tutor_agent"`), the exported variable must be `root_agent`:

```python
# Internal identifier for traces/telemetry
scene_scout = Agent(
    model="gemini-3.6-flash",
    name="nc_scene_scout",
    description="North Carolina music scene room inspector",
    instruction="You are an authentic music scout..."
)

# Required runtime export for ADK CLI and Cloud Run deployments:
root_agent = scene_scout
```

---

## 5. Instruction Crafting Architecture

An effective ADK instruction establishes three pillars:
1. **Persona & Tone:** Who the agent is and how it communicates (e.g., authoritative, jam-adjacent, authentic, encouraging).
2. **Operational Guardrails & Boundaries:** What the agent is strictly prohibited from doing (e.g., never auto-publish unreviewed concert candidates to production; never draft email blasts with broken ticket links).
3. **Step-by-Step Tool Protocol:** The exact chronological reasoning path the agent must follow when executing tools.

---

## 6. Nido Catalog Multi-Agent Reference Implementations

Applying these patterns to the active Nido agent roadmap:

### 1. Scene Scout Agent (PR #108 / Issue #107)
```typescript
export const ezVibesScoutAgent = new Agent({
  name: 'EZVibesSceneScout',
  model: 'gemini-3.6-flash',
  description:
    'Verifies North Carolina music venues, identifies partner tier rankings, and retrieves scheduled concert lineups.',
  instruction: `
You are the EZ Vibes Venue Scout & Vibe Inspector for Nido - North Carolina's indie live music intelligence portal.

Operational Protocol:
1. Always call lookupCuratedVenue with the venue name to verify if the room is in Nido's curated catalog.
2. If verified and a venueId is returned, call getUpcomingShowsAtVenue using that venueId.
3. If unverified, clearly report the room as unverified/community discovery and suggest local scout reconnaissance.
4. Synthesize an energetic, soulful assessment of the room, its partner tier, vibe, and live music schedule.
`,
  tools: [lookupCuratedVenueTool, getUpcomingShowsAtVenueTool],
});
```

### 2. Autonomous Newsletter Curator (Issue #101 / #102 / #103)
```typescript
export const newsletterCuratorAgent = new Agent({
  name: 'NewsletterCurator',
  model: 'gemini-3.6-flash',
  description:
    'Curates the weekly EZ Vibes live music email newsletter following the 70/20/10 rule and stages drafts in Beehiiv.',
  instruction: `
You are the Executive Editor of the EZ Vibes Weekly Dispatch.

Operational Protocol:
1. Fetch approved concerts for the target 7-day window via fetchApprovedConcerts.
2. Query co-billing recommendations to identify connected lineups via getCoBillRecommendations.
3. Formulate the 70/20/10 curation balance (70% anchor staples, 20% emerging jam/indie co-bills, 10% wildcards).
4. Verify every ticket URL via verifyTicketUrl before including it.
5. Stage the completed draft into Beehiiv with status='draft' via stageBeehiivDraft.
6. Under no circumstances may you publish directly to live subscribers without human admin review.
`,
  tools: [
    fetchApprovedConcertsTool,
    getCoBillRecommendationsTool,
    verifyTicketUrlTool,
    stageBeehiivDraftTool,
  ],
});
```

### 3. Multimodal Flyer Ingestion Agent (Issue #53 / ADR Ingestion v2)
```typescript
export const flyerIngestionAgent = new Agent({
  name: 'FlyerIngestionCritic',
  model: 'gemini-3.6-flash',
  description:
    'Parses concert poster images to extract headliners, support acts, dates, and venues, performing sanity validation before saving concert candidates.',
  instruction: `
You are the Multimodal Concert Flyer Inspector for Nido.

Operational Protocol:
1. Extract date, headliner, support acts, and venue from the poster image.
2. Cross-reference venue hints with the catalog via lookupCuratedVenue.
3. Check for year boundaries (e.g. flyers omitting the year during fall/spring tours).
4. Always write to concert_candidates with status='pending_review'. NEVER write directly to production concerts.
`,
  tools: [lookupCuratedVenueTool, saveConcertCandidateTool],
});
```

---

## 7. The Four ADK Execution & Deployment Methods

An ADK agent's `agent.py` code remains identical regardless of how it is executed. ADK provides four distinct runtime execution modes:

```
                                  ┌───────────────────────────────┐
                                  │           agent.py            │
                                  │ (root_agent = my_agent)       │
                                  └───────────────┬───────────────┘
                                                  │
         ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
         ▼                        ▼                               ▼                        ▼
  [1. adk web]              [2. adk run]                [3. adk api_server]        [4. Programmatic]
  Visual web portal         Terminal interactive        REST API Service           Embedded in code
  (port 8000 dev UI)        (headless / CI/CD)          (Uvicorn + OpenAPI docs)   (Runner + SessionService)
```

### Execution Comparison Matrix

| Method | Execution Syntax | Primary Audience & Use Case | Session Persistence |
| :--- | :--- | :--- | :--- |
| **1. Visual Web UI** | `adk web` | Visual development, prompt iteration, inspecting tool payloads | In-browser |
| **2. Terminal CLI** | `adk run <agent>` | Fast command-line interaction, headless VM debugging, CI/CD smoke testing | Process lifecycle |
| **3. REST API Server** | `adk api_server <agent>` | Exposing the agent as a REST service with interactive OpenAPI docs (`/docs`). Ideal for Cloud Run deployment | Client / Session store |
| **4. Programmatic SDK** | `Runner` + `SessionService` | Deep integration into backend services (Python or TypeScript `@google/adk`). Fine-grained execution control | Custom (InMemory or Database) |

### Enterprise GCP Runtime Configuration (Vertex AI vs. AI Studio)

ADK supports instant backend switching without modifying agent code:

```bash
# Option A: Gemini Developer API (Google AI Studio - Fast prototyping)
GOOGLE_API_KEY="AIzaSy..."
GOOGLE_GENAI_USE_VERTEXAI="FALSE"

# Option B: Gemini Enterprise / Vertex AI (Google Cloud Production)
GOOGLE_GENAI_USE_VERTEXAI="TRUE"
GOOGLE_CLOUD_PROJECT="nido-api-81555493719"
GOOGLE_CLOUD_LOCATION="us-east1"
# Authenticated automatically via Google Cloud Application Default Credentials (ADC) or Workload Identity
```

---

## 8. ADK Quick Reference Card & Cheat Sheet

### Essential CLI Commands
```bash
# Environment Setup
python3 -m venv adk-env               # Create virtual environment
source adk-env/bin/activate           # Activate (macOS/Linux)
adk-env\Scripts\activate              # Activate (Windows)
pip install google-adk                # Install Python ADK

# Create Agents
adk create my_agent                   # Create Python code-based agent (agent.py)
adk create --type=config my_agent     # Create YAML config-based agent (root_agent.yaml)

# Run Agents
adk web                               # Web interface (from agent dir)
adk web my_agent                      # Web interface (from parent dir)
adk run                               # Interactive terminal execution
adk api_server                        # REST API server with /docs
```

### Pattern 1: Python-Based Agent (`agent.py`)
```python
from google.adk.agents import Agent

root_agent = Agent(
    model="gemini-flash-latest",
    name="math_tutor_agent",
    description="Helps students learn algebra by guiding them through problem-solving steps.",
    instruction="""You are a patient and encouraging algebra tutor.
    Guide students to discover solutions rather than giving direct answers."""
)
```

### Pattern 2: YAML-Based Agent (`root_agent.yaml`)
```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/google/adk-python/refs/heads/main/src/google/adk/agents/config_schemas/AgentConfig.json
name: math_tutor_agent
model: gemini-flash-latest
description: Helps students learn algebra by guiding them through problem-solving steps.
instruction: |
  You are a patient and encouraging algebra tutor.

  Your teaching approach:
  1. Break down the problem into smaller, manageable steps.
  2. Guide students to discover answers rather than giving them directly.
  3. Always maintain a supportive, patient tone.
```

### Pattern 3: Programmatic Execution (`Runner` + `SessionService`)
```python
import asyncio
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

agent = Agent(
    model="gemini-flash-latest",
    name="math_tutor",
    instruction="You are a patient math tutor."
)

session_service = InMemorySessionService()
runner = Runner(agent=agent, app_name="my_app", session_service=session_service)

async def run_agent():
    session = await session_service.create_session(
        app_name="my_app", user_id="user_1", session_id="session_1"
    )

    user_message = Content(
        role="user",
        parts=[Part.from_text(text="How do I solve 2x + 5 = 13?")]
    )

    async for event in runner.run_async(
        user_id="user_1", session_id="session_1", new_message=user_message
    ):
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    print(part.text)

if __name__ == "__main__":
    asyncio.run(run_agent())
```

---

## 9. Next Steps in GEAR 2 Path
- **Graph-Based Workflows:** Chaining agents into Directed Acyclic Graphs (DAGs) using ADK state machines.
- **Session State Persistence:** Migrating from `InMemorySessionService` to Cloud SQL / Redis-backed persistent sessions.
- **Model Context Protocol (MCP):** Exposing Nido's catalog services as MCP endpoints to allow external tools and Jules to query live data cleanly.
