---
name: plan
description: >
  Create a detailed implementation plan through research and a
  complexity-scaled question round, then write plan.md and plan-brief.md.
  Use when the user says /plan, "write the plan", "zaplanuj", or hands a
  change-id, frame.md, or research.md to turn into phases. Use AFTER /frame
  or /research when those exist, BEFORE /implement.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Plan

Interactive plan. Do not write `plan.md` until every confirmed question has a decision. Do not run `/implement`.

## Hard rules

1. **Read named files fully, yourself, before any sub-agent.**
2. **Upstream docs are decisions.** Do not re-ask them. A frame owns the problem. This skill owns the solution.
3. **Ask the scaled question count.** Do not pad, and do not skip the round when the only input is a task description.
4. **No open questions in the final plan.** Stop and resolve them first.
5. **Intent and contract, not a pre-written implementation.** Snippets only when the change is non-obvious. Rules: [references/plan-template.md](references/plan-template.md).
6. **Checkboxes live only in `## Progress`.** [references/progress-format.md](references/progress-format.md).
7. **An archived change is refused.** Print `This change is archived. Open a new change with /new instead.` and stop.

## How to ask

Use the host's structured question tool. One option is `⭐ Recommended`. Description shape and category lists: [references/question-categories.md](references/question-categories.md). Read that file before the question round.

## Entry

A path, ticket, or change-id → read those files fully and start Step 1. No argument → print the block below and wait.

```
I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/ticket description (or reference to a ticket file)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

The more upstream context you pass in, the fewer questions I'll ask:
- Just a task description → full questioning
- Task + research doc (`context/changes/<change-id>/research.md`) → fewer questions; I won't redo what research covered
- Task + frame brief (`context/changes/<change-id>/frame.md`) → far fewer questions; the problem framing is already settled
- Task + frame + research → minimum questions; I focus only on solution-design decisions that need your input

Tip: invoke directly with a change-id or path — `/plan oauth-login` or `/plan @context/changes/oauth-login/frame.md`
For deeper analysis, try: `/plan think deeply about @context/changes/oauth-login/research.md`
```

## Step 1: Context and questions

### 1.0 Scale

| Input | LOW | MEDIUM | HIGH | Skip |
| --- | --- | --- | --- | --- |
| Task only | 4–6 | 7–10 | 11–15 | Nothing |
| Task + research | 3–5 | 5–7 | 8–11 | Answers already in the research doc. Do not re-find files it already cites. |
| Task + frame | 2–3 | 4–6 | 7–9 | Every `[D]` category. The Reframed or Confirmed Problem Statement is the task. |
| Task + frame + research | 1–2 | 3–5 | 5–7 | Both of the above. Ask only `[S]` decisions the docs do not settle. |

A frame is `context/changes/<change-id>/frame.md`, or a doc that starts with `# Frame Brief:` or contains `## Reframed`. A research doc is `research.md`, or frontmatter with `topic:` and `researcher:`. An existing `plan.md` is a resume: read it and refine, do not apply this table as a fresh interview.

Frame present: copy Reported Observation and the Reframed or Confirmed Problem Statement into the task. Lift Hypothesis Investigation and Narrowing Signals into Current State Analysis. If Confidence is LOW, put that in Open Risks and ask one question: verify first, or plan with the risk named. Do not re-investigate the framing.

Research present: its Code References are the codebase baseline. Architecture Insights feed Current State Analysis. Spawn a sub-agent only for a gap the doc does not cover.

Also read `context/foundation/lessons.md` when it exists. A lesson already accepted is not a fresh design question.

### 1.1 Research, then confirm complexity

Spawn 2–3 Explore agents in parallel for gaps only: related files, a similar implementation, prior decisions under `context/changes/**/` and `context/archive/**/`. Use general-purpose when the gap needs many files. Wait for all of them. Then read, fully, the files they name that you have not read.

Print what you found (ticket or description, then 2–3 discoveries with file references). Then:

```
**Complexity Assessment: [HIGH / MEDIUM / LOW]**

<2–3 sentences: systems touched, integration, state, data model, unknowns, test surface>

I'd like to ask **[N] questions** about <decision areas>.

Does this feel right, or would you adjust the complexity level?
```

Ask "Does this complexity assessment match your expectations?"

- "Agree — proceed with [N] questions (Recommended)"
- "Higher — ask more questions" — they name what is missing; recount
- "Lower — fewer questions needed" — recount

LOW is a single-file or single-topic change. MEDIUM touches several interacting parts. HIGH is cross-cutting, easy to get expensively wrong. After they confirm, ask N questions from [references/question-categories.md](references/question-categories.md).

## Step 2: Discovery

Answer implementation questions yourself.

If the user corrects a fact, do not just accept it. Read the files they name or spawn a search, then proceed from what you verified.

When several approaches are real, ask which one, with the same option shape. When one approach matches the codebase, state it and why. Do not ask.

Print a short current-state summary before that choice.

## Step 3: Outline

```
Here's my proposed plan structure:

## Overview
<1–2 sentences>

## Implementation Phases:
1. <name> - <what it accomplishes>
2. <name> - <what it accomplishes>
3. <name> - <what it accomplishes>
```

Ask "Does this phase breakdown look right?"

- "Looks good, proceed (Recommended)"
- "Needs adjustment" — wait for the change, then rewrite the outline
- "Too granular" — merge phases
- "Too coarse" — split phases

## Step 4: Write the plan

- `/plan <change-id>` and `context/changes/<change-id>/` exists → use it.
- Otherwise derive a kebab-case id and create the folder plus `change.md` the way `/new` does.
- Path under `context/archive/` → the refusal in the hard rules. Stop.
- Set `change.md` `status: planned` and `updated` to today.

Read [references/plan-template.md](references/plan-template.md) and write `context/changes/<change-id>/plan.md` from it.

## Step 4.5: Brief

Read [references/plan-brief.md](references/plan-brief.md) and write `context/changes/<change-id>/plan-brief.md`.

## Step 5: Review

Confirm both files exist. Copy `/implement <change-id> phase 1` to the clipboard (`Set-Clipboard` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere).

```
I've created the implementation plan:

📋 Brief (start here): `context/changes/<change-id>/plan-brief.md`
📄 Full plan: `context/changes/<change-id>/plan.md`

→ /implement <change-id> phase 1 (✓ copied)

Review the brief first, then check the full plan for anything that needs adjustment:
- Are the phases properly scoped?
- Are the success criteria specific enough?
- Any technical details that need adjustment?
- Missing edge cases or considerations?
```

Revise until the user is satisfied. Add phases, change the approach, tighten criteria, move scope. Do not run `/implement`.

If the conversation is too full to keep editing well, the draft is already on disk. Offer a fresh window and copy `/plan <change-id>`.

Sub-agents stay read-only, one area each, and must return `file:line`. Synthesize their summaries. Re-read a file only to verify a claim you will put in the plan.
