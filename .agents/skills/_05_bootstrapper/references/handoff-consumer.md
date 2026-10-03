# Hand-off consumer

Bootstrapper reads `context/foundation/tech-stack.md` (written by `/tech-stack-selector`) at Step 0. This doc names which keys bootstrapper consumes (and how), which it surfaces back to the user, and which it logs to `verification.md` without acting on in v1.

## Contract source

The authoritative schema for `context/foundation/tech-stack.md` lives in tech-stack-selector's reference set:

- `../../_04_tech-stack-selector/references/handoff-schema.md`

That doc is the single source of truth — frontmatter keys, value enums, body convention. This consumer doc does **not** duplicate the schema; it only describes how bootstrapper interacts with each field.

When bootstrapper reads the hand-off, it expects the contract there to hold. If the file on disk diverges from the schema (extra unknown keys, missing required keys), bootstrapper surfaces a single warning naming the divergence and falls back to defaults where possible — but it does not refuse for schema drift alone. Schema drift is the writer's bug; refusal happens only for missing files or registry-drift (`starter_id` not in registry).

## Required fields bootstrapper consumes

Bootstrapper reads four top-level keys from frontmatter and dispatches actions on them:

### `starter_id` — registry lookup

Used to look up the chosen card in `../../_04_tech-stack-selector/references/starter-registry.yaml` under the `starters:` map. The card supplies:

- `cmd_template` — the CLI invocation, with `{name}` and `{pm}` placeholders.
- `language_family` — drives the audit-command lookup at Step 3.
- `bootstrapper_confidence` — surfaced to the user as informational; logged in `verification.md`.
- `toolchain.package_manager` — fallback for `{pm}` substitution when the hand-off omits `package_manager`.
- `deployment_defaults` — surfaced for context; not consumed for action in v1.

If the `starter_id` is absent from the registry, run the registry-drift refusal from `refusal-protocol.md`. In chain-mode this is unreachable (tech-stack-selector refuses to write a hand-off it cannot resolve); the check is defensive against hand-edited hand-offs.

### `package_manager` — `{pm}` substitution

Substituted into the chosen card's `cmd_template` wherever `{pm}` appears. Open string per the schema (`npm`, `uv`, `poetry`, `bundle`, `gradle`, `cargo`, `go-modules`, `composer`, `dotnet`, etc.).

When omitted from frontmatter (legitimate for ecosystems with no external choice — Go is the canonical example), fall back to the chosen card's `toolchain.package_manager`. The card always carries the field, so there is always a fallback. Do NOT enum-validate the value — the contract is open.

If `cmd_template` does not contain `{pm}` at all (e.g., `cargo new {name} --bin --edition 2024`), ignore the `package_manager` field entirely.

### `project_name` — `{name}` substitution

Substituted into `cmd_template` for `{name}`. The substitution rule depends on the chosen `cwd_strategy` (see `scaffold-merge.md`):

- `subdir-then-move` and `git-clone` strategies: `{name}` becomes `.bootstrap-scaffold` (the temp directory the CLI scaffolds into; bootstrapper moves files up afterward).
- `native-cwd` strategy: `{name}` becomes `.` (the CLI scaffolds directly into cwd).

The `project_name` itself is preserved in the verification log (and, by virtue of being in the hand-off frontmatter, in any commit the user later makes), but it is NOT used as the actual scaffold directory name in v1 — the scaffold-into-cwd convention means the directory name is the user's choice when they `cd` into the eventual project location.

### `hints.language_family` — audit-command dispatch

Indexes into `bootstrapper-config.yaml` `audit_commands` map at Step 3 to pick the per-language audit invocation (`npm audit --json`, `pip-audit`, `cargo audit`, etc.). Values that map to `null` (currently `java`, `php`, `dart`, `multi`) skip the post-scaffold audit and write a "no built-in audit tool for this ecosystem" line to the verification log.

## Hints bootstrapper surfaces but does not act on in v1

These hint subfields are read into bootstrapper's working memory and copied verbatim into the `verification.md` audit-trail section. They influence conversation surfacing (heads-up messages, summary lines) but no automated decision in v1:

- `bootstrapper_confidence` (`verified | first-class | best-effort`) — surfaced inline at Step 0 ("Confidence: best-effort"); a `best-effort` value adds a one-line heads-up that scaffolding may need manual touch-up. No automated compensation in v1 (compensation lives in the future M1L4 skill).
- `quality_override` (`bool`) — when `true`, surfaced as a heads-up ("You proceeded past a quality gate during stack selection — note that scaffolding will not compensate for the gap in v1"). No automated action.
- `path_taken` (`standard | custom`) — informational; logged.
- `self_check_answers` (`object | null`) — logged in full to `verification.md`. No automated action.
- `team_size`, `deployment_target`, `ci_provider`, `ci_default_flow` — logged. No CI/CD scaffolding in v1.
- `has_auth`, `has_payments`, `has_realtime`, `has_ai`, `has_background_jobs` — logged. The Step 0 confirm-or-correct summary lists which feature flags are `true`, but bootstrapper does not modify the scaffold based on them in v1.

These fields are deliberately collected at hand-off time so the future M1L4 skill (or a later v2 of bootstrapper) can act on them without a schema bump. v1's responsibility is to preserve the audit trail.

## Hand-off body

The hand-off carries exactly one body section: `## Why this stack` (one paragraph, ≤ 200 words). Bootstrapper does not parse this paragraph. It is copied verbatim into the `## Hand-off` section of `verification.md` so the audit trail is complete; humans reading the log later can see the rationale alongside the scaffold log.

If the body section is missing or empty, bootstrapper logs a one-line warning ("hand-off body absent") in the verification log but does not refuse — the body is human-facing context, not a machine contract.
