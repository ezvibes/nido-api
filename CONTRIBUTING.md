# Contributing To EZ Vibes Nido

Thanks for considering a contribution. This is a public project owned by Evan Bonertz, creator and founder of EZ Vibes. Contributions are welcome when they are scoped, tested, and aligned with the current product direction.

## Current Product Direction

Nido is a concert intelligence platform and admin tool for EZ Vibes. The current API/domain language is:

- `Concert`: the primary object displayed in the shared concert feed.
- `Venue`: location and market context for concerts.
- `Band`: artist/lineup context for concerts.
- `Ingestion`: uploaded flyers/images and processing jobs.
- `Admin Review`: EZ Vibes member tooling for reviewing and publishing uploaded flyers.

Avoid introducing a separate `Event` model or broad architecture migration unless a GitHub issue explicitly asks for it.

## Picking Up Work

Start with GitHub issues labeled `good first issue`, `Starter`, or explicitly assigned to you. Use the issue template when proposing focused tasks, improvements, or bug reports.

Before coding:

- Read the issue fully.
- Inspect the files listed in the issue.
- Check existing tests for the module.
- Ask for clarification in the issue if the product outcome is unclear.

## Branch Naming

Create branches from `main`:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b <type>/<short-issue-slug>
```

Examples:

```bash
git checkout -b feature/concert-city-region-filters
git checkout -b fix/venue-region-filter
git checkout -b docs/readme-contributor-guide
```

Recommended prefixes:

- `feature/` for new behavior.
- `fix/` for bug fixes.
- `docs/` for documentation-only work.
- `chore/` for maintenance.

`codex/` is acceptable for Codex-created branches, but it is not required for other contributors.

## Development Standards

- Keep each PR focused on one issue.
- Prefer small, reviewable changes over large rewrites.
- Do not commit `.env`, credentials, service account JSON, tokens, or local-only docs.
- Preserve current API behavior unless the issue explicitly changes it.
- Update Swagger/OpenAPI DTOs when API request or response contracts change.
- Add or update focused tests for the changed behavior.
- Avoid broad refactors unless they are required to complete the issue safely.

## Useful Commands

```bash
npm install
npm install --prefix client
npm run start:dev
npm run dev --prefix client
npm test
npm test -- --runInBand concerts
npm test -- --runInBand ingestion
npm run build
npm run build --prefix client
```

Run the smallest relevant test command while developing, then run the broader build checks before opening a PR.

## Working With Codex Or Claude

Good agent prompt template:

```text
You are working in ezvibes/nido-api.

Implement issue #<number>: <issue title>.

Constraints:
- Keep the PR focused only on this issue.
- Do not refactor unrelated modules.
- Do not touch ignored docs or environment files.
- Preserve current API behavior unless the issue explicitly changes it.
- Add or update focused tests.
- Run the validation commands from the issue.

Before coding:
- Inspect the relevant controller, service, entity, DTO, and tests.
- Identify any existing local changes and avoid overwriting them.

After coding:
- Summarize changed files.
- Report validation results.
- Draft a PR description with Summary, Testing, Risk, and Follow-ups.
```

## Pull Request Expectations

PR titles should describe the change clearly:

```text
feat(concerts): add city and region filters
fix(venues): apply region slug filtering
docs: improve contributor onboarding
```

PR body template:

```markdown
## Summary
- What changed
- Why it was needed

## Testing
- [ ] `npm test -- --runInBand <area>`
- [ ] `npm run build`
- [ ] `npm run build --prefix client` if client code changed

## Risk
- Expected risk level
- Any behavior changes or migration impact

## Follow-ups
- Anything intentionally left for another issue

Fixes #<issue-number>
```

## Review And Merge

- Evan Bonertz is the project owner and final reviewer.
- External contributors should not self-merge.
- Admin, deployment, and secret-related changes require owner review.
- `.github/CODEOWNERS` marks `@ezvibes` as the default code owner.
- GitHub branch protection should require code-owner approval before merges to `main`.
- PRs should stay small enough to review quickly.
- If a PR uncovers a larger architecture decision, pause and discuss it in the issue before expanding scope.

## Security Rules

Never commit:

- `.env` files
- Firebase private keys
- Google service account JSON
- Database passwords
- API keys
- OAuth access tokens
- Local logs containing secrets

If you accidentally expose a secret, notify the project owner immediately so it can be rotated.
