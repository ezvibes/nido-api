# Firenze / TPS2 Curation Refinement Framework

TPS2 is EZ Vibes' Weekly Top Picks program. Firenze is the Newsletter and
Editorial Agent that supports it. This framework turns editor feedback into a
durable prompt, rubric, fixture, application, or documentation change.

## Feedback Categories

### Voice And Tone

Examples include reducing sales language, using scene terminology more naturally,
or removing unsupported claims.

Update `.gemini/prompts/weekly_top_picks.md` and
`test/agent-harness/brand-voice.md`. Add or revise a fixture when the rule can
be evaluated deterministically.

### Layout And Format

Examples include section order, chronological grouping, headings, or structured
Beehiiv output.

Update the prompt and the corresponding response or UI tests. Preserve required
template variables and distinguish current Markdown output from proposed
structured content blocks.

### Curation Policy

Examples include geographic focus, genre balance, partner treatment, exclusions,
or the number of recommendations.

Inspect the approved-catalog query and current editor inputs before changing the
policy. Put business eligibility in NestJS/TypeORM, editorial guidance in the
prompt or rubric, and user-selectable behavior in explicit API/UI inputs.

Historical partner examples included Dr. Bacon, Big Fur, Larry Keel, Sam Fribush,
Treehouse!, Julia, Africa Unplugged, Nth Power, Chill Paxton, Toubab Krewe, Tand,
Badfish, Sons of Paradise, Eggy, Daniel Donato, Dogs in a Pile, and Billy Strings.
Treat this as historical context, not a permanent current list. Confirm current
relationships with the maintainer or application data.

### Model And Provider Behavior

Examples include generation quality, model availability, timeouts, ticket-link
checks, or Beehiiv draft creation.

Use environment configuration for model selection. Keep network calls bounded,
preserve draft-only authority, and separate deterministic tests from
live-provider evidence.

## Refinement Protocol

1. Restate the feedback and classify it.
2. Inspect the current canonical source and existing evidence.
3. Make one focused change in the correct layer.
4. Add a regression fixture or test when practical.
5. Run focused tests, `npm run test:newsletter:harness`, and the shared gate.
6. Report live checks that were completed or intentionally skipped.

Do not append an unbounded change log to the production prompt. Git history, PR
evidence, focused tests, and the agent learning guide are the durable record.
