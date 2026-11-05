/**
 * Nido Centralized Runtime Contract Registry
 *
 * PURPOSE & ARCHITECTURE:
 * This directory defines the runtime compatibility contracts across Nido's operational boundaries:
 * 1. Cloud SQL / PostgreSQL TypeORM persistence entities.
 * 2. NestJS HTTP controllers and public API DTOs.
 * 3. Gemini multimodal structured output extraction.
 * 4. Google Cloud Tasks asynchronous worker queues.
 * 5. Firenze & Beehiiv curated newsletter cards.
 *
 * PRECEDENCE & AUTHORITY MATRIX:
 * When schemas or contracts disagree:
 * - Database & TypeORM Entities remain AUTHORITATIVE for persisted storage, transactions, and foreign keys.
 * - NestJS DTOs remain AUTHORITATIVE for HTTP endpoint wire format, auth guards, and route serialization.
 * - Runtime Contracts (src/contracts/) define INTER-SERVICE COMPATIBILITY and runtime validation boundaries.
 * - Human Approval is strictly MANDATORY before any candidate data from ingestion or agents can advance
 *   to canonical Concert, Band, or Venue entities.
 *
 * NON-GOALS:
 * - This layer is NOT a replacement for TypeORM entities or API DTOs.
 * - This layer does not fabricate fake database defaults for missing columns.
 * - This layer does not mutate database entities or catalog state.
 *
 * OWNERSHIP & EVOLUTION:
 * - Owned by: Integration Specialist (Innsbruck) & Mission Orchestration (Frankfurt).
 * - Versioning: Semantic versioning per contract module; breaking changes require contract matrix tests.
 */

export * from './venue.contract';
export * from './band.contract';
export * from './concert.contract';
export * from './extraction.contract';
export * from './worker-payload.contract';
export * from './newsletter.contract';
export * from './gemini-schema.adapter';
