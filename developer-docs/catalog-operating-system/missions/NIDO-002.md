# NIDO-002: Public concert discovery, search indexing, and conversion loop

- Status: in_progress
- Human owner: Nido maintainer
- Coordinator: Frankfurt (documented role, not a running service)
- Specialists and implementation owner(s): RDU for full-stack implementation and QA; Innsbruck for public contract boundaries; Firenze for newsletter conversion alignment; Bologna for living documentation.
- Linked issues/ADRs: [#207](https://github.com/ezvibes/nido-api/issues/207), [#204](https://github.com/ezvibes/nido-api/issues/204), [#209](https://github.com/ezvibes/nido-api/issues/209), [#214](https://github.com/ezvibes/nido-api/issues/214), [#216](https://github.com/ezvibes/nido-api/issues/216), [#46](https://github.com/ezvibes/nido-api/issues/46), [Discovery and indexing audit](../nido-002-1-discovery-and-indexing-audit.md).
- Last evidence review: 2026-11-18, branch `feat/nido-002-2bcd-sitemap-newsletter-cta-city-filters` off `8f7de71` (`NIDO-002.1` merged in #213; `NIDO-002.2a` merged in #215; `NIDO-002.2b/c/d` implemented in #216).

## Outcome and demonstration

- A nontechnical user can: discover an approved concert via search, social link share, or `/concerts`, open its canonical `/concerts/:id` page with accurate title/metadata, add the show to their calendar or get directions, subscribe to the EZ Vibes Weekly Top Picks newsletter, or sign in to submit a poster.
- Independent demonstrator: Nido maintainer or first-time fan/venue partner visiting `/concerts` and `/concerts/:id` on mobile or desktop without special agent knowledge.
- Success measures:
  - Every active, admin-approved concert has a stable, deep-linkable `/concerts/:id` URL and machine-readable `schema.org/Event` structured data.
  - Search crawlers can discover approved concert URLs via `robots.txt` and `sitemap.xml` without indexing private or unapproved records.
  - Public visitors on `/concerts` and `/concerts/:id` have a 1-click path to subscribe to the newsletter and a clear path to submit a concert poster.

## Boundaries

- In scope:
  - Read-only discovery and indexing audit (`NIDO-002.1`, [#209](https://github.com/ezvibes/nido-api/issues/209)).
  - Dynamic document titles, descriptions, canonical tags, OpenGraph metadata, and `schema.org/Event` (`MusicEvent`) JSON-LD on `/concerts/:id`.
  - Public `robots.txt` and approved-only `sitemap.xml` generation (`NIDO-002.2`).
  - Public newsletter signup CTA and poster submission conversion paths on `/`, `/concerts`, and `/concerts/:id`.
  - City and region query filter alignment on `GET /concerts` ([#46](https://github.com/ezvibes/nido-api/issues/46)).
- Not in scope:
  - Full-site SSR framework migration (e.g. Nuxt rewrite) unless explicitly approved by the maintainer.
  - Public partner developer API keys or external webhook subscriptions ([public API decision backlog](../../future-vision/public-api-decision-backlog.md)).
  - Autonomous publication of unreviewed concerts (`isAdminApproved = true` remains mandatory for public visibility).
- Human approvals and safety limits:
  - Only `catalogStatus = 'active'` and `isAdminApproved = true` concerts may appear in public feeds, sitemaps, or anonymous detail responses.
  - Maintainer approval is required before merging PRs, modifying DNS/Search Console verification, or deploying to production.

## Delivery slices

1. **Slice 0 — Shareable Concert Detail Page ([#204](https://github.com/ezvibes/nido-api/issues/204)):** Public `GET /concerts/:id` endpoint and `/concerts/:id` Vue route with calendar export, Google Maps directions, and social share button. *(Implemented on `main` at `323f91c`.)*
2. **Slice 1 — Discovery & Indexing Audit (`NIDO-002.1`, [#209](https://github.com/ezvibes/nido-api/issues/209)):** Baseline audit of routing, HTML/meta rendering, structured data, sitemap/robots, analytics, conversion CTAs, and public/private boundaries, plus ranked gap analysis and `NIDO-002.2` implementation plan. *(Merged on `main` in `bdf2aa9`, PR #213.)*
3. **Slice 2 — Client Head Metadata, `schema.org/Event` JSON-LD & `robots.txt` (`NIDO-002.2a`, [#214](https://github.com/ezvibes/nido-api/issues/214)):** Dynamic `document.title`, `<meta name="description">`, `<link rel="canonical">`, `og:*` tags, and `application/ld+json` `MusicEvent` structured data on `ConcertDetailPage.vue` and `ConcertsPage.vue`, plus static `client/public/robots.txt`. *(Merged on `main` in `8f7de71`, PR #215.)*
4. **Slice 3 — Dynamic Approved-Catalog Sitemap (`NIDO-002.2b`, [#216](https://github.com/ezvibes/nido-api/issues/216)):** Root `GET /sitemap.xml` (and `GET /concerts/sitemap.xml`) wired through Firebase Hosting Cloud Run rewrite (`firebase.json`) to serve only `active` + `isAdminApproved` concert URLs. *(Implemented in #216.)*
5. **Slice 4 — Public Newsletter Signup CTA & Attribution (`NIDO-002.2c`, [#216](https://github.com/ezvibes/nido-api/issues/216)):** Public Beehiiv newsletter subscription endpoint (`POST /api/newsletter/subscribe`) and `<NewsletterSignupBanner />` CTA on `HomePage.vue`, `ConcertsPage.vue`, and `ConcertDetailPage.vue`, plus `utm_source=nido&utm_medium=referral` attribution on outbound ticket links. *(Implemented in #216.)*
6. **Slice 5 — Server-Side City & Region Discovery Filters (`NIDO-002.2d`, [#46](https://github.com/ezvibes/nido-api/issues/46), [#216](https://github.com/ezvibes/nido-api/issues/216)):** Added `city` and `region` query filters to `ListConcertsDto` and `ConcertService.findWithQuery` and URL query state sync on `ConcertsPage.vue` (e.g. `/concerts?city=raleigh`). *(Implemented in #216.)*

## Acceptance evidence

| Criterion | Evidence required | State/link |
| --- | --- | --- |
| Shareable `/concerts/:id` detail route and public `GET /concerts/:id` contract | Unit tests in `concert.service.spec.ts`, `concert.controller.spec.ts`, `ConcertDetailPage.spec.ts` | Implemented on `main` (`323f91c`, [#204](https://github.com/ezvibes/nido-api/issues/204)) |
| Baseline discovery and indexing audit (`NIDO-002.1`) | Capability matrix, top 5 ranked problems, and `NIDO-002.2` slice sequence | Merged on `main` (`bdf2aa9`, PR #213, [Audit report](../nido-002-1-discovery-and-indexing-audit.md)) |
| Search & social metadata (`title`, `og:*`, `schema.org/Event` JSON-LD, `robots.txt`, `sitemap.xml`) | Automated unit tests + live dev HTML/Rich Results inspection + post-deploy Hosting smoke test (`curl -fsSi https://nido-api-9ed65.web.app/sitemap.xml`) | Implemented across PR #215 (`NIDO-002.2a`) and [#216](https://github.com/ezvibes/nido-api/issues/216) (`NIDO-002.2b`, verified in `.github/workflows/deploy-dev.yml` and `scripts/smoke-test-api.mjs`) |
| Public newsletter signup & poster submission conversion paths + city filter URLs | Unit tests (`NewsletterSignupBanner.spec.ts`, `ConcertsPage.spec.ts`, `beehiiv.service.spec.ts`) + browser verification | Implemented in [#216](https://github.com/ezvibes/nido-api/issues/216) (`NIDO-002.2c/d`) |

## Handoff

- PRs/commits and migrations/rollback:
  - [#204](https://github.com/ezvibes/nido-api/issues/204) merged in `323f91c` (no schema migration required).
  - [#209](https://github.com/ezvibes/nido-api/issues/209) (`NIDO-002.1`) documentation-only audit; rollback is a clean revert of the docs commit.
- Known limitations and observation window:
  - Firebase Hosting serves a client-rendered Vue 3 SPA (`client/dist/index.html`). Non-JS social scrapers (iMessage, Slack, Discord, X, Facebook) only see static `<head>` tags in `client/index.html` unless a Cloud Run rewrite or prerender step serves concert-specific OpenGraph tags.
- Next step, blocker, and maintainer decision:
  - Review and merge `NIDO-002.1` ([#209](https://github.com/ezvibes/nido-api/issues/209)), then authorize `NIDO-002.2a` (dynamic head metadata, `schema.org/Event` JSON-LD, and `robots.txt`) and confirm the canonical public Beehiiv newsletter subscribe URL.
