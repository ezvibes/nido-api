# Admin Concert Catalog Contract

The admin concert catalog gives allowlisted Nido administrators a focused way to
correct, publish, feature, hide, and archive canonical concert records without
turning the application into a general-purpose CMS.

Use the
[Admin Concert Catalog Testing And Deployment Guide](admin-concert-testing-deployment-guide.md)
for local verification, PR readiness, deployment observation, dev smoke testing,
evidence capture, and rollback order.

## Authority And Concurrency

Admin decisions take precedence over user and automated updates. Nido enforces
that policy with optimistic version checks rather than explicit row locks or a
distributed locking service.

Every concert has an integer `version`. Admin reads return the current value and
admin PATCH requests must send it as `expectedVersion`. The API applies the update
only while the stored version still matches:

```text
read version 7 -> PATCH expectedVersion 7 -> save version 8
```

If another writer changes the concert first, the API returns `409 Conflict`. The
client closes any stale editor, reloads the current record, and asks the admin to
review the latest state before trying again. No update is merged silently.

Automated calendar and ranking jobs use the same precedence rule:

- calendar sync writes only when the version it inspected is still current;
- calendar sync skips archived or editorially locked records;
- Top Picks writes only calculated ranking fields and verifies that the concert is
  still active, approved, and at the version it ranked;
- each current ranking candidate is written at most once per refresh, while a
  separate cleanup clears only previously ranked records that left the candidate set;
- ingestion approval of an existing linked concert fails with `409 Conflict` when
  a newer admin or workflow update wins the race.
- owner edits and deletes require the record to remain active, unlocked, and at the
  version the owner read; an admin hide, archive, or edit wins the race.

This is intentionally a small concurrency model. PostgreSQL conditional updates
provide the atomic boundary; Nido does not add explicit pessimistic locks, Redis,
or another always-on coordination service.

## Catalog States

`catalogStatus` is mutually exclusive:

| State      | Public discovery | Admin catalog | Automated calendar updates |
| ---------- | ---------------- | ------------- | -------------------------- |
| `active`   | Included         | Included      | Allowed unless locked      |
| `hidden`   | Excluded         | Included      | Allowed unless locked      |
| `archived` | Excluded         | Included      | Always skipped             |

Moving a concert out of `active` automatically clears `isFeatured`. Archiving is
recoverable and does not delete the concert or its history.

`isFeatured` is a manual editorial decision. It is separate from `isTopPick`, which
is calculated by the ranking workflow.

## API Contract

All `/admin/concerts` routes require Firebase authentication and the existing admin
email allowlist.

### List concerts

```http
GET /admin/concerts?page=1&pageSize=25&catalogStatus=active&q=summer&isFeatured=true
```

Supported filters:

- `catalogStatus`: `all`, `active`, `hidden`, or `archived`;
- `q`: case-insensitive title, description, venue, or band search;
- `isFeatured`: optional boolean filter;
- standard concert date and genre filters;
- `page`: one-based page number;
- `pageSize`: 1 through 100.

The response includes `data`, `total`, `page`, and `pageSize`. The Vue admin screen
uses 25 rows per page and exposes Previous and Next controls whenever more results
exist.

### Genre metadata

```http
GET /concerts/meta/genres
```

Genre metadata is public and does not require Firebase authentication. Options are
served from the controlled `genres` catalog table seeded by migration, not inferred
from existing concert rows. The response keeps the legacy `genres: string[]` field
for current selectors and adds stable `options: [{ slug, name }]` metadata for new
clients, OCR hints, and future normalized references.

### Read one concert

```http
GET /admin/concerts/{concertId}
```

Admin detail responses include the same decorated data as admin list responses:
engagement counts, sync provenance, poster URL, catalog state, editorial lock, and
optimistic version.

### Update one concert

```http
PATCH /admin/concerts/{concertId}
Content-Type: application/json

{
  "expectedVersion": 7,
  "title": "Summer Jam at The Pour House",
  "genre": "Indie Rock",
  "catalogStatus": "active",
  "isFeatured": true
}
```

The PATCH operation is comprehensive for the supported admin fields. It can update
core content, venue, visibility, Featured state, and synchronization authority in a
single version-checked request.

Validation rules include:

- `expectedVersion` is a positive integer;
- title is trimmed, nonblank, and at most 255 characters;
- genre is trimmed, nonblank, and at most 120 characters;
- timestamps must be ISO-8601 values;
- venue identifiers must be UUIDs;
- only active concerts can be Featured.

Fields documented as optional may be omitted, but explicit `null` is rejected unless
the contract says it clears a value (`endsAt`, `venueId`, or `description`).

Validation failures return `400 Bad Request`. Missing records return `404 Not
Found`. Stale writes return `409 Conflict` and never overwrite the newer record.

## Public Visibility Boundary

Normal public concert lists and public genre metadata include only active records.
Creating or deleting an upvote also requires the concert to remain publicly active.
Upvote deletion qualifies the mutation by public status and rechecks visibility
after calculating the response, so a known UUID cannot be used to inspect engagement
for hidden or archived records.

Admin-only metadata such as `catalogStatus`, `editorialLockedAt`, and `version` is
removed from public discovery responses.

## Operational Verification

Before promoting the feature from draft review:

1. Run the additive catalog migration against a disposable or dev PostgreSQL
   database.
2. Confirm existing rows default to active, unfeatured, and version 1.
3. Exercise edit, hide, restore, feature, unfeature, archive, and pagination as an
   allowlisted admin.
4. Confirm hidden and archived records disappear from public discovery and reject
   both upvote operations.
5. Start a sync update, make an admin edit first, and confirm the stale sync result
   is counted as skipped.
6. Record the dev Cloud Run revision and rollback target after deployment.
