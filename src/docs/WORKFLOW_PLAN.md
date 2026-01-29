# Onboarding Flow Plan

## Learning Objectives
- Who is responsible for what ( swim lanes)

## Tools used
- draw
- firebase auth
- vs code or goose

## Additonal resources too learn
- draw.io
- firebase auth
- firestore
- postgress

# Workflow PLan

## Authentication & User Bootstrap Flow

### Status

**Finalized (MVP v1)** – aligned with current architecture diagram and implementation plan.

---

## Summary

This document describes the finalized **authentication and user bootstrap flow** for the Carolina Live Music ecosystem, powered by the open‑source **NIDO API**.

The architecture is intentionally designed to:

- Use **Firebase Authentication** for identity and OAuth abstraction
- Keep the **backend (NIDO API)** authoritative for domain users
- Minimize database footprint for the MVP
- Support web, mobile, and future AI/agent clients with the same flow

This design is production‑sound while remaining cost‑effective and simple for early development.

---

## Core Design Principles

- **Identity ≠ Domain User**
- **Clients are thin** (no business logic)
- **Backend is deterministic**
- **Auth is reusable across human and AI clients**

---

## High-Level Components

### Web App

- Vue 3 + TypeScript
- Uses Firebase Client SDK
- Stores Firebase JWT in memory or secure client storage
- Makes authenticated HTTP requests via Axios

### Identity Providers

- **Google Identity Platform** (OAuth)
- **Firebase Authentication** (token verification + JWT issuance)

### Backend API

- **NIDO API (NestJS)**
- Validates Firebase JWTs using Firebase Admin SDK
- Owns domain user lifecycle
- Exposes idempotent auth bootstrap endpoint (`POST /auth/sync`). This endpoint's job is to find a user based on the token, create one if they don't exist, and return the canonical user entity from Postgres.

### Data Store

- **Postgres** (domain users only)
- Firebase Auth stores identity metadata

---

## Detailed User Signup Flow

(Based on the diagram in `src/assets/FirebaseSignupFlow.jpg`)

This flow outlines the precise sequence of events when a new user signs up.

### Swim Lanes
- **Web App:** The client-side application the user interacts with.
- **Identity Providers:** Google Identity and Firebase Authentication.
- **Nido API:** The backend application.
- **Data Store:** The Postgres database.

### Step-by-step Flow
1.  **Web App:** User arrives on the Sign Up page.
2.  **Web App:** User clicks "Sign Up with Google".
3.  **Identity Providers:** The client redirects the user to Google Identity Platform for OAuth.
4.  **Identity Providers:** Google authenticates the user and returns a Google ID Token.
5.  **Identity Providers:** The Google ID Token is exchanged for a Firebase JWT.
6.  **Web App:** The frontend receives the Firebase JWT and stores it in memory or secure storage.
7.  **Web App & Nido API:** The frontend calls a `POST /auth/sync` endpoint on the Nido API, including the Firebase JWT in the authorization header.
8.  **NIDO API:** The API validates the Firebase JWT using the Firebase Admin SDK. It then checks if a user record already exists in the database.
9.  **NIDO API & Data Store:** If no user record is found, a new one is created in the Postgres database. The user's `email`, `picture`, and `uid` (Firebase ID) are extracted from the decoded JWT claims and mapped to the new user record.
10. **NIDO API:** The user object (either found or newly created) is returned to the frontend.
11. **Web App:** The user sees an "account created" confirmation and a welcome message.

---

## Future Architectural Patterns

### @CurrentUser Decorator

To streamline development and avoid repetitive database queries in controllers, a custom NestJS decorator, `@CurrentUser()`, will be implemented. This will allow easy access to the fully populated Postgres `User` entity within any controller method.

**Example Usage:**
```typescript
@Get('profile')
getProfile(@CurrentUser() user: UserEntity) {
  // 'user' is the full UserEntity object from Postgres
  return user;
}
```