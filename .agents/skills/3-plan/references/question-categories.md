# Question categories

Read this when asking the planning questions. Ask the count from the complexity table in SKILL.md, scaled by upstream artifacts. Rounds of 1–4 questions. Wait for answers.

Each question has 2–4 options. `multiSelect: true` only when options can combine. Header ≤ 12 characters. Exactly one label starts with `⭐ Recommended`. Every description is:

`[what this does]. · Strength: [advantage]. · Tradeoff: [cost or risk].`

Ground the recommendation in the codebase or the upstream docs. The user decides.

Tag: `[D]` is about the problem, `[S]` is about the solution. A frame brief skips every `[D]`. Always ask the `[S]` items the input has not already settled.

Do not ask what a frame, research doc, or the code already answers. Do not ask for low-level implementation you can see in the repo. Do not ask a preference that does not change the plan.

## Universal

- Scope boundaries `[D]`
- Edge cases and failure modes `[S]` — how the implementation handles the case, even if a frame named the observation
- Success criteria `[D]` — from the user's point of view
- Priority `[D]` — what is cut if time is short

## Software

MEDIUM and above: data model `[S]`, error handling `[S]`, testing approach `[S]`, performance boundaries `[S]`.

HIGH adds: architecture `[S]`, state management `[S]`, security model `[S]`, migration and rollback `[S]`, observability `[S]`.

## Content / education

MEDIUM and above: audience and prerequisites `[D]`, format and medium `[S]`, narrative arc `[S]`, examples and exercises `[S]`.

HIGH adds: curriculum dependencies `[D]`, assessment `[S]`, reuse `[S]`, distribution and access `[D]`.

## Strategy / process

MEDIUM and above: stakeholders and roles `[D]`, timeline and milestones `[S]`, risks `[S]`, resource constraints `[D]`.

HIGH adds: change management `[S]`, measurement `[D]`, dependencies and sequencing `[S]`, communication plan `[S]`.

A hybrid task uses the universal list plus the extra lists that match.

## Option shape

Ask the user: "How should the system handle conflicts when two users edit simultaneously?"

- header: "Conflicts"
- Recommended: "Notify and merge" — show the conflict and let them choose. Strength: no silent data loss, and it matches an existing edit panel if one exists. Tradeoff: a resolution step and a way to detect the clash.
- Alternative: "Last write wins" — later save overwrites. Strength: no new UI. Tradeoff: lost work with no warning.
- Alternative: "Lock-based" — first editor locks the resource. Strength: conflicts cannot happen. Tradeoff: stale locks and blocked coworkers.

Questions ask what should happen, not which function to write.
