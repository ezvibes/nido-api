# Project TPS2 Curation & Refinement Framework

This framework provides a protocol for processing feedback from Evan and Camille to continuously optimize and polish the weekly newsletter curation drafts.

---

## 1. Feedback Categories & Actions

When you receive feedback regarding output curation, classify it into one of these four categories:

### A. Tone & Voice Adjustments
* **Example:** *"Make it sound a bit less sales-y and more jam-adjacent."* or *"Add 'heads' and 'heaters' to the lingo check."*
* **Action:**
  1. Open [weekly_top_picks.md](file:///.gemini/prompts/weekly_top_picks.md).
  2. Navigate to the `### IDENTITY & TONE` section.
  3. Add or modify the specific bullet point instructions (e.g., add positive/negative lingo examples).

### B. Layout & Formatting Tweaks
* **Example:** *"Group shows by city first, then chronologically."* or *"Change the schedule divider line to a custom symbol."*
* **Action:**
  1. Open [weekly_top_picks.md](file:///.gemini/prompts/weekly_top_picks.md).
  2. Locate the `### OUTPUT FORMAT` section.
  3. Edit the markdown examples and rules showing Gemini exactly how to style headers, bullet points, and show records.

### C. Curation Rules (Bands & Venues)
* **Example:** *"Add Badfish and Eggy to partner artists."* or *"Exclude heavy metal genres from our NC pull."*
* **Action:**
  1. Open [weekly_top_picks.md](file:///.gemini/prompts/weekly_top_picks.md) and edit `### DATA INGESTION & CURATION RULES`.
  2. Update the target arrays in the NestJS service filter list inside [newsletter.service.ts](file:///Users/ezvibes/EZ/nido-api/src/newsletter/newsletter.service.ts) to match the database query limits.

### D. Model & API Performance
* **Example:** *"Upgrades the model to Gemini 1.5 Pro to get better paragraph flow."* or *"Change the temperature to reduce repetitive sentences."*
* **Action:**
  1. To change temperature, edit `generationConfig` inside [newsletter.service.ts](file:///Users/ezvibes/EZ/nido-api/src/newsletter/newsletter.service.ts) (e.g., lower temperature for deterministic structures, higher for creative tone).
  2. To change the model, update the `GEMINI_MODEL` environment variable in the Cloud Run configuration.

---

## 2. Refinement Protocol (Agent Workflow)

Whenever the user provides curation feedback in chat:

1. **Alignment:** Restate the feedback to verify the intent.
2. **Implementation:** Update [weekly_top_picks.md](file:///.gemini/prompts/weekly_top_picks.md) and/or backend config files.
3. **Change Log:** Append a brief log at the bottom of the prompt template:
   ```markdown
   ## CHANGE HISTORY
   - [Date]: [Brief description of change, e.g. "Added Eggy to partner artists, lowered temperature to 0.6"]
   ```
4. **Smoke Test Verification:** Run the local dev smoke test to confirm formatting compliance:
   ```bash
   npm run agent:gate
   ```

---

## 3. Recommended Collaboration Pattern

- For simple coaching, state the desired tone, layout, or curation rule in the
  task and ask the agent to update the prompt template or tests.
- For complex prompt changes, ask the agent to interview you briefly before
  editing so the rule is captured in durable project files rather than only in
  chat memory.
