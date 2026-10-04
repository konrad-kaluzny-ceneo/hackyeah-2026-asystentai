# Assistant Proposal from Aggregated MetaEvents — Plan Brief

> Historyczny brief. Slice jest na `main`. Próg requestu to 5 unikalnych MetaEventów. Aktualny kontrakt: `context/changes/assistant-proposal-box/interface.md`.

> Full plan: `context/changes/assistant-proposal-box/plan.md`
> API contract to revise during implementation: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Connect the existing behavior MetaEvent pipeline to the single assistant proposal box. The client sends its first bounded MetaEvent history after the first unique successfully dispatched event, then queues one request per new event while no proposal is visible; Jev classifies that summary, and the server returns `{ status, title, message }` from a Jev shortcut or OpenAI-generated copy.

This broadens S-05 beyond its original UI-only boundary. The server response carries copy; the UI keeps control of the fixed `narrow-choice` action and filter link.

## Starting Point

Raw events stay in the browser, while detectors create privacy-safe MetaEvents that are batched to `/api/meta-events`. The dispatcher exposes full MetaEvents after a successful HTTP response, but the app retains only reduced summaries for the debug overlay. `AssistantInline` renders local `DecisionEngine` text and does not call the Jev route.

The proposal route accepts only MetaEvents. Its Jev prompt is privacy-minimized; confident unhedged decision-fatigue outputs can use the Jev draft, while other valid outputs use OpenAI to generate a title and message.

## Desired End State

The app retains the latest 10 unique MetaEvents in a production-purpose in-memory store, separate from the debug overlay and raw event buffer. Starting at the first event, and while the user is not muted and no proposal is visible, the client serially sends `{ metaEvents }` snapshots to `/api/assistant-proposal` as new successful events arrive.

The server validates those events and builds a Jev prompt without raw events, session/page-view identifiers, or paths. A confident, unhedged fatigue result with a non-empty draft may use the Jev shortcut; other valid results go through OpenAI. The API returns only status/title/message; the UI combines that copy with its local filter action to show one box. Invalid output, timeout, rate limiting, or model failure hides the proposal.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Jev request context | MetaEvents only | Matches the requested flow; catalog events stay local to the client gate. |
| Request trigger | One unique event, then each new event until a proposal is visible | Lets server-side Jev/OpenAI classify a bounded event history without sending catalog state. |
| Confidence boundary | `DECISION_FATIGUE` with confidence `>= 0.75`, no hedging, and non-empty draft | Matches the historical S-04 route decision. |
| High-confidence output | Jev draft as the response message | Avoids an unnecessary second model call when Jev already has a usable draft. |
| Recent event window | Latest 10 unique MetaEvents after successful dispatch | Bounds request size and uses the existing dispatcher callback. |
| No usable MetaEvents | Do not call Jev before the first unique event | Prevents empty-context or tracker-disabled requests. |
| Existing friction behavior | Keep `search_friction` local and prioritize it over server proposals | Preserves the existing S-03 recovery path. |

## Scope

**In scope:**

- Production-purpose bounded MetaEvent history from successful `/api/meta-events` dispatches.
- MetaEvents-only request validation, server prompt, Jev shortcut/OpenAI decision, and title/message response contract.
- Client request queue, serialized event-trigger worker, abort/requeue handling, existing mute, and one-box rendering.
- Align the shared interface, S-04 notes, PRD FR-010, and roadmap acceptance wording during implementation.

**Out of scope:**

- Raw events, catalog state, or catalog events sent to Jev.
- Reading assistant context from the dev-only debug store.
- Raw events, catalog state, or catalog events sent to Jev/OpenAI.
- Detector or decision-fatigue rule changes, new proposal types, loader, or second box.

## Architecture / Approach

The dispatcher’s successful-batch callback publishes full MetaEvents into a bounded app store and queues snapshots beginning at the first unique event. `AssistantProposalCoordinator` drains those snapshots one at a time while unmuted and without a visible proposal. Local `search_friction` remains first priority. The route validates each request, calls Jev under existing timeout/rate limits, then either uses the shortcut or invokes OpenAI; the UI owns the fixed filter action.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Retain recent MetaEvents | Bounded production history from successful dispatcher batches | Coupling it to debug-only state would fail in production. |
| 2. Jev route and text decision | MetaEvents-only contract, Jev shortcut/OpenAI fallback, title/message response | Keep the incoming request privacy boundary while preserving current OpenAI behavior. |
| 3. Wire the box | Five-event threshold, serialized per-event requests, and one validated proposal | Duplicate or stale requests could render old content. |

**Prerequisites:** The behavior tracker is enabled; the existing S-04 Jev route and response schema remain available to adapt.
**Estimated effort:** Three implementation phases across the client pipeline, shared contract, server route, and assistant UI.

## Open Risks & Assumptions

- MetaEvent history is in memory for the mounted tracker lifetime; a full page reload clears it. Client-side catalog navigation retains it.
- Classification starts from MetaEvent count, not local `CatalogEvent`s; local empty-search recovery remains independent.
- Jev/OpenAI provide proposal copy; the UI retains control of the fixed filter action.

## Success Criteria (Summary)

- The first successful MetaEvent and each later event can trigger a bounded request until one proposal is shown or muted.
- A Jev shortcut or valid OpenAI title/message response shows one proposal box; provider failure leaves it hidden and queued later events may be classified.
- Raw events and catalog context do not appear in the assistant request or Jev prompt; OpenAI receives only the validated Jev result and available filter definitions.
