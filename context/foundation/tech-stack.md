---
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
---

## Why this stack

A small team building an after-hours web app with a two-week MVP benefits from predictable conventions and quick scaffolding. Next.js matches the chosen TypeScript and Vercel direction, is widely documented, and has verified scaffolding. PostgreSQL is hosted on Supabase. The MVP uses session-level heuristic signals and does not require Supabase Auth, payments, realtime updates, LLM integration, or background jobs. CI uses GitHub Actions with automatic deployment on merge to main.
