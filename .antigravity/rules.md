# SYSTEM ARCHITECTURE DIRECTIVES: EZ VIBES / NIDO ECOSYSTEM

**Effective Date:** August 2026
**Scope:** All Workspace Agents & AI Operations

---

## 1. High-Level Ecosystem Division

### A. Public Website & Growth Engine (beehiiv)
- **Hosting Platform:** **beehiiv** AI Website Builder (`https://www.beehiiv.com`)
- **Responsibilities:**
  - Subscriber Growth, Newsletter Subscriptions, Gated Content & Paywalls.
  - Public Marketing pages & B2B `/partnerships` (Venue Sprints, Festival Packages, Artist EPKs).
  - Public **Top Picks** Weekly Show Guides & Lead Generation.
  - Direct Stripe checkout links for B2B advertising/sponsorship packages.
- **Integration Points:** Embedded client-side Vanilla JS/CSS widgets (via beehiiv Custom HTML blocks) and server-side post-sync via beehiiv API v2 (`/posts`).

### B. Admin & Curation Dashboard (Vue 3 App in `client/`)
- **Hosting / Location:** Vue 3 SPA located in `client/` inside `nido-api` repository.
- **Responsibilities:**
  - **Crucial Admin & Operations Tool** for the Vibes Squad & Operators.
  - Ingestion Review Queue & Moderation (human-in-the-loop validation of OCR / flyer ingestion).
  - Concert Sync Doctor & Catalog Management (Venues, Bands, Concerts).
  - Top Picks newsletter content generation & curation workflows.
  - Internal operations for the concert intelligence engine.

### C. Backend Intelligence & Data Platform (Nido API - NestJS / Postgres)
- **Hosting Platform:** NestJS API on Cloud Run + PostgreSQL via TypeORM (`https://github.com/ezvibes/nido-api`).
- **Responsibilities:**
  - **Concert Intelligence API:** Serving structured event data, venues, and artist entities (`/v1/events/published`).
  - **Automated Ingestion Pipeline:** Google Document AI + Gemini OCR converting unstructured flyer graphics into structured JSON event objects.
  - **Admin & Moderation Endpoints:** Powering the Vue 3 Admin Dashboard (`client/`).
  - **Ecosystem Orchestration:** Stripe webhook listeners (provisioning paid campaign statuses) and beehiiv API v2 syncing.

---

## 2. Updated Agent Directives & Rules

1. **Admin Dashboard (Vue 3 in `client/`):**
   - **Maintain and continue developing the Vue 3 app in `client/`** as the primary Admin & Moderation Dashboard.
   - Support Vibes Squad moderation workflows, flyer OCR review, catalog editing, Top Picks generation, and Sync Doctor.

2. **Public Site (beehiiv Integration):**
   - Do **NOT** build public consumer marketing or subscriber web pages inside the Vue 3 app—those live on beehiiv.
   - When building public web tools, produce clean, lightweight, standalone **Vanilla JavaScript / CSS** snippets designed to be embedded into **beehiiv Custom HTML blocks**.
   - Interface NestJS backend services with **beehiiv API v2 (`/posts`)** for newsletter content publishing.

3. **Backend & Database Rules (NestJS & TypeORM):**
   - Focus NestJS development on high-performance REST endpoints, TypeORM data integrity, role-based auth (JWT/API Keys), and webhooks.
   - Ensure `/v1/events/published` is optimized for fast, CORS-enabled fetching by client-side widgets embedded in beehiiv.
   - Maintain entities for `Event`, `Venue`, `Campaign` (handling Venue Sprints, Festival Packages, Artist EPKs), and `VibesSquadMember`.
