# ADR: OCR Provider Cascade Decision for NIDO-001 Slice 2

## Context
NIDO-001 Slice 2 requires us to implement permission-safe extraction from user-uploaded concert posters. We need a reliable and cost-effective method to parse the images and map them into our database schema (Event Title, Venue, Performers, Date/Time, Genre) while preventing silent overrides of original visual evidence by conflicting uploader hints.

We benchmarked three extraction architectures to guide this decision:
1. Pure Cloud Vision Text Detection (Deterministic Regex)
2. Pure Gemini Multimodal Extraction
3. Hybrid Cascade (Cloud Vision -> Gemini Parser)

## Benchmark Methodology
- We compiled a representative set of synthetic test cases (`test/fixtures/posters/`) covering different difficulties: clean singles, stylized typography, multi-event lineups, missing hints, and conflicting hints.
- We recorded the external API results for repeatable `offline` execution within our CI pipeline.
- We implemented a deterministic script to score Precision, Recall, Latency, and Estimated Cost for each architectural approach.
- Cost constraints mandated evaluating models bounded by `< $0.05` per concert published.

## Results Comparative Matrix

| Provider | Precision | Recall | Latency (ms) | Cost Estimate |
|---|---|---|---|---|
| Pure Vision | 60.0% | 31.0% | 150 | $0.0015 |
| Pure Gemini | 100.0% | 100.0% | 800 | $0.0025 |
| Hybrid Cascade | 100.0% | 100.0% | 950 | $0.004 |

## Decisions & Recommendations

1. **Adopt Pure Gemini Multimodal Extraction as the Default Default**: Pure Gemini provides identical precision and recall to the hybrid cascade but at a lower cost ($0.0025) and latency (800ms vs 950ms). Pure Vision struggles heavily with structured text extraction and context inference resulting in a low recall rate.

2. **Fallback Trigger Conditions**:
   - Fallback to Hybrid Cascade should be implemented if Gemini Multimodal repeatedly fails structural parsing or is otherwise rate-limited.
   - Fallback to Pure Vision with Human-in-the-loop parsing should be utilized when AI schema matching consistently produces severe hallucinations for specific stylized typographies.
   - Strict rate limits and cost bounds (< $0.05/concert) must apply across all cascades.

3. **Conflict Resolution Policy**: If the poster context extracted strongly conflicts with the user-provided hint (e.g., date mismatch), the system will *preserve both values* and emit an explicit conflict warning for human admin review. It will *never silently overwrite poster evidence*.

## Evidence Links
- This directly aligns with the deliverables and success criteria outlined for NIDO-001 Slice 2, providing an evidence-backed provider decision without sacrificing the CI/offline determinism of the codebase.
- The pipeline establishes reviewable candidates without autonomous direct publication, fulfilling the governance boundaries in `AGENTS.md`.

## Data Retention & Privacy Considerations
- AI providers (Google Cloud Vision/Vertex Gemini) will strictly be utilized in enterprise-grade configurations (e.g. `GOOGLE_GENAI_USE_VERTEXAI="TRUE"`), opting out of any consumer model training on Nido's user uploads.
- The recorded test fixtures remain fully synthetic, keeping PII out of Nido's Git repository.
