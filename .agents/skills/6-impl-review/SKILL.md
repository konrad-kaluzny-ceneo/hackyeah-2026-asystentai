---
name: impl-review
description: >
  Review implementation against the plan for drift, dangerous decisions, and
  pattern misuse. Use when the user says /impl-review, "review the
  implementation", "sprawdź implementację", or after /implement for one phase
  or the whole plan. Resumes triage from a saved impl-review report.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Implementation review

Compare the code to the plan. A phase review covers that phase. A full review covers every phase whose Progress rows are all `[x]`. Edit the tree only when triage chooses a fix. Do not invent findings.

## Hard rules

1. **A finding names file:line and the mismatch.** "src/auth/handler.ts:42 builds SQL with string concatenation; the plan required a parameter" is a finding. "There might be a security issue" is not.
2. **Style that still follows the plan is not a warning.** Report a pattern only when siblings do it differently in a way that matters (auth skipped, naming that breaks callers).
3. **One fix by default.** A second fix only when each option has an upside the other lacks.
4. **Impact is decision effort, not severity.**
5. **Triage edits are minimal.** Do not refactor code that was not flagged. Do not argue after Skip.
6. **An archived plan is refused.** If the path starts with `context/archive/`, print `This change is archived. Reviews are not appended to archived plans.` and stop.

- Security: injection, hardcoded secrets, missing auth at a boundary, permissive CORS or permissions.
- Data safety: destructive database work without rollback, a schema change without a migration, data loss.

Flag Security or Data safety only when the diff shows that failure at `file:line`. When an H2 in `context/foundation/lessons.md` names the same failure, quote that H2 in Detail.

## How to ask

Use the host's structured question tool.

## Input

1. The file contains `<!-- IMPL-REVIEW-REPORT -->` → Step 5. Skip Steps 1–4.
2. `<change-id>` and `context/changes/<change-id>/plan.md` exists → that plan.
3. A plan path → that file. Strip a leading `@`.
4. `phase N` → only that phase. Otherwise every phase whose Progress rows are all `[x]`.
5. No argument → list `context/changes/*/change.md` with status `implementing` or `implemented`, newest `updated` first, and ask which to review.

If the host has a task list, one task named "Implementation Review". Set its label to the step you are in: Loading context, Gathering evidence, Verifying success criteria, Compiling findings, Triage.

## Step 1: Load

Read the plan fully. Read `context/foundation/lessons.md` if it exists. If the diff contradicts an H2 in that file, severity is WARNING or CRITICAL, and Detail quotes that H2. Progress shape: [../3-plan/references/progress-format.md](../3-plan/references/progress-format.md). Completion is the count of `[x]` over `[ ]` plus `[x]`. The current phase holds the first `- [ ]`, or the last phase when all are done. Read sibling `change.md` for `status` and `updated`.

From the phases in scope, take Changes Required paths, decisions, Automated and Manual criteria, and What We're NOT Doing.

**What changed.** Date is a `YYYY-MM-DD` in the path, otherwise `created` from `change.md`. Run `git log --oneline --after=<date>`. Take the oldest hash from `git log --reverse --after=<date> --format=%H`, then `git diff --name-only <hash>^..HEAD`. If that range fails, use commits whose messages mention the change-id.

- In the plan and in the diff → check that the content matches the intent.
- In the diff only → unplanned. Flag it.
- In the plan only → maybe missing.

Do not read every changed file here. The sub-agents read them. A single-phase review still checks whether this phase broke an assumption of an earlier phase.

## Step 2: Two sub-agents

Launch both in one message. Do not paste the whole plan into both.

**Drift** (general-purpose). Give it the Changes Required text and the paths to read. For each planned change: MATCH, DRIFT, MISSING, or EXTRA, with the path, what the plan said, and what is there. DRIFT is an intent mismatch, not formatting. EXTRA is scope creep. MISSING is a skipped item with no note.

**Safety and patterns** (general-purpose). Give it the changed-file list, the repo root, and the Security and Data safety bullets from Hard rules.

- Performance: N+1, unbounded loops, missing pagination, needless sync I/O.
- Reliability: no error handling at a network, file, or database boundary; races; leaks.

Flag Performance or Reliability only when the diff shows that failure at `file:line`. Quote a matching lesson H2 the same way as Security and Data safety.

- Patterns: for each changed file, compare with 1–2 siblings. Report only a real mismatch. Three changed files or fewer → a short pattern pass.

Each of its findings has file, line, category, severity CRITICAL / WARNING / OBSERVATION, description, and a recommendation.

## Step 3: Success criteria

For each reviewed phase, run every Automated Verification command and record pass or fail. Truncate huge output. On Windows separate chained commands with `;`.

Manual rows: `[x]` with nothing in the diff that could be that check is a possible rubber stamp. `[ ]` is pending, not a failure by itself.

## Step 4: Report

Each finding: `F1`, `F2`, …; severity; impact; one dimension; title; `file:line` or `N/A`; detail with evidence; fixes.

| Impact | Meaning on the report |
| --- | --- |
| 🏃 LOW | quick decision; fix is obvious and narrowly scoped |
| 🔎 MEDIUM | real tradeoff; pause to reason through it |
| 🔬 HIGH | architectural stakes; think carefully before deciding |

LOW impact: `Fix: <one line>`. MEDIUM and HIGH: Strength, Tradeoff, Confidence HIGH/MED/LOW with why, Blind spot or "None significant". Two options → exactly one `⭐ Recommended`.

| Dimension | FAIL when |
| --- | --- |
| Plan Adherence | MISSING or DRIFT (intent mismatch, Step 2) |
| Scope Discipline | WARNING if an EXTRA change is harmless |
| Safety & Quality | any CRITICAL finding |
| Architecture | a boundary or dependency violation |
| Pattern Consistency | WARNING for a real inconsistency |
| Success Criteria | an automated check failed |

- **APPROVED** — every dimension is PASS, or at most two dimensions are WARNING and every other dimension is PASS.
- **NEEDS ATTENTION** — three or more dimensions are WARNING, or one dimension is FAIL and that FAIL is not on the REJECTED list.
- **REJECTED** — a dimension is FAIL for security, data safety, a failing automated check, or Plan Adherence.

A flawed plan (it specified an unsafe approach) is a finding too.

Sort CRITICAL, then WARNING, then OBSERVATION. Cap at 10. Merge findings that are the same problem.

No findings → verdict table, all PASS, overall APPROVED, and stop.

Otherwise read [references/report-format.md](references/report-format.md) and print that chat report. Then ask "Review complete. How would you like to proceed?" Header: `Implementation Review — <N> findings`.

- "Triage findings" — Step 5.
- "Save report & triage later" — save, print the path, tell them `/impl-review <saved-report-path>`.
- "Save report only" — save and stop.

Saving uses the saved-file shape in the reference. Set `change.md` `status: impl_reviewed` and `updated` to today.

## Step 5: Triage

Resume: `### F` sections with Decision PENDING. None → print `All findings triaged.` and stop.

Walk the rest in severity order. Header: `Finding <current> of <total remaining>`.

Two fixes:

- "Apply Fix A ⭐"
- "Apply Fix B"
- "Skip" — not worth it now
- "Record as lesson" — save a recurring rule

One fix:

- "Fix now"
- "Fix differently"
- "Skip"
- "Record as lesson"

Apply Fix A, Apply Fix B, or Fix now: show before and after, ask "Apply this?", then edit. Decision: `FIXED` and name the option. Fix differently: they describe it, then the same. Skip → `SKIPPED`.

Free text: "fix differently" → ask, edit, `FIXED`. "Accept risk" → `ACCEPTED` plus their reason. "Dismiss" or "disagree" → `DISMISSED`.

**Record as lesson.** Show the Confirm block from [../lesson/SKILL.md](../lesson/SKILL.md). On this path, pre-fill Context with the finding location and Problem with the detail. Leave Rule and Applies to empty for the user. `/lesson`'s "pre-fill nothing" rule does not apply here.

Ask "Approve this entry?" with "Approve this entry", "Edit before saving", and "Cancel". Approve appends the H2 to `context/foundation/lessons.md`. If the file is missing, create it with the header under Append in [../lesson/SKILL.md](../lesson/SKILL.md), then append the entry.

Do not reorder or edit older lessons. After a successful append, always ask "Lesson saved. Also apply the fix to the current code?"

- "Yes — fix now" — show before and after, edit, Decision `FIXED + ACCEPTED-AS-RULE: <rule title>`.
- "No — lesson only" — Decision `ACCEPTED-AS-RULE: <rule title>`.

Never skip that question.

If a saved report is open, update its Decision after each answer. When triage was chosen, append each non-FIXED finding to `context/changes/<change-id>/follow-ups/review-fixes.md` as `- F1 — <Decision> — <title>`. Create the folder if needed. Do not create the file when every finding was FIXED.

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2 (Fix A)   (2)
  Rule:      F3 (+ fixed)     (1)
  Skipped:   F4               (1)
  Accepted:  F5               (1)

═══════════════════════════════════════════════════════════
```

Mark the review task completed. Stop.
