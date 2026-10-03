# Agent-friendly criteria

> "If you don't have a strong preference, go with the recommended default for your `(product_type, language_family)` cell. If you have a production stack, stick with it when it meets the four agent-friendly criteria."

This doc specifies the four quality criteria the LLM applies during decision-flow Step B (`references/decision-flow.md`), what each means, the load-bearing per-language-family caveat for criterion 3, and the hard-filter + soft-challenge enforcement modes.

The four criteria are tracked per starter as `agent_friendly.{typed, convention_based, popular_in_training, well_documented}` booleans in `references/starter-registry.yaml`. The LLM does NOT re-derive them at runtime — it reads the booleans and applies them.

---

## 1. Typed

**Definition**: the language and starter's default dependencies use explicit types or schemas for project-level contracts. An agent reading the code can reason about input/output shapes from the source itself, without running the program.

**Examples that pass**: TypeScript end-to-end (Next, T3, Hono); Python with Pydantic / SQLModel (FastAPI); Java / Kotlin / .NET / Rust (typed by the language); Go (typed by the language); Dart (typed).

**Examples that fail**: Express.js with no type discipline; raw Django without type hints; raw Rails without RBS / Sorbet; PHP without typed properties; untyped Lua.

**Tracked as**: `agent_friendly.typed` boolean per starter card.

---

## 2. Convention-based

**Definition**: the framework / starter ships strong opinions about folder layout, routing, configuration, testing, and naming. A stranger reading the code can predict where things live without reading every file. An agent navigating the codebase has the same advantage.

**Examples that pass**: Rails (convention over configuration is the slogan); Next.js App Router (file-based routes); Django (apps + manage.py + admin); Spring Boot (autoconfiguration); Astro (file-based routes + island architecture).

**Examples that fail**: Express (you assemble routing/middleware ad hoc per project); Vite + React with no router (every project lays out routes differently).

**Tracked as**: `agent_friendly.convention_based` boolean per starter card.

---

## 3. Popular in training data

**Definition**: the starter and its surrounding stack appear frequently enough in the LLM's pre-training corpus that the agent has internalized the idioms. The agent generates code that looks like the framework's own examples, not a confabulation.

### Per-language-family caveat (load-bearing)

**Assess this criterion *per language family*, not globally.** Django is popular *in Python training data*; FastAPI is too; Spring is in Java training data; Rails is in Ruby training data. Comparing absolute training-data popularity unfairly penalizes every non-JS stack against the JS ecosystem's volume.

The boolean per starter records "is this popular within its language family?" — NOT "is this as popular as the JS top tier?". A `false` here means "even within its own language family, this is a niche pick" — examples might be a brand-new Rust web framework launched in the last six months, or a fork that broke from upstream and lost mind-share.

This is also why the candidate filter in decision-flow Step A ALWAYS partitions by `language_family` first: the agent reasons about Python starters in the context of other Python starters, not against React.

**Examples that pass**: React, Vue, Angular (JS); Django, FastAPI, Flask (Python); Rails (Ruby); Spring (Java); Laravel (PHP); .NET (C#); Flutter (Dart).

**Examples that fail**: a forked-six-months-ago variant of an established framework; a brand-new framework with <1k stars and no Stack Overflow corpus; an internal company-only framework.

**Tracked as**: `agent_friendly.popular_in_training` boolean per starter card.

---

## 4. Well-documented

**Definition**: the framework's official docs are current, version-pinned, and link-able by URL. An agent (or human) can land on a doc page that matches the version they're using; examples in the docs reflect current API.

**Examples that pass**: Next.js (versioned docs, examples per version); Django (the canonical batteries-included docs); FastAPI (auto-generated OpenAPI + extensive guide); Rails (Rails Guides per version); Spring Boot (versioned reference manual).

**Examples that fail**: docs hosted as scattered blog posts; docs three major versions behind the current release; community-maintained wiki out of sync with the codebase.

**Tracked as**: `agent_friendly.well_documented` boolean per starter card.

---

## Compensation path

Gaps in the four criteria are NOT absolute disqualifications — they can be patched via instruction files (`AGENTS.md`, `CLAUDE.md`, project-specific rules) at the cost of additional manual work. A non-agent-friendly stack can still be the right choice when the team owns the friction explicitly.

What `quality_override = true` and `bootstrapper_confidence: best-effort` represent in practice:

- The user has accepted a known-friction stack.
- Bootstrapper's instruction-file generation (Phase 4 of bootstrapper, written to `AGENTS.md` / `CLAUDE.md` per the active tool) MUST carry extra ecosystem-specific context to compensate. For Express: explicit middleware order conventions, error-handling pattern, request-validation pattern. For untyped Django: type-hint-everywhere convention, Pydantic-at-boundaries, mypy in CI. For raw Rails: Sorbet stubs at API boundaries, conventions doc.
- The user takes ownership of ongoing care: as the codebase grows, the agent will need more steering, not less, until the project's instruction files cover the gap.

Compensation does NOT erase the gap; it makes the gap legible. An agent reading a well-written instruction file (`AGENTS.md` / `CLAUDE.md`) can still pattern-match on it, even if the framework itself doesn't carry the conventions in code.

When a Socratic challenge fires (decision-flow `### Socratic moments`) and the user picks the failing-stack option, the conversation should explicitly name the compensation path: "OK, you've picked Express despite its `typed: false` and `convention_based: false` gates. Here's what bootstrapper will add to the project's instruction file (`AGENTS.md` / `CLAUDE.md`) to compensate: <list of conventions>. Plan to revisit and tighten as the codebase grows."

---

## Enforcement

### Hard filter (within candidate pool)

Candidates with ANY criterion=`false` are excluded from the **unprompted** recommendation set within the user's constrained candidate pool (typically already filtered by `language_family` per Step A). The lead recommendation surfaced in Step D is drawn only from candidates that pass all four gates.

### Soft challenge (Socratic, on user override)

If the user explicitly names a failing starter via `tech_preferences` (e.g., "I want Express even though..."), the skill does NOT silently accept. It surfaces:

1. The failing criteria, named (e.g., "Express fails on `typed` and `convention_based`").
2. The strongest higher-criteria alternative in the same language_family + product_type cell (e.g., "Hono passes all four gates and is also Node.js + edge-deployable").
3. The compensation path (per the section above).

Then it asks the user to confirm or pivot. Confirmation sets `hints.quality_override = true` in the hand-off; pivot routes to the alternative.

### Standard path skips the gates

When the user takes the recommended_default at Q0 (standard path), all gates are presumed-passed (the recommended_defaults map should never name a starter that fails an agent-friendly gate). The skill does NOT re-run filtering on the standard path.

### Custom path runs the gates fully

On the custom path, decision-flow Step B runs the hard filter against the candidates surviving Step A. Candidates failing any gate are dropped; the surviving set feeds Step C reasoning.
