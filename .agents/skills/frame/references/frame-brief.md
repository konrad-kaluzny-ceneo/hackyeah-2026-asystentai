# Frame Brief

Write this to `context/changes/<change-id>/frame.md` at Step 6. One file per change. About 80–150 lines. The hypothesis table is the center.

```markdown
# Frame Brief: <topic>

> Framing step before /plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

<Literal observable effect or stated scope/design question — copied from Step 1, unchanged.>

## Initial Framing (preserved)

- **User's stated cause or approach**: <from Step 1>
- **User's proposed direction**: <from Step 1>
- **Pre-dispatch narrowing**: <from Step 1.5, in the user's words. "not separated yet" is a valid answer.>

## Dimension Map

The observation could originate at any of these dimensions:

1. **<Dimension A>** — <what would go wrong, or what the framing assumes here>
2. **<Dimension B>** — <...>  ← initial framing
3. **<Dimension C>** — <...>

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| <Dimension A: brief claim> | <file:line, document:section, or an observation> | STRONG / WEAK / NONE |
| <Dimension B: initial framing> | <evidence> | STRONG / WEAK / NONE |

## Narrowing Signals

- <Observation from Step 4 that ruled a dimension in or out>

## Cross-System Convention

<How this class of observation is usually handled, and whether the leading hypothesis matches.>

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: <one sentence — the root, not the surface>

<Two or three sentences on why this is the problem and what would change if it were addressed. If the original framing held: "The initial framing was correct — proceed with the originally proposed direction." Do not manufacture a reframe.>

## Confidence

- **HIGH** — strong evidence, matches the convention, and a decisive narrowing signal
- **MEDIUM** — evidence points one way, but the convention or the signal is weaker
- **LOW** — inconclusive. Name the verification step required before /plan.

<Pick one. LOW lists that step.>

## What Changes for /plan

<One or two sentences. If nothing changes, say the original framing held.>

## References

- Source files: <file:line>
- Related research: `context/changes/<change-id>/research.md` (if present)
- Investigation tasks: <ids from Step 3>
```
