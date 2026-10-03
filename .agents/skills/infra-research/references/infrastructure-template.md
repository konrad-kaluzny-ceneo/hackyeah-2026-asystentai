# infrastructure.md

Read this at the write step. `researched_at` is today as `YYYY-MM-DD`. Project name comes from `tech-stack.md`, else `prd.md`, else the working directory name. Missing stack fields stay empty. Do not add sections.

```markdown
---
project: <project name>
researched_at: <YYYY-MM-DD>
recommended_platform: <platform name>
runner_up: <platform name>
context_type: mvp
tech_stack:
  language: <language>
  framework: <framework>
  runtime: <runtime>
---

## Recommendation

**Deploy on <Platform Name>.**

<Two or three sentences: why this platform for this stack and these constraints. Cite the scores and the interview answers that decided it.>

## Platform Comparison

<The scoring matrix, plus one paragraph per platform explaining the scores.>

### Shortlisted Platforms

#### 1. <Platform A> (Recommended)

<Why it won against the criteria and the constraints.>

#### 2. <Platform B>

<Why it is second, and the gap versus the recommendation.>

#### 3. <Platform C>

<Why it is third, and the gap versus the recommendation.>

## Anti-Bias Cross-Check: <Recommended Platform>

### Devil's Advocate — Weaknesses

<Numbered list of 3–5 specific weaknesses.>

### Pre-Mortem — How This Could Fail

<The 150–200 word failure narrative.>

### Unknown Unknowns

<3–5 non-obvious risks. Include version-driven differences found while checking Getting Started.>

## Operational Story

One concrete answer per line.

- **Preview deploys**: <how a PR or branch becomes a preview URL; protection such as Cloudflare Access; conditions such as fork PRs>
- **Secrets**: <where env vars and tokens live; who can read them; how rotation works>
- **Rollback**: <command or click sequence; typical time to revert; data that does not roll back, such as a migration>
- **Approval**: <what needs a human: publish, rotate a primary secret, drop a database; what an agent may do unattended>
- **Logs**: <read-only commands or tools for pipeline and runtime logs>

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| <risk> | Devil's advocate / Pre-mortem / Unknown unknowns / Research finding | L / M / H | L / M / H | <concrete step> |

Every row names the lens that surfaced it.

## Getting Started

<3–5 first steps for this stack on this platform. Commands match the versions in tech-stack.md.>

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
```
