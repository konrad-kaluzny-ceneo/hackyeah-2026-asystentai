# Assistant Proposal from Aggregated MetaEvents — Plan Brief

> Full plan: `context/changes/assistant-proposal-box/plan.md`
> API contract to revise during implementation: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Connect the existing behavior MetaEvent pipeline to the single assistant proposal box. The client sends its first bounded MetaEvent history after the first unique successfully dispatched event, then queues one request per new event while no proposal is visible; Jev classifies that summary, and the server returns a minimal action/data decision through OpenAI unless the confident Jev shortcut hides it.

This broadens S-05 beyond its original UI-only boundary. Presentation copy remains local to the UI; model output is constrained to an action enum and validated action data.

## Starting Point

Raw events stay in the browser, while detectors create privacy-safe MetaEvents that are batched to `/api/meta-events`. The dispatcher exposes full MetaEvents after a successful HTTP response, but the app retains only reduced summaries for the debug overlay. `AssistantInline` renders local `DecisionEngine` text and does not call the Jev route.

The proposal route accepts only MetaEvents. Its Jev prompt is privacy-minimized; non-shortcut outputs use the OpenAI client with its own deadline and no automatic retries.

## Desired End State

The app retains the latest 10 unique MetaEvents in a production-purpose in-memory store, separate from the debug overlay and raw event buffer. Starting at the first event, and while the user is not muted and no proposal is visible, the client serially sends `{ metaEvents }` snapshots to `/api/assistant-proposal` as new successful events arrive.

The server validates those events and builds a Jev prompt without raw events, session/page-view identifiers, or paths. A confident, unhedged fatigue result may use the Jev shortcut; other valid results go through OpenAI. The API returns only action/data, which the UI combines with local copy to show one box. Invalid output, timeout, rate limiting, or model failure hides the fatigue box.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Jev request context | MetaEvents only | Matches the requested flow; catalog events stay local to the client gate. |
| Request trigger | Five unique events, then each new event until a proposal is visible | Lets server-side Jev/OpenAI classify a bounded event history without sending catalog state. |
| Confidence boundary | Strictly greater than `0.75`; exactly `0.75` hides | Matches the requested threshold. |
| High-confidence output | Confident, unhedged Jev shortcut | Avoids an unnecessary second model call when Jev already has a usable draft. |
| Recent event window | Latest 10 unique MetaEvents after successful dispatch | Bounds request size and uses the existing dispatcher callback. |
| No usable MetaEvents | Do not call Jev before the fifth unique event | Prevents early/empty-context or tracker-disabled requests. |
| Existing friction behavior | Keep `search_friction` local and prioritize it over server proposals | Preserves the existing S-03 recovery path. |

## Scope

**In scope:**

- Production-purpose bounded MetaEvent history from successful `/api/meta-events` dispatches.
- MetaEvents-only request validation, server prompt, Jev shortcut/OpenAI decision, and action/data contract.
- Client request queue, serialized event-trigger worker, abort/requeue handling, existing mute, and one-box rendering.
- Align the shared interface, S-04 notes, PRD FR-010, and roadmap acceptance wording during implementation.

**Out of scope:**

- Raw events, catalog state, or catalog events sent to Jev.
- Reading assistant context from the dev-only debug store.
- Raw events, catalog state, or catalog events sent to Jev/OpenAI.
- Detector or decision-fatigue rule changes, new proposal types, loader, or second box.

## Architecture / Approach

The dispatcher’s successful-batch callback publishes full MetaEvents into a bounded app store and queues snapshots beginning at the fifth unique event. `AssistantInline` drains those snapshots one at a time while unmuted and without a visible proposal. Local `search_friction` remains first priority. The route validates each request, calls Jev under existing timeout/rate limits, then either uses the shortcut or invokes OpenAI; UI copy remains local.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Retain recent MetaEvents | Bounded production history from successful dispatcher batches | Coupling it to debug-only state would fail in production. |
| 2. Jev route and action decision | MetaEvents-only contract, Jev shortcut/OpenAI fallback, minimal response | Keep the incoming request privacy boundary while preserving current OpenAI behavior. |
| 3. Wire the box | Five-event threshold, serialized per-event requests, and one validated proposal | Duplicate or stale requests could render old content. |

**Prerequisites:** The behavior tracker is enabled; the existing S-04 Jev route and response schema remain available to adapt.
**Estimated effort:** Three implementation phases across the client pipeline, shared contract, server route, and assistant UI.

## Open Risks & Assumptions

- MetaEvent history is in memory for the mounted tracker lifetime; a full page reload clears it. Client-side catalog navigation retains it.
- Classification starts from MetaEvent count, not local `CatalogEvent`s; local empty-search recovery remains independent.
- The model decides action/data only; UI presentation copy must not move into model output.

## Success Criteria (Summary)

- Four MetaEvents produce no request; the fifth and each later event can trigger a bounded request until one proposal is shown or muted.
- A Jev shortcut or valid OpenAI action/data response shows one proposal box; provider failure leaves it hidden and queued later events may be classified.
- Raw events and catalog context do not appear in the assistant request or Jev prompt; OpenAI receives only the validated Jev result and available filter definitions.
