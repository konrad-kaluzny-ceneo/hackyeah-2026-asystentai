---
name: infra-research
description: >
  Research and recommend an MVP deployment platform via a short interview plus
  parallel, bias-checked web research. Writes context/foundation/infrastructure.md
  with a scored comparison and a risk register. Use when the user says
  /infra-research, "choose a platform", "where should I deploy", "infra
  research", "wybierz platformę", "gdzie deployować", or "jaka platforma do
  deploymentu". Use after /prd or /tech-stack-selector, before /implement.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, nazwy platform, komendy CLI. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku. Pytania wywiadu zadawaj w aktywnym języku. Zapisuj odpowiedź jako jedną z wartości kanonicznych podanych niżej.

# Platform research

Write `context/foundation/infrastructure.md`: a scored comparison, the recommendation, the day-to-day operational story, and a risk register. It sits after `prd.md` and `tech-stack.md`. `/implement` may read it later. Do not run `/implement`.

Toward the user, say "the platform comparison", "the recommended option", and "the risk register". Do not say step numbers.

## Hard rules

1. **Research before recommending.** Score only after the web research. Do not pick from memory of pricing or features.
2. **The stack is a hard constraint.** An unsupported runtime drops the platform. Scoring does not override that.
3. **Always shortlist three.** Interview answers change weights. Only the persistent-connection filter and an unsupported runtime remove a platform.
4. **Run all three bias checks** on the top pick, even when it looks obvious. You write them. Do not delegate them.
5. **MVP scope.** Rank for a preview URL from one CLI deploy against the versions pinned in `tech-stack.md`, and for estimated cost at 10k–100k monthly requests. Do not add multi-region failover, an SLA target, or dedicated support unless `prd.md` requires them.
6. **Getting Started matches the pinned versions** in `tech-stack.md`, not a marketing page. Before any CLI line, check what that adapter version does now: whether the framework dev server already covers the platform, whether config or env access changed, and whether the tool was merged, renamed, or deprecated. Put a version difference into Unknown Unknowns. Ship only the command that matches the pin.
7. **Do not write Dockerfiles or CI.** Do not plan production HA.

## How to ask

Use the host's structured question tool. One interview question per turn. Wait. Collect all five before research.

## Entry

A path argument → strip `@` and read that file as the tech stack. No argument → read `context/foundation/tech-stack.md` when it exists.

## Load

Read what exists.

- Tech stack → language, framework, runtime, database. Hard constraints.
- `context/foundation/prd.md` → expected scale, latency, uptime. Soft weights.
- [references/agent-friendly-criteria.md](references/agent-friendly-criteria.md) → the five criteria. Read it before scoring.

```
Context loaded:
  Tech stack:    <language> / <framework> / <runtime>  [or "not found — will infer from cwd"]
  PRD context:   <scale / latency notes>               [or "not found — skipping"]
  Platform criteria: references/agent-friendly-criteria.md ✓
```

No stack file → infer language, framework, and runtime from the working tree before research.

## Interview

Ask in order. Record the canonical value.

1. "Does your app require persistent server-side connections — WebSockets, long-polling, or background worker processes that must stay alive between requests?"
   - `Yes` — always-on processes or long-lived connections.
   - `No` — stateless request/response.
   - `Don't know`
2. "Is minimizing monthly cost the top priority at MVP stage, or is developer experience and speed of iteration more important?"
   - `Minimize cost`
   - `Prioritize DX`
   - `Don't know / roughly equal`
3. "Do you or your team already have hands-on experience with any specific platform you'd feel comfortable deploying to?"
   - `Yes — Vercel / Netlify`
   - `Yes — Cloudflare (Workers / Pages)`
   - `Yes — Railway / Render / Fly.io`
   - `Yes — AWS / GCP / Azure`
   - `No strong familiarity`
4. "Do you expect the app to serve users globally (edge/CDN matters) or mainly from one region?"
   - `Global — latency across regions matters`
   - `Single region is fine`
   - `Don't know yet`
5. "Will the deployment need co-located managed services — database, object storage, queues — from the same platform, or are external providers fine?"
   - `Co-location preferred`
   - `External providers are fine`
   - `Don't know yet`

## Research

Candidate pool, all six:

| Platform | Primary use |
| --- | --- |
| Cloudflare Workers + Pages | Edge-first, serverless JS/TS, global CDN |
| Vercel | Frontend and serverless functions, Next.js-native |
| Netlify | Frontend and serverless, JAMstack |
| Fly.io | Containers, persistent processes, multi-region |
| Railway | Full-stack PaaS, co-located databases |
| Render | Containers and static hosting, free tier, cron |

Spawn one sub-agent per platform, all in one message. Each returns 200–300 words of facts with links. Use the host's web search and fetch. Prefer current official pricing and docs over posts older than about 18 months.

Each prompt:

```
Research <Platform> as an MVP deployment target.

Focus on:
1. Supported runtimes and languages, especially <language>.
2. CLI commands to deploy, roll back, and tail logs.
3. Whether docs exist as markdown or llms.txt on GitHub.
4. Free tier and estimated cost at 10k–100k monthly requests.
5. Persistent process / WebSocket support: yes, no, or limited.
6. Co-located database, storage, and queues.
7. An MCP server or agent integration, if any.
8. Known limitations for <framework>.
9. Status of each feature: GA, beta, preview, deprecated, or region-limited. For anything not GA, the caveat and the date you checked.

Mark every beta, preview, and region limit inline.
```

## Score

Hard filters, applied before the shortlist:

- Interview `Yes` on persistent connections → drop a platform that cannot keep a process alive. Netlify and Vercel serverless-only drop.
- Runtime the stack needs and the platform does not support → drop.

Score the rest Pass / Partial / Fail on the five criteria in [references/agent-friendly-criteria.md](references/agent-friendly-criteria.md). Use the weight table in that file. Do not restate it.

Soft weights, not exclusions:

- `Minimize cost` → rank a higher estimated monthly cost at 10k–100k requests as a penalty. Do not drop the platform for cost alone.
- A familiarity answer → break a tie toward that platform when it is in the pool.
- `Global` → prefer edge-native.
- `Co-location preferred` → prefer an integrated database.

Shortlist the top 3. Print:

```
Shortlisted platforms:
  1. <Platform A> — <one sentence>
  2. <Platform B> — <one sentence>
  3. <Platform C> — <one sentence>

Running anti-bias cross-check on the top recommendation (<Platform A>)...
```

## Bias check

Write these yourself for the current top pick.

1. Devil's advocate — 3–5 numbered failure modes, specific to this stack on this platform. Not categories.
2. Pre-mortem — 150–200 words: six months later the choice was a disaster. The wrong assumptions, in order.
3. Unknown unknowns — 3–5 things the marketing page does not say, including version-driven surprises from the Getting Started check.

Show the three, then ask "The anti-bias cross-check surfaced some risks for <Platform A>. How would you like to proceed?"

- "Proceed with <Platform A> — risks noted" — manageable. They go in the register.
- "Swap to <Platform B> instead"
- "Swap to <Platform C> instead"

A swap → run the three checks on the new top pick, show them, and continue. Do not ask again.

## Write

If `context/foundation/infrastructure.md` exists, ask "context/foundation/infrastructure.md already exists. How would you like to proceed?"

- "Overwrite (Recommended)" — replace it.
- "Save as infrastructure-v2.md" — next free `infrastructure-vN.md`. Scan existing `infrastructure-v*.md`. N is max+1, or 2 when none exist.
- "Abort" — stop. The recommendation stays in the chat.

Create `context/foundation/` if needed. Read [references/infrastructure-template.md](references/infrastructure-template.md) and write the chosen path.

Copy `/implement` (`Set-Clipboard` on PowerShell; elsewhere `pbcopy`, then `clip.exe`, then `xclip -selection clipboard`). Print:

```
═══════════════════════════════════════════════════════════
  INFRASTRUCTURE DECISION RECORDED
═══════════════════════════════════════════════════════════

  Platform:      <recommended platform>
  Runner-up:     <runner-up>
  Bias checks:   3 / 3 passed

  ► Decision:    <path written>
  ► Next:        /implement  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

Stop.
