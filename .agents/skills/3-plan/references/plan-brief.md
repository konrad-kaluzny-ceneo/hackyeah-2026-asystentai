# plan-brief.md template

Read this at Step 4.5. Write `context/changes/<change-id>/plan-brief.md`. About 60–80 lines. Someone who missed the planning conversation should understand the shape from this file alone.

```markdown
# <Feature name> — Plan Brief

> Full plan: `context/changes/<change-id>/plan.md`
> Frame brief: `context/changes/<change-id>/frame.md`
> Research: `context/changes/<change-id>/research.md`

## What & Why

<2–3 sentences. If a frame exists, lift the Reframed or Confirmed Problem Statement verbatim.>

## Starting Point

<1–2 sentences on what exists today. If a frame investigated this, summarize its Hypothesis Investigation.>

## Desired End State

<2–3 sentences: the user-visible outcome, not a metric.>

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| <area> | <choice> | <rationale> | Frame / Research / Plan |

Omit the Source column when every row would be Plan.

## Scope

**In scope:** <bullets>

**Out of scope:** <bullets>

## Architecture / Approach

<one short paragraph: components and data flow, or workflow and dependencies>

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. <name> | <one line> | <risk> |

**Prerequisites:** <what must be true before starting>
**Estimated effort:** <rough size, for example "~2-3 sessions across 3 phases">

## Open Risks & Assumptions

- <risk that could change the plan>

## Success Criteria (Summary)

- <how a user knows it worked>
```

Omit the Frame line or the Research line when that file does not exist.
