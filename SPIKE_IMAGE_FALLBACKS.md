# Spike: Image Handling and Fallbacks for Google Calendar Synced Concerts

## Executive Summary
Concerts ingested from Google Calendar sync frequently lack flyer/poster images. This spike investigated Google Calendar event payload capabilities, backend storage/schema implications, and client rendering strategies to ensure the Nido public concert list avoids blank or broken visual states as ingestion expands.

---

## Answers to Spike Questions

### 1. Does Google Calendar event data expose any usable image/attachment fields for our sync use case?
* **Google Calendar API v3 Schema:** The API exposes an optional `attachments[]` array on `Event` objects (`fileUrl`, `title`, `mimeType`, `iconLink`, `fileId`).
* **Real-World Availability:** In practice for venue/promoter Google Calendars:
  1. Most music calendar events do **not** include attached image files in `attachments[]`. Event titles, start/end times, and descriptions are standard, but media attachments are rare.
  2. When attachments are present, `fileUrl` typically points to a Google Drive URL (`https://drive.google.com/file/d/.../view`). Fetching or displaying Google Drive attachments requires elevated Google OAuth scopes (`https://www.googleapis.com/auth/drive.readonly`) and authenticated download streams, as Drive links cannot be directly embedded as `src` URLs on client web pages due to CORS and access restrictions.
  3. Inline image links within HTML event descriptions are inconsistent, frequently broken, hosted on non-CORS external domains, or non-image web pages.

### 2. If calendar events include attachments, can or should we sync those into our storage model?
* **Recommendation:** **Do not auto-download or ingest calendar attachments in the MVP sync pipeline.**
* **Rationale:**
  * Auto-downloading arbitrary attachments from external calendars introduces security risks (untrusted binary files), storage bloat, and OAuth permission friction.
  * Google Calendar sync should remain focused on lightweight event metadata extraction (artists, venue, start time, genre).
  * Flyer upload and poster management should remain driven by Admin/Promoter manual poster uploads via GCP Cloud Storage (`/ingestion/upload-url`).

### 3. Should synced concerts support an optional `imageUrl`, `posterUrl`, or storage object reference?
* **Current State & Recommendation:** Keep `posterUrl: string | null` (or optional) in the backend `Concert` entity and DTO response model.
* **Model Integrity:** `posterUrl` represents an accessible image URL (e.g. GCP Signed URL or public storage URL). When no flyer exists, `posterUrl` should explicitly be `null`.
* **Client Contract:** Client components must treat `posterUrl` as optional (`string | null`), avoiding reliance on external placeholder service URLs (like `placehold.co`) which create network overhead and generic visual noise.

### 4. What should the public concerts list show when a concert has no image?
* **Recommended MVP Approach:** Render a dynamic, genre-aware, pure CSS gradient tile with styled typography, genre badge, artist initials, and an SVG geometric pattern overlay directly in the client (`ConcertCard.vue`).
* **Benefits:** Zero external HTTP requests, zero storage overhead, instant render performance, zero risk of missing/broken placeholder images.

### 5. Fallback Visual Treatment Options Considered
* **Option A: Static Default Asset (e.g., standard Nido placeholder image)**
  * *Pros:* Simple.
  * *Cons:* Monotonous when multiple synced shows lack posters in a row.
* **Option B: Venue or City/Region Static Images**
  * *Pros:* Contextual.
  * *Cons:* Requires maintaining asset libraries for venues/cities; repetitive when scanning multiple shows at the same venue.
* **Option C: Genre-Aware CSS Gradient + SVG Texture + Initials Badge (RECOMMENDED & IMPLEMENTED)**
  * *Pros:* Highly polished, visually distinct per music genre (Electronic, Rock, Jazz, Acoustic, Hip-Hop, Default), lightweight, fast, zero image assets required, fully responsive. Handles image loading errors gracefully (`@error` event).
* **Option D: Dynamic AI / Generative Image Pipeline**
  * *Pros:* Unique artwork.
  * *Cons:* Out of scope, expensive, slow ingestion, potential quality control issues.

### 6. How should the fallback behave across desktop and mobile cards?
* **Mobile (< 720px):** Fits standard 3:4 portrait poster aspect ratio (`aspect-ratio: 3 / 4`, min-height 220px).
* **Desktop (≥ 720px):** Renders in the left column (`220px` width) matching the full height of the horizontal concert card layout.
* **Resilience:** If a concert has a `posterUrl` configured but the image URL breaks (404/CORS/network failure), `ConcertCard.vue` intercepts `@error` and seamlessly swaps to the fallback visual tile without breaking layout.

### 7. What is the smallest schema/API/client change needed to support the recommended approach?
* **Backend:** 0 schema or API changes required. (`posterUrl` remains `string | null` on `Concert` entity and `ConcertResponseDto`).
* **Client Types:** Updated `ConcertListItem` interface so `posterUrl` is `string | null`. Removed `placehold.co` mock fallbacks in page transformers.
* **Client UI:** Implemented styled CSS gradient + SVG texture fallback component within `ConcertCard.vue` with `@error` image loading fallback.

---

## Implementation Summary (Included MVP Prototype)

1. **`client/src/types/concerts.ts`**:
   * Updated `ConcertListItem` `posterUrl` type definition to `string | null`.
2. **`client/src/pages/ConcertsPage.vue`**:
   * Preserved `posterUrl: null` when no flyer URL is present instead of substituting external placeholder image URLs.
3. **`client/src/components/concerts/ConcertCard.vue`**:
   * Implemented genre-themed CSS gradients (`.concert-card__fallback--electronic`, `--rock`, `--jazz`, `--acoustic`, `--hiphop`, `--default`).
   * Added dynamic genre badge, artist initials computation, SVG pattern background, and `NIDO` branding.
   * Added `@error` image listener (`handleImageError`) to convert broken poster URLs to the visual fallback automatically.
4. **`client/src/components/concerts/ConcertCard.spec.ts`**:
   * Added unit tests verifying visual fallback rendering when `posterUrl: null` and error recovery when image loading fails.

---

## Risks and Follow-Up Work
* **Future Enhancement:** Optional venue image fallbacks if venues upload default venue photography in admin settings.
* **Sync Extensions:** If Google Calendar events start including flyer links in custom extended properties (`extendedProperties.shared`), a parser can extract valid HTTP image URLs without needing Drive permissions.
