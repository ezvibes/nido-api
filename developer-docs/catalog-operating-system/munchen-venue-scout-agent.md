# Munchen: The Venue Scout Agent

Munchen is Nido's **Venue Scout Agent**. It explores what Nido knows about a
venue and the live music connected to that place.

The name remembers where the idea began: Munchen, or Munich, Germany. Like
Firenze, the name connects the technology to a real journey and a real place.
Munchen is meant to help people understand music scenes more deeply, not reduce
venues to anonymous search results.

## Start Here

A venue is more than an address. It can be a community anchor, a listening room,
a neighborhood stage, a touring destination, or a place where a new scene takes
shape. Munchen is intended to help a person ask questions such as:

- Is this the same venue that already exists in Nido's catalog?
- What verified information does Nido have about it?
- What concerts are connected to the venue?
- What should a human scout or partner verify next?

Munchen is a research assistant. It is not a venue critic with firsthand
experience, an automatic partner-ranking system, or an authority that can approve
catalog data.

## Why Munchen Exists

Venue information arrives in many forms: official names, nicknames, shortened
calendar labels, poster text, addresses, and partner submissions. A useful
live-music catalog needs to connect those references without pretending that an
uncertain match is verified.

Munchen was defined around a simple sequence:

1. Look up the venue before making claims about it.
2. Use a stable venue identity when requesting its shows.
3. Distinguish verified catalog evidence from an unknown or ambiguous room.
4. Tell the user what was found and what still needs human investigation.

That pattern became Nido's first local ADK venue-scout experiment. It proved that
an agent could choose typed tools, use one tool's venue identifier in the next
call, and synthesize a readable result.

## Current Conceptual Workflow

```text
Person enters a venue name
        |
        v
Munchen checks the venue catalog
        |
        +---- no confident match ----> mark unverified and request human research
        |
        v
Use the verified venue ID
        |
        v
Retrieve connected upcoming shows
        |
        v
Present evidence and a scout summary
```

This order matters. Looking up concerts by a loose text name can mix together
different rooms or miss aliases. A verified venue ID is a stronger connection.

## What Exists Today

Munchen currently exists as a local TypeScript ADK spike in
`src/scripts/test-adk-venue-scout.ts`. The spike includes:

- a small, hard-coded set of example North Carolina venues;
- venue aliases and basic descriptive fields;
- a small, hard-coded set of example upcoming shows;
- a Zod-validated `lookupCuratedVenue` tool;
- a Zod-validated `getUpcomingShowsAtVenue` tool;
- an ADK agent that calls those tools when a model is configured;
- a local fallback demonstration when a live model is unavailable.

The script is useful for learning and testing ADK orchestration. Its seeded venue
and show data are **not** evidence that Nido's live PostgreSQL catalog was queried,
that a venue is currently verified, or that the listed shows are current.

Run it locally with:

```bash
npm run adk:venue-scout -- "Cat's Cradle"
```

Without a supported model configuration, the script demonstrates the same tool
sequence locally. A fallback result proves the deterministic handlers ran; it
does not prove live model reasoning or a cloud deployment.

## What Munchen Can And Cannot Do

### Munchen can do now

- demonstrate venue lookup by exact name, known alias, or simple partial match
  against the seeded example catalog;
- pass a returned venue ID into a second tool;
- return seeded upcoming-show information for a matched example venue;
- distinguish a seeded match from an unverified query;
- demonstrate a live ADK run when valid model credentials and configuration are
  available;
- fall back to deterministic local handlers for development and teaching.

### Munchen cannot do now

- query Nido's production or development PostgreSQL venue catalog;
- establish that a venue is currently open, safe, accessible, or operating under
  the same name;
- approve a venue, assign a partner tier, or change catalog records;
- discover current shows from the public internet;
- replace an in-person venue visit or local community knowledge;
- serve as a deployed partner-facing product.

### Planned direction

A production version should replace seeded data with bounded NestJS services and
PostgreSQL/TypeORM queries. It should preserve provenance, expose uncertainty,
require human authority for catalog changes, and use the same authenticated and
observable runtime standards as other Nido agents.

Potential future capabilities include:

- catalog-backed venue identity and alias resolution;
- upcoming approved concerts linked by stable venue ID;
- source and freshness indicators for venue facts;
- review queues for ambiguous matches or proposed corrections;
- partner-submitted context that remains separate from admin verification;
- structured evidence that other agents, including Firenze, can use.

These are directions, not current features. Each needs a defined product
contract, tests, privacy review, and deployment evidence.

## Safe Human Use

When using a future Munchen report, a person should:

- check whether each statement came from the live catalog, seeded test data, a
  partner, or another source;
- treat `unverified` as an invitation to investigate, not a negative judgment;
- confirm names, addresses, accessibility details, policies, and show schedules
  with authoritative sources;
- avoid presenting generated "vibe" language as firsthand experience;
- keep partner status and commercial relationships under human control;
- send corrections through Nido's review process instead of allowing the agent
  to overwrite catalog records.

The safest result is an evidence-backed report that clearly labels uncertainty.
Munchen should never invent local credibility.

## The Connected City Network

[Firenze](firenze-newsletter-agent.md) is Nido's Newsletter Agent. Firenze helps
an editor curate approved concerts and prepare a newsletter draft. Munchen helps
someone investigate the place where music happens.

Munchen can complement Firenze by providing stronger venue identity and context.
For example, it may eventually confirm which catalog venue a concert belongs to
or return approved shows associated with that venue. Firenze can then use that
evidence while making an editorial recommendation.

The relationship should remain explicit:

```text
Munchen: venue identity and venue evidence
                    |
                    v
Nido catalog: reviewed source of truth
                    |
                    v
Firenze: editorial selection and draft preparation
                    |
                    v
Human editor: final judgment and publication
```

Munchen does not approve information for Firenze, and Firenze does not turn a
Munchen description into fact without catalog evidence and human review.

[Bologna](bologna-documentation-agent.md) is the Documentation and Teaching
Agent. Bologna records how Munchen works, which evidence it uses, and where
human investigation is still required. It does not verify venues or turn seeded
examples into catalog facts.

## Glossary

| Term                 | Meaning                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **ADK**              | Google's Agent Development Kit, used to coordinate the model and its controlled tools.    |
| **Alias**            | Another name or spelling used for the same venue.                                         |
| **Bologna**          | The canonical name of Nido's Documentation and Teaching Agent.                            |
| **Catalog evidence** | Structured information retrieved from Nido with a known source and status.                |
| **Firenze**          | The canonical name of Nido's Newsletter Agent.                                            |
| **Function tool**    | A narrowly scoped operation an agent can request using validated data.                    |
| **Munchen**          | The canonical name of Nido's Venue Scout Agent.                                           |
| **Seeded data**      | Fixed example records included in a development script; not live catalog data.            |
| **Stable venue ID**  | A durable identifier used to connect one venue record to its concerts and aliases.        |
| **TypeORM**          | The application layer Nido uses to query PostgreSQL from NestJS services.                 |
| **Unverified**       | Not confidently matched to reviewed catalog evidence; it does not mean false or unworthy. |
| **Zod**              | The schema library that checks tool inputs and outputs.                                   |

## Learning More

- [Firenze: the Newsletter Agent](firenze-newsletter-agent.md)
- [Bologna: the Documentation and Teaching Agent](bologna-documentation-agent.md)
- [ADK architecture guide](gear-adk-agent-guide.md)
- [Agent context map](agent-context-map.md)
- [Agent development and evaluation harness](agent-development-harness-guide.md)
