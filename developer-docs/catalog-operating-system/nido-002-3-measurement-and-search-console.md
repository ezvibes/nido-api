# NIDO-002.3: Organic, AI Referral & Conversion Measurement Runbook

- **Issue:** [#222](https://github.com/ezvibes/nido-api/issues/222) (Parent mission: [#207](https://github.com/ezvibes/nido-api/issues/207))
- **Status:** Implemented (`NIDO-002.3`), awaiting dev deploy + Search Console property verification by maintainer
- **Measurement ID (dev):** `G-QHDNZBE86B` (`nido-api-9ed65`, Firebase Analytics enabled lazily only when `VITE_FIREBASE_MEASUREMENT_ID` is configured)

## 1. Day-0 Baseline (2026-11-18 UTC)

Recorded directly against the live dev deployment (`e66c2a7` / Cloud Run `nido-api-00109-chf`, prior to NIDO-002.3 event collection):

| Signal | Baseline Value | Verification Source |
| --- | --- | --- |
| Live upcoming approved concerts (`GET /concerts`) | `39` (`38` in `NC`) | `https://nido-api-81555493719.us-east1.run.app/concerts` |
| URLs indexed in `/sitemap.xml` | `41` (`/`, `/concerts`, + `39` concert pages) | `https://nido-api-9ed65.web.app/sitemap.xml` (HTTP 200) |
| Sitemap pages in `/sitemap-index.xml` | `1` | `https://nido-api-9ed65.web.app/sitemap-index.xml` (HTTP 200) |
| Crawl policy (`/robots.txt`) | Present (HTTP 200) | `https://nido-api-9ed65.web.app/robots.txt` |
| Google Search Console indexing / clicks baseline | `0` / unverified | No `google-site-verification` token configured prior to #222 |
| Client GA4 event collection baseline | `0` events before #222 | `client/src/firebase.ts` initialized only `auth` and `storage` |
| Outbound ticket referral UTM tagging | Active (`utm_source=nido`, `utm_medium=referral`, `utm_campaign=concert_discovery`) | `client/src/utils/concert-presentation.ts` |
| Beehiiv newsletter signup endpoint | Active (`POST /api/newsletter/subscribe`) | `src/newsletter/beehiiv.service.ts` |

## 2. Privacy-Safe Traffic & AI Referral Classification

`client/src/utils/analytics.ts` classifies first-touch session attribution into `sessionStorage` (`nido_session_attribution`) on initial route entry (`router.beforeEach`) before any redirect (such as `/` -> `/concerts` for signed-in users):

- `ai_referral`: `chatgpt.com`, `chat.openai.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `bard.google.com`, `copilot.microsoft.com`, `you.com`, `phind.com`, `kagi.com`, `poe.com`, or explicit `?utm_medium=ai` / `ai_referral` / `?utm_source=<ai-provider>`.
- `organic_search`: Google Search domains (excluding `gemini.google.com` and `bard.google.com`), `bing.com`, `duckduckgo.com`, `search.yahoo.com`, `search.brave.com`, `ecosia.org`, or `?utm_medium=organic`.
- `social`: `instagram.com`, `facebook.com`, `t.co`, `x.com`, `twitter.com`, `reddit.com`, `threads.net`, `bsky.app`, `tiktok.com`, `linkedin.com`, or `?utm_medium=social`.
- `email`: `beehiiv.com`, `substack.com`, or `?utm_medium=email` / `newsletter`.
- `referral`: any other external referrer hostname or `?utm_source=...`.
- `direct`: internal/empty referrers without UTM parameters.

When a visitor lands via `ai_referral` (for example from ChatGPT or Perplexity) and subscribes to the Weekly Top Picks newsletter, `resolveNewsletterAttribution` forwards `utmMedium: 'ai_referral'` alongside the banner `utmSource` (`nido_home`, `nido_concerts_feed`, `nido_concert_detail`) to `POST /api/newsletter/subscribe` -> Beehiiv.

## 3. Client Analytics Events (GA4 / Firebase Analytics)

All events attach `{ traffic_channel, traffic_source, traffic_medium, landing_path }` and explicitly strip `email`, `token`, `idToken`, and `password` parameters:

| Event Name | Trigger Location | Key Parameters |
| --- | --- | --- |
| `page_view` | `client/src/router.ts` (`afterEach`, excludes `/admin*` and `/concert-sync`) | `page_path`, `route_name` |
| `concert_ticket_click` | `ConcertCard.vue`, `ConcertDetailPage.vue` | `source_surface`, `concert_id`, `concert_city` |
| `concert_calendar_export` | `ConcertDetailPage.vue` | `export_type` (`google_calendar` or `ics`), `concert_id` |
| `concert_share` | `ConcertDetailPage.vue` | `concert_id`, `share_method` (`native` or `clipboard`) |
| `newsletter_subscribe_attempt` / `newsletter_subscribe_success` / `newsletter_subscribe_error` | `NewsletterSignupBanner.vue` | `source_surface`, `campaign` |
| `concert_submission_started` / `concert_submission_completed` | `IngestionUploadPanel.vue` | `source_surface`, `has_venue`, `has_band`, `has_genre` |

## 4. Google Search Console & GA4 Operator Checklist

### One-Time Property Verification (Maintainer)
1. Open Google Search Console and add `https://nido-api-9ed65.web.app` (URL-prefix) or custom production domain (Domain TXT).
2. Copy the HTML meta verification token and store it as GitHub repository/environment variable `VITE_GOOGLE_SITE_VERIFICATION`:
   - `client/vite.config.ts` automatically injects `<meta name="google-site-verification" content="..." />` into `dist/index.html` whenever `VITE_GOOGLE_SITE_VERIFICATION` is non-empty during CI/Hosting builds.
3. Submit both sitemaps in Search Console -> **Sitemaps**:
   - `https://nido-api-9ed65.web.app/sitemap-index.xml`
   - `https://nido-api-9ed65.web.app/sitemap.xml`
4. Run **URL Inspection -> Test Live URL** on `/concerts` and one active `/concerts/:id` detail URL to confirm rendered `MusicEvent` JSON-LD and canonical tag visibility.

### GA4 Custom Dimensions & Key Events (Maintainer)
1. In Google Analytics 4 (`G-QHDNZBE86B`), register event-scoped custom dimensions for `traffic_channel`, `traffic_source`, and `source_surface`.
2. Mark `newsletter_subscribe_success`, `concert_ticket_click`, and `concert_submission_completed` as Key Events.
3. Use a weekly Exploration breaking Key Events down by `traffic_channel` (`ai_referral` vs `organic_search` vs `social` vs `email` vs `direct`).
