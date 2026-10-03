---
name: bootstrapper
description: >
  Scaffold a project into the current working directory after the tech stack
  is picked. Reads context/foundation/tech-stack.md, runs the chosen starter's
  CLI with a strict conflict policy that always preserves context/, and writes
  a verification log. Use when the user says "bootstrap the project",
  "scaffold the app", "set up the codebase", "let's start the project".
  Use AFTER /tech-stack-selector.
---

# Bootstrapper

Scaffold the current directory from a tech-stack hand-off. v1 is chain-mode only. Do not write `AGENTS.md`, `CLAUDE.md`, CI workflows, or `git init`. Do not auto-fix audit findings.

Chain position: `/shape → /prd → /tech-stack-selector → /bootstrapper`. Adding or swapping one library in an existing codebase is `/frame`. A stack that is not in the registry goes back to `/tech-stack-selector`.

The starter list lives in `../_04_tech-stack-selector/references/starter-registry.yaml`. This skill looks up `starter_id`, fills `cmd_template`, and runs it. It does not add starters.

## Hard rules

1. **The hand-off file is the input.** No mini-handoff and no stack picked from chat. If the file is missing, stop.
2. **`context/` is never overwritten.** Existing files become `.scaffold` siblings. `.gitignore` is append-merged. The matrix is in `references/scaffold-merge.md`.
3. **A non-zero scaffold CLI is a hard stop.** Leave `.bootstrap-scaffold/` in place, write a partial log with `phase_3_status: failed`, copy `/bootstrapper` to the clipboard, and stop. Do not run the audit.
4. **Every other check warns and continues.** Stale packages, critical audit findings, and a missing audit tool do not block. The user decides.
5. **Clipboard only on failure.** Missing hand-off and unknown `starter_id` copy `/tech-stack-selector`. CLI failure copies `/bootstrapper`. A successful run copies nothing.
6. **Internal labels stay internal.** Do not say "Step 2", `subdir-then-move`, `native-cwd`, `git-clone`, or `hints.deployment_target` to the user. Say "the scaffold step", "scaffold into a temp directory then move files up", "scaffold directly here", "clone the starter without keeping its git history", "where this will run".

## How to ask

Use the host's structured question tool. Recommended option first, label ending in `(Recommended)`.

## What to read, and when

| When | Read |
|---|---|
| Step 0 | [references/handoff-consumer.md](references/handoff-consumer.md). On any refusal, [references/refusal-protocol.md](references/refusal-protocol.md) |
| Step 1 | [references/pre-scaffold-verification.md](references/pre-scaffold-verification.md) and [references/bootstrapper-config.yaml](references/bootstrapper-config.yaml) |
| Step 2 | [references/scaffold-merge.md](references/scaffold-merge.md) |
| Step 3 | [references/post-scaffold-verification.md](references/post-scaffold-verification.md) |
| Step 4 | [references/verification-log-schema.md](references/verification-log-schema.md) |

Follow those files for thresholds, the conflict matrix, and the log shape. This file is the order of work. Keep one in-memory verification record and pass it from step to step.

## Entry

1. A path argument (`/bootstrapper @context/foundation/tech-stack-v2.md`) → that path, strip a leading `@`.
2. No argument → `context/foundation/tech-stack.md`.

Call this `<handoff-path>`.

## Step 0: Hand-off

If `<handoff-path>` is missing, run refusal (a) in [references/refusal-protocol.md](references/refusal-protocol.md) and stop. Use that file's clipboard command and its verbatim print. Where the print names `context/foundation/tech-stack.md`, substitute `<handoff-path>`.

If the file exists, read it fully. Parse it with `references/handoff-consumer.md`. Look up `starter_id` under `starters:` in `../_04_tech-stack-selector/references/starter-registry.yaml`. If it is missing, run the registry-drift refusal and stop.

Also apply every other condition in `references/refusal-protocol.md` at the trigger that file names (empty directory, populated directory, existing log).

Print:

```
Hand-off received:
  Starter:        <starter_id> — <name>
  Project name:   <project_name>
  Package manager:<package_manager | "(card default)" if omitted>
  Language:       <hints.language_family>
  Confidence:     <hints.bootstrapper_confidence>
  Path taken:     <hints.path_taken>
  Deployment:     <hints.deployment_target>
  Feature flags:  <comma list of has_* set to true, or "none">
```

Ask "Proceed with this hand-off, or correct something first?"

- "Proceed (Recommended)" — continue.
- "Correct a value" — ask which field, keep an in-memory override, leave the file unchanged.
- "Stop — fix the hand-off first" — stop. They re-run `/tech-stack-selector`, then this skill.

After Proceed or an override, run the populated-directory guard before Step 1. Abort there writes nothing.

## Step 1: Recency check

Read `references/pre-scaffold-verification.md` and run it. Read-only. Every finding warns and continues.

1. If `language_family` is `js` and `cmd_template` is `npm create X` (or the same shape), the package name is `create-X` (`npm create next-app` → `create-next-app`). A template that starts with `git clone` skips npm.
2. When a package name exists, run `npm view <package> version` and `npm view <package> time.modified`.
3. If `docs_url` is `github.com/<owner>/<repo>`, run `gh api repos/<owner>/<repo> --jq '.pushed_at'`.
4. Score fresh / aged / stale with the thresholds in the reference. Print one line. A stale signal gets a one-line heads-up. Do not block.
5. Stage package name, repo URL, both timestamps, and both severities on the verification record. A failed network call logs the error and keeps the partial record.

From `references/bootstrapper-config.yaml`, stage `cwd_strategy` for this `starter_id` (default `subdir-then-move` when the id is absent) and `audit_commands[<language_family>]` (`null` means Step 3 skips the audit and says so in the log).

## Step 2: Scaffold and merge

Read `references/scaffold-merge.md` and follow it for substitution, the three strategies, the conflict matrix, and CLI failure.

1. Fill `{name}` and `{pm}` in `cmd_template`. If the hand-off omits `package_manager`, `{pm}` is the card's `toolchain.package_manager`.
2. `subdir-then-move`: run with `{name}=.bootstrap-scaffold`. On exit 0, move files up by the conflict matrix, then delete `.bootstrap-scaffold/`.
3. `native-cwd`: `{name}=.` in the current directory. No merge. Before exec, list the files the CLI will touch.
4. `git-clone`: `{name}=.bootstrap-scaffold`. On exit 0, delete `.bootstrap-scaffold/.git/` before the move, then delete `.bootstrap-scaffold/`.
5. Record stdout, stderr, and the exit code.
6. Non-zero exit: follow the CLI-failure path in `scaffold-merge.md`. Leave `.bootstrap-scaffold/`. Do not merge. Write the partial log (`phase_3_status: failed`). Copy `/bootstrapper`. Print the failure summary. Stop. Do not run Step 3.
7. Exit 0: print the one-line result from `scaffold-merge.md`, stage the move log, and go to Step 3.

## Step 3: Audit

Read `references/post-scaffold-verification.md`.

1. Audit command `null`: stage "no built-in audit tool for <language_family>", print the skip line, go to Step 4.
2. Otherwise run it from the directory the scaffold created. Capture stdout, stderr, and the exit code. A non-zero audit exit does not stop the skill.
3. Tier findings CRITICAL / HIGH / MODERATE / LOW. If the tool separates direct and transitive, record that split.
4. Print one line. CRITICAL and HIGH counts are in the line. MODERATE and LOW stay in the log.
5. Stage the raw output, counts, and per-finding detail.

Tool missing, network error, or a parse failure: warn and continue. CRITICAL findings: warn and continue.

## Step 4: Write the log

Read `references/verification-log-schema.md`.

1. Create `context/changes/bootstrap-verification/` if needed. No `change.md`.
2. If `verification.md` already exists, run refusal `(e)`. Overwrite replaces it. "Save as verification-vN.md" uses the next free N (`verification-v2.md`, then `-3`, and so on). Abort stops without a new file. The scaffold from Step 2 is already on disk.
3. Write frontmatter (`phase_3_status: ok` on a normal run, `failed` on the CLI hard stop) and the sections the schema names. `## Hints recorded but not acted on` lists every hint `handoff-consumer.md` says v1 surfaces but does not act on.
4. If the write fails, print the full body in chat, per the schema.
5. On a normal run, print:

```
Bootstrapped <starter_id> into the current directory. Verification log: context/changes/bootstrap-verification/verification.md.

Pre-scaffold: <one-line recency summary>.
Scaffold:    <one-line scaffold summary>.
Audit:       <one-line audit summary>.

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.
```

Use the versioned log path when that is what was written. Stop. Do not copy a next command on success. The CLI-failure clipboard was already set in Step 2.
