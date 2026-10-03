---
name: roadmap
description: >
  Generate context/foundation/roadmap.md from a PRD as an ordered set of
  vertical, end-to-end slices. Use AFTER /prd (and after the tech-stack
  selection / bootstrap step, when applicable) to turn a holistic PRD into a
  sequence of user-visible milestones a programmer can pick off and hand to
  /plan. Trigger phrases: "write the roadmap", "generate roadmap",
  "create the roadmap from PRD", "stwórz roadmapę", "turn PRD into a
  roadmap", "what should I build first". Do NOT use for per-change planning
  — that's /plan's job.
---

# Roadmap

Decomposition and sequencing. Output is `context/foundation/roadmap.md`. Do not invoke `/plan` when this skill finishes. Do not pre-create change folders.

Chain position: `/shape → /prd → tech-stack-selector → bootstrapper → /roadmap → /plan`. One slice can later spawn more than one change. `/archive` is the only writer of `## Done` and of `Status: done`.

## Hard rules

1. **Every slice traces to a PRD `US-NN` or `FR-NNN`.** The interview and the baseline do not grow the PRD. A new idea becomes an Open Roadmap Question or a Parked line.
2. **Vertical slices.** Each slice is one user-visible "user can …" capability through every layer it needs. Foundations are the only cross-cutting items, and only as the smallest enabler with `Unlocks`.
3. **No estimates and no implementation.** No days, weeks, t-shirt sizes, or points. No frameworks, file paths, schemas, libraries, or code. Those belong to `/plan`. `tech-stack.md` may inform Foundations; it is not copied in as a design.
4. **Surface blockers.** An Unknown with `Block: yes` sets `Status: blocked`. A hollow PRD becomes blocked slices, not invented scope.
5. **Baseline comes from the repo.** Probe, then ask the user to confirm. Do not ask what is already built.
6. **Interview cap.** At most three anchors: `main_goal`, `north_star`, `top_blocker`. Investment areas are derived. Custom-MVP exception: those three plus at most two follow-ups.
7. **Self-review aborts.** Do not patch a failed roadmap and write it anyway.
8. **Collisions archive first.** Default is move-then-replace.
9. **No cohort or certification language** in chat or in the file.
10. **Never chain.** Step 10 recommends one `/plan <change-id>`. The user runs it.

## How to ask

Use the host's structured question tool. If none exists, ask in chat with the same labelled options. Recommended option first, label ending in `(Recommended)`. One question per call unless a step sets `multiSelect: true`.

## How to probe

Before Step 4, if the host can spawn isolated research agents, fan the layer probes out in one batch. Otherwise run them in this context. Each probe returns the same shape: `present`, `absent`, or `partial`, at most 100 words, file evidence when present, no speculation, no edits.

## Neighbors

- `/shape`, `/prd` — upstream. Lift `## Forward: technical-roadmap` from `shape-notes.md` when it exists.
- `tech-stack-selector` — if `context/foundation/tech-stack.md` exists, it seeds Foundations and skips probes for layers it already names.
- `/plan` — the user picks one Change ID. This skill does not plan the change.
- `/archive` — flips the matching item to `done` and appends `## Done`.
- `/frame`, `/research` — one change, not the roadmap.

## Entry

1. A path argument (`/roadmap @path/to/prd.md`) → that path, strip a leading `@`. Step 1.
2. No argument → `context/foundation/prd.md`. Step 1. Do not prompt yet.

## Step 1: Read the PRD

If the file exists, read it fully. Step 2.

If it does not, ask "No PRD found at `<path>`. How would you like to proceed?"

- "Run /prd first (Recommended)" — stop. Print "Stopping. Run `/prd` to produce prd.md, then re-invoke `/roadmap`."
- "Provide a different path" — wait for the path, then repeat Step 1 with it.
- "Cancel" — stop, no writes.

## Step 2: Supplementary inputs

Read what exists. Note what is missing and continue.

- `context/foundation/shape-notes.md` — lift `## Forward: technical-roadmap` bullets as priors. Do not re-ask them.
- `context/foundation/tech-stack.md` — Foundations input. A layer it names is "per tech-stack.md: <choice>", not re-probed.
- `context/foundation/roadmap.md` — hold for Step 9. Do not edit it yet.
- `context/foundation/lessons.md` — ordering or readiness rules are priors, not orders.

## Step 3: PRD readiness

Score 0–4. One point per signal:

1. `## Vision & Problem Statement` has at least two sentences and no `# TODO`.
2. A `### US-NN:` heading has Given/When/Then under it, not `# TODO`.
3. A line matches `^- FR-\d{3}: .* (P|p)riority: must-have$`.
4. `## Business Logic` opens with a declarative sentence, not `# TODO: domain rule`.

Print the "PRD readiness check" block in [references/emit-templates.md](references/emit-templates.md).

Score ≥ 3 → Step 4.

Score < 3 → name each missing signal and the roadmap consequence. Then print the "Hollow PRD" block in [references/emit-templates.md](references/emit-templates.md).

Ask "How would you like to proceed?"

- "Firm up PRD first (Recommended)" — print the redirect and stop.
- "Proceed anyway" — continue. Step 6 marks hollow areas as blocked slices whose Unknown is the PRD gap.
- "Cancel" — stop, no writes.

## Step 4: Baseline

Probe these layers. Skip a layer `tech-stack.md` already names.

| Layer | Look for |
|---|---|
| Frontend | UI framework, routing, components — `package.json`, framework config |
| Backend / API | Server entrypoints, routes, handlers |
| Data | DB driver, ORM, schema, migrations, seed data |
| Auth | Provider, session or token paths, route middleware |
| Deploy / infra | `Dockerfile`, CI workflows, deploy config |
| Observability | Logging, error tracking, metrics |

Prompt shape, one layer at a time: "Inventory the <layer> of this codebase. Under 100 words: present, absent, or partial; name what exists; cite file:line when present. If absent, say absent. Do not speculate. Do not edit files."

Then print the "Codebase baseline" block in [references/emit-templates.md](references/emit-templates.md).

Ask, `multiSelect: true`: "Does this baseline match your understanding? Anything to correct or add before it informs Foundations?"

- "Looks right — proceed (Recommended)" — use it for Foundations and `## Baseline`.
- "Correct one or more layers — I'll explain" — wait, re-record those layers, then continue.
- "Add something not listed" — wait, record it (planned-but-unwired, another repo), then continue.

## Step 5: Framing interview

Arrive with a recommendation. Ask only what the artifacts do not already lock. At most three questions, in order: `main_goal`, `north_star`, `top_blocker`. The user picks the recommendation, an alternative, or their own words.

Skip an anchor only when the PRD literally states that value. Announce the skip with the quote. If any other reading is plausible, ask. If an anchor is still open after the cap, record the recommendation, name the reason, and continue. The user may override later in the file or in chat.

**5a. Ground each anchor.** Quote the PRD (frontmatter, Vision, Success Criteria, NFRs, Open Questions), the baseline, or `tech-stack.md`. An alternative must have a real signal or be a normal default for this product shape. No strawmen. If only one value is plausible, offer that recommendation plus "Something else — I'll explain", and say the artifacts support one reading.

| Anchor | Values | Signals |
|---|---|---|
| `main_goal` | `market-feedback`, `quality`, `low-complexity`, `speed`, `learn`, `other` | Tight `timeline_budget` → speed or low-complexity. Small scale → low-complexity. "Learn from real users" or "riskiest assumption" → market-feedback. "No incidents" → quality. Hobby tone → learn. Hard deadline → speed. Offer only adjacent values the same evidence supports. |
| `north_star` | A slice candidate, not an abstract label | Smallest end-to-end flow that proves the Vision. Trace it to a high-priority `US-NN` and the primary Success Criterion. Alternatives are other candidates on that criterion, with different prerequisites. At most three candidates. Label: `<US-NN> — <one-line outcome>`. |
| `top_blocker` | `skills`, `capacity`, `time`, `decisions`, `external`, `motivation`, `none` | ≥ 3 Open Questions → decisions. Scope vs `timeline_budget` → time or capacity. Named uncontracted vendor → external. A stack layer the team has not shipped → skills. Nothing fired → none. |

**5b. One question per remaining anchor.** Plain language, in the user's language. Polish PRD → Polish question, options, and recap. In Polish labels say "gwiazda przewodnia", "główne ryzyko", "konieczne" — not "north star", "blocker", "must-have". Translate section names the same way (`Open Questions` → `Otwarte pytania`). A quote in an option must say why it matters for this anchor.

- "<Recommend> (Recommended)" — one line plus the artifact pointer.
- Up to two alternatives — each line says when it is reasonable and what sequencing changes.
- "Something else — I'll explain" — always last.

**5c. Derive investment. Do not ask.** For `frontend`, `backend`, `data`, `infra`: `invest deeply` or `go simple`. Invest only when you can name the signal: an NFR that gates launch in that layer, a baseline gap tied to a must-have FR, Open Questions piled in that layer, or the chosen `main_goal` (`quality` → privacy and observability, `learn` → the unfamiliar layer, `speed` or `low-complexity` → simple by default). Say the result in the recap. The user may override one line.

**5d. Recap, then wait for "go".** No new question. Mirror the user's language. Print the "Framing recap" block in [references/emit-templates.md](references/emit-templates.md).

"Go", or silence until the next step starts, locks the framing. A one-line override updates that line only.

**5e. Custom MVP.** Use this when the product is not a familiar SaaS dashboard, CRUD app, content site, AI wrapper, or marketing site: novel interaction, stories that are not create/read/update/delete of one thing, or unusual tooling (game engine, hardware, a new agent shape).

Before the first question, say the recommendations are weaker and the user should push back. Phrase `north_star` and investment as "best read, thin signal", not as a quote that is not there. Allow up to two free-text follow-ups after the three anchors. Ceiling: five exchanges.

## Step 6: Decompose in memory

Do not write the file yet.

**6a. Foundations (`F-01`…).** A foundation has no user-visible outcome. It unblocks a named slice, reduces a named unknown, or creates the verification a named slice needs. Sources: scaffolding implied by `tech-stack.md`, an NFR that needs a measurement path, Access Control beyond single-user, baseline `absent` or `partial`, and a Step 5 "invest deeply" layer. Skip baseline `present` layers.

Smallest enabler only. Do not finish a data, API, UI, or auth layer ahead of the slice that uses it. "We will need this eventually" is not a foundation. After it lands, at least one `S-NN` must still exercise that layer through a real user capability. No Unlocks → delete it or fold the minimum into the first slice that needs it.

**6b. Slices (`S-01`…).** Group User Stories and FRs into vertical slices:

- One "user can …" capability.
- Every layer that capability needs.
- One `US-NN` per slice. A second `US-NN` only when both are create and list of the same entity.
- One Change ID in kebab-case (`first-gated-generation`). Stable enough for `/plan` and a backlog issue.

Split when a candidate has more than one primary user action, mixes setup with the core workflow and admin, holds more than half of the must-have FRs while a sibling holds one, has more than one risk and those risks name different owners, or has unknowns owned by different people. Split into narrower vertical outcomes. Never into schema / API / UI.

**6c. Dependencies.** Prerequisites: foundation IDs, earlier slice IDs, and concrete external state ("a seeded ingredient table"). Each foundation's Unlocks names the `S-NN`, the unknown, or the verification path. Parallel with: items whose prerequisites do not lead to this item and that this item does not block. If `top_blocker` is `capacity`, mark every real sibling.

**6d. Order.** Foundations first, in their own dependency order, then slices. Put the north star as early as its Prerequisites allow. Break ties by `main_goal`:

- `market-feedback` — earlier slice surfaces the riskiest assumption.
- `quality` — observability and access-control foundations stay ahead of user-facing slices.
- `low-complexity` — smallest viable slice; park aggressively.
- `speed` — must-have path only; non-essentials are Parked, not "later".
- `learn` — exercise the unfamiliar layer early.

If an Open Roadmap Question would be answered by picking a sequence, leave the affected items `blocked` instead of choosing.

**6e. Unknowns.** Blockers: external pending, or `—`. `external` from Step 5 feeds these. Unknowns: question, owner, `Block: yes|no`. `decisions` from Step 5 feeds these. `Block: yes` → `Status: blocked`.

**6f. Open Roadmap Questions.** Copy PRD Open Questions. Add cross-slice questions from Step 5. Per-slice unknowns stay on the slice.

**6g. Parked.** PRD Non-Goals, plus anything deferred in Step 5. Grows when `main_goal` is `speed` or `top_blocker` is `time` or `capacity`. One line plus one-line why.

**6h. Streams.** A reading aid over the graph, not a second order and not new IDs. Omit the section when there are fewer than two streams. Cap at five; fold a one-item stream into the neighbor when prerequisites overlap.

1. One stream per foundation: `F-NN` then the slices that list it, in dependency order.
2. A slice with no foundation prerequisite is its own stream. No "Misc" bucket.
3. A slice that touches several streams joins the stream whose head is a Prerequisite of the other heads. If no head is a Prerequisite of the others, join the stream that Step 6d lists first. Say "joins Stream A at S-01". Do not duplicate the slice.
4. Table columns: `Stream | Theme | Chain | Note`. Chain uses `→` and `/` or "parallel with". Note is one clause.
5. Themes name the chain ("Review loop"), not a slogan ("the killer feature").
6. If a stream disagrees with the topological order, the stream is wrong.

## Step 7: Emit

Read [references/roadmap-template.md](references/roadmap-template.md) and fill it. Field rules in that file are binding. Section order: Vision recap, North star, At a glance, Streams (only if Step 6h kept them), Baseline, Foundations, Slices, Backlog Handoff, Open Roadmap Questions, Parked, Done. `## Done` stays empty.

## Step 8: Self-review

Check the in-memory roadmap. Any failure → print the "Self-review abort" block in [references/emit-templates.md](references/emit-templates.md) and stop. Do not write.

1. Frontmatter has `project`, `version`, `status`, `created`, `updated`, `prd_version`, `main_goal`, `top_blocker`.
2. The `##` headings match Step 7's order. Count is 11 with Streams, 10 without.
3. Every `S-NN` has Outcome, Change ID, PRD refs, Prerequisites, Parallel with, Blockers, Unknowns, Risk, Status. Every `F-NN` also has Unlocks.
4. Every must-have FR and every `### US-NN:` appears in some slice's PRD refs.
5. No dependency cycles. Every Prerequisite ID exists. No item depends on one that appears later.
6. The glance table matches each body's Change ID, Prerequisites, PRD refs, and Status.
7. `blocked` has an Unknown with `Block: yes`. `ready` has no blocking Unknown, and every Prerequisite is already in `done` — today that means no Prerequisites, or only foundations whose layer the baseline reports `present`. A Prerequisite on another `proposed` or `ready` item is not enough.
8. Every slice's PRD refs include a real `FR-\d{3}` or `US-\d{2}`.
9. No Foundation re-scaffolds a layer Baseline marks `present`.
10. Every Foundation's Unlocks names an `S-NN`, a blocking unknown, or a verification path.
11. Change IDs are unique kebab-case. Each `F-NN` and `S-NN` appears once in Backlog Handoff with that same Change ID. No spaces, dates, statuses, or roadmap IDs as Change IDs.
12. No slice holds more than half of the must-have FRs while a sibling holds one, includes more than two `US-NN` outside the create-and-list pair of the same entity, has more than one primary user action, or has more than one risk with a different owner. Split vertically. Exception: the PRD describes a single workflow.
13. No Foundation completes a whole data, API, UI, or auth layer. Outcome and Unlocks show a minimal enabler the next slice still exercises.
14. A technical element appears in the first slice that needs it, or in a Foundation required before that slice can be planned, verified, or made safe. "Useful later" fails.
15. If Streams exist: every glance ID is in exactly one Chain, Chains cite real IDs, and there are 2–5 streams.
16. Strategy terms listed in the template's field rules are defined in one sentence on first use.

## Step 9: Write

If `context/foundation/roadmap.md` is absent, write it and go to Step 10.

If it exists, this skill replaces the whole file. Ask "context/foundation/roadmap.md already exists. How would you like to proceed?"

- "Archive and replace (Recommended)" — create `context/foundation/archive/` if needed. Move the file to `context/foundation/archive/<YYYY-MM-DD>-roadmap.md`. If that path exists, use `-2`, `-3`, and so on. Then write the new file.
- "Overwrite without archiving" — replace in place.
- "Cancel" — stop, no writes.

## Step 10: Hand off

Print the "Handoff banner" block in [references/emit-templates.md](references/emit-templates.md).

Recommend one next item. Do not offer a menu. First match:

1. North star is `ready` → that slice.
2. Else a `ready` Foundation the north star depends on → that Foundation, and say it unlocks `<S-NN>`.
3. Else nothing is `ready` → the Open Question or Blocker that unblocks the most items. Print the "No planning move" block in [references/emit-templates.md](references/emit-templates.md).
4. Else the `ready` item with the largest downstream fan-out. Tie-break with Step 6d.

For matches 1, 2, and 4, print the "Next move" block in [references/emit-templates.md](references/emit-templates.md).

Stop. The user chooses when to plan.
