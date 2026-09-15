# ADR: Multimodal Agent Ingestion System (v2)

## Status
Proposed (Targeting Slice 1 Implementation)

## Context & Objectives
Nido API v1 relied on deterministic scraping and single-prompt LLM extractions. As concert sources expand across unstructured Instagram flyers, multi-event poster collages, iCal feeds, and venue websites, the single-prompt extraction pattern faces failure modes:
1. Multi-event flyer collages dropping secondary support acts or conflating show dates.
2. Venue name mismatching causing duplicate database records.
3. Lack of agentic verification loops when confidence is low.

Ingestion v2 introduces an **Autonomous Multimodal Agent System** using Gemini 2.5 Flash / 3.6 Flash and ReAct pattern orchestration.

## Architecture & Agent Cycle
```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────┐
│  1. PERCEIVE    │───>│    2. THINK      │───>│      3. ACT       │───>│     4. CHECK     │
│  (OCR/Vision)   │    │  (ReAct Loop)    │    │ (Tool Execution)  │    │  (Confidence)    │
└─────────────────┘    └──────────────────┘    └───────────────────┘    └──────────────────┘
```

1. **Perceive**: Extract text, dates, venues, lineup from image/flyer via Gemini Flash Multimodal.
2. **Think**: Determine if venue exists in DB via Trigram similarity search (`pg_trgm`).
3. **Act**: Execute entity resolution tools (`resolveVenue`, `normalizeArtistNames`, `findExistingConcert`).
4. **Check**: Evaluate confidence score ($0.0 - 1.0$). If score $\ge 0.85$, auto-approve. Otherwise, queue for Admin Review Console.

## Components & File Locations
- **`src/ingestion/agent/flyer-extractor.service.ts`**: Core agent orchestrator handling multimodal image parsing and tool calls.
- **`src/ingestion/agent/tools/venue-resolver.tool.ts`**: Trigram fuzzy matching against `venues` database table.
- **`src/ingestion/agent/tools/artist-normalizer.tool.ts`**: Normalizes headliner vs support roles and standardizes genres.
- **`src/apis/concerts/admin-concert.controller.ts`**: Admin review console endpoints for 1-click approvals of low-confidence extractions.
