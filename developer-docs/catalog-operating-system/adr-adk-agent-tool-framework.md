# ADR: Nido Unified ADK Agent Tool Framework (Firenze, Bologna & Beyond)

## Status
**Accepted & Implemented (Core Foundation)**

## Context
Nido has transitioned from static prompt-stuffing to autonomous ReAct agent execution powered by **Google's Agent Development Kit (ADK v2.1)** and **Gemini 3.6/3.8 Flash**. 

Initially, agent tools were scoped narrowly to newsletter draft generation in **Firenze**. However, as Nido expands to multi-channel operations (social media generation, catalog search, subscriber engagement analytics) and specialized agents like **Bologna** (Documentation and Teaching Agent) and **Munchen** (Venue Scout Agent), the system requires a **solidified, uniform tool framework**.

This framework ensures that any agent in Nido's connected city network can be safely extended with new capabilities in a modular, type-safe, and testable manner.

---

## The Unified Nido Tool Framework Architecture

Every Nido tool follows a standardized 5-layer lifecycle:

```
+--------------------------------------------------------------------------+
| 1. Contract & Validation Layer (Zod Schema)                              |
|    - Strict argument validation (ISO dates, bounded limits, enum arrays) |
|    - Prompt injection protection & untrusted input sanitization           |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| 2. Encapsulated Execution Service (NestJS Provider)                      |
|    - Enforces DB constraints, TypeORM queries, or external MCP APIs     |
|    - Implements offline mock fallbacks for CI and non-production testing |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| 3. ADK FunctionTool Wrapper                                              |
|    - Wraps handler in `@google/adk` FunctionTool                          |
|    - Declares explicit tool name and clear LLM-facing description         |
|    - Attaches `requireConfirmation` flag for mutating/remote operations   |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| 4. Agent Tool Registry (Dependency Injection)                            |
|    - Scoped per agent (e.g. NewsletterAgentToolRegistry, DocToolRegistry)|
|    - Exposes immutable tool collections to the ADK Runner                 |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| 5. Deterministic Evaluation & Harness Verification                       |
|    - Unit test for schema and service layer                              |
|    - Offline test harness verifying tool invocation without live tokens   |
+--------------------------------------------------------------------------+
```

---

## Universal Tool Specification Pattern

To add a new tool to any Nido agent, engineers implement this standard pattern:

```typescript
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// 1. Zod Input Schema
export const ExampleToolInputSchema = z.object({
  query: z.string().min(1).max(200).describe('Search query string'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum items to return'),
});

export type ExampleToolInput = z.infer<typeof ExampleToolInputSchema>;

// 2. Factory Function returning FunctionTool
export function createExampleTool(service: ExampleService): FunctionTool {
  return new FunctionTool({
    name: 'exampleTool',
    description: 'Concise explanation guiding Gemini when and why to invoke this tool.',
    parameters: ExampleToolInputSchema,
    execute: async (args: ExampleToolInput) => {
      try {
        const result = await service.execute(args);
        return { success: true, data: result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  });
}
```

---

## Firenze Tool Extensions Roadmap

Firenze (Newsletter & Editorial Agent) uses this framework for three immediate capability expansions:

### 1. Multi-Facet Catalog Search (`searchCatalogConcertsTool`)
* **Purpose:** Enables Firenze to find concerts matching specific editorial criteria without scanning full date dumps.
* **Parameters:**
  * `genres`: Optional array of canonical genre strings (e.g., `['Jazz', 'Bluegrass']`).
  * `venues`: Optional array of venue names or IDs.
  * `cities`: Optional array of cities (e.g., `['Durham', 'Raleigh']`).
  * `maxTicketPrice`: Optional ceiling filter for budget-friendly recommendations.
  * `startDate` & `endDate`: Bounded ISO date window.
* **Safety:** Queries only `admin_approval = true` records in PostgreSQL.

### 2. Multi-Platform Social Media Pack (`generateSocialPackTool`)
* **Purpose:** Repurposes curated Top Picks into platform-tailored social copy.
* **Outputs:**
  * **Instagram:** Hook blurb, carousel slide summaries, artist `@handles`, and "Link in bio" CTA.
  * **Discord / Twitter:** Short punchy bulleted alerts with verified ticket links.
* **Safety:** Generates markdown/text proposals; zero direct publishing to social networks without human review.

### 3. Newsletter Engagement Analytics & Optimization (`analyzeNewsletterEngagementTool`)
* **Purpose:** Connects to Beehiiv MCP (`get_posts`) to inspect past edition metrics (open rate, click rate, link popularity).
* **Outputs:** Data-driven recommendations for subject lines, optimal pick counts, and layout adjustments before staging new drafts.
* **Safety:** Read-only analysis; cannot alter historic publication records.

---

## Bologna Tool Architecture (Teaching & Documentation Agent)

**Bologna** is Nido's Documentation and Teaching Agent. Under this unified framework, Bologna gains its own **Documentation Tool Registry** (`DocAgentToolRegistry`), transforming it from a conceptual documentation persona into an interactive ADK agent.

### Bologna's Standard Toolset:

1. **`readArchitectureDocTool`**:
   * Reads approved ADRs, context maps, and agent specifications from `developer-docs/catalog-operating-system/`.
   * Guarantees Bologna explains established architecture rather than hallucinating intended behavior.

2. **`inspectTestEvidenceTool`**:
   * Inspects test outputs and harness evaluation metrics (`test/agent-harness/reports/latest.json`).
   * Ensures Bologna only cites verified, passing capabilities when documenting system status.

3. **`generateContributorGuideTool`**:
   * Generates step-by-step onboarding walkthroughs, runbooks, and cheat sheets for engineers and support staff based on live codebase structure.

4. **`auditAgentBoundariesTool`**:
   * Audits agent instructions and tool registries across all agents (Firenze, Munchen, Venezia).
   * Verifies that human approval gates (e.g., `draft`-only staging, zero autonomous email sends, zero unapproved catalog writes) are strictly documented and enforced.

---

## Non-Negotiable Tool Safety Boundaries

1. **Human-in-the-Loop Approval:** No tool may execute destructive writes, financial transactions, or public broadcasting without human confirmation.
2. **Draft-Only Staging:** External platform integrations (Beehiiv, social media, CRM) must strictly enforce `status: "draft"`.
3. **Fail-Closed Input Validation:** Every tool argument must pass Zod schema parsing before reaching database or network services.
4. **Deterministic CI Harness:** Every tool must support offline execution (`mock: true` or synthetic fixtures) so test suites can run without consuming live LLM or API tokens.
