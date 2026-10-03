# Scaffold-and-merge (Step 2)

The phase where bootstrapper actually runs the starter's CLI. Three `cwd_strategy` branches share one strict conflict policy. CLI exit code != 0 is the only HARD-STOP in the skill; everything else is WARN-AND-CONTINUE.

## Inputs (resolved at Step 0 / Step 1)

- The chosen card's `cmd_template` (carries `{name}` and possibly `{pm}` placeholders).
- `project_name` from the hand-off frontmatter.
- `package_manager` from the hand-off frontmatter, falling back to the card's `toolchain.package_manager` if omitted.
- `cwd_strategy` from `bootstrapper-config.yaml` for this `starter_id`, defaulting to `subdir-then-move` if the id is not listed.

## Substitution rules

Two placeholders, substituted before exec:

- `{name}` — replaced by `.bootstrap-scaffold` for `subdir-then-move` and `git-clone`; replaced by `.` for `native-cwd`.
- `{pm}` — replaced by the resolved package manager (hand-off value, or card's `toolchain.package_manager` fallback). If `cmd_template` contains no `{pm}` placeholder, the package manager field is unused (e.g., `cargo new {name} --bin --edition 2024`).

`project_name` itself is **not** a substitution input. The scaffolded project lives in cwd; the cwd's directory name is the project's directory name. `project_name` is staged into the verification log as metadata.

## Strategy: subdir-then-move (default)

The default for any `starter_id` not listed in `bootstrapper-config.yaml`. Used by `next`, `astro`, `vite-react`, `t3`, `expo`, and most v2-onward starters.

Sequence:

1. Substitute `{name}=.bootstrap-scaffold` (and `{pm}` if present) into `cmd_template`.
2. Run the resolved command. Capture stdout, stderr, and exit code.
3. If exit code != 0, run the CLI failure handling below. Stop here on failure.
4. Apply the conflict matrix below to move files from `.bootstrap-scaffold/` up into cwd.
5. Delete `.bootstrap-scaffold/` (the directory should be empty after the move; if it is not, log the leftover paths into the verification log and remove the directory anyway — the move-up step is best-effort, not transactional).

## Strategy: native-cwd

Used by starters whose CLI was designed to scaffold into the current directory (e.g., `django-admin startproject {name} .`, `npm create hono@latest .`). Listed explicitly in `bootstrapper-config.yaml` per starter.

Sequence:

1. Run the populated-cwd pre-flight: list the files the CLI is about to create or touch (best-effort — for most CLIs this is "files matching the starter's known layout"). If pre-flight cannot enumerate, surface the limitation in conversation but proceed.
2. Substitute `{name}=.` into `cmd_template`. Substitute `{pm}` if present.
3. Run the resolved command in cwd. Capture stdout, stderr, and exit code.
4. If exit code != 0, run the CLI failure handling below. Stop here on failure.
5. There is no merge step — the CLI wrote into cwd directly. The conflict policy still applies in spirit: if the CLI overwrote a file the user had pre-populated (rare; most cwd-aware CLIs refuse on conflict and exit non-zero, which trips the HARD-STOP), surface the overwrite in the post-run summary.

`native-cwd` exists because some CLIs refuse to operate inside a parent directory or perform their own conflict handling that is friendlier than `.scaffold` siblings. When in doubt, `subdir-then-move` is the safer default.

## Strategy: git-clone

Used by starters whose `cmd_template` starts with `git clone` (e.g., `astro-starter`).

Sequence:

1. Substitute `{name}=.bootstrap-scaffold` (and `{pm}` if present) into `cmd_template`.
2. Run the resolved command. Capture stdout, stderr, and exit code.
3. If exit code != 0, run the CLI failure handling below. Stop here on failure.
4. **Delete `.bootstrap-scaffold/.git/`** before the move-up. The cloned `.git/` carries the upstream starter's history, which is rarely what the user wants; the user typically initialises their own repo afterwards. If cwd already contains a `.git/`, the existing-wins rule keeps it untouched.
5. Apply the conflict matrix below to move files up into cwd.
6. Delete `.bootstrap-scaffold/`.

## Conflict matrix

Applied during the move-up step for `subdir-then-move` and `git-clone`. Compares each path under `.bootstrap-scaffold/` against the same relative path under cwd.

| Path pattern in scaffold                                                       | Path exists in cwd? | Resolution                                                                          |
| ------------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------- |
| `context/**` (any path under `context/`)                                       | yes or no           | scaffold copy is dropped; cwd `context/` is the source of truth and never overwritten |
| `.gitignore`                                                                   | yes                 | append-merged: cwd lines kept in order, then scaffold lines de-duped against the cwd set, appended at the end with a `# from <starter_id>` separator comment |
| `.gitignore`                                                                   | no                  | move silently                                                                       |
| `package.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, root-level `*.md`       | yes                 | existing wins; scaffold copy lands as `<filename>.scaffold` sibling                  |
| `package.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, root-level `*.md`       | no                  | move silently                                                                       |
| anything else                                                                  | yes                 | existing wins; scaffold copy lands as `<filename>.scaffold` sibling                  |
| anything else                                                                  | no                  | move silently                                                                       |

Notes on the matrix:

- `context/` is special-cased because it is the bootstrap chain's metadata surface — `tech-stack.md`, `change.md`, plans, frames. Overwriting any of it would destroy the chain trail. Drop is the right policy: cwd `context/` is canonical.
- `.gitignore` is the only file that gets append-merged because git's ignore semantics are additive (more patterns = stricter), so combining is safe and useful. De-dupe is line-by-line, exact match.
- `<filename>.scaffold` siblings give the user a no-data-loss diff target. The user can `diff README.md README.md.scaffold` to see what the starter shipped vs what they had.
- The matrix never deletes user files. It either moves a scaffold file into place, drops it (for `context/**`), or sidelines it as a `.scaffold` sibling.

## Default strategy

Any `starter_id` not listed in `bootstrapper-config.yaml`'s `starters:` map defaults to `subdir-then-move`. This is the safe default — the CLI scaffolds into a temp dir, then the conflict matrix governs the move-up, and cwd state (including `context/`) is preserved.

A starter that is genuinely cwd-aware (its CLI was designed to write into `.`) but is not yet listed in `bootstrapper-config.yaml` will scaffold sub-optimally under `subdir-then-move` — the CLI may write into `.bootstrap-scaffold/`, the move-up still works correctly, but the user pays an extra copy/delete round-trip. Worked example: `fastapi` (hypothetical card not in v1 config) — `cmd_template` `pip install fastapi[standard] && fastapi run app/main.py` is run in `.bootstrap-scaffold/`; it works, but a future bootstrapper-config entry pinning `fastapi: cwd_strategy: native-cwd` would avoid the temp-dir round-trip.

Future starters get explicit overrides in v2 by adding entries to `bootstrapper-config.yaml`. The validator at `scripts/validate-starter-registry-sync.mjs` ensures every `starter_id` listed there exists in the tech-stack-selector registry.

## CLI failure handling

When the scaffold CLI exits non-zero, bootstrapper HARD-STOPs:

1. Capture stdout, stderr, and the exit code into the in-memory verification record.
2. Leave `.bootstrap-scaffold/` in place for the user to inspect (do NOT delete it on failure — the user may want to read partial output, log files, or rerun manually).
3. Do NOT apply the conflict matrix. cwd stays exactly as it was at Step 1.
4. Write a partial `verification.md` per `verification-log-schema.md`, with `phase_3_status: failed`, the captured CLI output, and the resolved invocation that failed.
5. Set the clipboard for retry:

   ```bash
   echo -n "/bootstrapper" | pbcopy 2>/dev/null || echo -n "/bootstrapper" | clip.exe 2>/dev/null || echo -n "/bootstrapper" | xclip -selection clipboard 2>/dev/null || true
   ```

6. Print verbatim (substitute `<exit_code>` and `<short_stderr>`):

   ```
   Scaffold CLI exited with status <exit_code>. The scaffold directory `.bootstrap-scaffold/` is left in place for inspection. Last stderr line:

       <short_stderr>

   A partial verification log was written to `context/changes/bootstrap-verification/verification.md` with `phase_3_status: failed` and the captured CLI output. Re-invoke `/bootstrapper` (clipboard set) once the failure cause is addressed.
   ```

7. Stop. Do not advance to Step 3 or Step 4 (Step 4 already ran in step 4 above for the partial log; the normal Step 3 audit is skipped because there is nothing to audit).

CLI failure is the only HARD-STOP in the skill. Pre-scaffold staleness, post-scaffold CRITICAL findings, missing audit tools — all WARN-AND-CONTINUE. The principle: bootstrapper halts only when there is genuinely no project to verify.

## Substitution edge cases

- **`{pm}` omitted from hand-off**: fall back to the card's `toolchain.package_manager`. The chosen card always carries one — registry validation guarantees it.
- **`cmd_template` with no `{pm}` placeholder**: ignore the package_manager field for this run (e.g., `cargo new {name} --bin --edition 2024` does not need a JS package manager). Stage the resolved value in the verification log anyway for audit-trail completeness.
- **`{name}` appears more than once in `cmd_template`**: substitute every occurrence. The astro-starter template (`git clone <url> {name} && cd {name} && {pm} install`) is the canonical example.
- **`cmd_template` carries a chained `&&`**: run the whole template as one shell invocation. Bootstrapper does not split on `&&` — it lets the shell handle the chain. Failure of any segment surfaces as a non-zero overall exit code, which the HARD-STOP path handles correctly.

## Surfacing the result

After a successful scaffold, print one summary line in conversation. Format:

```
Scaffolded via <strategy>. <N> files moved. <M> conflicts surfaced as `.scaffold` siblings: <comma list>. `.gitignore` <append-merged | moved silently | absent>.
```

For `native-cwd`:

```
Scaffolded via native-cwd directly into the current directory. <N> files written. <M> pre-existing files preserved.
```

Stage the full file-by-file move log (or write log, for `native-cwd`) into the in-memory verification record for Step 4 to write to disk.

## What this step does NOT do

- Does not install dependencies beyond what `cmd_template` itself runs. Most templates chain an install (`npm create next-app && cd next-app && npm install`); bootstrapper inherits that behaviour but does not add its own install step.
- Does not initialise git. The user runs `git init` themselves (or did so before invoking bootstrapper). For `git-clone` strategy, the cloned `.git/` is deleted before move-up exactly so the user is not surprised by inherited history.
- Does not run any audit. That is Step 3 (`post-scaffold-verification.md`).
- Does not generate `AGENTS.md` / `CLAUDE.md`. That is the future M1L4 skill's job.
- Does not write the verification log. That is Step 4. This step only stages findings into the in-memory record.
