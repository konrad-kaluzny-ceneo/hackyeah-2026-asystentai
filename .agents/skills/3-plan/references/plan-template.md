# plan.md template

Read this at Step 4. Checkbox rules are in [progress-format.md](progress-format.md). Do not leave open questions in the file. Each decision is already made.

Phase Success Criteria are plain `- ` bullets. The matching `- [ ]` rows live only in `## Progress`.

`## Critical Implementation Details` is omitted unless a constraint is surprising or load-bearing. A plan without it is complete. When included, 1–3 sentences, and only the headings that apply:

- Timing and lifecycle — a non-obvious order, race, or hook
- User experience — behavior you cannot derive from the requirements
- Performance — a real budget or a known hotspot, not generic memoization advice
- State sequencing — the obvious order is wrong
- Debug and observability — a specific check beyond ordinary logging

Under `### Changes Required`, each file has `**Intent**` (what and why, 1–2 sentences) and `**Contract**` (the interface, signature, schema field, route, structure, or invariant). A code snippet belongs at the end of Contract only when the change is non-obvious: a tricky regex, an unusual API call, a counterintuitive order, a workaround, or a signature later phases depend on. Routine edits get no snippet.

Automated commands, pick only what the phase touches. On Windows separate commands with `;`. Do not invent `make` targets.

- Parser hot-spots: `pnpm run quality:parser-floor`
- Frontend hot-spot: `cd src/qa.monitoring.frontend; pnpm run lint` and `pnpm exec vitest related path/to/file.ts --run --passWithNoTests`
- Broad backend: `dotnet test src/Qa.Microservice.Monitoring.sln` (integration needs Docker for Testcontainers)
- Broad frontend tests: `cd src/qa.monitoring.frontend; pnpm run test`
- One spec: `cd src/qa.monitoring.frontend; pnpm exec vitest run path/to/file.spec.ts`
- After an OpenAPI contract change: run the microservice, then `cd src/qa.monitoring.frontend; pnpm run generate-client`

```markdown
# <Feature name> Implementation Plan

## Overview

<what and why>

## Current State Analysis

<what exists, what is missing, constraints>

## Desired End State

<what is true when this plan is done, and how to verify it>

### Key Discoveries:

- <finding with file:line>
- <pattern to follow>
- <constraint>

## What We're NOT Doing

<out of scope>

## Implementation Approach

<strategy>

## Phase 1: <name>

### Overview

<what this phase accomplishes>

### Changes Required:

#### 1. <component or file group>

**File**: `path/to/file.ext`

**Intent**: <what and why>

**Contract**: <interface, signature, schema, route, or heading>

### Kryteria sukcesu

#### Automated Verification:

- <command that applies to this phase>

#### Manual Verification:

- <human check>

**Implementation Note**: After this phase's automated checks pass, pause for the human to confirm the manual checks before the next phase.

---

## Testing Strategy

### Unit Tests:

- <what to test>
- <edge cases>

### Integration Tests:

- <end-to-end scenario>

### Manual Testing Steps:

1. <step>

## Performance Considerations

<omit the section if there is no real budget or hotspot>

## Migration Notes

<omit the section if nothing existing must move>

## References

- Related research: `context/changes/<change-id>/research.md`
- Similar implementation: `<file:line>`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: <phase name>

#### Automated

- [ ] 1.1 <automated item>

#### Manual

- [ ] 1.2 <manual item>
```

Repeat the phase block for each phase. Common phase order when it fits: database changes go schema, then store, then logic, then API, then clients. A new feature goes patterns, then data model, then backend, then API, then UI. A refactor documents current behavior, then incremental changes, then compatibility, then migration.
