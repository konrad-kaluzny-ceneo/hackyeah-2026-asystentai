---
name: next-slice-selector
description: >
  Selects the best next roadmap slice by ranking candidates, proposing top 3
  (including at most one parallel bundle), asking the user to choose, then
  marking the chosen slice as active in context/foundation/roadmap.md.
  Several slices may stay active when each is a separate solution lane.
  Use when deciding what to implement next, prioritizing slices, or preparing
  to start a new slice from roadmap.md. Trigger: "what's next", "next slice",
  "co dalej", "następny slice", "co implementować".
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Next slice selector

Pick the next item from `context/foundation/roadmap.md`, wait for an explicit choice, mark it `active`, then initialize its change folder.

## Hard rules

1. **Do not activate before the user confirms.**
2. **Do not mark `active` when a Prerequisite is not `done`,** unless the user explicitly overrides that item.
3. **Other `active` slices stay active.** Each one is a lane with one owner. Do not ask the user to keep only one.
4. **Same slice, different owner: stop.** If this slice is already `active` and `context/changes/<change-id>/lane.md` names a different owner, do not edit the roadmap. Report the slice, the owner in `lane.md`, and stop.
5. **At most one parallel bundle** in the top 3.

## How to ask

Use the host's structured question tool. One choice by default. If the user names more than one slice anyway, activate each of them.

## 1. Read

Read `context/foundation/roadmap.md` fully.

Candidates are `F-*`, `S-*`, and `R-*` items whose status is `ready` or `proposed`. Exclude `done`, `active`, `blocked`, and `parked`.

Per item, keep: roadmap ID, Change ID, status, Prerequisites, Parallel with, Outcome, Risk, Unknowns.

Optional user context, when they already gave it: capacity, quick win vs the north-star path, willingness to run slices in parallel. Do not interview for it.

## 2. Score

Add the points that apply:

- `+4` every Prerequisite is `done` (or the item has none)
- `+2` status is `ready`
- `+2` the item is the slice named under `## North star`, or that slice lists this ID in Prerequisites, or another item's **Blockers** names a blocker this item's Outcome removes
- `+1` Unknowns are `—`, or every Unknown has `Block: no`
- `+1` at least 2 later items list this ID in Prerequisites
- `-2` a Prerequisite ID exists and is not `done`
- `-1` any Unknown has `Block: yes`

Ties, in order: more later items list this ID in Prerequisites, then the earlier row in `## At a glance`. If the user already named a roadmap ID, that ID wins. If they asked for speed or a quick win, prefer the fewest Prerequisite IDs. If they asked for hardening, prefer the candidate that `## North star` lists in Prerequisites, otherwise the `## North star` slice.

## 3. Top 3

Rank the top 3. Each option is one item, except at most one bundle of two items when both have their Prerequisites `done` and each lists the other under Parallel with.

Every option states: roadmap ID and Change ID, why now (dependency and what it unlocks), and the main risk.

Print:

```markdown
## Next slice recommendation

1. `S-xx` (`change-id`) — <why now>
2. `S-yy` (`change-id`) — <why now>
3. `S-aa + S-bb` (parallel option) — <why now>

Recommended: `<best-option>`

Choose what to activate:

- Option 1
- Option 2
- Option 3
```

Use the real IDs. Drop the bundle row when no pair qualifies, and say there is no safe parallel pair.

## 4. Activate

After the choice, for each chosen item:

1. In `context/foundation/roadmap.md`, set `- **Status:** active` on the item and the matching `## At a glance` row.
2. Set frontmatter `updated` to today.
3. Invoke `/new <change-id>` (skill `1b_next-slice-init`) so `context/changes/<change-id>/` exists.

Then print:

```markdown
Activated: `S-xx` (`change-id`)

- Roadmap: `active`
- Change folder: `context/changes/<change-id>/`

Next: `/plan <change-id>`
```

One block per activated item. Stop. Do not run `/plan`.
