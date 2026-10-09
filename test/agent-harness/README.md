# Newsletter Offline Harness

Issue [#106](https://github.com/ezvibes/nido-api/issues/106), a bounded foundation
for [#101](https://github.com/ezvibes/nido-api/issues/101). This MVP exercises the
existing newsletter pipeline, not an autonomous ADK agent.

## Run

Use Node 22 and the repository dependencies (`npm ci`), then:

```bash
npm run test:newsletter:harness
```

No database, Docker, `.env`, Firebase login, model key, or Beehiiv account is
required. The suite instantiates the real `NewsletterService` and `BeehiivService`
with synthetic configuration, a query-aware repository fake, a mocked Gemini SDK,
and an in-memory Beehiiv HTTP transport. Node HTTP/HTTPS/socket calls fail the
suite; every application fetch must match the expected mocked request. These are
application-level guards, not an operating-system network sandbox.

The runner writes ignored `reports/latest.json` and `reports/latest.md`. It returns
nonzero for failed tests, no tests, or a missing/failed scenario check. In GitHub
Actions the Markdown report is also appended to the job summary. Both the shared
`npm run agent:gate` and the existing PR/dev workflows run this suite. Prompt,
harness, and runner changes trigger deployment validation.

## Fixtures And Assertions

All shows, venues, draft responses, and ticket URLs are synthetic. Do not add real
credentials, personal submission data, or scraped newsletter text to fixtures.

| Scenario             | Contract checked                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `ideal-weekend`      | Three approved NC concerts, chronological order, hydrated prompt, draft-only HTML staging |
| `data-drought`       | An unapproved-only catalog supplies zero shows; no fabricated source rows                 |
| `catalog-boundaries` | Unapproved, hidden, archived, excluded, and city-mismatched shows stay out                |
| `date-boundaries`    | Inclusive timestamp limits, adjacent events excluded, Eastern display dates               |
| `provider-failure`   | A model error stops staging; one call, no implicit retry                                  |
| `broken-links`       | Source URL preserved; known fixture 404 recorded as a warning, not automatically rejected |

Additional checks cover empty model output, missing model credentials, and Beehiiv
staging failure. The prompt's injected JSON must equal the previewed catalog
sources. The repository fake applies the production query's actual predicates,
so omitting approval or visibility filters exposes private fixture rows instead
of having the fake silently protect them.

The production correction in this slice adds `isAdminApproved: true` to the
database source query alongside active status and date limits. This aligns the
implementation with the existing documented editorial approval contract. There
are no migrations, DTO changes, UI changes, or cloud resource changes.

## Reading The Report

JSON schema version 1 includes the revision, dirty-working-tree indicator, Node
version, prompt and fixture hashes, assertion results, per-scenario results, and
explicit evidence boundaries. A dirty run tests local changes; its revision alone
does not identify a reproducible committed release. The full tested harness code
must accompany the hashes when comparing runs.

PASS establishes source selection, prompt hydration, error propagation, and the
existing output transport against fixed mock responses. It does **not** establish:

- factual accuracy, voice, or lack of hallucinations in live model output;
- HTML sanitization or browser rendering of arbitrary generated content;
- live ticket availability, model availability, or real Beehiiv integration;
- SQL execution, migrations, authentication, or deployed behavior;
- ADK tool contracts, autonomous iteration budgets, or OCR extraction quality.

In particular, the broken-link case remains a visible capability gap. A live URL
verifier and an output-to-source factual validator need their own implementation
and negative fixtures. The current service returns freeform Markdown rather than
typed curated event blocks; do not claim schema validation of generated picks.

## Editorial Review And Next Slice

Use the [provisional brand rubric](brand-voice.md) for human review. Ratings remain
pending until an editor reviews an actual draft. Do not manufacture a numeric
voice score from canned model output or run an LLM judge in the offline gate.

Next, establish typed catalog/tool and output contracts for #102, then reuse these
fixtures for factual negative tests. An explicitly opt-in live benchmark can
follow once the maintainer approves the provider, sample count, and cost limit.
Keep routine PR tests offline and deterministic.

## Local Handoff Evidence

Validation on 2026-10-02, branch `codex/newsletter-offline-harness`, based on main
`375a575`. Changes were uncommitted during these runs; the generated report records
that distinction. No live provider calls or deployed-environment checks were run.

| Layer                 | Evidence                                                                                                                        | Result                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Shared gate           | `npm run agent:gate`                                                                                                            | Hygiene, 148 API tests, 9 harness checks, 47 client tests, both builds passed |
| Focused lint          | `npx eslint test/agent-harness/newsletter.spec.ts test/agent-harness/offline.setup.ts test/agent-harness/mocks/mock-beehiiv.ts` | Passed without mutating files                                                 |
| Runner/workflows      | `node --check scripts/eval-newsletter-harness.mjs`; both workflow files parsed with installed `js-yaml`                         | Valid syntax and harness steps present                                        |
| Independent review    | Read-only verifier; environment fallback and overlapping city/exclusion fixtures corrected                                      | No residual findings after recheck                                            |
| Negative evidence     | Approval regression failed before the query fix; removing the PostgreSQL exclusion predicate fails `catalog-boundaries`         | Intended regressions detected                                                 |
| Environment isolation | Harness run with conflicting synthetic provider/template environment values                                                     | 9/9 checks passed                                                             |
| CI/dev                | Checks configured; branch not published or deployed                                                                             | Pending after maintainer review                                               |
| Migration/browser     | No schema or UI changes                                                                                                         | Not applicable; authenticated dev smoke remains pending                       |

## Dev Verification And Rollback

After an approved merge and deployment:

1. Sign in as an admin and preview a range containing an active approved show and
   a pending show. Only the approved show should appear as a database source.
2. Check hidden/archived records are absent and preview totals match the list.
3. Generate one draft only with maintainer-approved API spend. Keep Beehiiv auto-
   staging off unless explicitly testing that integration; never publish from a
   smoke test. Compare dates, venues, artists, and links against the preview.

Raw calendar input is a separate, existing admin-supplied source path; the added
database approval filter does not approve or validate that input. Leave it blank
when verifying this boundary. Live checks and human approval are required before
calling the entire newsletter workflow production-ready.

Rollback: redeploy the last verified API image/revision using the existing rollback
playbook. No schema rollback is needed. The previous query could include pending
concerts, so use database previews cautiously if this correction is reverted.
