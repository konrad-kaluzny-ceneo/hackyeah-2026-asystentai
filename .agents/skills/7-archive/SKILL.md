---
name: archive
description: >
  Archive a completed change by moving context/changes/<change-id>/ into
  context/archive/ and stamping change.md archived. Use when the user says
  /archive, "archive this change", "zamknij change", or "archiwizuj". Closes
  the matching roadmap item when one exists.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# /archive — Close a change

Move `context/changes/<change-id>/` to `context/archive/<created>-<change-id>/`, stamp `change.md`, and commit the rename. If `context/foundation/roadmap.md` has an item whose Change ID equals `<change-id>`, set that item to `done` and append `## Done`.

The gate warns and asks. It hard-stops only on uncommitted work inside the change folder, or on unrelated staged changes that would ride into the archive commit.

## Hard rules

1. **Do not rewrite Progress SHAs.** `/implement` is the only writer of ` — <sha>`. A missing suffix is a warning.
2. **Do not run tests or a build as a gate.** Do not push.
3. **Do not unarchive.** A revisit is a new `/new` that may read the archived folder.
4. **After the move, do not write under `context/archive/`.** The folder is read-only by convention.
5. **Roadmap edits close one exact Change ID.** Do not reorder slices, edit other items, or create a roadmap. No file or no exact match → leave the roadmap alone.
6. **Do not roll back a partial move.** `status: archived` still sitting in `context/changes/` is intent. Re-running hits the resolution stop below. `/status` reports that as `status drift: archived in wrong folder`.
7. **A roadmap failure does not abort the archive.** Note the skipped sub-edit in the confirmation and continue.

## How to ask

Use the host's structured question tool. On PowerShell, clipboard is `Set-Clipboard`. Elsewhere: `pbcopy`, then `clip.exe`, then `xclip -selection clipboard`. Ignore a clipboard failure.

## No argument

Print this and stop:

```
I'll archive a completed change. Please provide a change-id (kebab-case slug) or path:

Examples:
  /archive context-dir-restructure
  /archive @context/changes/oauth-login/

You can list active changes with: `ls context/changes/`
```

## Parse

First whitespace-delimited token. Strip a leading `@` and a trailing `/`. If it contains `/`, take the last non-empty segment. That is `<change-id>`.

## Resolve

Target: `context/changes/<change-id>/`.

- Missing, and `context/archive/` has a directory ending in `-<change-id>` → `error: change "<change-id>" is already archived at <path>.` Stop.
- Missing otherwise → print this and stop:

  ```
  error: no change folder at context/changes/<change-id>/. Run `ls context/changes/` to list active changes.
  ```
- `change.md` `status: archived` → `error: change "<change-id>" is already archived in change.md but its folder is still under context/changes/. Inspect manually before re-running.` Stop.
- `created` missing or not `YYYY-MM-DD` → `error: change.md.created is missing or malformed; cannot derive archive folder name.` Stop.

Read `status` and `created` from that frontmatter. Keep `created` for the destination name.

## Hard stops

Run both before any warning prompt.

1. `git status --porcelain "context/changes/<change-id>/"`. Non-empty → stop:

```
✗ Cannot archive: context/changes/<change-id>/ has uncommitted changes.

  <one line per porcelain path>

Commit or stash them first, then re-run /archive.
```

2. `git diff --cached --quiet`. Non-zero exit → stop:

```
✗ Cannot archive: pre-existing staged changes would be bundled into the archive commit.

  <output of git diff --cached --name-only>

Either commit them first or `git reset` to unstage, then re-run /archive.
```

If git is missing or this is not a repo: print `warning: not a git repository — skipping uncommitted-changes block.` Continue. Skip `git mv` and the commit later.

## Warnings

Collect every hit, then one prompt. No hits → go to Move.

1. `status` is not `implemented` or `impl_reviewed` → `Status is "<status>"; expected "implemented" or "impl_reviewed".`
2. Progress in `plan.md`, section `## Progress` only. Count `- [ ]` under each `### Phase N:` separately for `#### Automated` and `#### Manual`. `<X>` automated, `<Y>` manual, `<N>` = `<X> + <Y>`. Tokens are `N.M <title>` in document order, automated first, then manual. Truncate the combined list at 5 and end with `…`.
   - Any phase has an Automated or Manual heading, and `<N> > 0` → `<N> Progress items still pending (<X> automated, <Y> manual): <tokens>.`
   - No phase has those headings, and any `- [ ]` remains under `### Phase` → `<N> Progress items still pending: <tokens>.` No parenthetical.
   - No `plan.md` → `No plan.md found in change folder.` Skip the Progress count and the SHA check.
3. No file matches `context/changes/<change-id>/reviews/impl-review*.md` → `No impl-review found at reviews/impl-review*.md.`
4. When `plan.md` exists: count `- [x]` rows in `## Progress` that do not end with ` — ` plus 7 or more hex digits. Non-zero → `<N> Progress rows missing SHA suffix: <tokens, same truncation>.` Empty-diff phases and older plans are valid. This is a signal, not a defect.

```
⚠ /archive warnings for <change-id>:

  - <warning>
```

Ask `Archive "<change-id>" anyway?` Header: `Archive`.

- `Continue archiving` — Move the folder to `context/archive/` despite the warnings.
- `Resume implementation` — Don't archive. Suggest `/implement <change-id>` next.
- `Cancel` — Don't archive. Exit cleanly without further action.

When the Progress warning is exactly `0 automated, <Y> manual` and `<Y> ≥ 1`, append ` (Recommended)` to `Continue archiving`. Every other case keeps the labels as written.

Continue → Move. Resume → print `→ /implement <change-id>`, copy that command, stop. Cancel → `Cancelled. Folder unchanged.` Stop.

## Move

1. `DEST` = `context/archive/<created>-<change-id>` using the `created` already read. If `DEST` exists → `error: archive destination "<DEST>" already exists. Inspect manually.` Stop.
2. Edit `change.md` in place. Set `status: archived`, `archived_at` to UTC now as `YYYY-MM-DDTHH:MM:SSZ`, and `updated` to today `YYYY-MM-DD`. On PowerShell: `(Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')`. Leave `created`, `change_id`, and every other field.
3. `git mv "context/changes/<change-id>" "<DEST>"`. If that fails, create `context/archive` if needed, move the folder, and print `warning: git mv failed — moved the folder without history.` Stop if `DEST` is missing or the source still exists.
4. When git is available, `git add "<DEST>/change.md"` so the stamp is in the same commit as the rename. `git mv` stages HEAD content only.
5. Close the roadmap item. Never block, roll back, or prompt.
   1. No `context/foundation/roadmap.md` → skip silently.
   2. Record `git status --porcelain context/foundation/roadmap.md`. Empty means the file may be staged into this commit.
   3. Match `<change-id>` exactly: the At a glance row whose Change ID cell equals it, and the `### <ID>:` block in Foundations or Slices that has `- **Change ID:** <change-id>`. `<ID>` is `F-NN` or `S-NN`. `<Outcome>` is the `- **Outcome:**` text, including a leading `(foundation) ` when present.
   4. No match → `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` A near-miss stays open. One slice may have spawned several changes.
   5. On a match, edit only these. If a target is not where the roadmap template puts it, skip that sub-edit, note it, and continue.
      - At a glance: that row's Status cell → `done`.
      - Body: `- **Status:**` → `- **Status:** done`.
      - Under `## Done`, append:

        ```
        - **<ID>: <Outcome>** — Archived <today> → `context/archive/<created>-<change-id>/`. Lesson: —.
        ```

        `<today>` is `YYYY-MM-DD`. No `## Done` heading → append the heading and this bullet at the end of the file.
   6. Set roadmap frontmatter `updated` to today. Leave every other key. No frontmatter → skip this sub-step.
   7. If git is available and the porcelain check in 5.2 was empty, `git add context/foundation/roadmap.md`. If it was dirty, leave the close unstaged and print `⚠ context/foundation/roadmap.md had pre-existing uncommitted changes — closed roadmap item <ID> in the working tree but did NOT stage it. Commit it yourself.`
   8. Keep `<ID>` and `<Outcome>` for the confirmation.
6. Commit when git is available. On PowerShell use two `-m` arguments. Never `--no-verify` or a signing bypass. A failed hook is fixed and committed again as a new commit. Do not amend.

```
git commit -m "chore(archive): close <change-id>" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

## Confirm

```
✓ Archived <change-id>
  context/changes/<change-id>/  →  <DEST>/

change.md updated:
  status:       archived
  archived_at:  <ISO datetime>
  updated:      <today>

roadmap.md:     closed <ID> "<Outcome>"  →  Status: done, entry added to ## Done

Committed as: <short SHA> chore(archive): close <change-id>

The folder is now read-only by convention. To start a new change: /new <new-id>
```

Omit the `roadmap.md` line when nothing matched. If a roadmap sub-edit was skipped, say so on that line. Omit the commit line when git was skipped.
