---
name: firenze-newsletter
description: Use for Firenze, Nido's Newsletter and Editorial Agent, including TPS2 Weekly Top Picks curation, approved-catalog evidence, prompt and voice refinement, co-bill recommendations, ticket-link checks, Beehiiv draft staging, and editorial quality review.
---

# Firenze Newsletter And Editorial Agent

Firenze helps a human editor turn Nido's reviewed concert evidence into useful,
authentic newsletter drafts. **TPS2 is the Weekly Top Picks program; Firenze is
the agent that supports it.**

Firenze is an editorial assistant, not an autonomous publisher. A maintainer or
editor owns selection, claims, voice, scheduling, publication, and sending.

## Route Work Correctly

- Use this skill for newsletter selection rules, prompts, voice, source previews,
  generated drafts, editorial evaluation, and Beehiiv draft preparation.
- Also use `gear-agent-flywheel` when changing Firenze's ADK orchestration or
  tool contracts.
- Also use `nido-feature-flywheel` when changing NestJS, Vue, TypeORM,
  migrations, or API behavior.
- Also use `nido-deployment-manager` for credentials, scheduled execution,
  cloud runtime, provider availability, cost limits, or post-deployment
  verification.

## Editorial Contract

1. Use only active, admin-approved concerts as publication evidence.
2. Keep the configured date and geographic scope explicit. TPS2 currently serves
   North Carolina, with emphasis on Raleigh, Durham, Chapel Hill, Wilmington,
   Asheville, Charlotte, and Boone.
3. Favor the EZ Vibes music focus: bluegrass, funk, rock, jam, alt-country,
   roots, soul, reggae, and adjacent scenes. Do not silently exclude a valid show
   solely because a genre label is incomplete.
4. Treat partner status, top-pick status, co-bill history, and ticket
   reachability as evidence for human review, not automatic editorial
   conclusions.
5. Use an authentic local voice. Avoid generic marketing hype, invented personal
   experience, unsupported popularity claims, and forced scene slang.
6. Stage Beehiiv drafts only after explicit confirmation. Firenze cannot
   publish, schedule, or send a newsletter.

Current partner priorities are editorial inputs that can change. Confirm them in
the current task or application data before encoding a permanent rule. Historical
examples remain documented in the
[refinement framework](references/refinement-framework.md).

## Canonical Sources

- Plain-English purpose and boundaries:
  `developer-docs/catalog-operating-system/firenze-newsletter-agent.md`
- Runtime and API behavior: `src/newsletter/README.md`
- Prompt template: `.gemini/prompts/weekly_top_picks.md`
- Editorial rubric: `test/agent-harness/brand-voice.md`
- Deterministic fixtures and report: `test/agent-harness/`
- Tool contracts and handlers: `src/newsletter/agent/`
- Current implementation and tests: `src/newsletter/` and
  `client/src/pages/AdminWeeklyPicksPage.vue`

Do not treat the prompt, this skill, or a previous report as proof of current
catalog data, provider availability, or deployment health.

## Workflow

1. Restate the editorial outcome, date range, geography, audience, and requested
   output.
2. Inspect the current prompt, rubric, relevant implementation, tests, and source
   preview before changing a rule.
3. Separate catalog facts from model recommendations and human editorial choices.
4. Make the smallest durable change in the correct source: prompt, rubric,
   fixture, application code, or documentation.
5. Add or update a deterministic fixture when a failure can be reproduced without
   a live provider.
6. Run focused newsletter tests and `npm run test:newsletter:harness`, then run
   `npm run agent:gate` before handoff.
7. Record skipped live-model, network, Beehiiv, authenticated, or deployment
   checks explicitly.

## Review Checklist

- Date range and geography match the requested edition.
- Every selected concert is active and admin-approved.
- Artists, venue, time, ticket URL, and material claims are traceable to evidence.
- Partner or sponsored treatment is intentional and appropriately disclosed.
- Output follows the required newsletter structure without unresolved template
  placeholders.
- Voice reflects the current rubric without fabricating experience or certainty.
- Ticket reachability is not misrepresented as ticket accuracy or availability.
- Any Beehiiv operation creates a draft only and retains human publication
  authority.

## Feedback And Learning

Classify feedback as voice, format, curation policy, source-data quality, model
behavior, or provider integration. Update the canonical source for that category
instead of accumulating one-off instructions in chat. Use the
[refinement framework](references/refinement-framework.md) for examples and the
repository learning guide for durable cross-agent lessons.
