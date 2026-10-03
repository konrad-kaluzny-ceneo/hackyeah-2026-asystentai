# Assistant Proposal from Aggregated MetaEvents — Plan Brief

> Full plan: `context/changes/assistant-proposal-box/plan.md`
> API contract to revise during implementation: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Connect the existing behavior MetaEvent pipeline to the single assistant proposal box. The client sends a bounded MetaEvent history only when the existing decision-fatigue gate fires; Jev classifies that summary, and the server returns a minimal action/data decision using a confident Jev shortcut or OpenAI.

This broadens S-05 beyond its original UI-only boundary. Presentation copy remains local to the UI; model output is constrained to an action enum and validated action data.

## Starting Point

Raw events stay in the browser, while detectors create privacy-safe MetaEvents that are batched to `/api/meta-events`. The dispatcher exposes full MetaEvents after a successful HTTP response, but the app retains only reduced summaries for the debug overlay. `AssistantInline` renders local `DecisionEngine` text and does not call the Jev route.

The proposal route accepts only MetaEvents. Its Jev prompt is privacy-minimized; non-shortcut outputs use the OpenAI client with its own deadline and no automatic retries.

## Desired End State

The app retains the latest 10 unique MetaEvents in a production-purpose in-memory store, separate from the debug overlay and raw event buffer. When the existing fatigue trigger fires, and the user is not muted, the client sends `{ metaEvents }` only to `/api/assistant-proposal`.

The server validates those events and builds a Jev prompt without raw events, session/page-view identifiers, or paths. A confident, unhedged fatigue result may use the Jev shortcut; other valid results go through OpenAI. The API returns only action/data, which the UI combines with local copy to show one box. Invalid output, timeout, rate limiting, or model failure hides the fatigue box.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Jev request context | MetaEvents only | Matches the requested flow; catalog events stay local to the client gate. |
| Request trigger | Existing decision-fatigue rule | Avoids calling Jev for every event and preserves the agreed S-05 trigger. |
| Confidence boundary | Strictly greater than `0.75`; exactly `0.75` hides | Matches the requested threshold. |
| High-confidence output | Confident, unhedged Jev shortcut | Avoids an unnecessary second model call when Jev already has a usable draft. |
| Recent event window | Latest 10 unique MetaEvents after successful dispatch | Bounds request size and uses the existing dispatcher callback. |
| No usable MetaEvents | Do not call Jev; render no fatigue box | Prevents empty-context or tracker-disabled requests. |
| Existing friction behavior | Keep `search_friction` local | The requested Jev flow is for decision fatigue. |

## Scope

**In scope:**

- Production-purpose bounded MetaEvent history from successful `/api/meta-events` dispatches.
- MetaEvents-only request validation, server prompt, Jev shortcut/OpenAI decision, and action/data contract.
- Client fetch, one-request-per-fatigue-trigger guard, abort/stale-response handling, existing mute, and one-box rendering.
- Align the shared interface, S-04 notes, PRD FR-010, and roadmap acceptance wording during implementation.

**Out of scope:**

- Raw events, catalog state, or catalog events sent to Jev.
- Reading assistant context from the dev-only debug store.
- Raw events, catalog state, or catalog events sent to Jev/OpenAI.
- Detector or decision-fatigue rule changes, new proposal types, loader, or second box.

## Architecture / Approach

The dispatcher’s successful-batch callback publishes full MetaEvents into a bounded app store. `AssistantInline` continues using `DecisionEngine` locally to decide when fatigue is present, then reads the recent MetaEvent snapshot and posts it to the shared endpoint. The route validates the request, calls Jev under existing timeout/rate limits, then either uses the shortcut or invokes OpenAI; UI copy remains local.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Retain recent MetaEvents | Bounded production history from successful dispatcher batches | Coupling it to debug-only state would fail in production. |
| 2. Jev route and action decision | MetaEvents-only contract, Jev shortcut/OpenAI fallback, minimal response | Keep the incoming request privacy boundary while preserving current OpenAI behavior. |
| 3. Wire the box | Occasional fatigue-triggered request and one validated proposal | Duplicate or stale requests could render old content. |

**Prerequisites:** The behavior tracker is enabled; the existing S-04 Jev route and response schema remain available to adapt.
**Estimated effort:** Three implementation phases across the client pipeline, shared contract, server route, and assistant UI.

## Open Risks & Assumptions

- MetaEvent history is in memory for the mounted tracker lifetime; a full page reload clears it. Client-side catalog navigation retains it.
- The fatigue trigger still depends on local `CatalogEvent`s even though Jev receives MetaEvents only.
- The model decides action/data only; UI presentation copy must not move into model output.

## Success Criteria (Summary)

- Browsing produces raw browser events and posted MetaEvents; a qualifying fatigue trigger sends one bounded MetaEvents-only request.
- A qualifying Jev shortcut or a valid OpenAI action/data response shows one fatigue box; provider failure hides it.
- Raw events and catalog context do not appear in the assistant request or Jev prompt; OpenAI receives only the validated Jev result and available filter definitions.
