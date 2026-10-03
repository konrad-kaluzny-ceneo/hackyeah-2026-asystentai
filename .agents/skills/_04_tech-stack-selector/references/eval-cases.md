# Eval cases

Manual sanity-check cases spanning the language families the registry covers. Each case names PRD priors, expected Q0 path, residual answers (if custom), expected `starter_id` family (any of the listed passes), expected Socratic moments, and the `bootstrapper_confidence` value Step E should surface.

These cases are run manually during development and serve as a future hook for `/skill-creator` evals. No production code consumes this file — it's a development artifact loaded only on demand.

---

## Case 1 — Solo JS SaaS, weak preference

```yaml
prd_priors:
  product_type: saas
  target_scale:
    users: small
  timeline_budget:
    mvp_weeks: 4
  tech_preferences:
    language: <none>  # not always present in PRD
q0_expected_path: standard
expected_recommendation_family: [astro-starter, t3, next]
expected_socratic_moments:
  - "feature audit if PRD FRs name a payments/auth feature the recommended starter doesn't carry first-class"
expected_bootstrapper_confidence_surfaced: first-class  # astro-starter is first-class
```

Standard path resolves through `recommended_defaults[saas][js] = astro-starter`. Solo + 4-week timeline + JS family → recommended_default + agent-friendly. (T3 stays as a strong alternative; the recommendation leads with astro-starter when both compete.)

---

## Case 2 — Python API for mobile, team of 3

```yaml
prd_priors:
  product_type: api
  target_scale:
    users: medium
  timeline_budget:
    mvp_weeks: 6
residual_answers:
  language_family: python
  team_size: small
q0_expected_path: standard
expected_recommendation_family: [fastapi, django]
expected_socratic_moments:
  - "MUST NOT recommend any JS stack"
expected_bootstrapper_confidence_surfaced: first-class  # FastAPI is first-class
```

Standard path resolves through `recommended_defaults[api][python] = fastapi`. The skill must NOT surface JS alternatives in the conversation — Step A's language_family partition drops them.

---

## Case 3 — Portfolio site

```yaml
prd_priors:
  product_type: web-app  # or website
  target_scale:
    users: small
  timeline_budget:
    mvp_weeks: 1
residual_answers:
  language_family: js
q0_expected_path: standard
expected_recommendation_family: [astro-starter, astro]
expected_socratic_moments:
  - "clarifying scope: static vs dynamic before locking"
expected_bootstrapper_confidence_surfaced: first-class  # astro-starter
```

Standard path resolves through `recommended_defaults[web][js] = astro-starter`. For a true static portfolio with no auth/database, Astro alone may be the better pick — the skill should ask one clarifying question.

---

## Case 4 — Compare React vs Vue vs Svelte

```yaml
prd_priors:
  product_type: web-app
  target_scale:
    users: small
  timeline_budget:
    mvp_weeks: 4
residual_answers:
  language_family: js
  user_explicit_request: "compare React vs Vue vs Svelte"
q0_expected_path: custom  # forced by request shape
expected_recommendation_family: [next, nuxt, sveltekit]  # any of these is acceptable
expected_socratic_moments:
  - "Q6 framework variant — present 3-5 candidates with one-line fits + bootstrapper_confidence; refuse vacuum comparison"
expected_bootstrapper_confidence_surfaced: verified  # whichever is picked, all three are verified or first-class
```

Custom path forced by the user's exploration intent. The skill walks Q1–Q3 first (so the candidate pool is constrained), then Q6 surfaces React vs Vue vs Svelte starters with project-context-driven fits. Refuses to compare in vacuum.

---

## Case 5 — Chrome extension + backend API

```yaml
prd_priors:
  product_type: browser-extension  # not in registry recommended_defaults
  target_scale:
    users: medium
residual_answers:
  language_family: js
q0_expected_path: custom  # registry has no browser-extension default
expected_recommendation_family: []  # registry doesn't carry an extension starter today
expected_socratic_moments:
  - "registry gap surfaced; user must pick which half this hand-off addresses (extension OR API), or pick custom-path API stack"
expected_bootstrapper_confidence_surfaced: best-effort  # if any
```

The registry doesn't carry browser-extension starters (Plasmo/WXT). The skill should surface the gap honestly, ask the user to scope this hand-off to one component (extension OR API), and let the user re-run for the other component. This is a known shape for two-part products.

---

## Case 6 — Ruby on Rails monolith for a small team

```yaml
prd_priors:
  product_type: web-app
  target_scale:
    users: medium
residual_answers:
  language_family: ruby
  team_size: small
q0_expected_path: standard
expected_recommendation_family: [rails]
expected_socratic_moments: []
expected_bootstrapper_confidence_surfaced: verified
```

Standard path resolves through `recommended_defaults[web][ruby] = rails`. Verifies the non-JS recommended-default cell.

---

## Case 7 — Go API microservice, low cost

```yaml
prd_priors:
  product_type: api
  target_scale:
    users: small  # <100 users
  timeline_budget:
    mvp_weeks: 4  # 1 month
residual_answers:
  language_family: go
q0_expected_path: standard
expected_recommendation_family: [go]
expected_socratic_moments: []
expected_bootstrapper_confidence_surfaced: first-class
expected_q4_lead: self-host  # NOT cloudflare; NOT vercel
```

Standard path resolves through `recommended_defaults[api][go] = go`. Critical: Q4 must lead with `self-host` (per Go card's `deployment_defaults: [self-host, fly, aws-ecs, google-cloud-run]`), NOT Cloudflare. The frame's "Cloudflare default" applies only when the chosen card lists it first.

---

## Case 8 — .NET enterprise web app

```yaml
prd_priors:
  product_type: web-app  # or enterprise
  target_scale:
    users: large
residual_answers:
  language_family: dotnet
  team_size: small
q0_expected_path: standard
expected_recommendation_family: [dotnet]
expected_socratic_moments: []
expected_bootstrapper_confidence_surfaced: verified
```

Standard path resolves through `recommended_defaults[web][dotnet] = dotnet`. Verifies the .NET recommended-default cell.

---

## Case 9 — PHP avoidance, web SaaS

```yaml
prd_priors:
  product_type: saas
residual_answers:
  language_family: js
  tech_preferences:
    avoid: [php]
q0_expected_path: standard
expected_recommendation_family: [astro-starter, t3]
expected_socratic_moments:
  - "if user later flips and asks about Laravel, Socratic challenge fires comparing against quality-bar"
expected_bootstrapper_confidence_surfaced: first-class
```

Standard path; recommended_defaults[saas][js] = astro-starter. The avoid: [php] entry means Laravel is silently dropped from any candidate list (Step A filter 4). If the user later names Laravel anyway, Step B's Socratic challenge fires (Laravel passes the gates, but the user's avoid-list takes precedence — the challenge surfaces the conflict, not a quality failure).

---

## Case 10 — Best-effort confidence surfacing

```yaml
prd_priors:
  product_type: web-app
residual_answers:
  language_family: js
  user_explicit_request: "I want astro-starter specifically"
q0_expected_path: standard  # recommended default for (web, js)
expected_recommendation_family: [astro-starter]
expected_socratic_moments: []
expected_bootstrapper_confidence_surfaced: first-class  # registry says first-class until promoted
```

Verifies Step E surfaces the `bootstrapper_confidence: first-class` value verbatim in conversation: "Bootstrapper has this stack registered with a valid CLI but hasn't been battle-tested. Expect mostly-smooth scaffolding with occasional manual steps." The user proceeds knowingly. Note the `astro-starter` card stays at `first-class` until verified end-to-end through bootstrapper, at which point promote to `verified`.
