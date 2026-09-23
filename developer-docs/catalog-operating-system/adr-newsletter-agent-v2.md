# ADR: Autonomous Newsletter Curation Agent (v2)

Status: Proposed / In Development

Target: Newsletter Agent v2 Epic (GitHub #101)

Related Documents:
- `adr-multimodal-agent-ingestion-v2.md` (Companion Ingestion Agent ADR)
- `agent-development-harness-guide.md` (Testing, circuit breakers, and golden fixtures)
- GitHub Epic #101, Issues #102, #103, #104, #105, #106, #107
- `AGENTS.md` (Repository boundaries and test gates)

---

## 1. Context & Objectives

In Phase 1 (merged in PR #99), Nido established an automated weekly newsletter transport pipeline:
`Cloud Scheduler -> NestJS NewsletterService -> raw prompt context stuffing -> Gemini -> regex to HTML -> Beehiiv draft`.

While Phase 1 solves the mechanical transport to Beehiiv, it operates as a brittle, linear script:
1. **Context Window Stuffing:** Dumps a raw array of all database shows into the prompt context, creating high token costs and degradation as the catalog scales.
2. **Lack of Taste & Discovery ("Getting It"):** It can only summarize what is already in the database; it cannot unearth rising talent, co-billed acts, or festival undercards.
3. **Fragile Downstream Formatting:** Converting Markdown to Beehiiv HTML via regex risks malformed tags and API `422` rejections.
4. **No Link Verification:** Dead or 404 ticket links are passed directly to subscribers.

**Newsletter Agent v2** introduces an **Autonomous Live Music Curation Agent** powered by Google's **Agent Development Kit (`@google/adk`)** and **Gemini Enterprise Agent Platform**.

---

## 2. Architectural Boundary: Clean Separation of Concerns

A core architectural principle is maintaining a strict boundary between the **NestJS Application Core** and the **AI Agent Layer**:

```text
┌──────────────────────────────────────┐     ┌───────────────────────────────────────┐
│     NESTJS / NIDO CORE (The Body)    │     │      GOOGLE ADK (The Mind)            │
│                                      │     │                                       │
│ • PostgreSQL transactions & TypeORM  │◄────┤ • Manages the ReAct Decision Loop     │
│ • Cloud SQL connection pooling       │     │ • Decides WHICH tool to call & WHEN   │
│ • Relational Co-Bill queries         │     │ • Synthesizes tone and editorial voice│
│ • HTTP Ingress & Firebase Auth       │     │ • Enforces circuit breakers (max turns│
│ • Raw Beehiiv v2 HTTP client calls   │     │ • Evaluates ticket link health        │
└──────────────────────────────────────┘     └───────────────────────────────────────┘
```

- **NestJS Core owns the "How":** Database queries, connection pools, external REST calls, and TypeORM entities.
- **ADK owns the "What" & "Why":** Deciding which tools to invoke, reasoning over data sufficiency, evaluating tone, and structuring the output.

---

## 3. How the Agent "Gets It" (Taste, Co-Billing, & Serendipity)

To make recommendations that resonate deeply with fans and industry professionals, the agent must not rely solely on simple genre string matching.

### 3.1 The Co-Billing Discovery Graph (Relational Today, Vector Tomorrow)
How human curators find new artists: they notice when an unknown band shares bills with bands they already love.

* **Phase 1 (Today in Cloud SQL PostgreSQL):**
  A pure relational self-join on `concert_band_lineup` querying bands that co-billed with our trusted scene favorites at reputable venues:
  ```sql
  SELECT DISTINCT candidate_band.name, candidate_band.id, venue.name as venue_name
  FROM concert_band_lineup l1
  JOIN concert_band_lineup l2 ON l1.concert_id = l2.concert_id AND l1.band_id != l2.band_id
  JOIN bands candidate_band ON l2.band_id = candidate_band.id
  JOIN concerts c ON l1.concert_id = c.id
  JOIN venues venue ON c.venue_id = venue.id
  WHERE l1.band_id IN (:...favoriteBandIds)
    AND venue.region_slug = 'nc';
  ```
* **Phase 2 (Future Vector Roadmap):**
  Enable native `pgvector` in Google Cloud SQL (`CREATE EXTENSION vector;`) to index 768-dimensional audio and cultural vibe vectors, migrating to **Vertex AI Vector Search** when catalog scale exceeds millions of statewide entities.

### 3.2 The 70 / 20 / 10 Curation Formula
The agent balances its weekly recommendations across three tiers:
- **70% Core Identity / Must-Sees:** The heavy hitters and trusted scene favorites.
- **20% Adjacent Discoveries:** Artists found via co-billing graphs and regional buzz.
- **10% High-Serendipity Wildcards:** Under-the-radar international rhythms (Afrobeat, Cumbia, Salsa, Zydeco, Reggae), experimental jazz, or small-room club debuts.

### 3.3 The Dual-Audience Intelligence Payload ("Scan on the Scene")
- **For Fans:** Weekend curated itinerary + **Community Miracle Meter** (Free and Pay-What-You-Can shows).
- **For Industry Pros (Tour Managers, Promoters, A&R):** Live **Genre Distribution (%)**, **Weekend Flashpoint Density** (sold-out momentum), and emerging undercard signals.

---

## 4. ADK Tool Registry Specification

The agent is equipped with 4 isolated tools wrapping NestJS services using strict Zod parameter schemas:

### Tool 1: `fetchApprovedConcertsTool`
- **Purpose:** On-demand retrieval of canonical concerts from Cloud SQL.
- **Input (Zod):**
  ```typescript
  z.object({
    startDate: z.string().describe('ISO start date'),
    endDate: z.string().describe('ISO end date'),
    region: z.string().default('nc'),
    cities: z.array(z.string()).optional(),
    genres: z.array(z.string()).optional(),
    limit: z.number().default(20),
  })
  ```
- **Execution:** Calls `ConcertService.fetchNCConcerts`.

### Tool 2: `getCoBillRecommendationsTool` (The Graph Discovery Tool!)
- **Purpose:** Traverses the relational co-billing graph to find artists connected to EZ Vibes favorites.
- **Input (Zod):**
  ```typescript
  z.object({
    anchorBandIds: z.array(z.number()).describe('IDs of core favorite artists'),
    targetDateRange: z.object({ start: z.string(), end: z.string() }),
    preferredVenues: z.array(z.string()).optional(),
  })
  ```
- **Execution:** Executes co-billing join query against `concert_band_lineup`.

### Tool 3: `verifyTicketUrlTool`
- **Purpose:** Active link verification to prevent dead 404 links from reaching subscribers.
- **Input (Zod):**
  ```typescript
  z.object({
    urls: z.array(z.string().url()),
  })
  ```
- **Execution:** Performs HTTP `HEAD`/`GET` requests; returns reachable vs. broken URLs.

### Tool 4: `stageBeehiivDraftTool`
- **Purpose:** Stages formatted draft directly to Beehiiv API v2.
- **Input (Zod):**
  ```typescript
  z.object({
    title: z.string(),
    htmlContent: z.string(),
    postTemplateId: z.string().optional(),
    status: z.literal('draft'), // Strictly enforces draft-only authority
  })
  ```
- **Execution:** Invokes `BeehiivService.createDraftFromHtml`.

---

## 5. Continuous Learning & Feedback Memory

How the agent improves week over week without fine-tuning:
1. **Editorial Diff Ingestion:** When administrators edit or remove a recommended show in the Beehiiv draft, the diff is captured into an `editorial_feedback` record.
2. **Dynamic In-Context Memory:** At the start of every curation run, the agent queries:
   *"Retrieve top 3 recent editorial corrections made by Evan."*
   These are injected into the prompt as few-shot negative and positive examples.

---

## 6. Enterprise Cloud Security (PCA Standard)

1. **Google Cloud OIDC Token Authentication:**
   - Cloud Scheduler authenticates to Cloud Run using Google-signed OpenID Connect (OIDC) Service Account tokens (`roles/run.invoker`).
   - Deprecates static shared secret headers (`X-Scheduler-Secret`).
2. **Keyless Vertex AI SDK:**
   - Model inference executed via `@google-cloud/vertexai` using Cloud Run's runtime Service Account (`roles/aiplatform.user`).
   - Zero static `GEMINI_API_KEY` in production `.env`.

---

## 7. Delivery Roadmap & Implementation Slices

| Step | GitHub Issue | Focus Area |
| :--- | :--- | :--- |
| **Spike** | **#107** | **ADK Venue Scout & Vibe Inspector CLI Spike** (Proves out ADK tool invocation locally) |
| **Slice 1**| **#102** | **ADK Tool Registry & Zod Data Contracts** (The 4 core tools) |
| **Slice 2**| **#103** | **Autonomous ReAct Orchestration & Critique Loop** |
| **Slice 3**| **#104** | **Native Beehiiv JSON Block Generation (`responseSchema`)** |
| **Slice 4**| **#105** | **Cloud Scheduler Google OIDC Authentication Migration** |
| **Slice 5**| **#106** | **Local Development Harness & Brand Voice Benchmark** |
