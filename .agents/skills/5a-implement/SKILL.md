---
name: implement
description: >
  Implement an approved plan from context/changes/<change-id>/plan.md phase by
  phase, verify it, and commit each phase. Use when the user says /implement,
  "implement the plan", "zaimplementuj", or "/implement <change-id> phase N".
  Use AFTER /plan (and /plan-review when that review exists), BEFORE /impl-review.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Implement

Carry out `context/changes/<change-id>/plan.md`. `## Progress` is the only execution state. Checkbox rules: [../3-plan/references/progress-format.md](../3-plan/references/progress-format.md). Do not archive the change.

## Hard rules

1. **Checkboxes live only in `## Progress`.** Phase blocks stay plain `- ` bullets. No HTML progress comments. No sidecar state file.
2. **Do not mark a Manual row `[x]` until the user confirms that check.**
3. **Stage by explicit path.** Never `git add -A` or `git add .`. Never `--no-verify`, `--amend`, or a signing bypass. A failed hook means the commit did not happen: fix the cause and make a new commit.
4. **Do not invent issue ids.** A `Refs:` line uses only ids or URLs the user showed in this conversation (Jira `ABC-123`, Linear `ENG-123`, GitHub `#123` / `GH-123` / a full issue or PR URL). Several ids go on one comma-separated line. The same line goes on every phase commit and the epilogue, unless the user ties a ref to one phase.
5. **An archived plan is refused.** If the path starts with `context/archive/`, print `This change is archived. Open a new change with /new instead.` and stop.

## How to ask

Use the host's structured question tool. Recommended option first, label ending in `(Recommended)`.

## Entry

- `/implement <change-id> [phase N]` → `context/changes/<change-id>/plan.md`.
- `@context/changes/<change-id>/plan.md` or another path → that file. Strip a leading `@`.
- Nothing → print the block below and wait.

```
I'll help you implement an approved technical plan. Please provide:

1. A change-id (e.g., `/implement oauth-login phase 1`), or
2. A full path (e.g., `@context/changes/oauth-login/plan.md`).

You can list active changes with: `ls context/changes/`

Tip: Make sure the plan has been reviewed and approved before implementation.
```

Read the plan fully. Read `context/foundation/lessons.md` if it exists, and follow those rules on every choice in this run. Read the research, frame, and source files the plan names, fully.

On entry, if `change.md` status is `planned` or `plan_reviewed`, set `status: implementing` and `updated` to today. Leave any other status unchanged, and still set `updated`.

If the host has a task list, one task per `## Phase N:` heading: `Phase N: <name>`. Mark it in progress before that phase and completed when its checks pass.

The next step is the first `- [ ]` in `## Progress`. A `phase N` argument starts at the first `- [ ]` inside `### Phase N:`. Existing `[x]` rows are done. Re-open an `[x]` row only when a later phase edits a file named in that row, or when a command from that row exits non-zero. Otherwise leave the row `[x]`.

If several phases were requested in one run, do not ask between them.

## Per phase

Implement the steps and files named in that phase. If a named path, command, or expected result does not match the tree, stop and print the mismatch block; do not edit further until the user picks an option. Finish the phase before the next one.

On a mismatch, stop and print:

```
Issue in Phase [N]:
Expected: [what the plan says]
Found: [actual situation]
Why this matters: [explanation]
```

Ask "How should I handle this mismatch?"

- "Adapt and continue" — match reality, and say what you adapted.
- "Skip this part" — this change is not needed.
- "Stop and re-plan" — stop. The plan has to change first.

**Touched-file set**, in memory, reset after each phase commit:

- Add every file you create or edit during the phase, repo-relative.
- Add `context/changes/<change-id>/plan.md` as soon as the phase starts.
- On the first phase only, also add every untracked or modified file already inside `context/changes/<change-id>/` (`change.md`, `research.md`, `plan.md`, and the rest).
- A dirty path that is not in the set is unrelated. It is not staged unless the user picks "Stage all" at Phase-end commit step 3.

**Automated checks.** Run what this phase's Automated Verification names. Prefer the path-aware command when the phase touches that area; the map is [../3-plan/references/plan-template.md](../3-plan/references/plan-template.md).

Re-run that command until it exits 0. Do not start `## Phase-end commit` while it is still failing.

Flip one Progress row at a time, from `- [ ] N.M <title>` to `- [x] N.M <title>`, with no SHA yet. Automated rows flip when that check passes. Manual rows flip only after the user confirms them at the gate below.

## Phase-end commit

The phase commit cannot contain its own SHA. Write the SHA onto the rows after the commit. Those lines stay dirty. The next phase commits them because `plan.md` is always staged. The last phase has no next phase, so the epilogue commits them.

1. **Manual gate.** Print this and wait.

```
Phase [N] Complete - Ready for Manual Verification

Automated verification passed:
- [List automated checks that passed]

Please perform the manual verification steps listed in the plan:
- [List manual verification items from the plan]

Let me know when manual testing is complete so I can proceed to the commit step.
```

This phase is final when no `### Phase M:` heading has `M > N`. Only then, if any earlier phase still has `- [ ]` under `#### Manual`, append them in document order as `<phase>.<index> <title>` (no checkbox prefix, no SHA suffix):

```
Pending manual checks from earlier phases:
- [phase.index title]
```

Omit that block when there are none. The pause still happens. It does not block on those earlier rows.

2. **Staging set** = touched-file set plus `context/changes/<change-id>/plan.md`.
3. **Unrelated dirt.** `git status --porcelain` minus the staging set. If anything remains, ask "<N> unrelated path(s) are dirty. How should I handle them?"
   - "Continue — stage only the planned set (Recommended)"
   - "Stage all"
   - "Abort" — stop the commit. Do not start the next phase.
   Empty unrelated set → skip the question.
4. **`git add` each chosen path by name.**
5. **`git diff --cached --quiet`.** Exit 0 means nothing staged. Print `Phase [N] had no diff to commit; rows remain SHA-less; archive warn-only will surface them.` Set `SHA=""`. Skip to step 8.
6. **Message.** Subject: `<type>(<change-id>): <phase title> (p<N>)`. Type is `feat`, `fix`, `chore`, `refactor`, or `docs`, from what the phase did. Body lists the touched files, plus `Refs:` when the hard rule says so. Ask "Approve commit message?"
   - "Approve as proposed (Recommended)"
   - "Edit subject line" — keep the body
   - "Override entirely"
7. **Commit** with that message and this trailer. On PowerShell, where a bash heredoc is unavailable, pass the same subject, body, and trailer with `git commit -m` and extra `-m` arguments.

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

8. If `SHA` is empty, skip this. Otherwise `git rev-parse --short HEAD`.
9. On every row flipped this phase that has no ` — <sha>` yet, replace `- [x] N.M <title>` with `- [x] N.M <title> — <SHA>`. Do not double-append. If `SHA` is empty, leave the rows SHA-less.
10. Set `change.md` `updated` to today. Keep `status: implementing`. On the final phase, after this SHA write-back, set `status: implemented`.
11. Clear the touched-file set.

## Between phases

Ask "Phase [N] complete. How to proceed?"

- "Continue to Phase [N+1]" — read that phase, mark its task in progress, implement. Do not re-read the whole plan.
- "Clear context first" — copy `/implement <change-id> phase <N+1>` to the clipboard (`Set-Clipboard` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere) and print `→ /implement <change-id> phase <N+1> (✓ copied)`.
- "Review this phase first" — run `/impl-review @context/changes/<change-id>/plan.md phase [N]`. When it returns, ask again with only Continue and Clear context.

A run that was told to do several phases in a row skips this question.

## After the last checkbox

When every Progress row is `[x]`:

1. Scan once more for `- [ ]`. If any remain, list `<phase>.<index> <title>` grouped Automated then Manual, and ask "<N> Progress item(s) still pending. How to proceed?"
   - "Pause (Recommended)" — stop. Do not change `change.md`. Do not commit the epilogue.
   - "Proceed to epilogue" — continue. `/archive` will warn about the stragglers.
   None pending → continue.
2. Set `change.md` `status: implemented` and `updated` to today. Do not set `archived_at`.
3. Epilogue, because the last phase's SHA lines and the status flip are still dirty:
   1. `git add` only `context/changes/<change-id>/plan.md` and `context/changes/<change-id>/change.md`.
   2. `git diff --cached --quiet` with exit 0 → nothing to commit. Stop.
   3. Subject `chore(<change-id>): close out plan (epilogue)`. Body: final SHA write-back and `change.md` → implemented, plus `Refs:` when required. Same approve / edit subject / override question.
   4. Commit with the same trailer and the same hook rule.
   5. Do not write the epilogue SHA back into the plan.

```
All phases implemented! 🎉

Summary:
- Phases completed: [N]
- Files changed: [every repo-relative path in the touched-file set for the completed phases]
```

Ask "Plan complete. Would you like a final implementation review?"

- "Run full review (/impl-review)" — run `/impl-review <change-id>` with no phase number.
- "Skip review — I'm satisfied" — stop.

## If stuck

Re-read the code the phase names. If the tree has moved since the plan, use the mismatch block. Use Explore for one path or one pattern. Use general-purpose when unread files named by the phase sit in more than one top-level directory. Do not delegate the phase itself.

## Where the run is

The next step is the first `- [ ]` in Progress. The current phase is the `### Phase N:` above it. Completion is the count of `[x]` over the count of `[ ]` plus `[x]`.
