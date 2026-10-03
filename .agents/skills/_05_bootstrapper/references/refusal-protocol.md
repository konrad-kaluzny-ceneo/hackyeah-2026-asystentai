# Refusal protocol

This doc enumerates every condition under which bootstrapper refuses to scaffold, what each refusal prints, and what next-step command lands on the clipboard. Single source for refusal copy so the strings stay consistent across `SKILL.md`, the lesson rule, and any future tooling that checks user-facing output.

Two semantic categories:

- **HARD REFUSAL** — skill prints the message, copies a clipboard pointer, and stops. No scaffold. No further interaction.
- **WARN-AND-CONFIRM** — skill prints the warning and uses `AskUserQuestion` to give the user an explicit choice (continue / abort). Scaffold proceeds only on explicit confirm.

## (a) Missing hand-off — HARD REFUSAL

**Trigger**: `test -f context/foundation/tech-stack.md` returns non-zero at Step 0.

**Clipboard**:

```bash
echo -n "/tech-stack-selector" | pbcopy 2>/dev/null || echo -n "/tech-stack-selector" | clip.exe 2>/dev/null || echo -n "/tech-stack-selector" | xclip -selection clipboard 2>/dev/null || true
```

**Print verbatim**:

```
Bootstrapper requires a tech-stack hand-off at `context/foundation/tech-stack.md`. Run `/tech-stack-selector` first, then re-invoke.
```

**Exit**: stop immediately. No fallback interview. No inline mini-handoff. The conversation transcript is not a substitute — the contract is the file on disk.

## (b) `starter_id` not in registry — HARD REFUSAL

**Trigger**: hand-off frontmatter `starter_id` does not match any key under `starters:` in `../../_04_tech-stack-selector/references/starter-registry.yaml`. In chain-mode this should be unreachable (tech-stack-selector refuses to write a hand-off whose `starter_id` it can't resolve); this is a defensive check against hand-edited hand-offs.

**Clipboard**:

```bash
echo -n "/tech-stack-selector" | pbcopy 2>/dev/null || echo -n "/tech-stack-selector" | clip.exe 2>/dev/null || echo -n "/tech-stack-selector" | xclip -selection clipboard 2>/dev/null || true
```

**Print verbatim** (substitute `<id>`):

```
Registry drift detected: `<id>` is not in the tech-stack-selector registry. Either the hand-off was hand-edited, or the registry was modified after the hand-off was written. Re-run `/tech-stack-selector` to regenerate `context/foundation/tech-stack.md` against the current registry.

(If you believe `<id>` should exist, add it to `.agents/skills/_04_tech-stack-selector/references/starter-registry.yaml` first — bootstrapper consumes that registry; it does not own it.)
```

**Exit**: stop immediately. Do not attempt to resolve the `starter_id` to anything else.

## (c) Empty cwd — HARD REFUSAL

**Trigger**: bootstrapper requires the current working directory (the user's invocation directory) to exist before scaffolding. Bootstrapper does NOT create a parent directory for the project — the user is expected to `mkdir my-project && cd my-project` before invoking, then run `/tech-stack-selector` (which writes `context/foundation/tech-stack.md` into that cwd), then `/bootstrapper`.

In practice this refusal almost never fires in chain-mode — if the user got here, `context/foundation/tech-stack.md` already exists, which means cwd is non-empty. Defensive check only.

**Clipboard**:

```bash
echo -n "" | pbcopy 2>/dev/null || echo -n "" | clip.exe 2>/dev/null || echo -n "" | xclip -selection clipboard 2>/dev/null || true
```

**Print verbatim**:

```
Bootstrapper expects to scaffold INTO the current working directory, not to create a new one. Create the project directory first (`mkdir my-project && cd my-project`), then re-invoke.
```

**Exit**: stop immediately.

## (d) Re-run on populated cwd — WARN-AND-CONFIRM

**Trigger**: cwd already contains a scaffold-shaped fingerprint. Detect by checking for any of:

- `package.json` (JS family)
- `Cargo.toml` (Rust)
- `Gemfile` (Ruby)
- `pyproject.toml` or `requirements.txt` (Python)
- `go.mod` (Go)
- `pom.xml` or `build.gradle` (Java)
- `composer.json` (PHP)
- `*.csproj` (anywhere in cwd, .NET)
- `pubspec.yaml` (Dart)

This guard runs after the Step 0 confirm-or-correct summary, before scaffolding. The presence of any of these fingerprints means the cwd is likely already scaffolded (or partially so).

`context/foundation/tech-stack.md` itself does NOT count as a scaffold fingerprint — it is the precondition for being here at all.

**Print** (substitute `<files>` for the comma-separated list of detected fingerprint files):

```
Heads-up: this directory already contains scaffold-shaped files: <files>. Bootstrapper will apply the strict conflict policy (existing files become `.scaffold` siblings; `context/` is preserved; `.gitignore` is append-merged), but this is your last chance to abort if the cwd state is unexpected.
```

**Then ask**:

AskUserQuestion:
- question: "Continue scaffolding into this populated directory?"
  header: "Populated cwd"
  options:
  - label: "Continue (Recommended)"
    description: "Apply the strict conflict policy. Existing files become `.scaffold` siblings; `context/` is preserved."
  - label: "Abort"
    description: "Stop the skill. No files written, no scaffold attempted."
  multiSelect: false

The recommended default is "Continue" because the most common path here is a user who legitimately re-runs bootstrapper after fixing a tech-stack pick (e.g., re-ran `/tech-stack-selector` to swap the starter). The conflict policy itself is the safety net — abort is the escape hatch for genuinely unexpected cwd state.

**On Continue**: proceed to Step 1.
**On Abort**: stop immediately. No clipboard set. No verification log written.

## (e) `verification.md` already exists — WARN-AND-CONFIRM

**Trigger**: at Step 4, `context/changes/bootstrap-verification/verification.md` already exists from a prior run.

**Print**:

```
A prior verification log exists at `context/changes/bootstrap-verification/verification.md`. Continuing will overwrite it.
```

**Then ask**:

AskUserQuestion:
- question: "Overwrite the existing verification log?"
  header: "Log collision"
  options:
  - label: "Overwrite (Recommended)"
    description: "Replace with this run's log. The prior log is lost unless committed."
  - label: "Save as verification-v2.md"
    description: "Preserve the prior log. New log lands at the next available verification-vN.md slot."
  - label: "Abort"
    description: "Skill exits without writing the log. Scaffold already happened (this guard runs at Step 4); rerun from a clean cwd if you need a fresh log."
  multiSelect: false

The recommended default is "Overwrite" — bootstrapper is a one-shot per project; multiple log versions are usually a sign the user re-ran the whole flow, in which case the prior log is stale.

**Note**: this guard runs in Phase 4. Phase 1 places the policy here for completeness; the actual emit step lands when Phase 4 ships.

## CLI failure (Phase 3) is HARD-STOP, not refusal

When the scaffold CLI exits with non-zero in Step 2, bootstrapper halts but this is a **hard-stop**, not a "refusal" in the protocol sense. The conditions above are pre-scaffold gates; CLI failure is a runtime failure mid-scaffold. The hard-stop:

- Leaves `.bootstrap-scaffold/` in place for inspection.
- Writes a partial `verification.md` marking `phase_3_status: failed` with the captured CLI output.
- Sets the clipboard to `/bootstrapper` for retry.

Detail in `scaffold-merge.md` (Phase 3).

## Why these are the only refusals

The skill deliberately runs WARN-AND-CONTINUE on every other surface:

- Stale starter (pre-scaffold verification): warn, scaffold proceeds.
- CRITICAL audit findings: warn, scaffold proceeds (the user, not bootstrapper, decides what to do about vulnerabilities in their freshly-scaffolded project).
- Audit tool unavailable for this language family (`java`, `php`, `dart`, `multi`): log a "no built-in audit" note, scaffold proceeds.

The principle: refuse only when bootstrapper genuinely cannot do its job (no hand-off, unknown stack, no cwd). Once the prerequisites are met, bootstrapper informs and leaves judgment to the user.
