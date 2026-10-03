# Residual Interview

The interview has a **Q0 path-fork** at the top, then a small set of residual questions that vary by the path the user picked. Standard path is short (Q0 + Q4 + Q5 + project-name confirmation). Custom path is long (Q0 + Q1–Q6 + conditional Q7 + Q8 self-check).

This file is loaded by `SKILL.md` Step 2. Each Q section names: trigger condition, recommended option set with one-line strength/tradeoff per option, default (if a conditional skip applies), and which path(s) the question runs on.

The interview reads PRD priors loaded in SKILL.md Step 1. It does not re-ask anything PRD frontmatter already carries (`product_type`, `target_scale`, `timeline_budget`).

---

## Q0 — Path-fork (NEW; always asked)

**Trigger**: always, immediately after PRD priors are confirmed.

**Pre-step — derive `language_family`**:

1. If PRD body has a `## Forward: tech-stack` block (carried forward from `/shape`) and that block names a language preference, use it.
2. Else if the user explicitly said a language family in conversation context, use it.
3. Else ask once before resolving the path-fork:

   Ask the user: "Which language family is this project targeting?" with these options:
   - "JavaScript / TypeScript (Recommended for web/SaaS)" — Node, React/Vue/Astro, etc. Default for web product types.
   - "Python" — Django, FastAPI, Flask. Strong for APIs, data, ML.
   - "Other (Ruby / Java / Go / Rust / PHP / .NET / Dart)" — I'll surface the specific options for the picked family.

   The "Other" branch routes to a follow-up that lists the remaining 7 families one-shot.

**Resolve recommendation**:

Read `references/starter-registry.yaml` `recommended_defaults` map. Look up `recommended_defaults[product_type][language_family]`.

- If a `starter_id` resolves: load that card. Capture its `name`, a one-line `fit` synthesis, and `bootstrapper_confidence` for use in the Q0 prompt.
- If the cell shows `<none>`: skip Q0 entirely. Print a single-line note ("No vetted recommended default exists for `<product_type>` + `<language_family>`; we'll walk the full residual interview.") and proceed straight to Q1.

**Q0 prompt** (only fires if a recommended starter was found):

Ask the user: "For a `<product_type>` in `<language_family>`, the recommended starter is `<starter_name>` (`<starter_id>`) — `<one-line fit>`. Bootstrapper confidence: `<value>`. Take it, or design your own?" with these options:
- "Take recommended `<starter_id>` (Recommended)" — Use the recommendation as-is. We'll just confirm deployment, CI/CD, and project name before writing the hand-off.
- "Design my own" — Walk through feature audit, team profile, technology preferences, deployment, CI/CD, framework variant, and a final five-point self-check.

The **default-recommended** label is editorial: name the starter up front so the user accepts the recommendation consciously, never silently.

**Routing**:

- "Take recommended" → set `hints.path_taken: standard`. Skip to Q4.
- "Design my own" → set `hints.path_taken: custom`. Proceed to Q1.

---

## Q1 — Feature audit (custom path only; always asked on custom)

**Trigger**: custom path only. Standard path inherits the recommended starter's defaults, with one Socratic surface if PRD FRs name a feature the recommended starter doesn't carry (handled at Step 3, not in the interview).

**Pre-step — scan PRD FRs**: detect technology-forcing features by keyword:

- `auth` / `login` / `sign in` / `OAuth` / `JWT` → `has_auth`
- `payment` / `checkout` / `subscription` / `Stripe` → `has_payments`
- `realtime` / `websocket` / `live update` / `presence` → `has_realtime`
- `LLM` / `AI` / `embedding` / `OpenAI` / `Anthropic` → `has_ai`
- `background job` / `queue` / `cron` / `scheduled` → `has_background_jobs`

**Q1 prompt**:

Ask the user: "Which technology-forcing features are in scope for the MVP? Detected from PRD FRs: `<list>`. Confirm or correct." with these options: one option per detected feature; plus "None of the above" plus "I have one not on this list". This question is multi-select.

Each picked feature lands as a `true` flag in `hints.has_*`. Anything explicitly unpicked lands as `false`.

If the user added a feature not on the list (free-text), capture it and add a Socratic note in conversation: "`<feature>` may force a specific framework or service — we'll surface candidates that support it during decision-making." Do NOT add new `hints` keys for free-text features; the schema's `has_*` set is fixed.

---

## Q2 — Team profile (custom path only; always asked on custom)

**Trigger**: custom path only. Standard path skips (the recommended default is already weighted toward solo / small team).

**Q2 prompt**:

Ask the user: "Who is going to build this?" with these options:
- "Just me, solo (Recommended for first-time users)" — Drives weighting toward battle-tested + popular community + agent-friendly.
- "Small team (2–5 people)" — Slightly relaxes the agent-friendly bar; adds 'good docs' priority.
- "Mixed-experience team" — Junior + senior together; agent-friendly + convention-based weighting goes UP, niche frameworks go DOWN.

Maps to `hints.team_size`: `solo | small | mixed`.

---

## Q3 — Tech preferences (custom path only; always asked on custom)

**Trigger**: custom path only. Standard path skips (language_family is already inferred at Q0; no soft preferences are gathered for the standard pick).

**Q3a prompt** (soft preferences):

Ask the user: "Any soft preferences on the stack? (e.g., 'prefer Postgres over MongoDB', 'must be TypeScript', 'stick to mainstream React'). One round, multi-select." with these options:
- "TypeScript over plain JS" — Will exclude untyped JS starters.
- "PostgreSQL as the database" — Will weight against MongoDB / DynamoDB / non-Postgres defaults.
- "Mainstream over niche" — Will surface popular options first in alternatives.
- "No soft preferences — surprise me" — Let the registry's recommended-default-per-cell win.

This question is multi-select.

Capture as a free-text bag (the schema doesn't carry soft preferences as typed fields; they shape the LLM-over-cards reasoning in Step C of the decision flow).

**Q3b prompt** (avoid list):

Ask the user: "Anything you explicitly want to AVOID on this project? Technology avoids only — scope avoids belong in PRD's ## Non-Goals." with these options:
- "Nothing explicit" — No technology avoids. Recommended unless you've been burned recently.
- "PHP / Laravel" — Excludes Laravel and any PHP-stack alternatives from the candidate set.
- "Monorepo / multi-package" — Excludes Turborepo / Nx defaults; favors single-package starters.
- "I want to add a specific avoid (free-text)" — Capture as a one-line technology avoid; if the registry's lead matches the avoid, we'll surface a check before locking the pick.

This question is multi-select.

If a free-text avoid is given, store it. The decision flow Step A drops candidates matching any avoid.

---

## Q4 — Deployment constraint (always asked, both paths; option set is starter-aware)

**Trigger**: always. The chosen starter's `deployment_defaults` array drives the option set.

**Pre-step — load starter's `deployment_defaults`**:

- Standard path: the recommended starter from Q0.
- Custom path: at this point in the flow Q4 fires AFTER decision Step C produces a lead candidate; if Q4 fires before a lead is decided (e.g., to gather constraint priors), use the most-likely lead from a quick filter pass.

Read the chosen card's `deployment_defaults` array. The first entry is the starter's default deployment target; the rest are stack-compatible alternatives.

**Q4 prompt**:

Ask the user: "Where will this deploy? `<starter_name>` defaults to `<deployment_defaults[0]>`." with these options:
- "`<deployment_defaults[0]>` (Recommended — starter default)" — What the starter ships with. Cheapest path to first deploy.
- "`<deployment_defaults[1]>`" — Stack-compatible alternative.
- "`<deployment_defaults[2]>` or other from the list" — Pick from the remaining alternatives in the starter's deployment_defaults array.
- "I don't know yet — pick the recommended default for me" — We'll lock the starter's first deployment default. Deployment specifics can be revisited once the project is scaffolded.

The "I don't know yet" option is intentional: deployment is a separate concern users may legitimately not have an opinion about at this stage. The default lands as the card's first `deployment_default`, NOT the literal string `unspecified`.

Maps to `hints.deployment_target` (string drawn from the picked option).

The frame's "Cloudflare Pages/Workers default" applies **only** when the chosen card's `deployment_defaults` lists Cloudflare first. For Python/Java/Ruby/Go/Rust/.NET starters, the leading default is typically `fly`, `railway`, `render`, `self-host`, or a cloud-specific target — never silently routed to Cloudflare.

---

## Q5 — CI/CD pipeline shape (always asked, both paths)

**Trigger**: always.

**Q5a prompt** (provider):

Ask the user: "Which CI/CD provider?" with these options:
- "GitHub Actions (Recommended)" — Default for all starters. Covered in M1 lesson trail.
- "GitLab CI" — Pick if the repo lives on GitLab.
- "CircleCI" — Pick if the team standardizes on CircleCI.
- "Cloudflare Builds" — Native if the deployment target is Cloudflare; otherwise typically not the right fit.

Maps to `hints.ci_provider`: `github-actions | gitlab-ci | circleci | cloudflare-builds`.

**Q5b prompt** (default flow):

Ask the user: "Default deployment flow on merge?" with these options:
- "Auto-deploy on merge to main (Recommended)" — PR → checks → merge → deploys. Default for solo + small teams.
- "Manual promotion after merge" — PR → checks → merge → deploy is a separate manual step. Pick when staging gates are required.

Maps to `hints.ci_default_flow`: `auto-deploy-on-merge | manual-promotion`.

---

## Q6 — Framework variant within product_type (custom path only; always asked on custom)

**Trigger**: custom path only. Standard path's recommended starter already settles the framework variant; no need to re-ask.

**Q6 prompt** — **Socratic moment**: present 3–5 candidate starters from the constrained set (post-Step-A filter; before Step B quality gates). Each option carries a one-line fit + the starter's `bootstrapper_confidence`. The skill refuses to compare in vacuum — the user must have answered Q1–Q3 first so the candidate set is constrained.

Ask the user: "For `<product_type>` in `<language_family>` with `<top-2-features-from-Q1>`, here are the candidates the registry surfaces. Which fits your project context best?" with these options: 3–5 options, each formatted as `<starter_name> (`<starter_id>`) — <one-line fit> [confidence: <value>]`.

The user's pick goes into Step C of the decision flow as a hard constraint; alternatives shrink to "consider also" surfaces in conversation.

**Compare-without-context guard**: if the user invokes the skill with a request like "compare React vs Vue vs Svelte" without first locking PRD priors and Q1–Q3 answers, refuse the comparison and walk the user through Q1–Q3 first. The frame is "I want to pick a framework that fits THIS project", not "tell me the difference between React and Vue".

---

## Q7 — Testing runner (CONDITIONAL; both paths if it fires)

**Trigger**: conditional — fires only when the chosen card prescribes ambiguity in its testing toolchain. Examples:

- Astro+React project where Vitest vs Playwright is not obvious from card defaults.
- Python project where pytest vs unittest is genuinely a project-context decision.
- Java project where JUnit vs Spock is the live decision.

The card's `testing_options` field (if present) drives the question. If the field is absent or empty, **skip Q7 entirely** — don't ask a question whose options aren't in the card.

**Q7 prompt**:

Ask the user: "`<starter_name>` supports multiple testing setups. Which fits your project?" with these options: one option per `testing_options` entry, with a one-line tradeoff.

Captured as a free-text bag in conversation rationale. Does NOT land in the hand-off frontmatter today (the schema's `hints` set is intentionally minimal — testing-runner choice is informational and bootstrapper picks it up from conversation context if needed).

---

## Q8 — Self-check (custom path final confirmation; only fires on custom path before write)

**Trigger**: custom path only, immediately before Step 4 (write). Standard path skips Q8 (the recommended path is itself the safer choice — no self-check needed).

**Q8 prompt** — surface five questions in one round (multi-select):

Ask the user: "Before I write the hand-off, walk through this five-point self-check. Mark every statement that applies to your chosen starter:" with these options:
- "I know this stack uses explicit types / schemas (TypeScript, Pydantic, Zod, Java types, Rust types — not duck-typed)" — Maps to self_check_answers.typed.
- "This starts from an official starter or mature template (not a hand-rolled scaffold)" — Maps to self_check_answers.from_official_starter.
- "Folder layout, routing, tests, and config follow conventions a stranger would recognize" — Maps to self_check_answers.conventions.
- "Documentation is current and link-able (the docs site exists and matches the version the starter ships)" — Maps to self_check_answers.docs_current.
- "I can recognize when an AI agent is doing something inconsistent with this stack's practice" — The load-bearing question. Maps to self_check_answers.can_judge_agent.

This question is multi-select.

Map the 5 picks to booleans (`true` if picked, `false` if unpicked) under `hints.self_check_answers`.

**Soft Socratic nudge**: count the `false` answers (i.e., statements the user did NOT mark). If `false` count ≥ 2:

```
Five-point self-check:
  typed:                <true|false>
  from_official_starter:<true|false>
  conventions:          <true|false>
  docs_current:         <true|false>
  can_judge_agent:      <true|false>

You marked <N> of 5 as not-true. The safer path for your profile is
`<recommended_default for (product_type, language_family)>`. You can still
proceed with `<chosen_starter>` — agent-friendly criteria can be patched via
CLAUDE.md / AGENTS.md (see references/agent-friendly-criteria.md § Compensation
path) — but it costs you extra manual setup and ongoing care.
```

Then ask:

Ask the user: "Continue with `<chosen_starter>`, or switch to the recommended default `<recommended_default>`?" with these options:
- "Continue with `<chosen_starter>`" — Lock in the starter you picked. The hand-off will record that you proceeded with a known-friction choice if any agent-friendly criterion was failing.
- "Switch to `<recommended_default>` (Recommended)" — Move to the recommended default. Your deployment and CI/CD answers are kept; we'll just confirm the project name.

The user's answer is honored either way. The 5 self-check booleans land in `hints.self_check_answers` in either case.

If `false` count is 0 or 1: no nudge; proceed to write.

---

## Project-name confirmation (always asked, both paths, just before write)

**Trigger**: always, after Q7 (or Q8 on custom).

Pre-step: kebab-case the PRD's `project` field (e.g., "Recipe Fridge" → `recipe-fridge`).

**Project-name prompt**:

Ask the user: "Project name for the hand-off (will be the directory name `/bootstrapper` scaffolds)?" with these options:
- "`<kebab-cased project>` (Recommended — from PRD)" — Use what's already in PRD.
- "Override with a different name" — Capture a free-text replacement.

Maps to `project_name` in the hand-off frontmatter.

---

## Path summary

| Path     | Questions asked                                                  | Skipped  |
|----------|-------------------------------------------------------------------|----------|
| Standard | Q0 → Q4 → Q5 → project-name confirm                               | Q1–Q3, Q6, Q7 (unless card forces it), Q8 |
| Custom   | Q0 → Q1 → Q2 → Q3 → Q4 → Q5 → Q6 → Q7 (if card forces) → Q8 → project-name confirm | (none) |
