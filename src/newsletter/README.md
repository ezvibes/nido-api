# Weekly Newsletter Generation Module (TPS2)

Project **TPS2** represents the future of how EZ Vibes curates, drafts, and delivers its weekly live music newsletter. 

This is peak AI application in action: utilizing advanced AI models (Google Gemini), structured prompt templates, and a verified canonical concert database to automate the heavy lifting of schedule organization, while keeping the human editor at the center of the output. The AI drafts the schedule and outlines the highlights; a human reviews, edits, and delivers the final vided copy. 

TPS2 is the North Star of the Nido platform—powering the flywheel of localized content, growing subscribers, and fulfilling our mission of bringing people together through live music.

## Architecture

The generation pipeline operates as follows:
1. **Request Ingestion:** The controller accepts parameters including dates, recap notes, featured highlights, and raw calendar links.
2. **NC Curation Query:** If enabled, the service queries active, approved concerts within the date range in North Carolina (Raleigh, Durham, Chapel Hill, Wilmington, Asheville, Charlotte, Boone) matching core genres (Bluegrass, Funk, Rock, Jam, Alt-Country, Roots, Soul, Reggae).
3. **Calendar Feed Parsing:** If an ICS URL, raw ICS string, or JSON feed is supplied, the parser extracts events, filters them by NC criteria, and normalizes them.
4. **Prompt Hydration:** The service reads the prompt template at `.gemini/prompts/weekly_top_picks.md` and injects the parameters and calendar dump.
5. **Gemini Invocations:** The `@google/generative-ai` SDK executes the prompt using `gemini-1.5-flash` with `temperature: 0.7` to yield a creative, community-focused newsletter draft.

---

## API Documentation

### Generate Newsletter Draft
- **Endpoint:** `POST /api/newsletter/generate-weekly`
- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Content-Type:** `application/json`

### Example Request Payload

```json
{
  "startDate": "2026-08-11T00:00:00.000Z",
  "endDate": "2026-08-16T23:59:59.999Z",
  "dateRangeLabel": "Tuesday, Aug 11 - Sunday, Aug 16, 2026",
  "weekendRecap": "We had an amazing weekend catching badfish and Eggy. Our local community is stronger than ever!",
  "featuredShow": "Dr. Bacon playing live at The Pour House on Friday night. Highly recommended funk-rock heads!",
  "featuredFestival": "Shakori Hills GrassRoots Festival details and volunteer crew coordination.",
  "rawCalendarData": "https://calendar.google.com/calendar/ical/example/public/basic.ics",
  "useDatabase": true
}
```

### Example Response Payload

```json
{
  "newsletterDraft": "# EZ Vibes Weekly Top Picks: Tuesday, Aug 11 - Sunday, Aug 16, 2026\n\n#### 1. Quick Hits\n- 🥁 Funk-rock fusion heads: Dr. Bacon hits Raleigh this Friday! ...",
  "concertsCount": 3,
  "concerts": [
    {
      "title": "Dr. Bacon Live",
      "date": "Friday, Aug 14, 2026",
      "venue": "The Pour House Music Hall (Raleigh, NC)",
      "artists": "Dr. Bacon",
      "genre": "Funk-Rock",
      "description": "Warmup set and album release show.",
      "isTopPick": true,
      "topPickScore": 0.94,
      "isPartnerArtist": true,
      "source": "Nido Concert Database"
    }
  ]
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
