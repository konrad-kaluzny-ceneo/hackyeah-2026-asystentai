---
name: roadmap-add
description: >
  Add one user-specified slice to an existing roadmap and its PRD. Isolates
  the edit in a git worktree, checks Linear and the local docs for a
  duplicate before allocating an ID, then appends the user story, the
  functional requirement, the glance row, and the detail block. Use when
  the user says /roadmap-add, "dodaj do roadmapy i utwórz slice", "add a
  slice to the roadmap and PRD", "nowy slice w roadmapie", or "add roadmap
  item". Not for brainstorming (/roadmap-expand) or regenerating the
  roadmap (/roadmap).
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo, nazwy pól schematu. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Roadmap add

The user brings one concrete thing to build and a goal. Append that one slice to `context/foundation/roadmap.md` and the PRD entries it traces to. Do not ideate. Do not regenerate either file. Do not open a change folder. Do not run `/plan`.

`/roadmap` regenerates. `/roadmap-expand` brainstorms and does not patch the PRD. `/new` opens a change folder. This skill stops after the roadmap and PRD land.

## Hard rules

1. **Dedup before an ID.** No roadmap id, branch, or issue until the duplicate check says the slice is new.
2. **Writes happen in a fresh worktree** on `features/<change-id>` off the base branch. Never on the checkout that holds an in-progress slice. Never commit to the base branch.
3. **Every slice cites a real PRD ref.** Add the user story and the requirement first. Do not invent a ref. Do not leave `PRD refs: —`.
4. **Append one item.** Do not rewrite the roadmap or the PRD.
5. **Match the schema already in the file.** Roadmap fields follow [../_03_roadmap/references/roadmap-template.md](../_03_roadmap/references/roadmap-template.md). PRD entries follow [../_01_shape/references/prd-schema.md](../_01_shape/references/prd-schema.md). No vendor, schema, runtime, transport, or UI affordance in the PRD.
6. **One issue truth.** Create Linear and GitHub only when both are configured. Verify the mirror. Do not leave two divergent ids.

## How to ask

Use the host's structured question tool. The first time you use Linear or `gh`, name the tool.

## Phase 0: Config

Read `context/foundation/roadmap.md` and `context/foundation/prd.md` fully. Either missing → stop and point at `/prd` or `/roadmap`. Do not create them.

Resolve each key from roadmap frontmatter, then `AGENTS.md`, then an `update-status` skill if the repo has one. A key that is still missing is asked once. Do not assume a Linear team, a GitHub repo, or a product name.

| Key | Where it comes from |
| --- | --- |
| Project name | roadmap `project:` |
| Repo root | `git rev-parse --show-toplevel` |
| Worktree directory | `../<Project>-<change-id>` unless `AGENTS.md` says otherwise |
| Base branch | `AGENTS.md`, else `main` |
| Feature branch | `features/<change-id>` unless `AGENTS.md` says otherwise |
| Linear team / project | `update-status` or the ask |
| GitHub repo | `update-status` or the ask |
| Roadmap structure | frontmatter `structure: split`, or an existing `roadmap-references/items/` directory. Otherwise flat |

## Phase 1: Intake

Parse the first token like `/new`: strip `@` and a trailing `/`; if it contains `/`, take the last segment.

- **change-id** — must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. If the token does not, propose a kebab-case id and confirm.
- **Outcome** — one "user can …" sentence from the description. A foundation outcome says what is now in place, prefixed `(foundation) `.
- **Acceptance** — one bullet per behavior the description states. Do not add a behavior that is not in the description.
- **Goal** — the `Cel:` or `Goal:` clause, verbatim. It is the user story's value. No clause → ask for one before anything else.
- **Type** — `S-NN` when Outcome is a user-visible "user can …" capability. `F-NN` only when Outcome is not user-visible and is prefixed `(foundation) `.

Input shape:

> `archive-old-tasks` dodaj do roadmapy i utwórz slice: zadania starsze niż 3 dni powinny trafiać do archiwum. Archiwum powinno być osobnym widokiem, w którym user może sprawdzić stare taski i ewentualnie usunąć je całkowicie z listy (musi być opcja multi-select + delete selected). Cel: zwiększenie przejrzystości aplikacji przez zmniejszenie liczby wyświetlanych tasków.

That parses to change-id `archive-old-tasks`, type `S-NN`, outcome `user can open a separate archive of tasks older than 3 days, review them, and delete the ones they select`, acceptance bullets only for that archive view and that multi-select delete, and the goal verbatim: `zwiększenie przejrzystości aplikacji przez zmniejszenie liczby wyświetlanych tasków`.

## Phase 2: Duplicate check

Read [reference.md](reference.md) § Linear dedup. Search Linear (when a team was resolved), the roadmap, and the PRD.

No match → Phase 3. A match → stop, report it, and ask: extend the existing item, pick a new scope, or cancel. Do not create a parallel slice.

## Phase 3: Worktree

Follow [reference.md](reference.md) § Worktree. Reuse an existing worktree or branch for this change-id.

## Phase 4: Allocate

Follow [reference.md](reference.md) § ID allocation. Prerequisites are existing `S-` / `F-` ids this slice consumes.

## Phase 5: PRD

Follow [reference.md](reference.md) § PRD inserts. Record the new `US-NN` and `FR-NNN`. They are the slice's PRD refs. Bump PRD `updated` to today.

## Phase 6: Roadmap and issues

Follow [reference.md](reference.md) § Roadmap inserts, then § Issue pair.

Before creating issues, check the new item only: every field in the sibling shape is present; PRD refs are the ids from Phase 5; every prerequisite exists; the glance row matches the detail block; no cycle; `blocked` only with `Block: yes`. Fix a miss before creating issues.

Leave Linear and GitHub as `—` when the user does not want issues yet, or when Phase 0 did not resolve them. Say that in the handoff.

## Phase 7: Commit and hand off

In the worktree, stage the roadmap, the PRD, and the new item file by explicit path. Commit on the feature branch. Do not skip hooks.

`docs(<change-id>): add <ID> to roadmap and PRD`

On PowerShell pass the subject as one `-m` argument.

Print the roadmap id, change-id, PRD refs, Linear and GitHub ids (or `—`), status, worktree path, and branch. Recommend `/plan <change-id>`, or `/research <change-id>` when the slice still needs a codebase look. Stop. Do not run it.
