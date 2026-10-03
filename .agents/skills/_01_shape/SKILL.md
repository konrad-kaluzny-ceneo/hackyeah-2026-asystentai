---
name: shape
description: >
  Facilitate a structured discovery conversation that turns a new-project idea
  into context/foundation/shape-notes.md, the input to /prd. Use BEFORE /prd,
  not in place of it. Trigger: /shape, "shape this idea", a new product from
  first principles, or an incomplete shape-notes.md to resume. Skip when a PRD
  already exists, or the ask is one bug, refactor, or small feature (use /frame).
---

# Shape

Facilitator only. Output is `context/foundation/shape-notes.md`, never `prd.md`. Do not invoke `/prd` when this skill finishes.

Chain position: `/shape → /prd → tech-stack-selector → bootstrapper`. `/frame` is for a small reframe. `/plan` is downstream of `/prd`.

Before the first write, read @references/prd-schema.md. Re-check it on every checkpoint write. Section names, FR/US format, and the `checkpoint:` block come from that file.

## Hard rules

1. **Do not invent domain content.** If a value is missing, ask. You may only add mechanical formatting: `FR-NNN` / `US-NN` numbers, schema headings, frontmatter keys.
2. **No stack, architecture, or delivery plan.** Do not ask, recommend, or commit to a framework, database, language, platform, team shape, deployment, CI/CD, or testing strategy. Product priors only: `product_type`, `target_scale`, `timeline_budget`. Volunteered stack notes go under `## Forward: tech-stack`. Volunteered implementation, test, or deploy notes go under `## Forward: technical-roadmap`. Neither block is a PRD section.
3. **No cohort or certification language** in chat or in files written to disk.
4. **Name the anti-pattern and the missing piece.** Empty CRUD and an oversized MVP get the scripts in @references/spoken-scripts.md. Never write "your idea has issues".
5. **Soft gate.** Step 7 warns and allows override. Record the override; do not refuse to finish.
6. **Small scope.** One bug, refactor, or small feature → tell the user to use `/frame` and stop.
7. **Resume does not replay.** Summarize each completed phase in one or two sentences, then start the unfinished phase.
8. **Skip is allowed.** If the user wants to skip a phase, name the hollow section that creates, then skip if they still want to.

## How to ask

Use the host's structured question tool whenever a step says "ask".

- Recommended option first, label ending in `(Recommended)`.
- Gray areas: real positions with a tradeoff, plus "Not sure / haven't decided".
- `multiSelect: true` only when several positions can co-exist.
- One open question to start a phase. Do not draft the user's answer.

## Phase loop

For Steps 1–6:

1. State in one line what this phase writes.
2. Ask the opening question. Wait.
3. If the answer is ambiguous, ask the gray-area decisions for that step.
4. Lock: one-line summary. Wait for confirmation.
5. Write that phase's sections in schema order (insert, do not dump at EOF). Then run **Checkpoint write**.

## Checkpoint write

Update `context/foundation/shape-notes.md` frontmatter to the `checkpoint:` block in @references/prd-schema.md. Write-timing rules that file does not state:

- Ask `project` in Step 1 if it is still unnamed.
- `checkpoint.current_phase` is an integer. Never `4.5`.
- `checkpoint.frs_drafted` is 0 until Step 4.
- `checkpoint.quality_check_status` stays `pending` until Step 7.

Body section names and order come from @references/prd-schema.md. Create each heading when its phase writes it. Optional extras, after those sections: `## Timeline acknowledgment`, `## Quality cross-check`, `## Forward: tech-stack`, `## Forward: technical-roadmap`.

| Step | Writes | Then `current_phase` | Add to `phases_completed` |
|---|---|---|---|
| 1 Vision & persona | Vision & Problem Statement, User & Persona | 2 | 1 |
| 2 Access | Access Control | 3 | 2 |
| 3 MVP | Success Criteria, `timeline_budget.mvp_weeks` | 4 | 3 |
| 4 FRs, stories, Socratic | Functional Requirements, User Stories | 4 until every FR has a quote, then 5 | 4 only after the Socratic round |
| 5 Domain rule & NFRs | Business Logic, Non-Functional Requirements | 6 | 5 |
| 6 Framing & non-goals | Non-Goals + remaining product frontmatter | 7 | 6 |
| 7 Cross-check | Quality cross-check | 8 | 7 |
| 8 Hand-off | final frontmatter | 8 | — |

## Entry

1. Inline idea (`/shape a recipe app…`) → seed, verbatim, do not rephrase. Step 0.
2. File path (`/shape @notes/idea.md`) → read the file fully; that text is the seed. Step 0.
3. No argument → print the block below and wait.

```
I'll help you shape an idea into structured notes that /prd can turn into
a real PRD for a new project.

Please share:
1. The seed idea — what do you want to build, in your own words?
2. (Optional) Any rough notes, sketches, or links I should read

Tip: pass the idea inline — `/shape a recipe app that uses fridge contents`
```

## Step 0: Scaffold

If `context/foundation/` exists, go to Step 0.5.

If missing, ask "This directory has no context/foundation/. Run /init now?"

- "Yes — run /init (Recommended)" — scaffolds `context/` (`changes/`, `archive/`, `foundation/`) with READMEs, then continue shaping.
- "No — stop here" — exit. Shaping needs the scaffold.

On Yes: invoke `/init` as a skill, not via shell. When it returns, re-check the directory; if it exists, go to Step 0.5. On No: print "Stopping. Run `/init` when ready, then re-invoke `/shape`." and stop.

## Step 0.5: Resume

If `context/foundation/shape-notes.md` is absent, start Step 1.

If present, read it fully. Parse `checkpoint:` per the schema section "shape-notes.md checkpoint format". Report:

```
Found a prior shape session at context/foundation/shape-notes.md:

  Project:                 [project, or "(unnamed)"]
  Current phase:           [N — phase name from the table]
  Phases completed:        [list]
  FRs drafted so far:      [count]
  Quality check status:    [pending | warned | accepted]
```

Ask "How would you like to proceed?"

- "Resume from Phase [next] (Recommended)" — summarize each completed phase in one or two sentences, then jump. Next phase = `current_phase` if it is not in `phases_completed`, otherwise `current_phase + 1`. If any `FR-NNN` lacks a `> Socratic:` or legacy `> Socrates:` quote, resume at the Socratic round inside Step 4.
- "Restart from scratch" — move the file to `context/foundation/archive/shape-notes-<YYYY-MM-DD-HHMM>.md` (create the directory if needed), then Step 1.
- "Cancel" — stop, no writes.

## Step 1: Vision & persona

Writes `## Vision & Problem Statement` and `## User & Persona` (primary persona only).

Ask: "Let's start with the pain. In one or two sentences — who has it, what's the moment they feel it, what does it cost them today?"

Echo back:

```
Pain:        [literal problem]
Person:      [role, not "users"]
Moment:      [situation that triggers it]
Cost today:  [what they do now, and what it costs]
```

If Pain, Person, Moment, or Cost today contains `everyone`, `always`, or a cost with no number and no named activity, ask one of: "Who specifically have you seen experience this in the last month?" or "What would have to be true for this to be the wrong problem?"

Then ask (multi-select where positions can co-exist):

- Pain category: workflow friction / missing capability / data trapped / decision paralysis / coordination overhead / other
- Insight: "If your idea is obvious, why hasn't this been built?"
- Primary persona: a role inside an org / individuals across many orgs / one named user including yourself / hobbyist niche / not sure

Also capture `project` if the user has not named it. Lock, write, checkpoint.

## Step 2: Access

Writes `## Access Control`. Persona is already captured.

Ask: "How does this person get into the app? Login, a local profile, an access key, no auth at all?"

- Login (email + password / OAuth / passwordless) (Recommended for multi-user web/mobile)
- Local profile, data on-device, no server (Recommended for solo / privacy-first)
- Access key (link or token; no account)
- N/A — single user, single device, no separation

If not N/A, ask whether the model is flat or has roles (admin / member / guest). Probe: "What's the smallest access model that would still make the MVP useful?"

A single-user local app still gets a real section, e.g. `Single user; no auth; data lives on-device only.` Lock, write, checkpoint.

## Step 3: MVP

Writes `## Success Criteria` (`### Primary`, `### Secondary`, `### Guardrails`) and sets `timeline_budget.mvp_weeks`.

Ask: "Sketch the smallest end-to-end user flow that would prove this product works. Walk me through the first session, click by click."

Echo it as `1. … 2. … 3. …`. Ask: "If you had three weeks of after-hours work, can you ship this flow?"

Surface the cost when any of these is true: more than about 6 actions before the user gets value, the user's estimate is over about 3 after-hours weeks, or the first payoff needs several integrations, external services, or custom infrastructure. Say the Oversized MVP script in @references/spoken-scripts.md.

Ask:

- **Scope down (Recommended)** — restart this step with a smaller first flow.
- **Commit to the longer timeline — I understand it will take sustained effort** — only if the multi-week, after-hours cost is accepted on purpose.
- **Restart Step 3 with a different first flow** — re-sketch from scratch.

On commit: ask `mvp_weeks` if not already stated. Append `## Timeline acknowledgment` with `Acknowledged on <YYYY-MM-DD>: <N>-week MVP requires sustained dedication; user accepted.` Do not warn again.

When the flow is locked, Primary = that flow working. Ask once for Secondary (one nice-to-have) and Guardrails (one or two must-not-break items: privacy, performance floor, UX).

Set `mvp_weeks` to `1` when scoped down, otherwise to the acknowledged estimate. Lock, write, checkpoint.

## Step 4: FRs, stories, Socratic round

Writes `## Functional Requirements` and `## User Stories`. Keep `current_phase: 4` and do not append `4` to `phases_completed` until every FR has a `> Socratic:` quote (`> Socrates:` on older notes counts as done; new quotes use `Socratic`).

Ask: "From the MVP flow you sketched, what does the actor have to be able to do? List the capabilities — I'll format them as FRs."

Each capability, one line, in the FR format from @references/prd-schema.md. Default `must-have` for anything in the MVP flow; ask before using `nice-to-have`.

Then require at least `### US-01:` for the primary path, with Given/When/Then per the schema. Write a further story only when that FR is not the click-path locked in Step 3. Set `frs_drafted` to the FR count.

**Socratic round — one challenge per FR, document order, no extras.** Ask each FR with 2–4 counter-arguments drawn from that FR. Last option, never first: "No counter-argument; it stands as written."

```
FR-NNN: [Actor] can [capability]. Priority: ...
What would have to be true for this FR to be wrong — i.e., for shipping it to
hurt the product instead of help it? OR: what's the strongest counter-argument
to including this in the MVP?
```

Write under the FR per the `> Socratic:` example in @references/prd-schema.md.

If the user splits, demotes, or drops an FR, edit it in place and refresh `frs_drafted`. When every FR has a quote, checkpoint with phase 4 complete and `current_phase: 5`.

## Step 5: Business logic & NFRs

Writes `## Business Logic` and `## Non-Functional Requirements`. Do not capture entities or fields. Nouns already live in FRs and user stories. A field-level question goes to `## Open Questions`.

Ask: "Describe the rule of operation in ONE sentence — the domain decision your app makes that distinguishes it from a generic CRUD list."

If they produce it, that sentence is line 1 of `## Business Logic`. Shape the rest per @references/prd-schema.md (Business Logic).

**Empty CRUD:** the answer is only add / view / update / remove, with no recommendation, prioritization, classification, validation, scoring, workflow, or calculation. Say the Empty CRUD script in @references/spoken-scripts.md.

Ask those shapes as multi-select, plus "I want to add a rule — give me a moment to think" and "I'm building this as pure CRUD anyway — record it".

- They pick a shape → return to the one-sentence prompt.
- They accept pure CRUD → write `# TODO: domain rule — see Open Questions` and add a matching `## Open Questions` entry.

Then one NFR round: "Are there qualities the app must hold at its outer boundary — what a user, operator, or regulator could measure without inspecting the implementation? Think: response timing as the user perceives it, privacy commitments, accessibility, browser/device support, retention windows."

Write each bullet per @references/prd-schema.md (Non-Functional Requirements). If they say "rate-limit per IP", "spinner during load", or "Postgres query < 50ms", reflect the outside-observable form and confirm before saving (for example: credential stuffing is rejected without locking out mistyped passwords; visible progress during any operation over 2s; user-perceived response under 800ms p95).

Lock, write, checkpoint.

## Step 6: Framing & non-goals

Writes `## Non-Goals` and the remaining product frontmatter: `product_type`, `target_scale`, `timeline_budget.hard_deadline`, `timeline_budget.after_hours_only`. `mvp_weeks` is already set. Do not print field names in questions or option labels.

Open: "Last phase — let's pin a few framing details, then nail down what this MVP is explicitly NOT doing. We're not picking frameworks, deployment, or test/CI plans here — those come after, when the stack is picked."

Ask these one at a time:

1. **What kind of thing are you building?** Options: "A website or web app" / "An API or backend service" / "A command-line tool" / "A mobile app" / "A desktop app" / "A library or SDK" / "A data pipeline", plus free text. Map to `product_type`: `web-app` / `api` / `cli` / `mobile` / `desktop` / `library` / `data-pipeline` / `other`.
2. **Roughly how many people will use this once it's live?** "Just me, or a handful" → `small`. "Dozens to a hundred" → `medium`. "Up to ten thousand" → `large`. "More than ten thousand" → `enterprise`. Then ask: "How would your domain rule change at 100x that scale?" If that surfaces something new, add one line to Vision.
3. **Timing, one round, two questions.** "Is there a hard deadline? If yes, what date — if no, say 'no deadline'." → `hard_deadline` ISO date or `null`. "Will this be after-hours work, or part of your day job?" → `after_hours_only` bool. Do not re-ask `mvp_weeks`.

Then one multi-select. Build 3–5 options from this product, not a generic list:

```
What is this MVP explicitly NOT doing? Pick anything that should be
ruled out now so it doesn't sneak back in later. Functional non-goals
(capabilities we won't build) and non-functional non-goals (quality
dimensions we won't aim for) both belong here.
```

Cover, in this product's words: a domain algorithm you will not build, an expensive capability you will not build (local model, realtime sync, multi-region), a secondary persona or admin surface, a quality bar you will not aim for (offline-first, WCAG-AA, sub-100ms), and "Other (you tell me)".

Each pick becomes one Non-Goal line plus a one-line rationale. Technology avoids ("avoid PHP", "avoid a monorepo") go to `## Forward: tech-stack`, not Non-Goals. Lock, write, checkpoint, then Step 7.

## Step 7: Soft-gate cross-check

Re-read `shape-notes.md`. Mark each item `present` or `missing/weak`:

1. **Access Control** — `## Access Control` states one of: login, local profile, access key, or no auth. A heading alone, `TBD`, or `TODO` is `missing`.
2. **Business Logic** — opens with one declarative sentence, not a paragraph and not "TBD".
3. **Project artifacts** — this file exists with a valid `checkpoint:` block (true by this point).
4. **Timeline-cost ack** — `mvp_weeks` ≤ 3, or `## Timeline acknowledgment` records that the user accepted the longer cost.
5. **Non-Goals** — at least one entry.

Do not check Testing Strategy, Deployment & CI/CD, or Implementation Decisions.

```
═══════════════════════════════════════════════════════════
  QUALITY CROSS-CHECK
═══════════════════════════════════════════════════════════

  Access Control:           [present | missing — describe]
  Business Logic:           [...]
  Project artifacts:        present
  Timeline-cost ack:        [present | missing — describe]
  Non-Goals:                [...]

═══════════════════════════════════════════════════════════
```

For each gap, name it and one consequence. Example: "Business Logic: not captured as a one-sentence rule — your PRD will be hollow without a domain decision."

Ask "How would you like to proceed?"

- "Address gaps now" — user picks the gap; re-run only the owning step (1–6); return here.
- "Accept and finish" — set `quality_check_status` to `accepted` if all five are present, otherwise `warned`. Append `## Quality cross-check` listing every gap by name with its one-line consequence.
- "Restart phase [N]" — re-run that step; overwrite its own sections only.

Then checkpoint with phase 7 complete and `current_phase: 8`. Go to Step 8.

## Step 8: Hand off

Confirm `quality_check_status` is `warned` or `accepted` (never `pending`). Set `updated` to today. Confirm the 10 body sections are in schema order and every `## Forward:` block stays outside them.

Copy `/prd` to the clipboard: `Set-Clipboard "/prd"` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere.

```
═══════════════════════════════════════════════════════════
  SHAPE COMPLETE
═══════════════════════════════════════════════════════════

  Project:                [project name]
  Phases captured:        1, 2, 3, 4, 5, 6
  FRs drafted:            [count]
  Quality check:          [warned | accepted]

  ► Notes:  context/foundation/shape-notes.md
  ► Next:   /prd  (✓ copied to clipboard)

  After /prd, the next chain step picks up tech-stack selection, then bootstrap.
  None of those belong in PRD itself.
═══════════════════════════════════════════════════════════
```

Stop. The user runs `/prd` when ready.
