---
name: rule-review
description: >
  Score an AI rules file on five axes and return concrete fixes. Works on
  CLAUDE.md, AGENTS.md, SKILL.md, .windsurfrules, nested rule files, or any
  other rule-for-AI markdown. Use when the user says /rule-review, "review
  AI rules", "audit AGENTS.md", "check my CLAUDE.md", "score my agent
  instructions", "is this rules file healthy", "przejrzyj reguły", or
  "oceń AGENTS.md". Scores the rule artifact, not the product.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, karta wyników). Nie tłumacz: kod, identyfikatory, ścieżki, cytaty z pliku. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Rule review

Score one rules file. Do not assume CLAUDE.md, AGENTS.md, or a tool. Do not score architecture, stack choices, or product conventions. Score whether the file is a healthy rule-for-AI artifact.

## Hard rules

1. **Read-only by default.** The only edit is a Check 5 reorder, and only after an explicit yes. Never rewrite rule wording. Never emit a full "fixed" file.
2. **Every finding cites `path:line`.** A vague phrase gets a testable rewrite grounded in this file or this repo. Never suggest "just delete it" for Check 3. Label a guess **(assumed)**.
3. **Score Check 5 on the original order**, before any reorder.
4. **Print the scorecard and stop.** No follow-up menu unless they ask.

## How to ask

Use the host's structured question tool.

## Input

`$ARGUMENTS` is one markdown path: absolute, repo-relative, or `@`-prefixed. Strip `@`.

- Empty → ask for the path. Do not guess.
- A directory → ask which file.
- Several files (a glob) → one scorecard each. Do not merge.
- Missing → stop and report the path. Do not invent content.

Read the file fully. Over 2000 lines, read in chunks until the end. For `.mdc`, count rule lines after the frontmatter. `globs:` and `alwaysApply:` are config, not rules.

## Check 1 — Length

Count non-empty lines. Ignore blanks and a line that is only `---`.

| Lines | Verdict |
| --- | --- |
| 0–200 | OK |
| 201–500 | WARN |
| 501+ | FAIL |

WARN or FAIL → name the cut: nest per-area rules next to the code (`src/api/AGENTS.md`), replace a duplicated doc with `@path`, drop a rule that is not tied to a recurring agent failure.

## Check 2 — Snippets

Flag a fenced block, or an inline code block longer than about 3 lines, when it is an example component, endpoint, migration, schema, query, script, test, or a config file (`tsconfig.json`, `eslintrc`, `package.json`, `wrangler.toml`).

Do not flag a 2–4 line format the agent must emit, a one-line command, or a Mermaid block.

Each flag → move the snippet into a real file and leave `@path`. OK = 0. WARN = 1–2. FAIL = 3+.

## Check 3 — Precise language

Flag intent a reviewer cannot check on a diff. Usual lines: "write clean code", "follow best practices", "care about quality", "be consistent", "use modern patterns", "make it readable / maintainable / robust", "handle errors properly", "keep things simple".

For each hit, write one replacement that names a threshold, a command, or a pattern from this file, the surrounding paragraph, or the repo (`package.json`, lint config, sibling rules). If nothing in the repo decides it, pick a default for the detected stack and mark it **(assumed)**.

| Vague line | Grounded replacement |
| --- | --- |
| "Write clean code" and the file already names TypeScript and ESLint | Avoid `any`. Split a function over 40 lines. Run `pnpm lint` before committing. |
| "Handle errors properly" and an earlier rule shows `{ error: {...} }` | Return `{ error: { code, message, context } }` as defined above. Do not throw a raw error. |

OK = 0. WARN = 1–3. FAIL = 4+.

## Check 4 — Redundant knowledge

After each paragraph ask: "Did I already know this before I opened the file?"

Flag it when you could have written it with no project access, when a framework, linter, type checker, or test runner already enforces it, when it defines a generic term, when it copies `README.md`, `package.json`, the layout, or a lint config, or when it reads like a Getting Started page.

Do not flag a convention that contradicts the framework default, a local pitfall you could not infer, an internal naming or layout rule, or a generic-looking rule that cites an incident.

Each flag is one of: delete it, replace it with `@README.md` / `@tsconfig.json` / `@docs/...`, or keep it only if the author adds the incident inline.

OK = 0 paragraphs. WARN = 1–3. FAIL = 4+.

## Check 5 — Ordering

Models weight the start and the end. Run these steps in order.

**5a.** Number the H1 and H2 headings with their line numbers. Use H3 only when there is no H2. No comment yet. No headings → say the file is one undifferentiated block.

**5b.** Tag each section: CRITICAL (security, money, irreversibility, a project "never"), USEFUL, INTRO (welcome, mission, team), REDUNDANT (from Check 4), VAGUE (from Check 3), REFERENCE (`@` pointers). Then one paragraph on the structural problem, or say the order is sound.

**5c.** Only when 5b found a problem. Propose moves: to the top, kept, to the bottom, removed. Do not rewrite lines. No problem → "Order is sound; no reshuffle needed." and skip 5d.

**5d.** Ask before any write. Header: `Reorder`.

- "Yes, reorder the file now" — move section blocks. Preserve every byte of rule content. One edit.
- "Only move the critical rules to the top" — lift the hard rules. Leave the rest.
- "No, just leave the suggestion in the report" — do not edit.
- "Show me the diff first" — preview the reordered file in chat. Do not write.

**5e.** Always end with this, whether or not you edited:

> Test each change in your next agent session. Reordering a rules file is a context-shape change — its effect on agent behavior only shows up the next time you run a real task. Apply changes one at a time (atomic): reorder, then run a representative task, then move on to the next change (split, dedupe, rewrite). Bundling multiple structural changes makes it impossible to attribute a behavior shift to a specific edit.

Verdict on the original order:

- **OK** — the top is dense with CRITICAL or USEFUL rules, headings are clear, no INTRO bloat.
- **WARN** — critical rules are split between the top and the middle, or a real INTRO sits at the start.
- **FAIL** — a critical rule is after line 200, there are no headings, or the first 30 or more lines are INTRO or marketing.

## Scorecard

Print this and stop. An OK check stays in the table. Its findings block is the heading plus one short line.

```
# Rule Review — <path>

**Overall:** <one line>

## Scorecard

| # | Check | Verdict | Score |
| --- | --- | --- | --- |
| 1 | Length | OK/WARN/FAIL | <n> non-blank lines |
| 2 | Direct snippets | OK/WARN/FAIL | <n> flagged blocks |
| 3 | Precise language | OK/WARN/FAIL | <n> vague phrases |
| 4 | Redundant knowledge | OK/WARN/FAIL | <n> redundant rules |
| 5 | Rule ordering | OK/WARN/FAIL | <one-line reason> |

## Findings

### 1. Length — <verdict>
- <n> non-blank lines.
- <cut, only when WARN or FAIL>

### 2. Direct snippets — <verdict>
- `path:line-range` — <kind of snippet> → `@<file>`

### 3. Precise language — <verdict>
- `path:line` — "<vague phrase>" → "<testable rewrite>"

### 4. Redundant knowledge — <verdict>
- `path:line` — <what is redundant> → delete | `@reference` | keep only with an incident note

### 5. Rule ordering — <verdict>
- <where the critical rules sit, and the 5d decision>

## Top 3 actions
1. <highest leverage, from any check>
2. <second>
3. <third>
```

## Edge cases

- Under 50 lines: still run all five. Short files most often fail Checks 3 and 4.
- Mostly `@` references: that helps Checks 2 and 4. Do not penalize it.
- A generated stub that nobody edited: still review. Check 4 usually dominates.
- Sibling rule files: review only the file passed in. Mention a sibling in Top 3 only when the two files duplicate each other.
