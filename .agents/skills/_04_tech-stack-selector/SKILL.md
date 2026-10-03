---
name: tech-stack-selector
description: >
  Pick a starter and a stack for a new project after the PRD is written.
  Reads context/foundation/prd.md, reasons over a language-aware starter
  registry with four agent-friendly quality gates, and writes the
  context/foundation/tech-stack.md hand-off. Use when the user asks "what
  stack should I use", "pick a stack", "choose framework",
  "co wybrać do projektu". Use AFTER /prd, BEFORE /bootstrapper.
---

# Tech stack selector

Decision over a curated registry. Output is `context/foundation/tech-stack.md` (or `tech-stack-vN.md`). Do not invoke `/bootstrapper` when this skill finishes.

Chain position: `/shape → /prd → tech-stack-selector → /bootstrapper`. A comparison question ("React vs Vue") with a PRD on disk takes the custom path. Adding or swapping one library in an existing codebase is `/frame`, not this skill.

`references/starter-registry.yaml` is the only starter list. Read the cards the filters leave, not the whole file. `/bootstrapper` may only use a `starter_id` from this registry. This skill may still recommend a card bootstrapper has not wired; that card's confidence is `best-effort`.

## Hard rules

1. **The PRD file is the input.** No mini-PRD, and no substitute priors from chat. If the file is missing, stop.
2. **Name the recommendation and wait.** The user accepts it or designs their own. Do not treat silence as acceptance.
3. **One path.** Standard: recommendation, then deployment, CI/CD, and project name. Custom: the full walk in `references/residual-interview.md`, including the closing self-check. `hints.path_taken` records the path they picked. Do not mix the two.
4. **Confidence never blocks.** `best-effort` is a heads-up in the conversation and a value in the hand-off. It does not drop a starter.
5. **Internal labels stay internal.** In anything the user reads, do not say `Q0`, `Q3`, `Step A`, "path-fork", "residual interview", "Socratic moment", or "decision flow". Say "this choice", "the framework question", "an alternative worth flagging". Do not say `hints.deployment_target`, `agent_friendly.typed`, or `bootstrapper_confidence`. Say "where this will run", "whether the stack uses explicit types", "how smooth scaffolding will be".
6. **No private paths and no org branding** in the hand-off or in chat. Do not write an absolute path (`C:\`, `/Users/`, `/home/`) or a path segment `vault`. Do not write `Ceneo` or `HackYeah` unless that string is the PRD `project` value.

## What to read, and when

| When | Read |
|---|---|
| Step 2 | [references/residual-interview.md](references/residual-interview.md) |
| Step 3 | [references/decision-flow.md](references/decision-flow.md), [references/agent-friendly-criteria.md](references/agent-friendly-criteria.md), and only the matching cards in [references/starter-registry.yaml](references/starter-registry.yaml) |
| Step 4 | [references/handoff-schema.md](references/handoff-schema.md) |

Follow those files for question wording, filters, and field names. This file is the order of work.

## Entry

1. A path argument (`/tech-stack-selector @context/foundation/prd-v2.md`) → that path, strip a leading `@`.
2. No argument → `context/foundation/prd.md`.

Call this `<prd-path>` for the rest of the run.

## Step 0: PRD file

If `<prd-path>` is missing, copy `/shape` to the clipboard (`Set-Clipboard "/shape"` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere), print the block below, and stop.

```
Tech-stack-selector requires a PRD at `<prd-path>`. Run `/shape` first, then re-invoke.
```

If the file exists, read it fully. Step 1.

## Step 1: Priors

From frontmatter: `project` (kebab-case it for `project_name` if needed), `product_type`, `target_scale.users`, `timeline_budget.mvp_weeks`, `timeline_budget.after_hours_only`.

From `## Functional Requirements` and `## Non-Goals`: note technology-forcing signals (auth, payments, realtime, AI/LLM, background jobs, file storage, i18n) and the `FR-NNN` that carries each one. A `## Forward: tech-stack` block is a language prior for the interview, not a PRD field.

Print:

```
PRD priors:
  Project:       <project>
  Product type:  <product_type>
  Scale:         <target_scale.users>
  Timeline:      <timeline_budget.mvp_weeks> weeks
                 (after-hours: <timeline_budget.after_hours_only>)

  Detected feature signals from FRs:
    - <feature> (FR-NNN)
```

Ask "Are these priors correct, or do you want to correct anything before we proceed?"

- "Correct — proceed (Recommended)" — Step 2.
- "Correct a value" — ask which field, keep an in-memory override, leave the PRD file unchanged, then Step 2.
- "Stop — fix the PRD first" — stop. They re-run `/prd`, then this skill.

## Step 2: Interview

Read `references/residual-interview.md` and run that question flow.

Standard path: they take the vetted starter for `(product_type, language_family)`. Skip the feature, team, and preference questions and the closing self-check. Still ask deployment, CI/CD, and project name.

Custom path: the full question walk, the testing question when the card requires it, and the five-point self-check before the hand-off.

`language_family` comes from `## Forward: tech-stack` or from something the user already said. Otherwise ask once. PRD frontmatter does not carry it. Look up `recommended_defaults[product_type][language_family]` in the registry.

- A `starter_id` → name it, one line of fit, and how smooth scaffolding will be. Wait for "take it" or "design my own".
- The cell is `<none>` → say there is no vetted default for this product and language, and take the custom path.

## Step 3: Decide

Read `references/decision-flow.md` and `references/agent-friendly-criteria.md`. Load only the registry cards that survive the language and product filters.

- Standard path — the accepted default is the lead. Surface scaffolding confidence and skip filtering.
- Custom path — filter, drop cards that fail a quality gate (with the per-language caveat in the criteria file), reason over what remains, then a lead plus one or two alternatives.

Raise the challenges the decision flow names: a preference that fails a quality gate, a PRD feature the recommended starter does not include, a framework comparison on the custom path, or limited scaffolding plus a solo builder. Honor the user's choice. Record a quality override only when they keep a starter that failed a gate.

Print the conversation shape at the end of `references/decision-flow.md`.

## Step 4: Write

Read `references/handoff-schema.md`. Build the file in memory.

- `package_manager` is the chosen card's `toolchain.package_manager`. If the card omits it, omit it here.
- Deployment "I don't know yet" stores the card's first deployment default, not the word `unspecified`.
- `hints.path_taken` is `standard` or `custom`.
- `hints.self_check_answers` is the five booleans when the custom path ran the self-check, otherwise `null`.

If `context/foundation/tech-stack.md` is absent, write it.

If it exists, ask "context/foundation/tech-stack.md already exists. How would you like to proceed?"

- "Overwrite (Recommended)" — replace the file. This skill is one decision per project.
- "Save as tech-stack-vN.md" — scan `context/foundation/tech-stack-v*.md`. `N` is the highest existing N plus 1, or `2` when none exist. Write `context/foundation/tech-stack-v<N>.md`. Leave `tech-stack.md` untouched.
- "Abort" — stop. The rationale stays in chat only.

Copy `/bootstrapper` to the clipboard (`Set-Clipboard "/bootstrapper"` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere) and print:

```
═══════════════════════════════════════════════════════════
  TECH STACK SELECTED
═══════════════════════════════════════════════════════════

  Starter:        <starter_id>
  Path taken:     <standard | custom>
  Confidence:     <verified | first-class | best-effort>

  ► Hand-off:  context/foundation/tech-stack.md
  ► Next:      /bootstrapper  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

Use the versioned path in the banner when that is what was written. Stop.
