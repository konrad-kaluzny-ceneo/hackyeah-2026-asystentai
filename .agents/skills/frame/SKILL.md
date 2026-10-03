---
name: frame
description: >
  Challenge framing assumptions about WHAT to build before planning HOW.
  Helper, not a numbered step (1–7). Use when a bug and a proposed fix, a
  scope question, or a design choice arrive as one fact. Trigger: /frame,
  "fix", "bug", "broken", "root cause", "should we even", "is this the
  right", "challenge the assumption", "rethink", "before I plan", "zanim
  zaplanuję", "czy to właściwy problem". Optional before /plan, not in
  place of it.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Frame

Separate the observation from the stated cause, and the problem from the proposed direction, before anyone plans. `/plan` answers how to build it. This skill answers what is actually worth planning. A confirmed framing is a successful result. A manufactured reframe is a failure.

`/research` explores the codebase. This skill may read a research doc and does not replace it. `/plan` can take the Frame Brief as its first argument. `/plan-review` checks a plan. This skill checks the premise. The brief stands alone. Do not run `/plan`.

## Hard rules

1. **Observation, stated cause, and proposed direction stay separate** through every step. The brief keeps the Step 1 wording even after a reframe.
2. **No solution design.** No phases, file edits, or technical choices. One artifact: the reframed or confirmed problem.
3. **Narrowing options are observations or positions, never fixes.** That binds Step 1.5 and Step 4. A question whose answer picks a direction belongs to `/plan`.
4. **Hypotheses come from this material.** Read the files first. A hunch from another system may suggest a hypothesis. Only `file:line` or `document:section` evidence from this project goes in the brief.
5. **Investigate only plausible dimensions.** Two real dimensions means two agents. Cap at 5.
6. **Stop if it drags.** Typical budget: 2–4 sub-agent rounds and 2–5 questions. Past that, recommend reproduction or more evidence and stop.
7. **Do not edit code or write a plan.** If the user objects to the reframe, re-run Step 3 against that objection. Do not defend it.
8. **An archived path is refused.** Print `This change is archived. Open a new change with /new instead.` and stop.

## When to run

Run on bug-shape ("X is broken, let's build Y"), scope-shape, design-shape, or assumption-shape. Run also when `/plan` is about to start from a stated cause that no `file:line` in this repo confirms, including `context/changes/<change-id>/research.md` when that file exists.

Skip a mechanical change ("rename this function", "bump the dependency"), a framing the user already verified ("I've confirmed it — plan the fix"), or a scoped feature with no premise to challenge.

## How to ask

Use the host's structured question tool.

## Entry

Strip a leading `@`.

- A `<change-id>` → read `context/changes/<change-id>/research.md` fully when it exists, then Step 1.
- A file path → read it fully, then Step 1.
- An inline description → Step 1.
- Nothing → print this and wait:

```
I'll help you check whether you're framing the right problem before planning a solution.

Please share:
1. The observation — what is happening, what you're seeing, or what scope you're considering?
2. Your initial framing — what you think is causing it, the approach you have in mind, or the way you'd cut the work?
3. (Optional) Any related research, prior incidents, or files I should read

Tip: pass research directly — `/frame @context/changes/<change-id>/research.md` (or just `<change-id>`)
```

## Step 1: Capture

Read `context/foundation/lessons.md` when it exists. Framing lessons are priors for the map in Step 2, not evidence. Read every file the user named, fully.

Record three distinct things:

- **Reported observation** — the effect or the scope question. Not a cause. Not a fix.
- **Stated cause or approach** — their theory.
- **Proposed direction** — what they want to do.

No clear framing ("something feels off, fix it") → omit that bullet and say the run is observation-driven. The rest of the protocol still applies.

Echo this and treat it as locked. Do not collapse the three if they say "just plan the fix".

```
Let me make sure I have this right:

  Observation (what's stated):     <literal effect or scope/design question>
  Your initial framing:            <their theory or approach>
  Your proposed direction:         <what they want to do>

I'm going to question the framing before we plan the work. The observation is fixed
ground — that's what we know. Everything else is a hypothesis until verified.
```

## Step 1.5: Narrow the observation

Always, before the map and before any sub-agent. One round. The question disambiguates observation and scope.

Ask: "Which of these items is the leading concern? Is this one observation or several? Is the observable a single symptom or a class of symptoms?"

- "This is the leading concern" — Focus on this specific observation.
- "These are several observations" — Treat these as distinct issues.
- "This is a single symptom" — It's one specific problem.
- "This is a class of symptoms" — It represents a broader category of issues.
- "I'm not sure / haven't separated them yet" — I need help distinguishing between these.

Record the answer beside the Step 1 capture. It becomes the brief's `Pre-dispatch narrowing` line. It does not replace the Step 1 wording.

## Step 2: Dimension map

Build the map for this situation. Read the named files and their neighbors. Trace the path from the stated cause to the observation: data flow, a chain of decisions, or a stack of assumptions. A dimension belongs only when a break there would produce roughly this observation, and only when you have seen evidence of it.

When the path from the stated cause to the observation is not contained in the named files and their neighbors, spawn one or two Explore agents: "Trace the path from <stated cause> to <observed effect>. List every distinct stage or axis, with file:line or document:section." The map is what they return.

Mark which node is the user's framing. Print:

```
The observation could originate at any of these dimensions:

  1. <Dimension A> — <what would go wrong, or what the framing assumes>
  2. <Dimension B> — <...>   ← user's current framing
  3. <Dimension C> — <...>

Going to investigate each in parallel before deciding.
```

## Step 3: Hypothesis agents

One task per plausible dimension. Spawn 2–4 agents, never more than 5, in one message.

Each prompt includes the Step 1 observation verbatim, the dimension, and: "What would we see if THIS were where the framing breaks? Look for that. Report present, partial, or absent, with file:line or document:section." Read-only. Explore for "find the code or document". General-purpose for "does assumption Y hold along this chain".

After they return, grade each hypothesis from the Step 3 report: strong = present, with `file:line` or `document:section` that would produce the Step 1 observation; weak = partial, the citation is adjacent but does not produce it; none = absent. A hypothesis with strong evidence that is not the user's framing is the candidate reframe.

## Step 4: Narrowing questions

Options are observations or positions, not causes or fixes. Each question rules one or two dimensions in or out. Headers stay short: "Pattern", "When", "Scope", "Tradeoff". Two to five questions. Every question includes "I'm not sure / haven't checked".

One hypothesis strong and the others none → skip, and say: `Step 3 found strong evidence for <hypothesis> and none for the others. Skipping the questioning step; reframing directly.`

## Step 5: Pressure-test

Use the checks that fit. Do not only confirm the favorite.

- A fresh Explore agent that is not told the leading hypothesis. Give it only the observation: "What in this system or design space is most likely responsible?"
- Search `context/changes/`, `context/archive/`, commit messages, and issues for a similar observation or scope decision.
- Check a prediction you have not checked, and something that should be absent if the hypothesis is true.
- If the original framing still fits the evidence as well, do not replace it with a tidier one.

A pass locks confidence. A credible alternative or a contradiction → stop and re-run Step 3 with that hypothesis on the map.

## Step 6: Write the brief

- `/frame <change-id>` and `context/changes/<change-id>/` exists → write there.
- Otherwise derive a kebab-case id from the observation. `context/changes/` must already exist. The id matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` and is unused in `context/changes/` and `context/archive/`. Create the folder and `change.md` in the `/new` shape: `change_id`, `title` (sentence case, ≤80 characters, no trailing period), `status: new`, `created` and `updated` today, `archived_at: null`, and a Notes section. Do not invoke `/new`.
- Path under `context/archive/` → the refusal in the hard rules.

Set `updated` to today. If `status` is `new`, set `preparing`. Leave every other field.

Read [references/frame-brief.md](references/frame-brief.md) and write `context/changes/<change-id>/frame.md`.

## Step 7: Hand off

```
═══════════════════════════════════════════════════════════
  FRAME COMPLETE: <topic>
  Confidence: <HIGH/MEDIUM/LOW>
═══════════════════════════════════════════════════════════

  Reported observation: <one line>
  Initial framing:      <one line>
  Reframed problem:     <one line, or "Initial framing held">

  ► Brief: context/changes/<change-id>/frame.md
═══════════════════════════════════════════════════════════
```

Ask "Frame done. How would you like to proceed?" Header: `Next step`.

- "Hand off to /plan" — Pass this brief to /plan and start implementation planning.
- "Reproduce / verify first" — Confidence is too low or the reframe needs a manual check before planning.
- "Discuss before planning" — I want to push back on the reframe or explore alternatives.
- "Stop here" — The brief alone is enough — no plan needed right now.

Hand off → copy `/plan <change-id>` (`Set-Clipboard` on PowerShell; elsewhere `pbcopy`, then `clip.exe`, then `xclip -selection clipboard`) and print `→ /plan <change-id> (✓ copied)`. Stop. Do not run it.
