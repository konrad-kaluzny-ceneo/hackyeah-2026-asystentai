---
bootstrapped_at: 2026-10-03T10:10:38Z
starter_id: next
starter_name: Next.js
project_name: asystent-ai-intencje-na-biezaco
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: asystent-ai-intencje-na-biezaco
hints:
  language_family: js
  team_size: small
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: false
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

## Why this stack

A small team building an after-hours web app with a two-week MVP benefits from predictable conventions and quick scaffolding. Next.js matches the chosen TypeScript and Vercel direction, is widely documented, and has verified scaffolding. PostgreSQL remains the database preference, with Supabase or Neon to be selected during bootstrap. The MVP uses session-level heuristic signals and does not require authentication, payments, realtime updates, LLM integration, or background jobs. CI uses GitHub Actions with automatic deployment on merge to main.

## Pre-scaffold verification

| Signal             | Value                                              | Severity | Notes                                                                                          |
| ------------------ | -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| npm package        | create-next-app v16.3.8 published 2026-10-02       | fresh    | resolved from cmd_template (`npx create-next-app@latest` → `create-next-app`)                 |
| GitHub repo        | not run                                            | n/a      | card `docs_url` is `https://nextjs.org/docs`, not a `github.com/<owner>/<repo>` URL           |

The published CLI timestamp is within the fresh window (under 3 months; the publish was the day before this run). No stale signal. The process that actually scaffolded reported `create-next-app@16.3.7` while `npm view` returned `16.3.8`.

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 21369 (21347 of them under `node_modules/`; 22 project files outside it)
**Conflicts (.scaffold siblings)**: README.md.scaffold
**.gitignore handling**: append-merged
**.bootstrap-scaffold cleanup**: deleted

The first invocation used `.bootstrap-scaffold` and exited 1 before creating a directory:

```
Could not create a project called ".bootstrap-scaffold" because of npm naming restrictions:
    * name cannot start with a period
```

The user then asked to initialize without the leading dot and continue. The successful run used `bootstrap-scaffold/` as the temp directory, applied the same conflict policy, and deleted that directory after the move. Nothing was left behind.

`create-next-app` filled unprovided options with defaults: `--no-react-compiler`, `--agents-md`. It installed dependencies (exit 0 from the CLI; the installer's own audit note is not this log's audit). After the move, `package.json` and `package-lock.json` `name` were set to `asystent-ai-intencje-na-biezaco` so the package name matches the hand-off instead of the temp directory.

Existing `README.md` was kept. The starter README is `README.md.scaffold`. Existing `context/` was not present in the scaffold, so nothing under `context/` was dropped. The starter also wrote `AGENTS.md` and `CLAUDE.md`; neither existed in the working directory, so both were moved into place.

## Post-scaffold audit

**Tool**: npm audit --json
**Exit code**: 1 (vulnerabilities present; not a halt)
**Summary**: 0 CRITICAL, 5 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/1/0/0 direct of total 0/5/0/0
**Dependency metadata**: prod 17, dev 381, optional 88, total 435. This npm version does not emit `metadata.dependencies.direct`.

#### CRITICAL findings

none

#### HIGH findings

- **eslint-config-next@16.3.7** (direct). Range `>=14.3.0-canary.0`. Affected via `@next/eslint-plugin-next`. No advisory id on this node. Fix offered: `eslint-config-next@14.2.35` (`isSemVerMajor: true`).
- **@next/eslint-plugin-next@16.3.7** (transitive). Range `>=14.3.0-canary.0`. Affected via `fast-glob`. Fix offered: `eslint-config-next@14.2.35` (`isSemVerMajor: true`).
- **fast-glob@3.3.1** (transitive). Range `*`. Affected via `micromatch`. Fix offered: `eslint-config-next@14.2.35` (`isSemVerMajor: true`).
- **micromatch@4.0.8** (transitive). Range `>=0.2.0`. Affected via `braces`. Fix offered: `eslint-config-next@14.2.35` (`isSemVerMajor: true`).
- **braces@3.0.3** (transitive). Range `*`. Advisory GHSA-vfj7-8cjw-p6xm (source 1240992): braces is vulnerable to stack-exhaustion denial of service through deeply nested patterns. https://github.com/advisories/GHSA-vfj7-8cjw-p6xm. Fix offered: `eslint-config-next@14.2.35` (`isSemVerMajor: true`).

#### MODERATE findings

none

#### LOW / INFO findings

none

The only direct HIGH finding is `eslint-config-next`. The other four HIGH findings are the same transitive chain ending at `braces`. The suggested fix downgrades `eslint-config-next` across a major version. No automatic fix was applied.

## Hints recorded but not acted on

| Hint                       | Value                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| bootstrapper_confidence    | verified                                                                                       |
| quality_override           | false                                                                                          |
| path_taken                 | custom                                                                                         |
| self_check_answers         | typed: true; from_official_starter: true; conventions: true; docs_current: true; can_judge_agent: true |
| team_size                  | small                                                                                          |
| deployment_target          | vercel                                                                                         |
| ci_provider                | github-actions                                                                                 |
| ci_default_flow            | auto-deploy-on-merge                                                                           |
| has_auth                   | false                                                                                          |
| has_payments               | false                                                                                          |
| has_realtime               | false                                                                                          |
| has_ai                     | false                                                                                          |
| has_background_jobs        | false                                                                                          |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
