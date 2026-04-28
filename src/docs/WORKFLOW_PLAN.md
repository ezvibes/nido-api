# NIDO API Workflow Plan

## Status

**Active roadmap (MVP platform build)** – updated to reflect the current backend direction.

---

## Where the project is now

The repo has moved beyond the original auth/bootstrap-only phase.

Implemented or in-flight backend slices now include:
- Firebase-backed user auth/bootstrap
- user profile sync/update basics
- ingestion image upload to GCS
- asynchronous OCR worker flow
- parsed ingestion candidate generation for review

That means the next planning layer is no longer “build concerts next.”
The real platform path is now:

**ingestion -> OCR -> candidate review -> canonical catalog -> partner/discovery APIs**

---

## Core Product Direction

EZ Vibes needs a pipeline that can:
1. accept raw event inputs (flyers, later partner submissions)
2. convert them into reviewable draft records
3. approve and normalize them into a canonical catalog
4. expose approved events to end users and partners

For MVP, the system should prefer:
- deterministic backend behavior
- explicit provenance
- moderate data quality over fake certainty
- simple operational boundaries (API + worker)

---

## Current Architecture Layers

### 1. Identity and user layer
- Firebase Authentication for identity
- NestJS API for domain users
- Postgres for application-owned records

### 2. Ingestion layer
- authenticated upload flow
- source asset persistence
- ingestion job tracking
- async worker execution

### 3. OCR + parsing layer
- OCR reads uploaded flyer assets from GCS
- OCR text persists on ingestion jobs
- parser creates draft ingestion candidates
- low-confidence or incomplete outputs remain in `needs_review`

### 4. Review / moderation layer
**Not implemented yet**
- human/admin review of candidates
- approve / reject / publish workflow
- audit trail for candidate decisions

### 5. Canonical catalog layer
**Not implemented yet**
- approved events
- normalized venue/artist/source relationships
- stable read APIs for discovery and partners

### 6. Partner platform layer
**Blocked on catalog + moderation foundations**
- API-key auth
- structured partner submissions
- approved catalog sync endpoints

---

## MVP Build Sequence

### Phase 1 — Foundation
Status: **partially complete**
- Firebase auth bootstrap
- domain user persistence
- basic authenticated user flows

### Phase 2 — Ingestion foundation
Status: **complete / in review**
- upload flyer images
- persist source assets
- create ingestion jobs
- expose job lookup

### Phase 3 — OCR worker
Status: **complete / in review**
- background worker claims queued jobs
- reads GCS object
- runs Vision OCR
- persists OCR output and failure state

### Phase 4 — Candidate generation
Status: **complete / in review**
- deterministic parsing from OCR text
- candidate persistence
- candidate detail retrieval
- jobs route to `needs_review`

### Phase 5 — Moderation workflow
Status: **next major blocker**
Required capabilities:
- moderation states for candidates
- admin/reviewer endpoints
- approve / reject / request-fix actions
- publishing rules and audit trail

### Phase 6 — Canonical event catalog
Status: **blocked by moderation design**
Required capabilities:
- approved event model
- source attribution model
- normalized event/venue/artist strategy
- read endpoints for approved catalog only

### Phase 7 — Partner platform
Status: **blocked by phases 5-6**
Required capabilities:
- partner identity and API keys
- partner submissions
- approved catalog sync (`updatedSince`)
- source attribution via event sources

---

## Immediate Engineering Priorities

### Priority 1
Get ingestion PR stack merge-ready:
- ingestion upload foundation
- OCR worker
- candidate generation

### Priority 2
Define moderation model:
- candidate lifecycle states
- reviewer actions
- publish boundary between ingestion artifacts and canonical records

### Priority 3
Define canonical catalog schema:
- canonical `events`
- normalized venues/artists as needed
- event provenance / source attribution

### Priority 4
Then implement partner APIs and discovery APIs on top of the approved catalog

---

## Major Known Blockers

### Blocker A — Moderation workflow is missing
Without moderation, the system can create draft candidates but cannot safely publish them.

### Blocker B — Canonical catalog model is not defined
Issue #12 and similar work depends on a stable approved event model.

### Blocker C — Migration discipline is missing
The project is adding entities/columns quickly, but there is not yet a clear migration workflow for persistent environments.

### Blocker D — Operational docs are behind reality
The old plan still points to user/concert flows instead of the ingestion pipeline now being built.

---

## Recommended Next Work After Current PR Stack

1. Merge/finalize the ingestion stack
2. Add moderation entities + admin review endpoints
3. Define canonical approved event schema
4. Add publish flow from candidate -> canonical event
5. Then implement partner API slice (#12)

---

## Guardrails

- Do not write parser output directly into canonical events
- Do not let partner submissions bypass provenance or moderation
- Keep Firebase auth separate from future partner API auth
- Keep worker stages explicit (`queued`, `processing`, `parsing`, `needs_review`, `failed`, etc.)
- Prefer deterministic parsing rules before LLM-assisted extraction

---

## Short version

**What exists now:** auth + ingestion + OCR + candidate creation

**What is missing next:** moderation + canonical catalog

**What is blocked until then:** partner platform, approved catalog sync, broader discovery APIs
