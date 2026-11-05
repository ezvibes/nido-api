---
name: RDU Builder Task
about: Dispatch an autonomous full-stack feature, bug fix, or refactor to RDU (Dedicated Engineering & QA Agent)
title: 'feat(rdu): '
labels: ['agents', 'agent:rdu']
assignees: ''
---

## 🎯 Desired Outcome
<!-- Describe the specific capability, refactor, or bug fix you want RDU to build. -->

## 📋 Acceptance Criteria
- [ ] Bounded changes to affected modules (NestJS / TypeORM / Vue 3)
- [ ] Unit & integration tests added/updated (`npm run test:changed`)
- [ ] Self-healing hygiene passed (`node scripts/check-hygiene.mjs`)
- [ ] Universal gate passed (`npm run agent:gate`)

## 🛠️ Implementation Guidance & Constraints
<!-- Specific files to inspect, APIs to adhere to, or non-goals. -->
