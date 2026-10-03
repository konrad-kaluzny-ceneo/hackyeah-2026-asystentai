# roadmap-add inserts

Read the section for the phase you are in. Match the shape already in the target file. The fallbacks below apply when that file follows the foundation schemas.

PRD schema: [../_01_shape/references/prd-schema.md](../_01_shape/references/prd-schema.md).
Roadmap fields: [../_03_roadmap/references/roadmap-template.md](../_03_roadmap/references/roadmap-template.md).

## Linear dedup

Search by capability words, not by the new slice ID. It does not exist yet.

- Linear: `list_issues` for the resolved team, project filter when one was resolved. Query keywords from the change-id and the outcome, then the change-id itself. `get_issue` on each near match. No Linear connection or no team → say so and continue with the local scans. Do not invent a team.
- `roadmap.md`: `## At a glance`, `## Parked`, `## Open Roadmap Questions`.
- `roadmap-references/` when it exists: `items/`, `parked.md`, `future-ideas.md`, `open-questions.md`.
- `prd.md`: `## User Stories`, `## Functional Requirements`.
- `context/changes/` and `context/archive/` for the same change-id.

A match → stop. Report the Linear id and the roadmap or PRD location. Ask: extend the existing item, pick a new scope, or cancel.

## Worktree

PowerShell, from anywhere:

```powershell
git -C <repo-root> fetch origin
git -C <repo-root> worktree add -b features/<change-id> ../<Project>-<change-id> origin/main
```

`<Project>` is the roadmap `project:` value, made safe for a directory name. Base branch and the `features/` prefix come from Phase 0.

`git worktree list` first. An existing worktree or branch for this change-id is reused, not recreated.

If the host can move the agent root, move it to the worktree. Otherwise run later commands with `working_directory` set to that path. Writes in Phases 4–6 happen only there.

## ID allocation

1. Highest `S-NN` and `F-NN` in `## At a glance`. Next id is max+1, zero-padded to two digits. A user-visible slice is `S-NN`. A pure cross-cutting enabler is `F-NN`.
2. `<change-id>` must be unique in the glance table, `roadmap-references/items/`, `context/changes/`, and `context/archive/`. On a collision, suffix `-2`.
3. `blocked` when any Unknown has `Block: yes`. Otherwise `ready` only when every prerequisite is `done`, or there is no prerequisite. Otherwise `proposed`. A prerequisite that is merely `proposed` or `ready` is not enough.

## PRD inserts

Copy the last `### US-NN` and the last `- FR-NNN` line in this PRD. Next numbers are max+1. US is two digits. FR is three digits.

Fallback when the PRD matches the schema:

```markdown
### US-NN: <short title>

- **Given** <context>
- **When** <user action>
- **Then** <observable outcome>

Value: <the Cel: / Goal: line, verbatim or lightly edited>
```

```markdown
- FR-NNN: <actor> can <capability>. Priority: must-have | nice-to-have
```

Use `must-have` or `nice-to-have` unless this PRD already uses another priority word. No vendor names, schema or ORM notation, runtime location, transport, or UI affordance. State the observable property. Bump `updated`.

## Roadmap inserts

Insert the glance row after the last prerequisite's row. Copy the existing header. Do not add columns. Cells the header does not have are not invented. Linear and GitHub stay `—` until the issue pair exists, and only in columns the header already has.

Fallback header from the roadmap contract, when you are matching that file:

```markdown
| S-NN | <change-id> | <user-can outcome> | <prereqs or —> | US-NN, FR-NNN | proposed |
```

Detail fields, in this order: Outcome, Change ID, PRD refs, Unlocks (foundations only), Prerequisites, Parallel with, Blockers, Acceptance, Unknowns, Risk, Status. Add Linear and GitHub lines only when sibling items have them.

Acceptance bullets are the behaviors the user stated. Unknowns use `Owner:` and `Block: yes|no`, or `—`.

```markdown
## Source / Lineage

- Added via `/roadmap-add` on <YYYY-MM-DD>.
- Goal: <the Cel: line verbatim>.
```

`structure: split`, or an existing `roadmap-references/items/` directory → write `roadmap-references/items/{ID}.md` in the shape of a sibling file, including the lineage section, and add a row to `roadmap-references/README.md`. Otherwise append the block under `## Slices` or `## Foundations`.

If `## Streams` exists, add this id to the chain it continues. If `## Backlog Handoff` exists, add one row. Ready for `/plan` is `yes` only when Status is `ready`. Bump roadmap `updated`.

## Issue pair

Skip this when Phase 0 did not resolve both a Linear team and a GitHub repo, or the user does not want issues. Leave issue cells as `—` and say so in the handoff.

When an `update-status` skill exists in the repo, follow it: one source of truth, then verify the mirror. Otherwise:

1. Linear `save_issue`. Title is the outcome, at most 120 characters. Description includes the PRD refs and the acceptance bullets.
2. GitHub: write the body to a temp `.md` file, then `gh issue create --title "..." --body-file <temp.md>`.
3. Cross-link the GitHub URL onto the Linear issue and verify the mirror. There is no automatic Linear ↔ GitHub sync.
4. Write both ids into the glance cells that exist and into the detail lines that exist.
