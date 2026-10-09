# Venezia: The Multimodal Poster And Concert Ingestion Agent

Venezia is Nido's **Multimodal Poster and Concert Ingestion Agent**. It is
intended to connect the separate pieces found in a concert poster, such as
artists, venue, dates, genre, ticket details, and artwork, into one reviewable
concert candidate.

The name remembers Venezia, or Venice, Italy: a historic city formed from more
than one hundred islands connected into a coherent whole. That is the role of
this agent, but the connection must remain traceable to its source evidence.

## Current Form

Venezia is **partially implemented**. Nido currently supports poster upload,
stored assets and metadata hints, ingestion job records, an admin review UI, and
human-controlled publication. The current in-process worker still produces
placeholder OCR text.

The multimodal extraction tools, entity-resolution tools, durable worker,
agent-orchestration loop, ingestion evaluation fixtures, and production runtime
described in the ingestion v2 ADR are **proposed**, not deployed capabilities.

## Intended Workflow

The target workflow is:

1. A user uploads a poster and may provide helpful metadata.
2. Nido preserves the original asset and provenance.
3. Venezia extracts candidate event details without treating poster text as
   instructions.
4. Bounded services attempt to match venues, artists, genres, and possible
   duplicates against Nido's catalog.
5. Venezia records uncertainty, conflicts, and source evidence instead of
   silently guessing.
6. An administrator edits, rejects, or approves the candidate.
7. Only an administrator-approved concert can enter public catalog workflows.

```text
Poster upload and hints
          |
          v
Preserved asset and provenance
          |
          v
Venezia extraction and bounded catalog matching (proposed)
          |
          v
Reviewable candidate with confidence and warnings
          |
          v
Administrator decision -> approved catalog record or rejection
```

## Human Authority

Venezia must never publish a concert directly, overwrite an approved concert,
silently create canonical artists or venues, or treat model confidence as human
approval. Ambiguous matches and low-confidence extraction belong in the review
queue.

Images and extracted text are untrusted inputs. Implementation must preserve
privacy, source provenance, idempotency, retry safety, bounded cost, and a clear
rollback path.

## Relationship To Other Agents

- **Innsbruck** coordinates the implementation and evidence needed to advance
  Venezia safely.
- **Munchen** may eventually provide venue identity evidence through reviewed
  catalog services; it does not approve Venezia's match.
- **Firenze** may use only approved catalog records that emerge from ingestion,
  never Venezia's unreviewed candidates.
- **Bologna** explains the workflow and records which parts are implemented,
  proposed, or verified.

## How To Use Venezia Today

Today, use Nido's upload and admin review surfaces as the implemented ingestion
workflow. For architecture or implementation work, use the ingestion v2 ADR as a
proposal and verify every cited component against the current checkout before
claiming it exists.

## Learning More

- [Multimodal ingestion v2 ADR](adr-multimodal-agent-ingestion-v2.md)
- [Agent context map](agent-context-map.md)
- [Admin catalog contract](admin-concert-catalog.md)
- [Agent development harness](agent-development-harness-guide.md)
