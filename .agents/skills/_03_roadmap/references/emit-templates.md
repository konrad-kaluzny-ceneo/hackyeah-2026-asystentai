# Emit templates

Read the named block when a step points here. Copy the shape. Fill placeholders from the PRD, the baseline, and the locked framing. Do not invent a different layout.

## PRD readiness check

```
PRD readiness check (heuristic, 4 signals, 1 point each):
  [✓|✗] Vision & Problem Statement non-trivial
  [✓|✗] ≥ 1 populated user story
  [✓|✗] ≥ 1 must-have FR
  [✓|✗] Business Logic populated

  Score: <N>/4
  Open Questions in PRD: <count>
```

## Hollow PRD

```
This PRD scored <N>/4 on the roadmap-readiness heuristic. Missing signals:

  - <signal name>: <one-line consequence for the roadmap>
  - ...

A roadmap generated from a hollow PRD will have many slices marked Status:
blocked with their first Unknown being a PRD gap. That's a valid intermediate
state — the roadmap surfaces what's blocking — but if you have time to firm
up the PRD first, the resulting roadmap will be substantially more actionable.
```

## Codebase baseline

```
Codebase baseline (auto-researched):

  Frontend:      <present | absent | partial> — <one line, with file pointer>
  Backend/API:   <…>
  Data:          <…>
  Auth:          <…>
  Deploy/infra:  <…>
  Observability: <…>
```

## Framing recap

Emit as markdown. This shape is for a Polish PRD; translate the labels when the PRD is not Polish.

```markdown
Locking in the roadmap framing:

- **Cel sekwencjonowania: `<main_goal>`.** <Tie the answer to the artifact.>
- **Gwiazda przewodnia: `<S-NN candidate> — <Outcome>`.** <Tie it to the primary Success Criterion.>
- **Główne ryzyko / blocker: `<top_blocker>`.** <Name the signal: question count, vendor, deadline mismatch.>
- **Inwestycje: w `<layer>` głęboko; reszta lekko.** <Derived, not asked.>

Powiedz "go" żeby ruszyć dalej, albo nadpisz dowolną linię ("inwestycja powinna być w data, nie infra"). Nie będę pytał ponownie o to, co już ustaliliśmy.
```

## Self-review abort

```
Roadmap self-review FAILED:

  - <specific failure, e.g., "FR-007 (must-have) is not covered by any slice"
     or "Slice S-04 lists S-06 in Prerequisites, but S-06 comes later in the doc"
     or "F-02 (auth scaffold) is redundant — Baseline reports auth as present">
  - ...

The roadmap was NOT written. Fix the failure and regenerate, or — if a check is
wrong — file a skill bug. Self-review aborts protect downstream tooling from
drift.
```

## Handoff banner

```
═══════════════════════════════════════════════════════════
  ROADMAP GENERATED
═══════════════════════════════════════════════════════════

  Project:           <project>
  Path:              context/foundation/roadmap.md
  Main goal:         <main_goal>            (sequencing bias)
  #1 blocker:        <top_blocker>          (what to plan around)
  Baseline present:  <comma-separated layers reported present>
  Foundations:       <count>
  Slices:            <count>
  Status breakdown:  ready: N  |  proposed: M  |  blocked: K
  PRD coverage:      <covered must-have FRs> / <total must-have FRs>
  Open Roadmap Q:    <count>
  Parked items:      <count>

  North star:  <Slice ID> — <Outcome>

═══════════════════════════════════════════════════════════
```

## Next move

```
► **Your next move:** `/plan <change-id>` on **<Roadmap ID>: <Outcome>**.

  Why this one first: <one sentence — it is the north star, it unblocks the
  north star, it has the highest fan-out, or it is the smallest end-to-end
  validation available now>.

  After that, in order: <next ready ID>: <Outcome> → <next>: <Outcome>.
  (Full list in `## Backlog Handoff`.)

  Blocked — stay parked until their Unknowns resolve:
    - <Slice ID>: <Unknown> (Owner: <who>)
  (Resolving any of these promotes its slice to `ready` and changes my
  recommendation; come back and I'll re-recommend.)
```

## No planning move

```
► **No planning move is available yet.** Every slice is blocked.
  Highest-leverage unknown to resolve next:

    <Question> — Owner: <who>. Unblocks: <S-NN, S-MM, ...>.

  Resolving this promotes <count> slices and is the single change that
  most opens the roadmap. Resolve it, then re-invoke `/roadmap` to
  re-recommend.
```
