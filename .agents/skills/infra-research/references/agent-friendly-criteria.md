# Agent-Friendly Platform Criteria

Five criteria for evaluating whether a deployment platform suits AI-agent-driven development and maintenance of an MVP.

---

## 1. CLI-first maintenance

**Definition**: the platform can be fully managed through a CLI tool or non-interactive API — deploy, configure, scale, tail logs, roll back — without a browser or GUI. An agent running in a terminal can complete the full operational loop unattended.

**Examples that pass**: Fly.io (`flyctl`), Cloudflare Workers (`wrangler`), Railway (`railway` CLI), Render (deploy hooks + API), Vercel (`vercel` CLI), Netlify (`netlify` CLI).

**Examples that fail**: platforms where critical operations (SSL provisioning, domain routing, billing tier changes) require logging into a dashboard and clicking through wizards.

**Why it matters for agents**: an agent cannot click. If recovery, scaling, or rollback requires a UI step, the agent is blocked.

---

## 2. Managed / serverless over raw infrastructure

**Definition**: the platform abstracts away OS patching, network configuration, and hardware provisioning. The developer ships a build artifact (container image, bundle, function code) and the platform handles the rest. Higher-level = fewer things that can break in ways the agent doesn't know how to fix.

**Preferred**: Cloudflare Workers/Pages, Netlify, Vercel, Fly.io (managed VMs), Railway, Render. These platforms handle TLS, routing, scaling, and health checks automatically.

**Requires caution**: raw VMs (AWS EC2, GCP Compute Engine, Azure VMs), bare-metal, or Kubernetes clusters without a managed control plane. These are appropriate for production scale, not MVP. They shift significant operational burden onto the developer (and agent).

**Why it matters for agents**: lower operational surface = a smaller attack surface of things an agent can misconfigure. An agent deploying to Cloudflare Workers cannot accidentally leave port 22 open.

---

## 3. Agent-accessible documentation

**Definition**: the platform's official documentation is available in agent-readable format — markdown files, MDX, or a published `llms.txt` / `llms-full.txt`. The agent can load and reason over docs directly rather than scraping HTML or hallucinating API syntax.

**Examples that pass**: Cloudflare (publishes `llms.txt` and markdown source in GitHub), Fly.io (docs in GitHub as MDX), Vercel (docs as MDX on GitHub).

**Examples that fail**: documentation that lives exclusively in a rendered SPA with no source available, or that requires a login to access.

**Why it matters for agents**: agents that can read the actual docs make fewer API mistakes and generate more idiomatic CLI invocations.

---

## 4. Stable, scriptable deployment API

**Definition**: deployment is a deterministic, one-command operation that returns a URL or success signal. Rollbacks are equally deterministic. The platform exposes a versioned API or webhook surface so an agent can trigger deployments as part of a workflow.

**Examples that pass**: `wrangler deploy` (Cloudflare), `fly deploy` (Fly.io), `vercel --prod` (Vercel), Railway deploy via API, Render deploy hooks.

**Examples that fail**: platforms where deployment involves manual steps (copy files via FTP, click "publish" in a dashboard), or where the deployment API is undocumented and changes without notice.

**Why it matters for agents**: an agent cannot iterate on a deployment that doesn't give deterministic feedback. A stable API means the agent can confirm success, detect failure, and roll back — all programmatically.

---

## 5. MCP server or first-class integration

**Definition**: the platform provides an MCP (Model Context Protocol) server, a published Claude/agent connector, or a well-maintained GitHub Actions / CI integration. This enables structured tool-use over platform operations rather than string-parsing CLI output.

**Examples that pass**:
- Netlify — official Netlify MCP Server, explicitly recommended alongside Netlify CLI.
- Vercel — Vercel MCP, OAuth-backed (beta as of 2026 — record status during research).
- Cloudflare — MCP servers across docs, Workers, observability.
- GitHub — GitHub MCP Server exposes repos, issues, PRs and CI/CD intelligence.
- AWS — Deployment SOPs in AWS MCP Server (preview as of 2026, region-limited).
- Any platform with a published, agent-composable GitHub Action that covers deploy / status / logs.

**Examples that fail**: platforms where the only operational path goes through dashboard clicking, undocumented internal APIs, or unsupported community wrappers.

**Why it matters for agents**: MCP servers give agents typed, structured access to platform primitives — the agent calls a named tool with a known schema instead of parsing CLI output. It's a differentiating signal when two platforms score similarly on the other four criteria. Capture beta / preview / region-limited status explicitly during research; an MCP server in beta is a real signal, but a soft one.

---

## Scoring

Each criterion is scored Pass / Partial / Fail per platform. No criterion is a hard blocker on its own — a platform with four passes and one partial can still be the right choice. The criteria are heuristics for conscious decision-making, not gates.

| Criterion | Weight guidance |
|---|---|
| CLI-first maintenance | Critical for agent-driven ops — weight heavily |
| Managed over raw infra | Critical for MVP scope — weight heavily |
| Agent-accessible docs | Important quality signal — medium weight |
| Stable deployment API | Critical for iterative development — weight heavily |
| MCP / first-class integration | Differentiating signal at MVP — light weight overall, but heavier when two top picks tie on the other four |
