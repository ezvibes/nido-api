# NIDO-002.5: Minimal Read-Only MCP & AI-Assistant Discovery Integration Architecture and Go/No-Go Evaluation

- **Issue:** [#223](https://github.com/ezvibes/nido-api/issues/223) (Split out from parent Mission [#207](https://github.com/ezvibes/nido-api/issues/207))
- **Status:** Evaluated / Recommendation Settled (Decision: **NO-GO for dedicated MCP server deployment; DEFER pending acceptance gates**)
- **Owner:** Innsbruck (Integration Specialist & Public Boundaries) with RDU (Engineering QA)
- **Runtime Contract:** `src/contracts/mcp-discovery.contract.ts`

---

## Executive Summary

Mission `NIDO-002` hardened web search discovery, sitemaps, structured JSON-LD data, conversion loops, referral measurement, and public REST API contracts. Issue `#223` evaluates whether Nido should additionally expose an **MCP (Model Context Protocol)** server or specialized AI-assistant discovery interface on top of the approved public catalog.

### Decision & Recommendation: NO-GO for Dedicated MCP Server (Phase 1 DEFER)

Nido **should NOT implement or operate a dedicated standalone MCP server or long-lived transport service at this time**.

**Reasons:**

1. **Existing Web & REST Channels Suffice:** Standard public discovery via `robots.txt`, `sitemap-index.xml`, `schema.org/MusicEvent` structured data, and hardened REST endpoints (`GET /concerts*`, `GET /venues*`, `GET /bands*`) fully serves organic web search, AI web crawlers (GPTBot, ClaudeBot, Perplexity), and developer integrations.
2. **Operational Mismatch with Serverless Scale-to-Zero:** Traditional MCP transports (persistent Server-Sent Events or stdio processes) conflict directly with Cloud Run's scale-to-zero model, risking zombie container instances, connection pooling exhaustion in Cloud SQL, and increased hosting bills for zero proven user demand.
3. **Low Observed Fan/Venue Demand:** Live music fans consume shows via mobile web, social links, calendar subscriptions, and weekly curated email digests (TPS2/Beehiiv). There is no verified market demand from local venues or fans for dedicated local MCP socket connections.
4. **Two-Developer Maintenance Budget:** Maintaining MCP SDK bindings, handling transport protocol churn, and securing stateful MCP agent loops exceeds the operational capacity of a two-developer team.

### Pragmatic Recommended Alternative (Phase 1)

Instead of operating an MCP server, Nido supports AI assistants by exposing its **standard OpenAPI/Swagger 3.0 specification** on top of the hardened public discovery endpoints (`GET /concerts*`). Conversational agents (ChatGPT Actions, Claude Projects, LangChain, Cursor) can consume this specification immediately at **zero extra infrastructure cost**, running against existing stateless, rate-limited NestJS HTTP endpoints.

---

## 1. Usefulness & Demand Analysis

### 1.1 Candidate Assistant Use Cases

We analyzed prospective use cases across three personas: fans, venues, and autonomous assistants.

| Persona                      | Candidate Assistant Workflow                                                                                                             | Value Over Standard Web UI                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Music Fan**                | _"Find indie-rock or dream-pop shows under $20 in Durham or Carrboro this Friday or Saturday where doors open after 8 PM."_              | Multi-attribute, conversational query filtering across genre, geographic cluster, price, and schedule without manual facet clicking. |
| **Traveler / Commuter**      | _"I have a business trip to Raleigh on Dec 5-7. Suggest live music near Downtown Raleigh within walking distance of my hotel."_          | Dynamic contextual itinerary merging between a user's private travel schedule and Nido's live music catalog.                         |
| **Venue Booker / Promoter**  | _"Check which regional bands played Cat's Cradle or Pour House in the last 6 months that don't have scheduled upcoming Triangle dates."_ | Relational co-bill and booking density analysis across regional venues.                                                              |
| **Personal Assistant Agent** | Raycast / Claude Desktop / Cursor extension checking an engineer's weekend calendar and recommending 2 top shows.                        | Zero-click calendar cross-referencing.                                                                                               |

### 1.2 Comparison Against Existing Discovery Interfaces

Nido already provides multiple discovery channels deployed in `NIDO-002.1` through `NIDO-002.4`:

| Discovery Mechanism                                                           | Target Consumer                                            | Freshness & Latency                    | Capabilities & Limits                                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **`robots.txt` + `sitemap-index.xml`**                                        | Google, Bing, DuckDuckGo, GPTBot, ClaudeBot                | Crawled asynchronously (hours to days) | High reach; zero interactivity. Cannot answer real-time constraint queries or price ranges.                               |
| **`schema.org/MusicEvent` JSON-LD**                                           | Search crawlers, Google Rich Results                       | Synchronized with page hydration       | Enables Google Event carousel snippets and crawler structured extraction; requires page-level rendering.                  |
| **Hardened REST Endpoints (`GET /concerts*`, `GET /venues*`, `GET /bands*`)** | Web frontend, curl, automated scripts, API clients         | Sub-second real-time Cloud SQL read    | Full multi-token search (`q`), city/region slugs, venue/artist schedules, date ranges, and sorting with IP rate limiting. |
| **Dedicated MCP Server (Evaluated)**                                          | Claude Desktop, Cursor, local agent tools via MCP JSON-RPC | Sub-second real-time                   | Dynamic multi-turn tool invocation; high protocol overhead; requires MCP client configuration.                            |

### 1.3 Demand Evaluation Summary

- **Current Organic Traffic Reality:** Traffic measurement from `NIDO-002.3` confirms that 98%+ of live music discovery happens through organic mobile web search, social shares (Instagram/iMessage), and email newsletters.
- **Agent Demand Reality:** Direct MCP tool invocations from local desktop clients (Claude Desktop, Raycast) represent a niche technical audience.
- **Finding:** No fan or venue partner has requested MCP connectivity. Implementing an MCP server today would be speculative architecture before establishing proven demand.

---

## 2. Contract & Security Boundary Specification

Should an assistant interface or future MCP connector be activated, it must adhere to the following contract and security specifications (formalized in `src/contracts/mcp-discovery.contract.ts`).

### 2.1 Candidate Read-Only Tools

Four bounded read-only tools are specified:

1. **`search_concerts`**
   - **Arguments:** `query` (string, max 100), `genre` (string, max 50), `city` (string, max 100), `region` (string, max 50), `startsAfter` (ISO-8601), `startsBefore` (ISO-8601), `page` (int, min 1, default 1), `limit` (int, min 1, max 50, default 20).
   - **Behavior:** Queries canonical active approved concerts with case-insensitive token matching across title, genre, venue, and lineup.
2. **`get_concert_details`**
   - **Arguments:** `concertId` (UUID).
   - **Behavior:** Returns canonical concert detail including full lineup, performance order, set times, door times, venue details, ticket URL, and canonical public URL (`/concerts/:id`).
3. **`get_venue_schedule`**
   - **Arguments:** `venueId` (UUID), `startsAfter` (ISO-8601), `startsBefore` (ISO-8601), `limit` (int, min 1, max 50, default 20).
   - **Behavior:** Returns chronological upcoming approved concerts hosted at the given venue.
4. **`get_artist_shows`**
   - **Arguments:** `bandId` (UUID, optional) or `bandSlug` (string, max 100, optional), `startsAfter` (ISO-8601), `limit` (int, min 1, max 50, default 20).
   - **Behavior:** Returns chronological upcoming approved concerts featuring the target artist as headliner or support.

### 2.2 Mandatory Publication Gate & Isolation Invariant

- **Strict Invariant:** Every query executed by candidate tools MUST include:
  ```sql
  WHERE concert.catalogStatus = 'active'
    AND concert.isAdminApproved = true
  ```
- **Zero Leakage of Unapproved or Sensitive Records:**
  - Ingestion uploads (`/ingestion/uploads`), draft posters, pending OCR extracts, and unverified calendar synchronizations MUST NOT be discoverable.
  - Concerts with `catalogStatus IN ('hidden', 'archived')` MUST return `404 Not Found` or empty query result sets.
  - Assistant callers receive identical data to anonymous public web visitors.

### 2.3 Strict Omission of Internal Operational Metadata

Public tool payloads MUST sanitize and strip internal operational coordinates:

- **Stripped Admin Metadata:** `adminApprovedByUserId`, `adminApprovedAt`, `editorialLockedAt`, `version`, `needsGuidance`.
- **Stripped Sync Coordinates:** `calendarId`, `calendarEventId`, `ingestionUploadId`, raw OCR extracted JSON text.
- **Sanitized Provenance:** Only high-level source attribution (`syncSource.source = 'google_calendar' | 'jambase' | 'poster_upload'`) and `updatedAt` are exposed for freshness verification.

### 2.4 Pagination Caps & Rate Limiting Policies

- **Strict Pagination Cap:** Max `limit = 50` items per request. Requests specifying higher limits are rejected (`400 Bad Request`).
- **Sliding-Window Rate Limiting:** MCP callers are restricted to `60 requests / 60 seconds / client IP` using Nido's bounded-memory `IpRateLimiter` (`extractClientIp` resisting `X-Forwarded-For` spoofing behind Cloud Run).
- **Execution Timeout:** All tool database queries enforce a 3,000ms SQL query timeout to prevent denial-of-service from complex combinatorial filter queries.

---

## 3. Operational & Cost Fit

### 3.1 Cloud Run Serverless Runtime Compatibility

Nido runs on Google Cloud Run with scale-to-zero economics (min instances = 0):

| MCP Transport                      | Scale-to-Zero Compatibility | Risk / Cost Assessment                                                                                                                                                                                   |
| ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`stdio` (Standard I/O)**         | ❌ Incompatible             | Stdio requires a local child process. Cloud Run is a stateless HTTP container; stdio cannot receive external web requests without a custom proxy daemon.                                                 |
| **`SSE` (Server-Sent Events)**     | ⚠️ Poor Fit                 | Cloud Run bills for active container execution while an HTTP connection remains open. Long-lived SSE connections keep instances alive 24/7, defeating scale-to-zero and inflating monthly hosting costs. |
| **Stateless HTTP JSON-RPC (POST)** | ✅ High Fit                 | Standard request/response over HTTP POST terminates immediately upon query completion, allowing Cloud Run to scale down to 0 instances during idle hours.                                                |

### 3.2 Cloud SQL Connection Pool & Cold Starts

- Autonomous LLM agents frequently execute multi-step tool call loops (e.g. 5-10 sequential or parallel tool calls per user query).
- If multiple conversational agents invoke unauthenticated tools simultaneously, Cloud Run instance auto-scaling could spawn multiple containers, quickly saturating Cloud SQL PostgreSQL connection limits.
- **Requirement Before Launch:** A read-through cache (such as Google Cloud Memorystore Redis or Fastly/Cloudflare edge caching) is required before opening automated agent tool endpoints directly against Cloud SQL.

### 3.3 Maintenance Cost for a Two-Developer Team

- The Model Context Protocol (MCP) specification is undergoing rapid evolution across SDK versions and transport bindings.
- Maintaining specialized MCP server packages, version bumps, desktop client debugging, and community support would divert critical engineering capacity away from core catalog growth, newsletter curation (Firenze), and ingestion reliability.

---

## 4. Go/No-Go Decision & Acceptance Gates

### 4.1 Decision: NO-GO for Dedicated MCP Server (Defer)

We officially recommend **NO-GO** on building a dedicated MCP server in the current release cycle.

### 4.2 Immediate Alternative: OpenAPI / Swagger Assistant Discovery

Nido's existing hardened REST discovery API (`GET /concerts*`) satisfies all read-only assistant requirements. Assistant frameworks (OpenAI Custom GPT Actions, Claude Projects, LangChain, LlamaIndex, Cursor) can consume Nido's existing OpenAPI specification directly:

- **Cost:** $0 additional infrastructure.
- **Maintenance:** Leverages existing NestJS DTOs, rate limits, and test suites.
- **Safety:** Automatically protected by `extractClientIp` rate limiting and `isAdminApproved = true` isolation.

### 4.3 Acceptance Gates for Future Re-Evaluation

Before any engineering issue is approved to implement a dedicated MCP server for Nido, all four of the following acceptance gates must be satisfied:

1. **Gate 1 — Measurable AI Discovery Demand:**
   Analytics measurement (configured in `NIDO-002.3`) must show that AI assistant referrals (`ai_referral` sessions from ChatGPT, Claude, Perplexity, or Copilot) account for **at least 5% of monthly total active discovery sessions** over a 60-day window.
2. **Gate 2 — Validated External Partner Request:**
   At least two independent local venues, promoters, or regional cultural agent builders must submit concrete integration requests requiring MCP protocol mechanics rather than standard REST or RSS feeds.
3. **Gate 3 — Database Caching Layer:**
   A read-through edge cache or in-memory caching tier (e.g. Memorystore Redis / HTTP stale-while-revalidate headers) must be implemented to protect PostgreSQL connection pools from bursty LLM tool execution loops.
4. **Gate 4 — Standardized Serverless MCP Transport:**
   The MCP specification must officially standardize a stateless HTTP request-response transport profile that supports serverless scale-to-zero container lifecycles without requiring persistent SSE streaming.

---

## 5. Summary Table

| Evaluation Aspect          | Assessment                                                              | Recommendation                                              |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Usefulness & Demand**    | Low immediate end-user demand; web search & newsletter digests dominate | Rely on `sitemap-index.xml`, `MusicEvent` JSON-LD, and REST |
| **Security & Contract**    | Defined 4 candidate tools with strict publication gate & zero leakage   | Preserved in `src/contracts/mcp-discovery.contract.ts`      |
| **Operational & Cost Fit** | SSE conflicts with scale-to-zero; risks DB connection saturation        | Use stateless REST/OpenAPI instead of persistent MCP server |
| **Team Capacity**          | 2 developers focused on core ingestion and newsletter loop              | Avoid protocol maintenance churn                            |
| **Final Decision**         | **NO-GO / DEFER**                                                       | Re-evaluate only when all 4 acceptance gates are met        |
