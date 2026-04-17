# Project Agents

This directory stores reusable agent briefs for `nido-api`. Use these prompts when spawning or delegating focused work so product, frontend, and implementation agents stay aligned.

## Available Agents

- `frontend-design-wizard`: Vue 3 frontend and UX specialist for small, practical UI improvements inspired by Eventbrite and Square, with a North Carolina music community lens.

## Usage

When product work needs frontend execution or design polish, give the worker the relevant brief before the task:

```text
Use .agents/frontend-design-wizard.md as your operating brief. Implement the UI changes requested by the product agent and keep the patch small, modern, and Vue 3-native.
```
