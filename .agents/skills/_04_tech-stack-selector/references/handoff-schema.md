# Hand-off schema

`context/foundation/tech-stack.md` is the file `/tech-stack-selector` writes and `/bootstrapper` reads. This doc is the contract for its shape. Both skills load this file by relative path; renames or restructurings here are load-bearing.

Two contracts live in this doc:

1. **Frontmatter** — 4 required top-level keys (`starter_id`, `package_manager`, `project_name`, `hints`) plus a fixed `hints` subfield set.
2. **Body** — exactly one `## Why this stack` heading with one paragraph (≤ 200 words). Nothing else.

The schema is **language-agnostic**. `package_manager` is an open string drawn from whatever the chosen starter's `toolchain.package_manager` field prescribes. `hints.deployment_target` is starter-prescribed (whatever appears in the card's `deployment_defaults` array).

Rich rationale stays in conversation. The body paragraph is a one-paragraph summary — bootstrapper does not parse it, it exists for human readers (the user, future maintainers, code reviewers) who open the file later and want the why.

# Frontmatter fields

```yaml
---
starter_id: <string>            # required; key from references/starter-registry.yaml
package_manager: <string>       # optional; open string per chosen card; may be omitted entirely
project_name: <string>          # required; kebab-case
hints:                          # required object; subfields below
  language_family: <enum>
  team_size: <enum>
  deployment_target: <string>
  ci_provider: <enum>
  ci_default_flow: <enum>
  bootstrapper_confidence: <enum>
  path_taken: <enum>
  quality_override: <bool>
  self_check_answers: <object | null>
  has_auth: <bool>
  has_payments: <bool>
  has_realtime: <bool>
  has_ai: <bool>
  has_background_jobs: <bool>
---
```

## Required top-level keys

### `starter_id` (string, required)

The key from `references/starter-registry.yaml` `starters:` map. The validator (`scripts/validate-starter-registry-sync.mjs`) ensures bootstrapper only references keys present in this registry; tech-stack-selector is the source of truth.

Examples: `astro-starter`, `next`, `t3`, `fastapi`, `django`, `rails`, `spring`, `laravel`, `go`, `rust`, `expo`, `flutter`, `dotnet`.

### `package_manager` (string, optional — may be omitted)

Open string. Whatever the chosen starter's `toolchain.package_manager` prescribes. Common values include:

- JS family: `npm`, `pnpm`, `yarn`, `bun`
- Python: `uv`, `poetry`, `pip`
- Ruby: `bundle`
- Java: `gradle`, `maven`
- Rust: `cargo`
- Go: `go-modules` (or omit entirely — Go has no external choice)
- PHP: `composer`
- .NET: `dotnet`, `nuget`
- Dart: `pub`

The field MAY be omitted from frontmatter for ecosystems where there's no external choice — Go is the canonical example. When omitted, bootstrapper uses the chosen card's default tooling without prompting.

Do NOT add ecosystem-incompatible values here. The value must match the chosen starter's `toolchain.package_manager`. If the starter card prescribes `npm` and the user wanted `pnpm`, the override happens in conversation rationale (not in this field) — the file always reflects the card's prescribed value, since bootstrapper uses this field to invoke the right CLI.

### `project_name` (string, required)

Kebab-case. Drawn from PRD's `project` field unless the user overrode it during the project-name confirmation step. This is the directory name `/bootstrapper` will scaffold.

### `hints` (object, required)

Subfields below. The set is intentionally minimal — only fields bootstrapper consumes today. New subfields require a schema bump (this doc) and updates to both this skill's writer and bootstrapper's reader.

## Permitted `hints` subfields

### `language_family`

Enum: `js | python | ruby | java | go | rust | php | dotnet | dart | multi`

Drawn from Q0 of the residual interview. (PRD frontmatter does not carry tech_preferences, so `language_family` is typically Q0-derived.) `multi` is reserved for genuinely polyglot starters (e.g., a project that ships a Rust binary plus a JS web client); it should not be used for "I'm not sure".

### `team_size`

Enum: `solo | small | mixed`

`solo` = 1 person; `small` = 2–5; `mixed` = junior + senior together (the "mixed-experience" option in Q2).

Standard path skips Q2; in that case, default to `solo` (the recommended-default registry is itself optimized for solo, so this is the right baseline when no answer was gathered).

### `deployment_target`

Open string drawn from the chosen starter's `deployment_defaults` array. Bootstrapper consumes this to decide deployment-specific scaffolding (e.g., adding `wrangler.toml` for Cloudflare, a `Dockerfile` for self-host, `fly.toml` for Fly).

If the user picked "I don't know yet" at Q4, this lands as the card's first `deployment_default` value (NOT the literal string `unspecified`). Bootstrapper does not need to handle a missing or unspecified value.

Common values: `cloudflare-pages`, `cloudflare-workers`, `vercel`, `fly`, `railway`, `render`, `self-host`, `aws-lambda`, `google-cloud-run`, `appstore-via-eas`, `testflight`.

### `ci_provider`

Enum: `github-actions | gitlab-ci | circleci | cloudflare-builds`

Drawn from Q5a. Default `github-actions`.

### `ci_default_flow`

Enum: `auto-deploy-on-merge | manual-promotion`

Drawn from Q5b. Default `auto-deploy-on-merge`.

### `bootstrapper_confidence`

Enum: `verified | first-class | best-effort`

Copied verbatim from the chosen card's `bootstrapper_confidence` field. Bootstrapper consumes this to decide how aggressive to be with automatic scaffolding vs. how many manual steps to surface.

Semantics:

- `verified` — bootstrapper has been run end-to-end on this starter; safe for full automation.
- `first-class` — registered with a valid CLI but not battle-tested; expect occasional hiccups.
- `best-effort` — limited support; manual steps likely; bootstrapper surfaces the friction explicitly.

### `path_taken`

Enum: `standard | custom`

Records which Q0 branch the user chose. `standard` means the recommended-defaults pick was accepted; `custom` means the user walked the full residual interview.

### `quality_override`

Bool. `true` only when the user proceeded with a starter that failed ≥1 of the four agent-friendly quality gates (typed / convention-based / popular_in_training / well_documented), against the skill's Socratic challenge. `false` otherwise.

`true` is informational, not blocking — bootstrapper uses it to know whether to add ecosystem-specific compensation in the generated instruction file (`AGENTS.md` / `CLAUDE.md`, per `references/agent-friendly-criteria.md` § Compensation path).

### `self_check_answers`

Object or `null`.

When `path_taken: custom`, this is an object with 5 boolean keys recording the user's answer to each statement of the Q8 self-check (see `references/residual-interview.md`):

```yaml
self_check_answers:
  typed: <bool>
  from_official_starter: <bool>
  conventions: <bool>
  docs_current: <bool>
  can_judge_agent: <bool>
```

When `path_taken: standard`, this is `null` (the standard path is itself the safer choice — no self-check is asked).

### Feature flags (`has_*`)

Five booleans drawn from Q1 (custom path) or detected from PRD FRs (standard path):

- `has_auth` — auth/login/OAuth/JWT in scope.
- `has_payments` — payments/checkout/subscription in scope.
- `has_realtime` — websockets/live-update/presence in scope.
- `has_ai` — LLM/embedding/AI features in scope.
- `has_background_jobs` — queues/cron/scheduled work in scope.

The set is intentionally fixed. Free-text features the user names beyond these five do NOT add new keys; they are surfaced in conversation rationale only. Adding a new `has_*` key requires a schema bump (this doc) and writer/reader updates.

# Body convention

Exactly one heading: `## Why this stack`.

One paragraph, ≤ 200 words, summarizing how PRD priors + residual answers led to the chosen starter. Cite 2–3 load-bearing factors (e.g., "solo + short timeline + has_auth → battle-tested + popular community → Astro+Supabase+Cloudflare wins on agent-friendly + bootstrapper-verified"). No bulleted lists, no subsections, no code blocks — bootstrapper does not parse this paragraph; it exists for human readers.

Rich rationale (alternatives considered, Socratic moments, quality gate analysis) stays in the conversation transcript only. The file is intentionally lean.

# Example (minimal but valid)

```yaml
---
starter_id: astro-starter
package_manager: npm
project_name: recipe-fridge
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

A solo learner shipping a recipe-matching MVP in 1 week with auth and an LLM
suggestion step needs a battle-tested, agent-friendly starter that handles
auth + database + edge deploy out of the box. Astro+Supabase+Cloudflare is the
recommended default for `(web, js)` and clears all four agent-friendly gates;
its bootstrapper confidence is verified, so scaffolding will be smooth. Auth
and AI feature flags are set; payments and realtime are out of scope per PRD
non-goals. CI runs on GitHub Actions with auto-deploy-on-merge — what the
starter ships with.
```

# Example (custom path with overrides)

```yaml
---
starter_id: fastapi
package_manager: uv
project_name: ingest-api
hints:
  language_family: python
  team_size: small
  deployment_target: fly
  ci_provider: github-actions
  ci_default_flow: manual-promotion
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
---

## Why this stack

Small Python team building an ingest API with background jobs. Custom path
because the team has Python expertise and rejected the JS recommended default
at Q0. FastAPI clears all four agent-friendly gates (the per-language-family
caveat applies — popular within Python training data). Fly is the deployment
default in the FastAPI card; manual promotion picked because the team gates
ingest changes through staging. Self-check came back clean across all five
points, so no Socratic nudge fired.
```

# Example (Go, omitted package_manager)

```yaml
---
starter_id: go
project_name: edge-router
hints:
  language_family: go
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo developer building a small edge router in Go. Standard path — `go` is the
recommended default for `(api, go)`. Go modules are part of the toolchain, so
package_manager is omitted from frontmatter (no external choice to record).
Deployment defaults to self-host per the Go card; CI on GitHub Actions with
auto-deploy is the starter's standard shape.
```
