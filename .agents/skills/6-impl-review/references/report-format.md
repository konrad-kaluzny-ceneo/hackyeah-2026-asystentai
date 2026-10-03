# Implementation review report

Read this at Step 4. Icons sit next to a word (`❌ CRITICAL`, not a bare `❌`). The title line is only `F1 — <title>`. Severity, Impact, Dimension, and Location are each their own line. Impact includes the meaning from the skill's impact table.

Omit empty severity groups. PASS dimensions appear only in the verdict table.

## Chat report

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: <plan title>
  Scope: Phase <N> of <Total>  |  Date: YYYY-MM-DD
  Findings: <N critical> <N warnings> <N observations>
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS    ✅
  Scope Discipline      WARNING ⚠️   (<n> finding)
  Safety & Quality      FAIL    ❌   (<n> finding)
  Architecture          PASS    ✅
  Pattern Consistency   WARNING ⚠️   (<n> finding)
  Success Criteria      PASS    ✅

  ► Overall: NEEDS ATTENTION

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — <title>
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔎 MEDIUM — real tradeoff; pause to reason through it
    Dimension: Safety & Quality
    Location:  <file:line or N/A>

    Detail:
    <plan versus code, or code versus the expected pattern, with evidence>

    Fix: <one line when impact is LOW, or the Strength block when it is not>
      Strength:   <advantage grounded in the code or the plan>
      Tradeoff:   <cost>
      Confidence: HIGH — <why>
      Blind spot: <unverified point, or "None significant">

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — <title>
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Scope Discipline
    Location:  <file:line>

    Detail:
    <what was added or missed>

    Fix A ⭐ Recommended: <one line>
      Strength:   <advantage>
      Tradeoff:   <cost>
      Confidence: HIGH — <why>
      Blind spot: <unverified point>

    Fix B: <one line>
      Strength:   <advantage>
      Tradeoff:   <cost>
      Confidence: MED — <why>
      Blind spot: <unverified point>
```

A LOW-impact finding has a single `Fix:` line and no Strength block. A second fix appears only when the skill's two-fix rule says so. For a full-plan review, set Scope to `Full plan (<N> phases)` instead of `Phase N of Total`.

## Saved file

Full review: `context/changes/<change-id>/reviews/impl-review.md`.
One phase: `context/changes/<change-id>/reviews/impl-review-phase-<N>.md`.

```markdown
<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: <plan title>

- **Plan**: <plan path>
- **Scope**: Phase <N> of <Total>
- **Date**: YYYY-MM-DD
- **Verdict**: APPROVED / NEEDS ATTENTION / REJECTED
- **Findings**: <N critical> <N warnings> <N observations>

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Plan Adherence | PASS / WARNING / FAIL |
| Scope Discipline | PASS / WARNING / FAIL |
| Safety & Quality | PASS / WARNING / FAIL |
| Architecture | PASS / WARNING / FAIL |
| Pattern Consistency | PASS / WARNING / FAIL |
| Success Criteria | PASS / WARNING / FAIL |

## Findings

### F1 — <title>

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: <file:line or N/A>
- **Detail**: <evidence>
- **Fix A ⭐ Recommended**: <approach>
  - Strength: <advantage>
  - Tradeoff: <cost>
  - Confidence: HIGH — <why>
  - Blind spot: <unverified point, or "None significant">
- **Fix**: <one line, when there is only one fix>
- **Decision**: PENDING
```

The marker `<!-- IMPL-REVIEW-REPORT -->` and `Decision: PENDING` are what resume mode looks for. After triage, Decision becomes one of: `FIXED` (name the fix), `FIXED + ACCEPTED-AS-RULE: <rule title>`, `ACCEPTED-AS-RULE: <rule title>`, `SKIPPED`, `ACCEPTED`, `DISMISSED`.
