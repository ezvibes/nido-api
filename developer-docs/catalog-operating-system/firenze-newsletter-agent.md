# Firenze: The Newsletter And Editorial Agent

Firenze is Nido's **Newsletter and Editorial Agent**. It helps a human editor
turn trustworthy concert information into a useful live-music newsletter draft.

The name remembers where the idea took shape: Firenze, or Florence, Italy. It is
also a reminder that this project is about more than automating content. Firenze
exists to help people discover authentic music, communities, and experiences in
real places.

## Start Here

Firenze is being designed as an editorial assistant, not an autonomous
publisher. A newsletter creator should be able to ask it for a date range and a
region, inspect the concerts it found, shape the story, and approve a draft.
Firenze can do the repetitive evidence-gathering work while the human remains
responsible for taste, context, accuracy, and the decision to send.

In plain English, Firenze is intended to:

- find concerts that Nido administrators have approved;
- help an editor discover meaningful artist and lineup connections;
- check ticket links before they reach readers;
- assemble a newsletter draft in the EZ Vibes voice;
- place that draft in Beehiiv for review;
- stop before publication and wait for a human.

Firenze is not a replacement for a local music editor. It does not attend shows,
know a community by instinct, or have authority to decide what Nido publishes.
Its recommendations are evidence to consider, not facts to accept blindly.

## Firenze And TPS2

**TPS2** is the Weekly Top Picks newsletter program and workflow. **Firenze** is
the agent responsible for helping people operate and improve that program. TPS2
is not a separate agent.

Firenze owns the reusable curation guidance for the program: North Carolina
focus, core genre preferences, partner-aware review, authentic voice, prompt
refinement, and the pre-publication checklist. Those rules guide editorial
review; they do not override catalog approval, source evidence, disclosure
requirements, or a human editor's judgment.

The repository skill is located at
`.agents/skills/firenze-newsletter/SKILL.md`. Its directory and metadata use the
canonical agent name, and the shared agent adapters route newsletter work to it.
The TPS2 curation rules now live inside that Firenze skill rather than defining a
separate agent.

## Why Firenze Exists

Creating a strong local-music newsletter requires several different kinds of
work: maintaining an accurate calendar, noticing interesting lineups, checking
links, choosing a balanced group of shows, writing useful copy, and preparing the
publishing system. Doing all of that manually every week limits how much time an
editor can spend listening, talking with artists, and understanding the scene.

Firenze separates the repeatable work from the human work:

| Firenze helps with                   | The human editor owns                                |
| ------------------------------------ | ---------------------------------------------------- |
| Retrieving approved catalog evidence | Editorial judgment and local context                 |
| Finding possible lineup connections  | Deciding which stories matter                        |
| Checking whether ticket URLs respond | Confirming that details are genuinely correct        |
| Structuring a draft                  | Editing voice, emphasis, and claims                  |
| Staging a Beehiiv draft              | Final approval, scheduling, publication, and sending |

This boundary was defined intentionally. Nido's catalog is the source of
evidence, AI helps organize and interpret that evidence, and a person remains the
publisher.

## How A Person Will Use Firenze

A future weekly workflow should feel simple:

1. An editor chooses the newsletter dates and optional filters such as city,
   venue, or genre.
2. Firenze asks Nido for active concerts that an administrator has approved.
3. Firenze may look for relevant co-bill connections to surface artists worth
   another look.
4. Firenze proposes a selection and draft using the configured editorial voice.
5. Firenze checks the ticket links included in the draft.
6. The editor reviews the evidence, corrects the copy, and approves or rejects
   the request to create a Beehiiv draft.
7. Beehiiv receives a **draft only**. A person reviews and publishes it through
   the normal editorial process.

```text
Approved Nido catalog
        |
        v
Evidence and possible discoveries
        |
        v
Firenze organizes and drafts
        |
        v
Ticket links are checked
        |
        v
Human confirms draft staging
        |
        v
Beehiiv draft -> human edits -> human publishes
```

Firenze should show enough source detail for the editor to understand why a
concert was considered. An editor should never have to trust an unexplained AI
claim merely because it sounds confident.

## The Parts Working Together

### PostgreSQL And The Nido Catalog

PostgreSQL stores Nido's concert, venue, artist, lineup, and approval data. It is
the durable source of catalog evidence. The newsletter tools ask NestJS services
to query this database through TypeORM; the AI model does not write SQL or open a
database connection itself.

The active catalog tool returns only concerts that are both active and approved
by a Nido administrator. It limits agent requests to a 366-day date window and
bounded result count. PostgreSQL applies region, city, venue, genre, editorial,
and exclusion filters before the limit. This protects the newsletter from
treating an unreviewed import or user submission as publication-ready information
or losing valid filtered matches behind a pre-filter scan ceiling.

The co-bill tool also uses PostgreSQL. It examines existing artist-to-concert
lineup relationships to find evidence such as two artists sharing a bill. It
returns only candidates that also have an active, admin-approved concert in the
requested upcoming date range. That is a useful discovery signal, but not proof
that two artists sound alike or that either belongs in the newsletter.

### ADK

Google's Agent Development Kit, or **ADK**, gives Firenze a controlled way to
choose and call tools. A tool is a narrow capability, such as fetching approved
concerts or checking a ticket URL. ADK does not replace Nido's business rules;
it coordinates calls to services that already enforce those rules.

The autonomous ADK orchestration loop is fully implemented in production via
`NewsletterService.generateNewsletter`. Firenze executes via `@google/adk`'s `Runner`
with persistent session memory provided by `TypeOrmSessionService`, dynamically
invoking tools from `NewsletterAgentToolRegistry`.

### Zod

Zod is a data-contract library. It checks the information moving between the AI
model and each tool. For example, it can require real ISO date strings, reject
unexpected fields, limit a request to a safe number of records, and ensure a
Beehiiv response still says `draft`.

Zod is useful here because model-generated tool arguments are untrusted input.
It complements, rather than replaces, the validation used by Nido's HTTP APIs
and the business rules enforced by NestJS services.

### Ticket URL Verification

Firenze can ask a bounded URL-checking service whether public ticket links are
reachable. The service limits each batch, times out slow requests, rechecks
redirect destinations, blocks private or local network addresses, and pins each
validated DNS address into the network connection. It reports links as reachable,
unreachable, blocked, or indeterminate.

A reachable result means the web server responded. It does **not** prove that the
page sells tickets for the correct concert, that tickets remain available, or
that the price is accurate. The editor must still inspect important links.

### Beehiiv Draft Staging & MCP Integration

Firenze's draft staging uses a resilient dual-transport architecture designed for
both automated agent workflows and human editor oversight:

1. **Why Beehiiv MCP Was Adopted:**
   Beehiiv's public REST API restricts programmatic post creation (`POST /v2/publications/.../posts`)
   to Enterprise accounts. To enable draft staging across standard plans without
   requiring enterprise licensing, Firenze connects to the official hosted Beehiiv
   Model Context Protocol (MCP) endpoint (`https://mcp.beehiiv.com/mcp`) using
   `@google/adk` and `@modelcontextprotocol/sdk`.

2. **Dual-Transport Staging (`stageBeehiivDraft`):**
   - **Primary (Remote MCP):** `BeehiivMcpService` connects to the hosted Beehiiv MCP
     server using Bearer authentication (`BEEHIIV_API_KEY`) and invokes the remote
     `create_post` tool.
   - **Fallback (REST / Offline Mock):** If the MCP endpoint is disabled, unreachable,
     or unauthenticated, the tool falls back gracefully to `BeehiivService.createDraftFromHtml`
     or an offline staging result (`BEEHIIV_MOCK_STAGING=true`).

3. **Strict Draft Safety Boundaries:**
   Firenze's Beehiiv tool is deliberately draft-only:
   - The tool parameter requires `status: "draft"`.
   - ADK enforces human confirmation (`requireConfirmation: true`) before any remote
     call is executed.
   - The returned response is verified to confirm Beehiiv created a draft; any non-draft
     status is rejected.
   - The tool contains zero publish, schedule, or subscriber-send capabilities.

4. **Connected Desktop MCP Editor Sessions:**
   Human editors can also connect desktop MCP tools directly to Beehiiv for interactive
   read/edit/verify sessions. The
   [MCP draft playbook](../../.agents/skills/firenze-newsletter/references/beehiiv-mcp-playbook.md)
   records the authentic venue-guide format, subscriber gate checks, and editorial
   rules learned from hands-on curation.

These overlapping controls are intentional. A prompt mistake, model hallucination,
or malformed tool call cannot silently turn into an email sent to subscribers.

### Human Approval

Human approval is a product boundary, not a temporary inconvenience. The editor
owns the final facts, selections, voice, links, legal claims, schedule, and send.
Automation can make preparation faster; it cannot take publication authority.

## What Firenze Can And Cannot Do

### Firenze can do now

- retrieve bounded, active, admin-approved concerts through the shared Nido
  catalog service;
- query bounded PostgreSQL co-bill evidence through TypeORM and return the
  historical connection plus an eligible upcoming concert;
- run autonomous multi-turn ReAct loops via ADK `Runner` and Gemini;
- persist session history and conversational state in PostgreSQL via `TypeOrmSessionService`;
- stage drafts directly into Beehiiv via `BeehiivMcpService` with fallback to REST;
- validate tool inputs and outputs with strict Zod schemas;
- check bounded batches of public ticket URLs with network safety controls;
- request creation of a Beehiiv draft after explicit confirmation;
- reject a Beehiiv result that is not still a draft;
- run deterministic tests without calling a live model or provider.

### Firenze cannot do now

- publish, schedule, or send a Beehiiv newsletter without human action;
- approve concerts or change the public Nido catalog;
- guarantee that a reachable ticket link contains correct event information;
- make commercial sponsor or pricing commitments.

### Tool Framework & Extensibility Roadmap

Firenze's toolset is built on the [Nido Unified ADK Tool Framework](adr-adk-agent-tool-framework.md).
New tools plug directly into `NewsletterAgentToolRegistry`:

1. **Multi-Facet Catalog Search (`searchCatalogConcertsTool`):**
   Allows Firenze to query concerts by genre, venue, city, and price ceiling without scanning full date dumps.
2. **Multi-Platform Social Media Pack (`generateSocialPackTool`):**
   Transforms selected top picks into Instagram carousel copy, Discord alerts, and X/Twitter threads for human review.
3. **Newsletter Engagement Analytics (`analyzeNewsletterEngagementTool`):**
   Queries Beehiiv's MCP `get_posts` endpoint to evaluate historical open rates, CTRs, and link engagement, proposing data-driven subject line and layout enhancements.

## Safe Use Checklist

Before accepting a Firenze-assisted draft, the editor should confirm:

- every included concert is active and admin-approved in Nido;
- dates, times, artists, venues, age restrictions, and prices match primary
  sources where those details matter;
- ticket links lead to the intended event, not merely a reachable website;
- recommendations are supported by the returned catalog or co-bill evidence;
- the writing does not invent attendance, popularity, relationships, quotes, or
  personal experience;
- partners and paid placements are disclosed according to editorial policy;
- the voice sounds like EZ Vibes and serves the reader;
- the Beehiiv item is still a draft before any separate publication action.

If evidence is incomplete, the right output is a question or warning, not a
confident guess.

## The Connected City Network

[Munchen](munchen-venue-scout-agent.md) is Nido's Venue Scout Agent. The two
agents look at the live-music ecosystem from different angles:

| Firenze                                    | Munchen                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| Builds an evidence-backed newsletter draft | Investigates a venue and its concert context            |
| Starts with an editorial date range        | Starts with a venue name or identity                    |
| Helps select and communicate shows         | Helps verify and understand places                      |
| May use venue evidence from the catalog    | May provide venue context useful to curation            |
| Ends at a human-reviewed Beehiiv draft     | Ends at a scout report or evidence for another workflow |

In the future, Munchen may help strengthen the venue evidence Firenze considers.
It should not silently approve a venue, alter catalog status, or dictate Firenze's
editorial choice.

[Bologna](bologna-documentation-agent.md) is the Documentation and Teaching
Agent. Bologna explains this workflow, its evidence, and its limits for future
contributors and creators. It does not choose concerts, approve source data, or
publish Firenze's work.

[Frankfurt](frankfurt-mission-orchestrator.md) coordinates delivery across agent,
application, review, and deployment boundaries. [Innsbruck](innsbruck-integration-specialist.md)
checks the contracts between those systems. [Venezia](venezia-ingestion-agent.md)
may create reviewable concert candidates from posters, but Firenze may only use
those records after an administrator approves them into the catalog.

## Glossary

| Term                   | Meaning                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **ADK**                | Google's Agent Development Kit, used to give an AI agent controlled access to named tools.                            |
| **Admin-approved**     | A Nido administrator has reviewed the concert and allowed it into approved catalog workflows.                         |
| **Beehiiv**            | The newsletter platform where Firenze may stage a draft for human review.                                             |
| **Bologna**            | The canonical name of Nido's Documentation and Teaching Agent.                                                        |
| **Catalog evidence**   | Structured concert, artist, venue, and lineup information retrieved from Nido.                                        |
| **Co-bill**            | Two or more artists appearing on the same concert lineup. It is a discovery clue, not a musical-similarity guarantee. |
| **Firenze**            | The canonical name of Nido's Newsletter and Editorial Agent.                                                          |
| **Function tool**      | A narrowly defined operation an ADK agent may request, with validated inputs and outputs.                             |
| **Human confirmation** | An explicit pause requiring a person to approve an external action before it runs.                                    |
| **Munchen**            | The canonical name of Nido's Venue Scout Agent.                                                                       |
| **TPS2**               | The Weekly Top Picks newsletter program and workflow operated with Firenze; not a separate agent.                     |
| **Venezia**            | The canonical name of Nido's Multimodal Poster and Concert Ingestion Agent.                                           |
| **Frankfurt**          | Nido's mission coordinator for scope, evidence, and acceptance recommendations.                                        |
| **Innsbruck**          | Nido's integration specialist for cross-service and provider contracts.                                               |
| **PostgreSQL**         | Nido's relational database and source of durable catalog evidence.                                                    |
| **TypeORM**            | The application layer Nido uses to query PostgreSQL from NestJS services.                                             |
| **Zod**                | The schema library that validates data crossing the AI tool boundary.                                                 |

## Learning More

Readers who want implementation detail can continue with:

- [Newsletter module guide](../../src/newsletter/README.md)
- [Bologna: the Documentation and Teaching Agent](bologna-documentation-agent.md)
- [Frankfurt: Mission Control](frankfurt-mission-orchestrator.md)
- [Innsbruck: Integration Specialist](innsbruck-integration-specialist.md)
- [Venezia: the Ingestion Agent](venezia-ingestion-agent.md)
- [Newsletter Agent v2 architecture decision](adr-newsletter-agent-v2.md)
- [ADK architecture guide](gear-adk-agent-guide.md)
- [Agent development and evaluation harness](agent-development-harness-guide.md)
