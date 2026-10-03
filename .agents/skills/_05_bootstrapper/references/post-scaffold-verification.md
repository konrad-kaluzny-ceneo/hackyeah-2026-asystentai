# Post-scaffold verification (Step 3)

The deep verification slot. Runs after a successful scaffold, before the verification log is written. Educational, not gating: even CRITICAL findings WARN-AND-CONTINUE — bootstrapper informs, the user decides.

## Slot purpose

Once dependencies are installed, run the ecosystem's audit tool against the scaffolded tree. Surface the count and severity in conversation. Stage the full breakdown into the verification log. The cohort outcome this serves: learners see, on day one of a fresh project, what kind of advisory state their dependency tree is shipping with — and learn the difference between direct and transitive findings.

The slot is dispatched by `hints.language_family` against the `audit_commands` table in `bootstrapper-config.yaml`. A `null` value means the ecosystem has no built-in audit tool worth invoking; the slot logs that fact and skips.

## Per-ecosystem invocation

Look up the command from `audit_commands[<hints.language_family>]` and run it from cwd (or from the appropriate dependency-install directory if the scaffold structured the project that way — most JS scaffolds install into cwd's `node_modules`).

### `js` — `npm audit --json`

```bash
npm audit --json
```

Run from the directory holding `package.json` (cwd in the common case). Output is a JSON document. Parse the top-level `metadata.vulnerabilities` object for the per-severity counts (`info`, `low`, `moderate`, `high`, `critical`) and the `metadata.dependencies.direct` count (used for the direct-vs-transitive context). The advisory list lives under `vulnerabilities.<package>` — each entry carries `severity`, `via` (direct cause chain), and `effects` (downstream packages affected).

`npm audit` exits non-zero when vulnerabilities exist; bootstrapper does NOT treat that as a halt. Capture the exit code and the full JSON for the log; carry on.

### `python` — `pip-audit`

```bash
pip-audit --format json
```

Run from cwd (assumes the project's virtualenv or system Python is on `PATH`; if `pip-audit` is not installed, the network call fails and the failure-mode block kicks in). Output is a JSON list of advisory entries; each carries `name`, `version`, `id`, `description`, `fix_versions`. `pip-audit` does not pre-compute severity tiers — bootstrapper maps CVE severity from the advisory body where present, otherwise tiers as MODERATE.

### `ruby` — `bundle audit check`

```bash
bundle audit check --update
```

Output is human-readable. Parse line-by-line for advisories. No native JSON mode in stable releases; bootstrapper surfaces the raw output in the log and reports the count from line scraping.

### `rust` — `cargo audit`

```bash
cargo audit --json
```

Output is a JSON document with a `vulnerabilities.list` array. Each entry carries an `advisory` block with `severity` and a `package` block with `name` and `version`.

### `go` — `govulncheck`

```bash
govulncheck -json ./...
```

Output is a stream of JSON objects (one per line). Bootstrapper aggregates by severity. `govulncheck` flags only vulnerabilities that are actually called from the project code (not just present in the module graph), which makes its findings more actionable than a pure dependency-tree audit.

### `dotnet` — `dotnet list package --vulnerable`

```bash
dotnet list package --vulnerable --include-transitive
```

Output is human-readable. Parse for "Severity" markers per package. The `--include-transitive` flag is intentional: post-scaffold context, transitive findings are often the only findings.

### `java`, `php`, `dart`, `multi` — null

No built-in audit tool ships with the language toolchain. Bootstrapper logs:

```
Skipped: no built-in audit tool for <language_family>. Recommended next step: configure <ecosystem-specific external tool> separately.
```

For `java`: mention OWASP Dependency-Check or Snyk as common external choices. For `php`: mention Roave's `security-advisories` Composer plugin or local-php-security-checker. For `dart`: mention `dart pub outdated --mode=null-safety` as the closest stand-in. For `multi`: skip silently with the bare "no single audit tool covers this multi-language stack" line.

The skip is stored in the verification record as a structured note, not as a fake "0 findings" record.

## Severity tiering

Findings tier into four buckets:

- **CRITICAL** — surface inline in chat
- **HIGH** — surface inline in chat
- **MODERATE** — log only
- **LOW** / **INFO** — log only

Tiering rules:

- For tools with native severity (npm-audit, cargo-audit, dotnet, govulncheck), use the tool's label.
- For tools without native severity (pip-audit's plain advisories, bundle audit, ruby gems advisories without CVSS), default to MODERATE unless the advisory text explicitly names CRITICAL or HIGH.
- For tools where severity comes from CVSS scores (>= 9.0 → CRITICAL, 7.0–8.9 → HIGH, 4.0–6.9 → MODERATE, < 4.0 → LOW), apply the standard CVSS-to-tier mapping.

The principle: tiering is an editorial filter on conversation surface, not a gate on the scaffold. The full unfiltered list lands in the log.

## Direct vs transitive

When the audit tool distinguishes direct from transitive dependencies (npm-audit's `metadata.dependencies.direct` + the `via` chain on each advisory; cargo-audit's `dependency.tree.path`), surface a direct-vs-transitive breakdown in the chat summary. For tools without that distinction, surface the count without the breakdown.

This matters because direct findings are immediately actionable (the user can update or replace the package they explicitly chose) while transitive findings are advisory until the upstream maintainer ships a fix. Conflating the two creates alert fatigue on day one of a new project.

## Output format

One summary line in conversation. The educational framing rule: every output line names a number AND a category — never just "X advisories". Format:

```
Audit: <C> CRITICAL, <H> HIGH, <M> MODERATE, <L> LOW. Direct: <Cd> CRITICAL, <Hd> HIGH. See verification.md for details.
```

If the audit was skipped (null command):

```
Audit: skipped — no built-in audit tool for <language_family>. See verification.md for the recommended external tool.
```

If the audit ran but found nothing:

```
Audit: 0 findings across CRITICAL, HIGH, MODERATE, and LOW. Clean tree.
```

If the audit failed to run (tool not installed, network error):

```
Audit: failed to run (<reason>). Findings unavailable. See verification.md.
```

## Failure mode

WARN-AND-CONTINUE on every branch:

- Tool not installed (pip-audit absent, govulncheck absent, etc.) → log "audit tool unavailable", proceed.
- Network failure mid-audit → log the partial output and the error, proceed.
- Parsing failure on the tool's output → log the raw output, surface "audit ran but output could not be parsed", proceed.
- CRITICAL findings present → surface, do not halt.

The principle, again: bootstrapper informs. The user decides what to do about findings — patch, ignore, defer, replace the starter. None of those decisions belong inside the bootstrap chain.

## What this slot does NOT do

- Does not modify the scaffolded project. No `npm audit fix`, no `pip install --upgrade`, no auto-patch. Suggesting such actions in chat is fine; running them is out of scope.
- Does not check the user's local toolchain version (Node, Python, Rust). Toolchain mismatches surface either as scaffold-time CLI errors (HARD-STOP at Step 2) or as audit-time "tool unavailable" notes here.
- Does not write the verification log. That is Step 4. This slot only stages findings into the in-memory record.
- Does not generate `AGENTS.md` / `CLAUDE.md` based on findings. The cohort scenario where audit findings shape agent context belongs to the future M1L4 skill.
