## Summary

- What changed
- Why it was needed

## Testing

- [ ] `npm test -- --runInBand <area>`
- [ ] `npm run agent:gate`

## Evidence

| Layer | Result | Evidence |
| --- | --- | --- |
| Focused tests | Pass/Fail/Skipped | Exact command |
| Shared gate | Pass/Fail | `npm run agent:gate` |
| Migration review | Pass/Skipped | Forward/default/rollback assessment |
| Manual or browser path | Pass/Skipped | Tested behavior and viewport |
| Independent review | Pass/Findings/Skipped | Findings and resolution |
| CI | Pass/Fail/Pending | Workflow run |
| Dev deployment | Pass/Fail/Pending | Commit and revision |
| Rollback target | Recorded/Pending | Prior commit or revision |

## Risk

- Expected risk level:
- API behavior changes:
- Migration or environment impact:
- Secret/config impact:

## Screenshots Or API Examples

Add screenshots for UI changes or request/response examples for API changes.

## Review

- [ ] Owner/code-owner review requested
- [ ] Scope stays focused on one issue
- [ ] No secrets, local env files, or credentials included
- [ ] I have read and agree to `CONTRIBUTOR_TERMS.md`
- [ ] Review feedback is marked as required for merge or non-blocking follow-up

## Follow-ups

- Anything intentionally left for another issue

Fixes #
