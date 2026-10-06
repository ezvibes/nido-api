# Weekly Newsletter Generation Module (TPS2)

Project **TPS2** represents the future of how EZ Vibes curates, drafts, and delivers its weekly live music newsletter.

This uses Google Gemini, structured prompt templates, and the canonical concert
database to automate schedule organization while keeping the human editor at the
center of the output. The AI drafts the schedule and highlights; a human reviews,
edits, and delivers the final copy.

TPS2 is the North Star of the Nido platform—powering the flywheel of localized content, growing subscribers, and fulfilling our mission of bringing people together through live music.

## Architecture & Operational Flow

The generation pipeline operates as follows:
1. **Calendar Sync & Staging:** Run calendar sync jobs (`/concert-sync`) to pull events from Google Calendar or ICS feeds into the database catalog.
2. **Admin Curation & Approval:** Admins review and approve ingested concerts (`isAdminApproved = true`).
3. **Request Ingestion:** The controller accepts parameters including dates, `editionType` (`weekly`, `monthly`, `custom`), recap notes, featured highlights, and optional filters (`cities`, `genres`, `venues`, `region`).
4. **Database Query:** If enabled, `NewsletterCatalogService` queries active,
   admin-approved database concerts within the target date range. By default, up
   to 100 approved concerts are included; custom filters (`cities`, `genres`,
   etc.) can restrict the result.
5. **Calendar Feed Parsing:** If an ICS URL, raw ICS string, or JSON feed is supplied, the parser extracts events, filters them, and normalizes them.
6. **Source Preview:** Admins can preview the exact approved database concerts and optional parsed calendar items before spending a Gemini call.
7. **Prompt Hydration:** The service reads the prompt template at `.gemini/prompts/weekly_top_picks.md` and injects the parameters and calendar dump.
8. **Gemini Invocations:** The `@google/generative-ai` SDK executes the prompt using `gemini-3.6-flash` to yield a creative, community-focused newsletter draft.

---

## Service Boundaries

The newsletter module deliberately separates catalog access from generation:

```text
Admin/Scheduler request
        |
        v
NewsletterService
  - resolves the edition date range
  - parses optional admin-supplied calendar input
  - hydrates the prompt and invokes Gemini
  - optionally requests a Beehiiv draft
        |
        v
NewsletterCatalogService
  - owns the TypeORM repository
  - requires active + admin-approved database records
  - applies newsletter filters and exclusions
  - returns normalized and ordered source records
  - applies an optional bounded limit for agent callers
```

`NewsletterCatalogService.findApprovedConcerts()` is the canonical database
entry point for newsletter curation. Its input uses `Date` values plus optional
city, genre, venue, region, Featured, Top Pick, exclusion, and legacy strict
filters. It rejects invalid ranges and invalid explicit limits and orders results
by start time. Existing admin previews omit the limit and continue to receive all
eligible records. Future agent tools must provide a limit between 1 and 100; the
planned Zod tool contract defaults that explicit agent request to 20.

This boundary is important for Agent v2: the future
`fetchApprovedConcertsTool` will call this service through NestJS dependency
injection. The ADK layer will not import repositories, construct SQL, or define a
second publication rule. This keeps the current admin preview and future agent
retrieval aligned.

The service does **not**:

- approve, publish, hide, or mutate concerts;
- treat raw calendar input as approved catalog data;
- call Gemini, Beehiiv, or external URLs;
- select final newsletter recommendations.

The optional raw calendar path remains a separate admin-supplied input contract.
Only database-backed records receive the active/admin-approved guarantee.

### Focused Verification

```bash
npx jest src/newsletter/newsletter-catalog.service.spec.ts \
  src/newsletter/newsletter.service.spec.ts --runInBand
npm run test:newsletter:harness
```

The catalog service tests cover the publication predicate, normalized output,
filters, exclusions, result limits, and invalid query rejection. The offline
harness confirms preview and generation still use the same source records without
live provider calls.

---

## API Documentation

For repeatable checks without provider calls or credentials, run
`npm run test:newsletter:harness`. See the
[offline harness guide](../../test/agent-harness/README.md) for fixture coverage,
report interpretation, and the distinction between workflow verification and
live editorial quality. Database sources require both active catalog status and
admin approval; optional raw calendar inputs remain a separate admin-supplied
source contract.

### Preview Newsletter Sources
- **Endpoint:** `POST /api/newsletter/preview-sources`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Content-Type:** `application/json`
- **Behavior:** Returns source items that would be injected into the prompt without calling Gemini.

```json
{
  "dateRangeLabel": "September 2026",
  "concerts": [
    {
      "id": "concert-uuid",
      "title": "Dr. Bacon Live",
      "date": "Friday, Sep 4, 2026",
      "venue": "The Pour House Music Hall (Raleigh, NC)",
      "artists": "Dr. Bacon",
      "genre": "Funk",
      "isTopPick": true,
      "topPickScore": 0.9,
      "isHighlightArtist": true,
      "source": "Nido Concert Database"
    }
  ],
  "calendarEvents": [],
  "concertsCount": 1,
  "calendarEventsCount": 0,
  "totalCount": 1
}
```

### Generate Newsletter Draft
- **Endpoint:** `POST /api/newsletter/generate-weekly`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Content-Type:** `application/json`

### Example Request Payload (Weekly)

```json
{
  "startDate": "2026-08-11T00:00:00.000Z",
  "endDate": "2026-08-16T23:59:59.999Z",
  "editionType": "weekly",
  "dateRangeLabel": "Tuesday, Aug 11 - Sunday, Aug 16, 2026",
  "weekendRecap": "We had an amazing weekend catching Badfish and Eggy. Our local community is stronger than ever!",
  "featuredShow": "Dr. Bacon playing live at The Pour House on Friday night. Highly recommended funk-rock heads!",
  "featuredFestival": "Shakori Hills GrassRoots Festival details and volunteer crew coordination.",
  "rawCalendarData": "https://calendar.google.com/calendar/ical/example/public/basic.ics",
  "useDatabase": true
}
```

### Example Request Payload (Monthly Top Picks)

```json
{
  "startDate": "2026-09-01T00:00:00.000Z",
  "endDate": "2026-09-30T23:59:59.999Z",
  "editionType": "monthly",
  "dateRangeLabel": "September 2026",
  "weekendRecap": "September is packed with fall festival vibes across NC!",
  "useDatabase": true
}
```

### Example Response Payload

```json
{
  "newsletterDraft": "# EZ Vibes Weekly Top Picks: Tuesday, Aug 11 - Sunday, Aug 16, 2026\n\n#### 1. Quick Hits\n- 🥁 Funk-rock fusion heads: Dr. Bacon hits Raleigh this Friday! ...",
  "concertsCount": 3
}
```

---

## Local Verification (Curl Command)

You can trigger the endpoint manually using curl:

```bash
curl -X POST http://localhost:3001/api/newsletter/generate-weekly \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-08-11T00:00:00.000Z",
    "endDate": "2026-08-16T23:59:59.999Z"
  }'
```
