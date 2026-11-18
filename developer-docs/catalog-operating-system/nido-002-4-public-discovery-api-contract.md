# NIDO-002.4: Public Discovery API Contract & Boundary Specification

- **Issue:** [#225](https://github.com/ezvibes/nido-api/issues/225) (Parent mission: [#207](https://github.com/ezvibes/nido-api/issues/207))
- **Owner:** Innsbruck (Integration & Public Contract Boundaries)
- **Status:** Implemented for `NIDO-002.4` on `feat/nido-002-4-public-discovery-contract`

## 1. Read-Only Public Endpoints

| Endpoint | Method | Auth | Purpose | Rate Limit |
| --- | --- | --- | --- | --- |
| `/concerts` | `GET` | Optional Bearer (`upvotedByMe` only if existing user) | Paginated feed of active, admin-approved concerts | `120 req / 60s / IP` |
| `/concerts/:id` | `GET` | Optional Bearer (owner may preview own `active` unapproved record) | Canonical concert detail with venue, full lineup, sets, and provenance | `120 req / 60s / IP` |
| `/concerts/meta/genres` | `GET` | None | Controlled genre catalog options (`genres` + slugged `options`) | `120 req / 60s / IP` |
| `/venues`, `/venues/:id` | `GET` | None | Public venue directory (`citySlug`, `regionSlug`, `verificationState`) | `120 req / 60s / IP` |
| `/bands`, `/bands/:id`, `/bands/:slug/slug` | `GET` | None | Public artist directory & slug lookup (`q`, `genre`, `isFeatured`) | `120 req / 60s / IP` |
| `/sitemap.xml`, `/concerts/sitemap.xml` | `GET` | None | Approved-only XML sitemap (`startsAt ASC, id ASC`, 1,000 concerts/page) | `120 req / 60s / IP` |
| `/sitemap-index.xml`, `/concerts/sitemap-index.xml` | `GET` | None | Partitioned sitemap index for 1,000+ approved concerts | `120 req / 60s / IP` |
| `/api/newsletter/subscribe` | `POST` | None (honeypot + strict IP rate limit) | Beehiiv Weekly Top Picks subscription CTA | `5 req / 15m / IP` |

## 2. Discovery Filtering, Schedules & Pagination (`GET /concerts`)

Validated by `ListConcertsDto`:
- `q`: Multi-token case-insensitive substring search across concert `title`, `genre`, `description`, `venue.name`, `venue.city`, `venue.region`, and `band.name` (capped at 6 tokens).
- `genre`: Exact genre match.
- `city`: Venue city name or normalized `citySlug` (e.g. `raleigh`, `winston-salem`).
- `region`: Venue state/region name, two-letter abbreviation, or normalized `regionSlug` (e.g. `NC` and `North Carolina` match equivalently).
- `venueId`: Optional UUID filter for a venue's upcoming/past schedule.
- `bandId`: Optional UUID filter for an artist's schedule (matched via `EXISTS` on both `concert_band_lineups` and `concert_sets` so co-bill bands in each returned concert remain intact).
- Note: Path `:id` parameters on `GET /concerts/:id`, `GET /venues/:id`, and `GET /bands/:id` validate UUID format via `ParseUUIDPipe` (`400 Bad Request` on malformed IDs).
- Rate limiting derives the client key from the rightmost proxy-appended IP in `X-Forwarded-For` (`extractClientIp`) to resist left-side header spoofing behind Cloud Run.
- `startsAfter` / `startsBefore`: ISO-8601 date bounds on `concert.startsAt`.
- `sort`: `soonest` (default), `latest`, `recently_added`, `featured`, `top_picks`, `trending_week`.
- `page` (default `1`, min `1`) & `pageSize` (default `20`, min `1`, max `100`).

## 3. Visibility, Provenance & Privacy Guarantees

1. **Mandatory publication gate:** Anonymous callers on `GET /concerts`, `GET /concerts/:id`, and `GET /sitemap*.xml` only receive concerts where `catalogStatus = 'active'` AND `isAdminApproved = true`. Unapproved uploads, pending calendar syncs, `hidden`, and `archived` shows return empty feeds or `404 Not Found`.
2. **No user sync on reads:** `OptionalFirebaseAuthGuard` + `UserService.findExistingFromToken` never writes or creates user records on `GET` requests.
3. **Stripped internal operational fields (`includeAdminMetadata = false`):**
   - `catalogStatus`, `editorialLockedAt`, `version`, and `adminApprovedByUserId` are omitted from `GET /concerts`, `GET /concerts/:id`, and `GET /concerts/mine`.
   - `syncSource` is sanitized to `{ source, lastSyncedAt }`; internal calendar coordinates (`calendarId`, `calendarEventId`, `needsGuidance`) are only returned on admin endpoints (`/admin/concerts*`).
4. **Freshness metadata:** Responses expose `updatedAt`, `adminApprovedAt`, and (for synced events) `syncSource.lastSyncedAt`.

## 4. Known Boundary Outside `NIDO-002.4` Scope

- `GET /ingestion/uploads/:id/image` in `src/ingestion/ingestion.controller.ts` currently streams upload media without verifying concert approval status and remains tracked separately from `NIDO-002.4` per maintainer prioritization.
