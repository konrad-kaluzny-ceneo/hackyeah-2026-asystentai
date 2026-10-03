# Decision flow

Specifies how the LLM reasons over `references/starter-registry.yaml` cards in BOTH paths (standard short-circuit and custom full-reasoning). Loaded by `SKILL.md` Step 3.

The flow has six steps (Step 0 plus A–E). Standard path runs Step 0 → Step E only; custom path runs Step 0 → A → B → C → D → E.

The output is one lead recommendation + 1–2 alternatives + a one-paragraph rationale + any Socratic moments surfaced in conversation. The decision is `LLM-over-cards` — no scoring matrix, no decision tree, no numeric weights. The cards encode the structure; the LLM does the reasoning.

---

## Step 0 — Resolve path-fork

Read `language_family` from explicit PRD content if present (PRD frontmatter does not carry tech_preferences, so this is typically derived from Q0 of the residual interview at `references/residual-interview.md`).

Look up `recommended_defaults[product_type][language_family]` in `references/starter-registry.yaml`.

- If a `starter_id` resolves AND the user picked "Take recommended" at Q0 → **jump straight to Step E** (the lead is already chosen; no filtering, no scoring).
- If the cell shows `<none>` OR the user picked "Design my own" at Q0 → **proceed to Step A**.

---

## Step A — Filter candidates against PRD priors and residuals

Build the candidate pool from `starters:`. Apply hard filters in this order:

1. **`language_family` partition** — drop candidates whose `language_family` does not match the user's. A Python user does NOT see JS candidates surface, even as alternatives. (The per-language-family popularity caveat in `agent-friendly-criteria.md` is the load-bearing reason — popularity is assessed within the family.)

2. **`product_type` filter** — keep candidates whose `for:` array contains the PRD's `product_type` (or a synonym — e.g., `web-app` matches `full-stack` and `saas`).

3. **Must-have features filter** — drop candidates incompatible with feature flags from Q1 / PRD FRs. Examples:
   - `has_realtime: true` → drop candidates whose `for:` doesn't include serverless/edge or whose deployment_defaults are all CDN-only.
   - `has_background_jobs: true` → favor candidates with batteries-included queue support (Django, Rails) or note the manual setup gap.

4. **Avoid-list filter** — drop candidates matching any tag/family in `tech_preferences.avoid` (Q3b). If the user's lead pick matches the avoid list, surface a Socratic moment (see `### Socratic moments` below).

5. **Deployment-compatibility filter** — drop candidates whose `deployment_defaults` array CANNOT satisfy the user's deployment_constraint at all (e.g., user requires self-host, candidate's deployment_defaults are all Vercel-only). Note: this filter is rare in practice; most candidates support `self-host` as a fallback.

The output of Step A is the **constrained candidate set**. Reasoning from here on uses ONLY this set.

---

## Step B — Apply quality gates

Drop entries failing any of the four `agent_friendly.*` criteria — `typed`, `convention_based`, `popular_in_training`, `well_documented` — assessed per language family per `references/agent-friendly-criteria.md`.

This is a **hard filter**: candidates failing any gate are excluded from the unprompted recommendation set.

If a candidate the user explicitly named in `tech_preferences` (e.g., "I want Express") gets dropped here, surface a **Socratic moment** at Step D rather than silently dropping. The user owns the override; the skill makes the gap legible.

The output of Step B is the **quality-gated candidate set** — the survivors.

---

## Step C — Reason over surviving cards

Read each card in the quality-gated set. Weight against the user's full prior + residual answers:

- `team_profile` (Q2) — solo / small / mixed-experience. Solo and small lean toward battle-tested + popular community + agent-friendly. Mixed-experience leans even harder on `convention_based: true`.
- `tech_preferences` (Q3a) — soft preferences (TypeScript over plain JS, PostgreSQL preference, mainstream over niche). Soft preferences are tiebreakers, not filters.
- `timeline_budget.mvp_weeks` (PRD) — short timelines (≤ 4 weeks) favor batteries-included + verified `bootstrapper_confidence`. Longer timelines tolerate first-class or best-effort stacks.
- `target_scale.users` (PRD) — small / medium → favor easy deploy + low ops; large / enterprise → favor scaling story baked in.
- Feature flags (Q1) — `has_*` booleans should match the candidate's strengths (e.g., `has_payments` favors stacks with mature payment SDK integration; `has_ai` favors edge-deployable for streaming).

The reasoning is narrative, not numeric. The LLM picks the strongest card for the priors+residuals combination, citing 2–3 load-bearing factors. Do NOT compute a score.

---

## Step D — Surface alternatives

The lead recommendation is the strongest card from Step C. The alternatives are drawn from the lead card's `alternatives_to_consider` array (typically 1–2 entries), trimmed to the top 1–2 by relevance to the user's priors.

If a Socratic moment fires during this step (the user named a failing starter at Q3, or PRD FRs name a feature the lead doesn't include, or the lead has `bootstrapper_confidence: best-effort` AND user is solo) — surface it BEFORE moving to Step E. See `### Socratic moments` below.

---

## Step E — Surface bootstrapper confidence

For the lead recommendation (both paths — standard and custom), state the `bootstrapper_confidence` value in conversation **always**. Never silently elide.

Wording per value:

- **`verified`**: "Bootstrapper has been run end-to-end on this stack — scaffolding will be smooth."
- **`first-class`**: "Bootstrapper has this stack registered with a valid CLI but hasn't been battle-tested. Expect mostly-smooth scaffolding with occasional manual steps."
- **`best-effort`**: "Bootstrapper has limited support for this stack — manual steps are likely; expect friction. We'll surface the rough spots as you go."

This is the heads-up the user needs before running `/bootstrapper`. It also lands in `hints.bootstrapper_confidence` so bootstrapper itself can adjust its scaffolding behavior.

---

## Socratic moments

The decision flow surfaces Socratic challenges at four points. Each is a one-question prompt to the user with the failing position framed as a real choice (not a gotcha). The user's answer is honored either way; quality-override booleans are recorded.

### 1. Q6 framework variant (custom path only)

When custom-path Step C produces 3–5 candidates after filtering, fire Q6 in the residual interview (`references/residual-interview.md`). Surface them with one-line fits + `bootstrapper_confidence`. Force the user to consciously pick.

### 2. `tech_preferences` names a failing starter

If the user named a starter (or stack) in their tech preferences that gets dropped at the quality-gate filter, surface the failure:

```
You mentioned <starter> earlier as a preference, but it fails <N> of 4
agent-friendly criteria: <list>. The strongest <language_family> +
<product_type> alternative that passes all four is <alternative_starter_id>.
You can still proceed with <starter> — agent-friendly gaps can be patched
via CLAUDE.md / AGENTS.md instructions that document the conventions for
this stack — but it costs you extra manual setup and ongoing care.
```

Then ask the user: "Continue with `<starter>`" (sets `quality_override: true` in the hand-off) or "Switch to `<alternative_starter_id>`".

### 3. Recommended-default starter doesn't include a feature the user named

Recommended-path only. If PRD FRs name a feature (e.g., auth, payments, realtime, AI, background jobs) that the recommended starter doesn't carry first-class:

```
The recommended starter for <product_type> in <language_family> is
<recommended_starter_id>. It does NOT include <feature> (you named it in
your PRD's functional requirements). You can:
  - add <feature> to the recommended starter (additional manual setup)
  - switch to a starter that includes <feature> first-class
  (alternative: <starter_with_feature>)
```

Then ask the user: "Add `<feature>` manually" or "Switch to `<starter_with_feature>`".

### 4. Lead has `bootstrapper_confidence: best-effort` AND user is solo

Solo + best-effort is a concerning combination — the user will be the only one to debug scaffolding friction. Surface:

```
The lead recommendation `<starter_id>` has limited scaffolding support —
bootstrapper hasn't been battle-tested on this stack — and you're working
solo. The compensation is real but you'll be the one absorbing the manual
steps. Here's what to expect: <list of likely friction points from card's
gotchas>. Continue, or switch to a smoother alternative?
```

Then ask the user: "Continue with `<starter_id>`" or "Switch to `<alternative_with_higher_confidence>`".

---

## Output shape

After Step E completes, the conversation produces this shape:

```
Recommendation: <starter_id> — <name>
Confidence:     <verified | first-class | best-effort>

<one-paragraph rationale tying PRD priors + residuals to the lead card,
 citing 2-3 load-bearing factors>

Alternatives worth a glance:
  - <starter_id_a> — <one-line tradeoff>
  - <starter_id_b> — <one-line tradeoff>

<if any Socratic moment fired: a one-line summary of what challenge surfaced,
 how the user resolved it, and any quality_override flag set>
```

The same shape is the conversation surface for both standard and custom paths. The difference is depth: standard path's rationale is short ("This is the recommended default for `(<product_type>, <language_family>)`; bootstrapper confidence is `<value>`"); custom path's rationale walks the filtering and reasoning explicitly.
