# NIDO-002.1: Public Concert Discovery, Search Indexing, and Conversion Audit

- **Mission:** [NIDO-002](missions/NIDO-002.md) ([#207](https://github.com/ezvibes/nido-api/issues/207))
- **Issue:** [#209](https://github.com/ezvibes/nido-api/issues/209) (`NIDO-002.1 — Discovery and indexing audit`)
- **Inspected baseline:** Commit `323f91c` on `origin/main` (2026-11-18)
- **Scope:** Read-only codebase inspection and implementation blueprint for `NIDO-002.2`. No runtime, schema, or hosting changes are made in this slice.

---

## 1. Executive Summary

With the merge of [#204](https://github.com/ezvibes/nido-api/issues/204) (`323f91c`), Nido now exposes a clean, public, deep-linkable route (`/concerts/:id`) and backend endpoint (`GET /concerts/:id`) for every active, admin-approved concert, complete with Google Calendar links, `.ics` export, Google Maps venue directions, and native/clipboard link sharing.

However, **search engine indexing, social link previews, and public fan-to-newsletter conversion remain largely unimplemented**:
1. **Static SPA `<head>` across all routes:** `client/index.html` serves `<title>EZ Vibes Concerts</title>` with zero `<meta name="description">`, `<link rel="canonical">`, or OpenGraph (`og:*`) / Twitter Card tags, and no Vue component updates `document.title`.
2. **No `schema.org/Event` (`MusicEvent`) structured data:** Neither `ConcertsPage.vue` nor `ConcertDetailPage.vue` emits `application/ld+json` structured data, preventing Google Event Rich Results ("Concerts in Raleigh" carousel) eligibility.
3. **No `robots.txt` or `sitemap.xml`:** `client/public/` contains only `vite.svg`, and `firebase.json` rewrites `**` to `/index.html` (`200 OK`). Crawlers have no sitemap of approved `/concerts/:id` URLs and receive soft-404 `200 OK` HTML shells on unknown paths.
4. **No public newsletter signup CTA:** Although Nido has a full Beehiiv editorial backend (`src/newsletter/beehiiv.service.ts`), public pages (`HomePage.vue`, `ConcertsPage.vue`, `ConcertDetailPage.vue`) have zero newsletter subscribe links or forms.
5. **No analytics or Search Console instrumentation:** Although `@firebase/analytics` is present transitively in `client/package-lock.json`, `client/src/firebase.ts` only initializes `auth` and `storage`, and outbound ticket/calendar/share actions carry no UTM parameters or event tracking.

---

## 2. Capability Classification Matrix (`323f91c`)

Following the [Agent Context Map](agent-context-map.md) evidence rules, each capability is classified as `implemented`, `partial`, `missing`, or `unknown` based on direct inspection of commit `323f91c`:

| Capability Area | Sub-capability | Status | Codebase Evidence (`323f91c`) | Boundary & Crawler / User Notes |
| --- | --- | --- | --- | --- |
| **Canonical URLs & Public Routing** | Public feed route (`/concerts`) & legacy redirect (`/events`) | `implemented` | `client/src/router.ts:41-54` | Public Vue route without `requiresAuth`; `/events` redirects to `/concerts`. |
| **Canonical URLs & Public Routing** | Shareable concert detail route (`/concerts/:id`) | `implemented` | `client/src/router.ts:46-50`, `client/src/pages/ConcertDetailPage.vue:1-575`, `client/src/components/concerts/ConcertCard.vue:77-84,119-124` | Every `ConcertCard` links both the artist heading and `"View Details"` to `/concerts/${concert.id}`. Published submissions in `MySubmissionsPage.vue:75-81` also link directly to `/concerts/:id`. |
| **Canonical URLs & Public Routing** | City / region / genre shareable URL query state | `missing` | `client/src/pages/ConcertsPage.vue:116-118`, `src/apis/concerts/dto/list-concerts.dto.ts:23-92` | `useConcertFilters` stores filter state only in in-memory Vue `ref`s (`ConcertsPage.vue` does not sync filters with `route.query`). `ListConcertsDto` supports `q` and `genre`, but lacks `citySlug` and `regionSlug` ([#46](https://github.com/ezvibes/nido-api/issues/46)). |
| **HTML Rendering, Title & OpenGraph Meta** | Base HTML document & SPA rewrite | `partial` | `client/index.html:1-13`, `firebase.json:1-14`, `.github/scripts/deploy-firebase-hosting.mjs:114-146` | `client/index.html` contains only `<title>EZ Vibes Concerts</title>` (`line 7`) and `<div id="app"></div>` (`line 10`). `firebase.json` rewrites `**` to `/index.html`. |
| **HTML Rendering, Title & OpenGraph Meta** | Dynamic `document.title`, `<meta name="description">`, and `<link rel="canonical">` | `missing` | `client/index.html:3-8`, `client/src/router.ts:111-147`, `client/src/pages/ConcertDetailPage.vue:342-575` | No `document.title` updates or head-management library (`@unhead/vue`) exist anywhere in `client/src/`. Every route displays `"EZ Vibes Concerts"` in browser tabs and search snippets. |
| **HTML Rendering, Title & OpenGraph Meta** | OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`) & Twitter Card tags | `missing` | `client/index.html:3-8` | Non-JS link-preview scrapers (Slack, iMessage, Discord, X, Facebook, WhatsApp) fetching `/concerts/:id` receive `client/index.html` with zero `og:*` tags and no concert poster preview. |
| **Sitemap & `robots.txt`** | `robots.txt` crawler directives | `missing` | `client/public/` (contains only `vite.svg`) | Because `firebase.json` rewrites `**` to `/index.html`, requesting `/robots.txt` returns `200 OK` with `text/html` (`index.html`) instead of a valid `text/plain` `robots.txt` file. |
| **Sitemap & `robots.txt`** | `sitemap.xml` for approved concerts | `missing` | `client/public/`, `src/apis/concerts/concert.controller.ts:40-235` | No static or dynamic `sitemap.xml` exists. Search engines cannot enumerate `/concerts/:id` pages unless they execute JS on `/concerts` (which only fetches `pageSize: 100` in `ConcertsPage.vue:182-186`). |
| **Structured Data (`schema.org/Event`)** | `application/ld+json` `MusicEvent` markup on concert pages | `missing` | `client/src/pages/ConcertDetailPage.vue:1-340`, `client/src/pages/ConcertsPage.vue:1-91` | `ConcertDetailPage.vue` has all required `MusicEvent` fields (`title`, `startsAt`, `endsAt`, `description`, `posterUrl`, `ticketUrl`, `venue` name/address/city/region/postalCode, `lineup` performers), but does not render `<script type="application/ld+json">`. |
| **Search Console & Referral Analytics** | Google Search Console verification & property ownership | `unknown` | `client/index.html:3-8` | No `google-site-verification` meta tag or HTML verification file exists in `client/`. Whether domain-level DNS TXT verification is configured outside the repo is `unknown` and requires maintainer confirmation. |
| **Search Console & Referral Analytics** | Client analytics & outbound referral/UTM attribution | `missing` | `client/src/firebase.ts:1-24`, `client/src/utils/concert-presentation.ts:21-33,124-156` | `client/src/firebase.ts` initializes `auth` and `storage` without `getAnalytics(app)`. Outbound `Get Tickets ↗` links (`ConcertDetailPage.vue:155-164`, `ConcertCard.vue:110-118`) include no `utm_source=nido` / `utm_medium=referral` attribution. |
| **Conversion Paths** | Venue partner & contributor poster submission CTA | `implemented` | `client/src/pages/ConcertsPage.vue:12-35`, `client/src/views/LoginPage.vue:4-9`, `client/src/components/onboarding/PartnerOnboardingModal.vue:1-66` | Anonymous visitors on `/concerts` see the `"Posting shows for your venue? Continue with Google"` CTA (`ConcertsPage.vue:12-33`); signed-in users see `IngestionUploadPanel` (`line 35`) right at the top of `/concerts`. |
| **Conversion Paths** | Public fan newsletter signup CTA (Weekly Top Picks / Beehiiv) | `missing` | `client/src/views/HomePage.vue:1-22`, `client/src/pages/ConcertsPage.vue:1-91`, `client/src/pages/ConcertDetailPage.vue:1-340`, `src/newsletter/beehiiv.service.ts:1-200` | Beehiiv integration exists only for admin draft staging (`POST /api/newsletter/push-beehiiv-draft`). There is no public newsletter signup CTA or subscribe link on `/`, `/concerts`, or `/concerts/:id`. |
| **Public vs. Private Data Boundaries** | Public feed & detail visibility enforcement | `implemented` | `src/apis/concerts/concert.controller.ts:52-88,188-203`, `src/apis/concerts/concert.service.ts:62-72,375-409`, `src/ingestion/ingestion.controller.ts:154-169` | `findAll` and `findOneForViewer` strictly filter anonymous requests to `catalogStatus = 'active'` AND `isAdminApproved = true`, stripping `catalogStatus`, `editorialLockedAt`, and `version` (`includeAdminMetadata = false`). `GET /ingestion/uploads/:id/image` only serves poster images when `concert.isAdminApproved && concert.catalogStatus === 'active'`. |

---

## 3. Top 5 Highest-Impact Discovery & Conversion Problems (Ranked)

### Problem 1 (Rank #1 — Highest Impact): Static SPA `<head>` and missing `robots.txt` / `sitemap.xml` block search discovery and social link previews
- **Affected files:** `client/index.html:3-8`, `client/public/`, `firebase.json:1-14`, `client/src/pages/ConcertDetailPage.vue:342-575`.
- **Technical root cause:**
  - Every route on the site has the hardcoded `<title>EZ Vibes Concerts</title>` and no `<meta name="description">` or `<link rel="canonical">`.
  - Because `firebase.json` rewrites `**` to `/index.html` and `client/public/` has no `robots.txt` or `sitemap.xml`, crawlers requesting `/robots.txt` or `/sitemap.xml` receive an HTML SPA shell (`200 OK`), and non-JS social link scrapers (iMessage, Slack, Discord, Instagram/Threads, X) pasting a `/concerts/:id` URL see no artist title, venue, date, or poster thumbnail.
- **User & growth impact:** When a fan or venue partner clicks `"Share Show"` on `ConcertDetailPage.vue` (`lines 203-210`) and pastes the link into a group text or social post, the preview is generic (`"EZ Vibes Concerts"`) instead of `"Sylvan Esso at Lincoln Theatre — Sep 18, 2026"`. Search engines also lack a sitemap to discover individual `/concerts/:id` pages beyond the initial client-rendered feed.

### Problem 2 (Rank #2): Missing `schema.org/Event` (`MusicEvent`) JSON-LD structured data on `/concerts/:id`
- **Affected files:** `client/src/pages/ConcertDetailPage.vue:342-575`, `client/src/utils/concert-presentation.ts`.
- **Technical root cause:** `ConcertDetailPage.vue` already loads all structured fields required by Google's Event Rich Results specification (`concert.title`, `concert.startsAt`, `concert.endsAt`, `concert.description`, `resolvedPoster`, `safeTicketUrl`, `concert.venue` with `name`, `address`, `city`, `region`, `postalCode`, and `concert.lineup` bands), but never serializes them into a `<script type="application/ld+json">` tag in the DOM.
- **User & growth impact:** Googlebot executes JavaScript on public pages and indexes client-injected `application/ld+json`. Without `MusicEvent` JSON-LD, Nido's approved concerts are ineligible for Google Search Event Rich Results (date badges, venue location cards, and direct ticket/event discovery in local music searches).

### Problem 3 (Rank #3): Zero public newsletter signup CTAs on `/`, `/concerts`, and `/concerts/:id`
- **Affected files:** `client/src/views/HomePage.vue:1-22`, `client/src/pages/ConcertsPage.vue:1-91`, `client/src/pages/ConcertDetailPage.vue:1-340`.
- **Technical root cause:** Nido invests heavily in Firenze (`src/newsletter/`) to curate the Weekly Top Picks newsletter and stage drafts to Beehiiv, and `ConcertsPage.vue:12-33` has a dedicated callout for Venue Partners, but there is no corresponding callout, link, or form for fans to subscribe to the Weekly Top Picks newsletter on any public page.
- **User & growth impact:** High-intent live music fans who land on `/concerts/:id` from a shared link or browse `/concerts` have no way to subscribe to the EZ Vibes Weekly Top Picks newsletter before leaving the site.

### Problem 4 (Rank #4): Discovery filters (`city`, `genre`, `q`, `sort`) are not URL-addressable or server-filtered by city/region
- **Affected files:** `client/src/composables/useConcertFilters.ts`, `client/src/pages/ConcertsPage.vue:116-118,182-186`, `src/apis/concerts/dto/list-concerts.dto.ts:23-92`, `src/apis/concerts/concert.service.ts:138-167`.
- **Technical root cause:**
  - `ConcertsPage.vue` fetches a single batch of `pageSize: 100` upcoming concerts and filters them in memory via `useConcertFilters`.
  - Filter selections (`searchText`, `dateRange`, `sort`) are not synced to URL query parameters (`?q=...&sort=...`), and `GET /concerts` does not yet support `citySlug` or `regionSlug` filtering ([#46](https://github.com/ezvibes/nido-api/issues/46)).
- **User & growth impact:** Users and newsletters cannot share filtered discovery URLs (such as `/concerts?city=raleigh&sort=top_picks` or `/concerts?city=wilmington`), and once the approved catalog exceeds 100 upcoming concerts, client-only filtering will miss later shows.

### Problem 5 (Rank #5): Missing outbound referral attribution (`utm_*`) and conversion instrumentation
- **Affected files:** `client/src/utils/concert-presentation.ts:21-33`, `client/src/components/concerts/ConcertCard.vue:110-118`, `client/src/pages/ConcertDetailPage.vue:155-211`, `client/src/firebase.ts:1-24`.
- **Technical root cause:** Outbound `Get Tickets ↗` links (`sanitizeTicketUrl`) pass raw ticket vendor URLs without appending `utm_source=nido&utm_medium=referral&utm_campaign=concert_discovery` (when safe), and no lightweight analytics or Search Console verification hook is configured.
- **User & growth impact:** Venue partners (such as Bowstring Brewyard or Lincoln Theatre) cannot see in their ticketing dashboards (Etix, Ticketmaster, Dice, Eventbrite) how many ticket clicks originated from Nido / EZ Vibes.

---

## 4. Public vs. Private Data Boundary Verification

A core requirement of `NIDO-002.1` ([#209](https://github.com/ezvibes/nido-api/issues/209)) is verifying that expanding search and social discovery will not leak unapproved, hidden, or private records:

1. **Public Concert Feed (`GET /concerts`):**
   - `ConcertService.findAll` (`src/apis/concerts/concert.service.ts:62-72`) enforces `concert.catalogStatus = 'active'` AND `concert.isAdminApproved = true`.
   - `findWithQuery` (`lines 287-295`) passes `includeAdminMetadata = false`, omitting `catalogStatus`, `editorialLockedAt`, and `version` from public responses.
2. **Public Concert Detail (`GET /concerts/:id`):**
   - `ConcertService.findOneForViewer` (`src/apis/concerts/concert.service.ts:375-409`) enforces `catalogStatus = 'active'` AND `isAdminApproved = true` for anonymous requests (and non-owners), throwing `404 NotFoundException` otherwise.
   - Owner preview exception (`lines 380-388`): An authenticated user whose `user.id === concert.owner_id` can view their own `active` unapproved concert when passing a valid Firebase Bearer token. Crawlers and anonymous users never send a Bearer token and therefore can never access unapproved records.
3. **Public Poster Image Endpoint (`GET /ingestion/uploads/:id/image`):**
   - `IngestionController.getPublicUploadImage` (`src/ingestion/ingestion.controller.ts:154-169`) and `IngestionService.getPublicUploadImageStream` verify that the upload is linked to a concert where `isAdminApproved === true` and `catalogStatus === 'active'` before streaming image bytes.
4. **Private / Authenticated Routes (`client/src/router.ts:29-104`):**
   - `/profile`, `/settings`, `/my-concerts`, `/my-submissions`, `/concert-sync`, and `/admin/*` are guarded by `meta: { requiresAuth: true }` (and `requiresAdmin: true` for admin routes) and must be explicitly `Disallow`ed in `robots.txt`.

---

## 5. Recommended Incremental Implementation Sequence for `NIDO-002.2`

To deliver maximum discovery and conversion value with small, reversible slices and zero framework churn:

### Slice `NIDO-002.2a` — Dynamic Document Head, `schema.org/Event` JSON-LD & `robots.txt` (Client + Public Asset)
- **Scope:**
  1. Add a lightweight head/structured-data helper (e.g. `client/src/utils/seo.ts`) invoked by `ConcertDetailPage.vue`, `ConcertsPage.vue`, and `HomePage.vue` to dynamically set:
     - `document.title` (e.g. `"${artistHeadline} at ${venue.name} (${formattedDate}) | EZ Vibes Concerts"` on `/concerts/:id`, and `"Concert not found | EZ Vibes Concerts"` + `<meta name="robots" content="noindex">` when a concert 404s).
     - `<meta name="description">`, `<link rel="canonical" href="...">`, and `<meta property="og:*">` tags in `document.head`.
     - `<script type="application/ld+json" id="nido-event-jsonld">` containing a valid `schema.org/MusicEvent` payload (`name`, `startDate`, `endDate`, `eventStatus: "https://schema.org/EventScheduled"`, `eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode"`, `location: { "@type": "MusicVenue", name, address }`, `performer`, `image`, `offers.url` when `safeTicketUrl` is present).
  2. Add `client/public/robots.txt` allowing `/`, `/concerts`, and `/concerts/*` while disallowing `/admin/`, `/my-concerts`, `/my-submissions`, `/concert-sync`, `/profile`, and `/settings`, and referencing `Sitemap: https://nido-api-9ed65.web.app/sitemap.xml` (or configured public origin).
- **Risk & Migration Impact:** Zero backend or DB changes; pure frontend + static `client/public/robots.txt`.

### Slice `NIDO-002.2b` — Public Approved-Catalog `GET /sitemap.xml` Endpoint (Backend)
- **Scope:**
  1. Add a public `GET /sitemap.xml` endpoint (or controller method) backed by `ConcertService` that queries only `catalogStatus = 'active'` AND `isAdminApproved = true` concerts (`id`, `updatedAt`, `startsAt`) and returns standard XML (`application/xml`, cached with `Cache-Control: public, max-age=3600`) listing `/`, `/concerts`, and `/concerts/:id` URLs.
  2. Optionally add a Firebase Hosting rewrite for `/sitemap.xml` (or serve from the API domain / build-time fetch in CI) so search consoles can ingest `/sitemap.xml` directly from the web origin.
- **Risk & Migration Impact:** Read-only query using existing indexed columns (`catalog_status`, `is_admin_approved`); no schema migration.

### Slice `NIDO-002.2c` — Public Newsletter Signup CTA & Outbound Ticket UTM Attribution (Conversion Loop)
- **Scope:**
  1. Add a reusable public newsletter CTA banner/card (`NewsletterSignupBanner.vue` configured via `VITE_BEEHIIV_SUBSCRIBE_URL` with a safe default to the EZ Vibes Beehiiv publication URL) on `ConcertsPage.vue` and `ConcertDetailPage.vue` ("Get the Weekly Top Picks in your inbox").
  2. Update `sanitizeTicketUrl` in `client/src/utils/concert-presentation.ts` to append non-destructive `utm_source=nido&utm_medium=referral` query parameters when not already present, giving venue partners automatic referral visibility in their ticketing analytics.
- **Risk & Migration Impact:** Frontend-only conversion slice; unit-tested in `ConcertDetailPage.spec.ts` and `ConcertsPage.spec.ts`.

### Slice `NIDO-002.2d` — URL-Synced Filters & Server-Side City/Region Querying ([#46](https://github.com/ezvibes/nido-api/issues/46))
- **Scope:**
  1. Extend `ListConcertsDto` and `ConcertService.findWithQuery` with optional `citySlug` and `regionSlug` filters (`venue.citySlug = :citySlug`).
  2. Sync `ConcertsPage.vue` filter state (`q`, `genre`, `city`, `sort`) with `vue-router` query parameters so filtered views are deep-linkable from newsletters and social shares.
- **Risk & Migration Impact:** Backward-compatible optional query parameters on `GET /concerts`; no schema migration required (`venues.city_slug` and `venues.region_slug` already exist).
