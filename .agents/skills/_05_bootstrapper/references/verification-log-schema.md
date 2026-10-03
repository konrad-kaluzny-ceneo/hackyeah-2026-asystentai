# Verification log schema

The shape of `context/changes/bootstrap-verification/verification.md`. Bootstrapper writes one of these per run, at Step 4, after Step 3's audit dispatch (or on HARD-STOP at Step 2 with a partial body). The file is human-readable; no other skill consumes it programmatically in v1, but pinning the shape now keeps it stable for future readers and any future tooling that wants to summarize bootstrap runs.

## File path

```
context/changes/bootstrap-verification/verification.md
```

The folder name (`bootstrap-verification`) deliberately does not start with a date prefix or carry a `change.md`. Bootstrap runs are one-shot artifacts, not tracked workflow changes — the folder hosts the log and nothing else. If the folder does not exist, bootstrapper creates it. If `verification.md` already exists, bootstrapper applies the WARN-AND-CONFIRM guard from `refusal-protocol.md` § (e) before overwriting.

## Frontmatter

YAML frontmatter at the top of the file:

```yaml
---
bootstrapped_at: <ISO 8601 timestamp, e.g. 2026-05-04T14:23:11Z>
starter_id: <starter_id from hand-off>
starter_name: <human-readable name from the registry card>
project_name: <project_name from hand-off>
language_family: <hints.language_family from hand-off>
package_manager: <resolved package manager — hand-off value or card fallback>
cwd_strategy: <subdir-then-move | native-cwd | git-clone>
bootstrapper_confidence: <verified | first-class | best-effort>
phase_3_status: <ok | failed>
audit_command: <the resolved command from audit_commands, or "null" for skip>
---
```

`phase_3_status: failed` flags the partial-log case (CLI failure HARD-STOP). `phase_3_status: ok` is the normal case. The audit slot has its own success/skip/failure surfacing in the body — `phase_3_status` is exclusively about the scaffold step.

## Body sections

In this exact order:

### `## Hand-off`

Verbatim copy of the hand-off frontmatter from `context/foundation/tech-stack.md`, plus the `## Why this stack` paragraph from the hand-off body. No editorializing — this section exists so the log is self-contained and a future reader does not need to chase the hand-off file.

### `## Pre-scaffold verification`

Findings from Step 1. Table format:

```
| Signal             | Value                              | Severity | Notes                              |
| ------------------ | ---------------------------------- | -------- | ---------------------------------- |
| npm package        | <pkg> v<X.Y.Z> published <date>    | fresh    | resolved from cmd_template         |
| GitHub repo        | <repo> last pushed <date>          | fresh    | from card.docs_url                 |
```

If a check did not run (network failure, no `docs_url`, non-JS starter), include the row with `Value: not run` and the reason in `Notes`. If both checks ran and surfaced nothing concerning, the table still appears in full — the log is the audit trail, not just an exception report.

### `## Scaffold log`

Records of what Step 2 actually did:

```
**Resolved invocation**: `<the cmd_template after substitution>`
**Strategy**: <subdir-then-move | native-cwd | git-clone>
**Exit code**: <0 | non-zero>
**Files moved**: <count>
**Conflicts (.scaffold siblings)**: <comma list, or "none">
**.gitignore handling**: <append-merged | moved silently | absent in scaffold | absent in cwd>
**.bootstrap-scaffold cleanup**: <deleted | left in place (failure)>
```

For `native-cwd`:

```
**Resolved invocation**: `<the cmd_template after substitution>`
**Strategy**: native-cwd
**Exit code**: <0 | non-zero>
**Pre-flight files-to-touch**: <comma list, or "could not enumerate">
**Files written by CLI**: <count>
**Pre-existing files preserved**: <comma list, or "none">
```

For HARD-STOP (`phase_3_status: failed`):

```
**Resolved invocation**: `<the cmd_template after substitution>`
**Strategy**: <strategy>
**Exit code**: <non-zero>
**Stderr (last 20 lines)**:

```
<captured stderr>
```

**.bootstrap-scaffold left in place at**: `.bootstrap-scaffold/`
```

### `## Post-scaffold audit`

Findings from Step 3. Three sub-shapes depending on outcome.

**Audit ran successfully**:

```
**Tool**: <audit_command>
**Summary**: <C> CRITICAL, <H> HIGH, <M> MODERATE, <L> LOW
**Direct vs transitive**: <Cd>/<Hd>/<Md>/<Ld> direct of total <C>/<H>/<M>/<L> (where the tool supports the distinction; "not distinguished by this tool" otherwise)

#### CRITICAL findings

<one block per finding: package name, version, advisory id, brief description, fix version if known>

#### HIGH findings

<same shape as CRITICAL>

#### MODERATE findings

<same>

#### LOW / INFO findings

<same>
```

**Audit skipped (null command)**:

```
**Tool**: skipped — no built-in audit tool for <language_family>
**Recommended external tool**: <ecosystem-specific recommendation per post-scaffold-verification.md>
```

**Audit failed to run**:

```
**Tool**: <audit_command>
**Status**: failed to run
**Reason**: <captured error>
**Partial output (if any)**:

```
<captured stdout/stderr>
```
```

For the HARD-STOP case (`phase_3_status: failed`), this whole section is replaced by:

```
**Audit not run**: scaffold halted at Step 2; no project to audit.
```

### `## Hints recorded but not acted on`

Lists every hint from the hand-off frontmatter that bootstrapper read but did not act on in v1. From `handoff-consumer.md`'s "surfaces but does not act on" list: `bootstrapper_confidence`, `quality_override`, `path_taken`, `self_check_answers`, `team_size`, `deployment_target`, `ci_provider`, `ci_default_flow`, all `has_*` flags. Each row names the field and the value:

```
| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | guided                             |
| ...                        | ...                                |
```

This section is the audit trail completeness contract: a future M1L4 skill (or human reader) can see exactly which hints were carried forward into v1's run without bootstrapper acting on them. It is also where `quality_override: true` and `bootstrapper_confidence: best-effort` surface for the user — v1 surfaces but does not compensate.

### `## Next steps`

The v1 placeholder pointer text:

```
Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
```

When the M1L4 skill ships, bootstrapper updates this paragraph in place to point at it.

## Failure-mode log shape

If bootstrapper itself errors out before Step 4 (e.g., parsing the hand-off fails, registry lookup fails), no log is written — those refusal paths print to chat and exit. The log exists to record runs that got far enough to attempt scaffolding.

If Step 2 HARD-STOPs, Step 4 still writes the log (with `phase_3_status: failed` and the truncated audit section above). That is the partial-log case.

If Step 4 itself fails to write (filesystem error, permission denied), bootstrapper falls back to printing the would-be log content into chat with a header line:

```
Verification log could not be written to disk (<reason>). Full log content below; copy it manually before clearing the conversation.
```

## What this schema does NOT specify

- **Versioning**. v1 has no schema-version field. Future schema changes either add fields (no version bump needed; readers tolerate extras) or break the contract (in which case a v2 marker lands here).
- **Machine-readable interchange format**. The log is markdown for human consumption. No JSON sidecar. If a future skill needs the data structured, it parses the markdown — the section headings above are stable enough to support that.
- **Cross-run history**. One file per run. Re-runs overwrite (or land at `verification-v2.md` per the `refusal-protocol.md` § (e) escape hatch). Bootstrapper does not maintain a chronological log across multiple bootstraps in the same cwd.
