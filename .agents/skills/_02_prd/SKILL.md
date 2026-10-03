---
name: prd
description: >
  Generate context/foundation/prd.md from shape-notes.md (or raw notes) against
  the locked PRD schema (10 sections). Use when the user has shaping notes
  ready and wants a schema-conformant PRD written to disk. Trigger phrases:
  "write the PRD", "generate PRD", "create the PRD from notes", "stwórz PRD",
  "turn notes into a PRD", "PRD from shape-notes". Use AFTER /shape, not in
  place of it.
---

# PRD

Document generator. Output is `context/foundation/prd.md` (or `prd-vN.md` on collision). Do not invoke `/tech-stack-selector` when this skill finishes.

Chain position: `/shape → /prd → tech-stack-selector → bootstrapper`. `/shape` produces the preferred input. This skill writes a whole file; it does not surgically edit an existing PRD. Still ideating with no notes → tell the user to run `/shape` and stop.

The contract is `../_01_shape/references/prd-schema.md`. Read it fully in Step 3 before building the PRD. Section names, order, and frontmatter keys come from that file.

## Hard rules

1. **Do not invent domain content.** Transcribe the user's words. Missing business logic, success criteria, user stories, FR priorities, NFR targets, access control, or non-goals become `# TODO:` lines plus an `## Open Questions` entry. Never extrapolate a business rule from nouns in FRs or stories.
2. **No stack in the PRD.** Do not emit `team_profile`, `tech_preferences`, or `deployment_constraint`. Do not emit `## Data Model`, `## Implementation Decisions`, `## Testing Strategy`, or `## Deployment & CI/CD`. The leak list in Step 3 is forbidden in section bodies. Route that material only into the Step 5 hand-off.
3. **Self-review aborts.** A missing section, wrong order, missing frontmatter key, retired section, or leak stops the write. Do not patch silently.
4. **Collisions keep history.** Recommend `prd-vN.md` over overwrite.
5. **No cohort or certification language** in chat or in the file.
6. **Never chain.** The hand-off announces `/tech-stack-selector`. The user runs it.

## How to ask

Use the host's structured question tool whenever a step says "ask". Recommended option first, label ending in `(Recommended)`.

## Entry

1. A path argument (`/prd @notes/raw.md`, `/prd context/foundation/shape-notes.md`) → that path, strip a leading `@`. Step 1.
2. No argument → `context/foundation/shape-notes.md`. Step 1. Do not prompt yet.

## Step 1: Locate input

If the file exists, read it fully (no offset or limit). Step 2.

If it does not exist, ask "No input file found at `<path>`. How would you like to proceed?"

- "Run /shape first (Recommended)" — stop. Print "Stopping. Run `/shape` to produce shape-notes.md, then re-invoke `/prd`."
- "Paste raw notes" — prompt "Paste your notes below. End with an empty line." That text is the in-memory input. Step 2.
- "Cancel" — stop, no writes.

## Step 2: Assess input

Score 0–4. One point per signal:

1. YAML frontmatter contains the key `checkpoint:`.
2. At least one line matching `^- FR-\d{3}: `.
3. Body contains `**Given**`, `**When**`, and `**Then**`.
4. `## Business Logic` exists and its first non-blank line is one declarative sentence: ≤ 200 characters, ends in `.`, and is not `# TODO: domain rule — see Open Questions` or a blank placeholder.

Print:

```
Input assessment (heuristic, 4 signals, 1 point each):
  [✓|✗] Frontmatter checkpoint block       — <found|missing>
  [✓|✗] FR-NNN format requirements         — <found N FRs|missing>
  [✓|✗] Given/When/Then user stories       — <found|missing>
  [✓|✗] Explicit one-sentence business rule — <found|missing>

  Score: <N>/4
```

Score ≥ 2 → Step 3, no extra prompt.

Score < 2 → name each missing signal and the PRD consequence. Do not say only "your notes are thin". Then:

```
This input scored <N>/4 on the shape heuristic. Missing signals:

  - <signal name>: <one-line consequence for the generated PRD>
  - ...

A PRD generated from thin input will have many `# TODO` placeholders and a long
`## Open Questions` section. That's a valid intermediate state, but if you have
time to run /shape first, the resulting PRD will be substantially stronger.
```

Ask "How would you like to proceed?"

- "Run /shape first (Recommended)" — print the redirect and stop.
- "Proceed anyway" — Step 3. Remember the score so TODOs are expected.
- "Cancel" — stop, no writes.

If a signal only partially matches (wrong heading level, a near-miss on the regex, or Given/When/Then in another layout), score that signal missing and take the score < 2 path. "Proceed anyway" recovers a false alarm. A silent thin PRD does not.

## Step 3: Generate in memory

Read `../_01_shape/references/prd-schema.md` fully. Build the PRD in memory. Do not write disk until Step 4, and only after the self-review passes.

### Frontmatter

Seven keys, names load-bearing: `project`, `version`, `status`, `created`, `product_type`, `target_scale`, `timeline_budget`.

- `project` — input frontmatter `project:`, else a `# <Project>` title, else the quoted TODO below.
- `version` — `1` until Step 4 bumps it for a versioned save.
- `status` — `draft`. Never `reviewed` or `locked`.
- `created` — today as `YYYY-MM-DD`.
- `product_type`, `target_scale`, `timeline_budget` — copy from input when present. Do not invent scale numbers.

A missing scalar is the quoted string `"# TODO: <field> — see Open Questions"` plus one Open Question. A missing object still emits the key; copy leaves that exist and set each missing leaf (`users`, `qps`, `data_volume`, `mvp_weeks`, `hard_deadline`, `after_hours_only`) to that quoted TODO. One Open Question covers the object.

`team_profile`, `tech_preferences`, and `deployment_constraint` stay out of frontmatter. Hold them for the Step 5 "Forward to next step" list.

### Sections

Emit these 10 headings, in this order, exact spelling:

1. `## Vision & Problem Statement`
2. `## User & Persona`
3. `## Success Criteria` — `### Primary`, `### Secondary`, `### Guardrails`
4. `## User Stories`
5. `## Functional Requirements`
6. `## Non-Functional Requirements`
7. `## Business Logic`
8. `## Access Control`
9. `## Non-Goals`
10. `## Open Questions`

Per section:

- Matching content → transcribe. Keep the user's words. Reformat only to the schema shape: `FR-NNN` lines, Given/When/Then, the three Success Criteria subsections.
- Partial content → transcribe, then a own-line `# TODO: <what's missing> — see Open Questions`, plus a numbered Open Question.
- No content → heading plus own-line `# TODO: <section name> — see Open Questions`, plus a numbered Open Question.

`# TODO:` in the body is its own line so `^# TODO: ` stays greppable. Preserve `> Socratic:` and legacy `> Socrates:` blockquotes under FRs verbatim.

Mirror each `## Quality cross-check` gap into `## Open Questions`: missing element plus its one-line consequence.

**Business Logic.** No one-sentence rule in the input → the section is exactly `# TODO: domain rule — see Open Questions`, and Open Questions includes `What is the one-sentence business rule? — TBD by user. Block: yes (PRD is hollow until resolved).`

Data-model or implementation text in the notes is not a section. Hold it for the Step 5 forward list.

### Self-review

Run this before any write. Failure aborts. Do not rewrite leaks yourself.

Structural:

1. Every `## ` heading is the canonical 10, in order, exact spelling.
2. No `## Data Model` and none of the other retired headings.
3. All 7 frontmatter keys are present.
4. Success Criteria has Primary, Secondary, and Guardrails, or each missing subsection is an own-line `# TODO:` with an Open Question.

Leak scan. A hit counts unless it is inside a verbatim user quotation that you are routing to Open Questions:

- Vendor or hosted product: OpenRouter, Stripe, Auth0, Supabase, Firebase, Vercel, Cloudflare, AWS, GCP, Azure, OpenAI, Anthropic, or any other product proper noun.
- Schema or ORM: `(FK)`, `nullable`, `_hash` / `_at` as a field list, `password_hash`, `cascade`, `soft-delete`, `hard-delete`, `migration`, `backfill`.
- Runtime location: `client-side`, `server-side`, `on the edge`, `in the cache`, `in the worker`.
- Enforcement: `per IP`, `per user-agent`, `token bucket`, `rate-limit per <axis>`.
- UI widget used as an NFR: `spinner`, `progress bar`, `streaming response`, `modal`, `toast`.
- Transport: `WebSocket`, `gRPC`, `GraphQL`, `REST endpoint`, `webhook`, `SSE`.
- A component named as the thing that performs the domain rule ("the LLM does X", "the database stores Z").

On any failure, print this and stop. Do not continue to Step 4.

```
PRD generation self-review FAILED:

  Structural:
    - Missing section: <name>
    - Out-of-order section: <name> (expected position N, found position M)
    - Missing frontmatter key: <key>
    - Retired section present: <name>

  Technical leak (content lint):
    - <section name>: "<offending phrase>" — <category>
    - ...

The PRD was NOT written. For structural failures: the schema and the generator
have drifted — re-read ../_01_shape/references/prd-schema.md and reconcile.
For leak failures: the input notes carry implementation detail that PRD does
not own. Either (a) rewrite the offending phrasings as outside-observable
properties / scope decisions and re-run, or (b) move the leaked content into
shape-notes' `## Forward: ...` blocks so a downstream skill consumes it.
```

All checks pass → Step 4 with the validated text.

## Step 4: Write

If `context/foundation/prd.md` is absent, write the validated text there. Step 5.

If it exists, ask "context/foundation/prd.md already exists. How would you like to proceed?"

- "Save as prd-vN.md (Recommended)" — keep `prd.md`. Scan `context/foundation/prd-v*.md`. Unversioned `prd.md` counts as v1. `N = max(those version numbers, 1) + 1`. Write `context/foundation/prd-v<N>.md` and set frontmatter `version:` to `N`.
- "Overwrite prd.md" — replace `context/foundation/prd.md`. Leave `version: 1`.
- "Abort" — stop, no writes.

Then Step 5.

## Step 5: Hand off

```
═══════════════════════════════════════════════════════════
  PRD GENERATED
═══════════════════════════════════════════════════════════

  Project:          [project from frontmatter]
  Path:             [context/foundation/prd.md | context/foundation/prd-vN.md]
  Schema sections:  10 / 10 present
  Frontmatter:      <K populated, M as TODO>  (7 keys total)
  Open Questions:   <count> entries

  Sections fully populated from input:
    - <section names with at least one body line that is not an own-line `# TODO:`>

  Sections marked TODO (see Open Questions):
    - <section names that contain an own-line `# TODO:`>

═══════════════════════════════════════════════════════════
```

Copy `/tech-stack-selector` to the clipboard: `Set-Clipboard "/tech-stack-selector"` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere.

```
► Next:   /tech-stack-selector  (✓ copied to clipboard)

          It picks up team composition, language preferences,
          technology avoid-list, deployment target, and CI/CD
          pipeline shape. None of those are in this PRD by design —
          the PRD describes the product, the next step describes
          how to build it.
```

If the notes carried stack preferences, implementation notes, or deploy hints, add:

```
  Forward to next step (not in PRD):
    • [one-line summary per detected item]
```

Omit that block when there is nothing to route. Stop.
