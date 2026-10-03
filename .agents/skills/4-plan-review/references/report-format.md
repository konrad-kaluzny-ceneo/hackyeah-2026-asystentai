# Plan review report

Read this at Step 6. Icons always sit next to a word (`❌ CRITICAL`, not a bare `❌`). The title line is only `F1 — <title>`. Severity, Impact, Dimension, and Location are each their own line. Impact includes the meaning from the skill's impact table.

Omit empty severity groups. PASS dimensions appear only in the verdict table.

## Chat report

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: <plan title>
  Mode: Deep / Quick  |  Date: YYYY-MM-DD
  Findings: <N critical> <N warnings> <N observations>
═══════════════════════════════════════════════════════════

  End-State Alignment    PASS    ✅
  Lean Execution         WARNING ⚠️   (<n> finding)
  Architectural Fitness  PASS    ✅
  Blind Spots            FAIL    ❌   (<n> finding)
  Plan Completeness      WARNING ⚠️   (<n> finding)

  Grounding: <n>/<n> paths ✓, <n>/<n> symbols ✓, brief↔plan ✓
  ► Overall: REVISE

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — <title>
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Blind Spots
    Location:  <phase or section>

    Detail:
    <plan claim versus what is true, or what is missing, with evidence>

    Fix A ⭐ Recommended: <one line>
      Strength:   <advantage grounded in the plan or the code>
      Tradeoff:   <cost>
      Confidence: HIGH — <why>
      Blind spot: <unverified point, or "None significant">

    Fix B: <one line>
      Strength:   <advantage>
      Tradeoff:   <cost>
      Confidence: MED — <why>
      Blind spot: <unverified point>

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — <title>
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW — quick decision; fix is obvious and narrowly scoped
    Dimension: Plan Completeness
    Location:  <phase>

    Detail:
    <what is wrong>

    Fix: <one line>
```

A LOW-impact finding has a single `Fix:` line and no Strength block. A MEDIUM or HIGH finding uses the Strength / Tradeoff / Confidence / Blind spot block. A second fix appears only when the skill's two-fix rule says so.

## Saved file

Path: `context/changes/<change-id>/reviews/plan-review.md`. One file per change. A rerun overwrites it.

```markdown
<!-- PLAN-REVIEW-REPORT -->
# Plan Review: <plan title>

- **Plan**: <plan path>
- **Mode**: Deep / Quick
- **Date**: YYYY-MM-DD
- **Verdict**: SOUND / REVISE / RETHINK
- **Findings**: <N critical> <N warnings> <N observations>

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS / WARNING / FAIL |
| Lean Execution | PASS / WARNING / FAIL |
| Architectural Fitness | PASS / WARNING / FAIL |
| Blind Spots | PASS / WARNING / FAIL |
| Plan Completeness | PASS / WARNING / FAIL |

## Grounding

<the grounding line>

## Findings

### F1 — <title>

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: <phase or section>
- **Detail**: <evidence>
- **Fix A ⭐ Recommended**: <approach>
  - Strength: <advantage>
  - Tradeoff: <cost>
  - Confidence: HIGH — <why>
  - Blind spot: <unverified point, or "None significant">
- **Fix**: <one line, when there is only one fix>
- **Decision**: PENDING
```

The marker `<!-- PLAN-REVIEW-REPORT -->` and `Decision: PENDING` are what resume mode looks for. After triage, `Decision` becomes `FIXED` (name the fix), `SKIPPED`, `ACCEPTED`, or `DISMISSED`.
