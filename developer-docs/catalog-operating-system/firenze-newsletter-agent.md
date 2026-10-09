# Firenze: The Newsletter Agent

Firenze is Nido's **Newsletter Agent**. It helps a human editor turn trustworthy
concert information into a useful live-music newsletter draft.

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

The full autonomous ADK orchestration loop is planned work. The current
implementation establishes the tool registry and safety contracts that the
future Firenze agent will use.

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

### Beehiiv Draft Staging

Firenze's Beehiiv tool is deliberately draft-only. Its input must explicitly say
`draft`, ADK requires a human confirmation before the external call, and the
response is checked to ensure Beehiiv created a draft. The tool has no publish or
send capability.

These overlapping controls are intentional. A prompt, model mistake, or malformed
tool call should not silently turn into an email sent to subscribers.

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
- validate tool inputs and outputs with strict Zod schemas;
- check bounded batches of public ticket URLs with network safety controls;
- request creation of a Beehiiv draft after explicit human confirmation;
- reject a Beehiiv result that is not still a draft;
- run deterministic tests without calling a live model or provider.

### Firenze cannot do now

- run the complete autonomous curation and critique workflow;
- learn automatically from an editor's changes;
- guarantee that a reachable ticket link contains correct event information;
- publish, schedule, or send a Beehiiv newsletter;
- approve concerts or change the public Nido catalog.

### Planned capabilities

- ADK orchestration that combines the tools into a reviewable editorial run;
- structured Beehiiv content blocks instead of fragile text conversion;
- better observability, cost limits, and authenticated scheduled execution;
- editorial evaluation against representative EZ Vibes examples;
- carefully governed feedback that helps future drafts reflect human edits.

Planned capabilities are not promises of current behavior. They require their
own implementation, tests, review, and deployment evidence.

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

## Glossary

| Term                   | Meaning                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **ADK**                | Google's Agent Development Kit, used to give an AI agent controlled access to named tools.                            |
| **Admin-approved**     | A Nido administrator has reviewed the concert and allowed it into approved catalog workflows.                         |
| **Beehiiv**            | The newsletter platform where Firenze may stage a draft for human review.                                             |
| **Bologna**            | The canonical name of Nido's Documentation and Teaching Agent.                                                        |
| **Catalog evidence**   | Structured concert, artist, venue, and lineup information retrieved from Nido.                                        |
| **Co-bill**            | Two or more artists appearing on the same concert lineup. It is a discovery clue, not a musical-similarity guarantee. |
| **Firenze**            | The canonical name of Nido's Newsletter Agent.                                                                        |
| **Function tool**      | A narrowly defined operation an ADK agent may request, with validated inputs and outputs.                             |
| **Human confirmation** | An explicit pause requiring a person to approve an external action before it runs.                                    |
| **Munchen**            | The canonical name of Nido's Venue Scout Agent.                                                                       |
| **PostgreSQL**         | Nido's relational database and source of durable catalog evidence.                                                    |
| **TypeORM**            | The application layer Nido uses to query PostgreSQL from NestJS services.                                             |
| **Zod**                | The schema library that validates data crossing the AI tool boundary.                                                 |

## Learning More

Readers who want implementation detail can continue with:

- [Newsletter module guide](../../src/newsletter/README.md)
- [Bologna: the Documentation and Teaching Agent](bologna-documentation-agent.md)
- [Newsletter Agent v2 architecture decision](adr-newsletter-agent-v2.md)
- [ADK architecture guide](gear-adk-agent-guide.md)
- [Agent development and evaluation harness](agent-development-harness-guide.md)
