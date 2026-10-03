---
name: plan-review
description: >
  Review an implementation plan for substance, feasibility, and architectural
  fitness before any code is written. Use when the user asks to review a plan,
  says "is this plan good", "check my plan", "review this plan", "sprawdź plan",
  "przejrzyj plan", or wants validation after /plan and before /implement.
  Also resumes triage from a saved plan-review report.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Plan review

Ask whether this plan will work. `/impl-review` asks whether the build matched the plan. Do not rewrite `plan.md` except when triage applies a fix the user chose. A plan with no findings gets a short SOUND verdict and a stop. Do not invent findings.

## Hard rules

1. **A finding names the plan's claim and the contradicting evidence.** "Phase 3 adds a second event bus beside `src/core/events.ts`" is a finding. "Architecture might have issues" is not.
2. **FAIL means a phase cannot be executed as written, or the phases cannot reach Desired End State. WARNING means the end state is still reachable, and the finding names a missing path, an extra phase, or an unmarked break.**
3. **One fix by default.** A second fix only when each option has an upside the other lacks. A weak extra option is not a tradeoff.
4. **Impact is decision effort, not severity.** A CRITICAL with an obvious fix is LOW impact. A WARNING with a wide tradeoff is HIGH impact.
5. **Triage edits touch only the lines the chosen fix names.** Do not restructure the plan for one finding. Do not argue after Skip, Accept risk, or Disagree.
6. **An archived plan is refused.** If the path starts with `context/archive/`, print `This change is archived. Reviews are not appended to archived plans.` and stop.

## How to ask

Use the host's structured question tool. Recommended option first when there is one.

## Input

1. The file contains `<!-- PLAN-REVIEW-REPORT -->` → resume at Step 7. Skip Steps 1–6.
2. Argument is `<change-id>` and `context/changes/<change-id>/plan.md` exists → that plan.
3. A plan path (`@context/changes/<change-id>/plan.md`) → that file. Strip a leading `@`.
4. No argument → list `context/changes/*/plan.md`, newest `change.md` `updated` first, and ask which to review.
5. `--quick` → document-only. Skip Step 3. Mode label is Quick. Otherwise Deep.

## Step 1: Read and scan the plan against itself

Read the plan fully. Read sibling `plan-brief.md` if it exists. Read `context/foundation/lessons.md` if it exists. A finding that repeats an accepted lesson weighs more, not less.

Extract Desired End State, Success Criteria, Current State Analysis, What We're NOT Doing, phases (paths, changes, dependencies), decisions, assumptions, and `## Progress`. Progress shape: [../3-plan/references/progress-format.md](../3-plan/references/progress-format.md).

- **Contradiction** — a limitation in Current State Analysis that a phase ignores, or a NOT Doing item that reappears in a phase.
- **Promise gap** — a capability in Desired End State, Success Criteria, or Migration Notes with no phase that builds it.
- **Contract break** — step B needs a token or id from step A, and A's response does not include it. Also an unresolved choice the implementer would have to guess (which endpoint, which auth, where rate-limit state lives).
- **Contract surfaces** — if `docs/reference/contract-surfaces.md` exists, take its H2 headings and search the plan for each name. For a hit, read that H2 and check that the plan reports the current shape and that a rename or schema change is marked breaking, with a migration for consumers. If the file is absent, skip this check.
- **Progress** — exactly one `## Progress` at the bottom. Each `## Phase N: <name>` has `### Phase N: <name>` in Progress. Every Success Criteria bullet under `#### Automated Verification:` or `#### Manual Verification:` has a matching `- [ ] N.M <title>` or `- [x]` in that phase's Progress subsection. Phase bodies are plain `- ` bullets. Any miss is CRITICAL under Plan Completeness.

## Step 2: Grounding

No sub-agents. Confirm at least five file paths the plan says it will modify exist. A missing path is critical. Search for functions and config keys the plan names. Compare phases, decisions, and scope with `plan-brief.md` when it exists.

Print one line, and raise a finding only on failure:

`Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓`

## Step 3: Deep check

Skip when the mode is Quick.

Pick the 3–5 claims that would force the most rework if wrong. Launch one sub-agent with three jobs, and give it those questions plus the relevant paths. Do not paste the whole plan.

1. For each claim: what the code shows, whether it confirms or contradicts the plan, with `file:line`.
2. Blast radius: callers and importers of the functions, constants, or endpoints the plan changes that the plan does not mention.
3. Pattern check, only if the plan introduces a new pattern: the touched area already solves this.

## Step 4: Five dimensions

Write a finding only when it names the plan's claim and the contradicting evidence (Hard rule 1). A preference with no contradicting evidence is not a finding.

- **End-State Alignment** — walking the phases, does the system reach the end state? Could every success criterion pass while the goal is still unmet?
- **Lean Execution** — if this phase were removed, would the end state still be reachable? Premature abstraction, "while we're here" work, a framework where a function would do.
- **Architectural Fitness** — fits the existing system. New pattern beside one that already works. Dependency direction. A phase that touches shared code across modules. "Refactor as needed" with no boundary.
- **Blind Spots** — missing error path, no rollback if a later phase fails, cost at the expected volume, a default that multiplies cost or time, a test gap, a security boundary.
- **Plan Completeness** — specific paths, changes at function or method level, success criteria with commands that can be run. No TBD, TODO, or placeholder.

## Step 5: Findings

Each finding: ID `F1`, `F2`, …; severity CRITICAL / WARNING / OBSERVATION; impact LOW / MEDIUM / HIGH; one dimension; one-line title; location (section or phase); detail with evidence; fix options.

| Impact | Meaning on the report |
| --- | --- |
| 🏃 LOW | quick decision; fix is obvious and narrowly scoped |
| 🔎 MEDIUM | real tradeoff; pause to reason through it |
| 🔬 HIGH | architectural stakes; think carefully before deciding |

LOW impact: `Fix: <one line>`. MEDIUM and HIGH: one sentence, then Strength, Tradeoff, Confidence HIGH/MED/LOW with why, and Blind spot (or "None significant"). Two options → exactly one `⭐ Recommended`.

Dimension verdicts: FAIL when that dimension has a CRITICAL finding, WARNING when it has WARNING findings and no CRITICAL, PASS when it has neither. OBSERVATION does not change the dimension verdict.

- **SOUND** — zero FAIL, and at most two WARNING. Safe to implement.
- **REVISE** — three or more WARNING, or exactly one FAIL whose fix stays inside the current approach.
- **RETHINK** — two or more FAIL, or walking the phases cannot reach Desired End State.

Sort CRITICAL, then WARNING, then OBSERVATION. Cap at 10. Merge findings that cite the same plan claim.

No findings → print the verdict table, all PASS, overall SOUND, and stop.

## Step 6: Report

Read [references/report-format.md](references/report-format.md) and print that chat report.

Then ask "Plan review complete. How would you like to proceed?" Header: `Plan Review — <N> findings`.

- "Triage findings" — Step 7.
- "Save report & triage later" — save, print the path, tell them to run `/plan-review <saved-report-path>`.
- "Save report only" — save and stop.

Saving writes `context/changes/<change-id>/reviews/plan-review.md` in the saved-file shape from the reference. Set `change.md` `status: plan_reviewed` and `updated` to today.

## Step 7: Triage

Resume: read the saved file, take `### F` sections whose Decision is PENDING. None pending → print `All findings triaged` and stop.

Walk the rest in severity order. For two fixes, ask with header `Finding <current> of <total remaining>` and options:

- "Apply Fix A ⭐" — the recommended one-liner
- "Apply Fix B"
- "Fix differently" — they describe it
- "Skip" — not now
- "Accept risk" — they will handle it in implementation
- "Disagree" — dismiss it

One fix replaces the first two labels with "Fix in plan".

Apply Fix, Fix in plan, or Fix differently: show the plan edit as before and after, confirm, edit `plan.md`, set Decision to FIXED and name the fix. Skip → SKIPPED. Accept risk → ACCEPTED. Disagree → DISMISSED. If a saved file is open, update its Decision field after each answer.

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1 (Fix A), F3   (2)
  Skipped:   F4               (1)
  Accepted:  F2               (1)
  Dismissed: F5               (1)

  ► Verdict after fixes: <previous → updated, e.g. REVISE → SOUND>
═══════════════════════════════════════════════════════════
```

Stop.
