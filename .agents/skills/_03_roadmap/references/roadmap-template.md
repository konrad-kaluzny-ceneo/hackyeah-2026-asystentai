# Roadmap document contract

Read this at Step 7. Section names and field labels are the contract. Fill every placeholder from the PRD, the confirmed baseline, and the locked framing. Do not add estimates, file paths, schemas, libraries, or framework names.

## Template

````markdown
---
project: <from PRD frontmatter>
version: 1
status: draft                    # draft | active | locked
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
prd_version: <int from PRD frontmatter>
main_goal: <market-feedback | quality | low-complexity | speed | learn | other>
top_blocker: <skills | capacity | time | decisions | external | motivation | none>
---

# Roadmap: <Project>

> Derived from `context/foundation/prd.md` (v<N>) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

<2–3 sentences from the PRD Vision. Orient the reader; do not restate the PRD. Define any strategy term on its first use in this file, in one plain sentence.>

## North star

**<Slice ID>: <Outcome>** — <why this slice is the validation milestone, tied to main_goal>.

> On the first use of "north star" in the body, add one sentence: the smallest end-to-end slice that would prove the core product hypothesis, placed as early as its Prerequisites allow. Do not repeat that gloss.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | <kebab-case-change-id> | (foundation) <foundation outcome> | — | NFR-XX | proposed |
| F-02 | <kebab-case-change-id> | (foundation) <foundation outcome> | F-01 | NFR-YY | proposed |
| S-01 | <kebab-case-change-id> | <user-can outcome> | F-01 | US-01, FR-001 | ready |
| S-02 | <kebab-case-change-id> | <user-can outcome> | S-01 | US-02, FR-003 | proposed |
| S-03 | <kebab-case-change-id> | <user-can outcome> | S-01, F-02 | US-03, FR-005 | blocked |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | <Theme> | `F-01` → `S-01` → `S-02` | <One line tying the stream to main_goal.> |
| B | <Theme> | `F-02` → `S-03` | <Joins Stream A at `S-NN`, or standalone.> |
| C | <Theme> | `S-NN` | <Standalone slice with no foundation prerequisite.> |

Omit this whole section when streams would not add a second chain. See the skill Step 6 for the 2–5 cap.

## Baseline

What's already in place in the codebase as of `<YYYY-MM-DD>` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** <present | absent | partial> — <one line, file pointer if present>
- **Backend / API:** <…>
- **Data:** <…>
- **Auth:** <…>
- **Deploy / infra:** <…>
- **Observability:** <…>

## Foundations

### F-01: <Foundation title>

- **Outcome:** (foundation) <one sentence — what is now in place; not user-visible>.
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <NFR-NN, Access Control, or the FR/US the enabler serves>
- **Unlocks:** <downstream S-NN IDs, blocking unknowns, or named verification paths>
- **Prerequisites:** <IDs and external state, or `—`>
- **Parallel with:** <IDs, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:** <questions, or `—`>
- **Risk:** <why sequenced here, and what goes wrong if it is not>
- **Status:** proposed | ready | blocked

## Slices

### S-01: <Slice title>

- **Outcome:** <user can …>
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <every must-have FR this slice satisfies and every US-NN it advances>
- **Prerequisites:** <slice/foundation IDs and external state>
- **Parallel with:** <IDs, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:**
  - <question> — Owner: <user|team|TBD>. Block: <yes|no>.
  - (or `—` if none)
- **Risk:** <one line>
- **Status:** proposed | ready | blocked

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/plan` | Notes |
|---|---|---|---|---|
| F-01 | <kebab-case-change-id> | <issue title> | no | <why, or `—`> |
| S-01 | <kebab-case-change-id> | <issue title> | yes | Run `/plan <change-id>` |

One row per `F-NN` and `S-NN`. Do not copy the body into this table.

## Open Roadmap Questions

1. **<Question>** — Owner: <who>. Block: <slice IDs, or `roadmap-wide`>.

## Parked

- **<Item>** — Why parked: <PRD Non-Goals reference, or the deferral from the interview>.

## Done

Empty on first generation. `/archive` is the only writer. Format when it appends:

- **<Slice ID>: <Outcome>** — Archived <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lesson: <pointer, or `—`>.
````

## Field rules

- **Outcome** is a state of the world. Slice: "user can sign in and see an empty fridge". Foundation: "(foundation) auth scaffold can issue a session". Never a noun phrase ("authentication system").
- **Change ID** is unique kebab-case for `context/changes/<change-id>/` and a future Jira/Linear issue. Never use `F-01` or `S-01` as the Change ID.
- **Unlocks** is Foundations only. Name the downstream `S-NN`, the blocking unknown, or the verification path. No Unlocks means the foundation does not belong.
- **PRD refs** are literal IDs (`FR-001`, `US-01`, `NFR-02`). Every must-have FR and every `US-NN` appears in at least one slice.
- **Prerequisites** mixes IDs and external state in one comma-separated field ("F-01, seeded ingredient table").
- **Parallel with** lists items with no dependency path to this one. When `top_blocker` is `capacity`, prefer marking real siblings.
- **Blockers** are external only (vendor, design, stakeholder). If the team can answer it, it is an Unknown.
- **Unknowns** carry Owner and `Block: yes|no`. `Block: yes` forces `Status: blocked`.
- **Risk** is one line: why this order, not a postmortem.
- **Status** this skill may emit: `proposed` (default), `ready` (no blocking unknown, and every Prerequisite is absent or is a foundation whose layer the baseline reports `present`), `blocked`. `planning` and `in-progress` are reserved. `/archive` sets `done`.
- **main_goal / top_blocker** in frontmatter are the locked Step 5 answers.
- Do not invent a slice. A wish that is not a PRD US or FR becomes an Open Roadmap Question or a Parked line.
- No "Day 1", weeks, t-shirt sizes, or points.
- First use in the body of `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, or `core hypothesis` gets a one-sentence plain definition. Later uses do not repeat it. If it will not fit in one sentence, use plain language instead. IDs and product names are exempt.
