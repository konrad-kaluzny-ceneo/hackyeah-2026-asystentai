# Assistant Proposal from Aggregated MetaEvents — Plan Brief

> Full plan: `context/changes/assistant-proposal-box/plan.md`
> API contract to revise during implementation: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Connect the existing behavior MetaEvent pipeline to the single assistant proposal box. The client will send a bounded MetaEvent history only when the existing decision-fatigue gate fires; Jev will classify that summary, and a deterministic local stub will return the demo proposal only when Jev says `DECISION_FATIGUE` with confidence strictly above `0.75`.

This broadens S-05 beyond its original UI-only boundary. The live OpenAI client remains deferred; the stub makes the complete request and display flow demonstrable without an OpenAI key or external call.

## Starting Point

Raw events stay in the browser, while detectors create privacy-safe MetaEvents that are batched to `/api/meta-events`. The dispatcher exposes full MetaEvents after a successful HTTP response, but the app retains only reduced summaries for the debug overlay. `AssistantInline` renders local `DecisionEngine` text and does not call the Jev route.

The existing proposal route accepts catalog state and catalog events. Its current high-confidence branch displays Jev's draft directly; the non-shortcut branch hides because the OpenAI client is unfinished.

## Desired End State

The app retains the latest 10 unique MetaEvents in a production-purpose in-memory store, separate from the debug overlay and raw event buffer. When the existing fatigue trigger fires, and the user is not muted, the client sends `{ metaEvents }` only to `/api/assistant-proposal`.

The server validates those events and builds a Jev prompt without raw events, catalog facts, or session/page-view identifiers. A qualifying fatigue result with `proposal.confidence > 0.75` invokes a fixed-response stub and shows one box. Confidence at or below the threshold, other situations, missing event context, invalid output, timeout, rate limiting, or failure hides the fatigue box.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Jev request context | MetaEvents only | Matches the requested flow; catalog events stay local to the client gate. |
| Request trigger | Existing decision-fatigue rule | Avoids calling Jev for every event and preserves the agreed S-05 trigger. |
| Confidence boundary | Strictly greater than `0.75`; exactly `0.75` hides | Matches the requested threshold. |
| High-confidence output | Fixed local demo proposal stub | Exercises the full flow without making a real OpenAI request. |
| Recent event window | Latest 10 unique MetaEvents after successful dispatch | Bounds request size and uses the existing dispatcher callback. |
| No usable MetaEvents | Do not call Jev; render no fatigue box | Prevents empty-context or tracker-disabled requests. |
| Existing friction behavior | Keep `search_friction` local | The requested Jev flow is for decision fatigue. |

## Scope

**In scope:**

- Production-purpose bounded MetaEvent history from successful `/api/meta-events` dispatches.
- MetaEvents-only request validation, server prompt, Jev confidence gate, and deterministic proposal stub.
- Client fetch, one-request-per-fatigue-trigger guard, abort/stale-response handling, existing mute, and one-box rendering.
- Align the shared interface, S-04 notes, PRD FR-010, and roadmap acceptance wording during implementation.

**Out of scope:**

- Raw events, catalog state, or catalog events sent to Jev.
- Reading assistant context from the dev-only debug store.
- A live OpenAI client, OpenAI credentials, or network call.
- Detector or decision-fatigue rule changes, new proposal types, loader, or second box.

## Architecture / Approach

The dispatcher’s successful-batch callback publishes full MetaEvents into a bounded app store. `AssistantInline` continues using `DecisionEngine` locally to decide when fatigue is present, then reads the recent MetaEvent snapshot and posts it to the shared endpoint. The route validates the request, calls Jev under existing timeout/rate limits, and sends only a qualifying validated fatigue output to the local stub.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Retain recent MetaEvents | Bounded production history from successful dispatcher batches | Coupling it to debug-only state would fail in production. |
| 2. Jev route and stub | MetaEvents-only contract, strict confidence gate, deterministic `show` or `hide` | Old S-04 shortcut and OpenAI plan conflict with the new branch. |
| 3. Wire the box | Occasional fatigue-triggered request and one validated proposal | Duplicate or stale requests could render old content. |

**Prerequisites:** The behavior tracker is enabled; the existing S-04 Jev route and response schema remain available to adapt.
**Estimated effort:** Three implementation phases across the client pipeline, shared contract, server route, and assistant UI.

## Open Risks & Assumptions

- MetaEvent history is in memory for the mounted tracker lifetime; a full page reload clears it. Client-side catalog navigation retains it.
- The fatigue trigger still depends on local `CatalogEvent`s even though Jev receives MetaEvents only.
- The fixed stub copy is demo-only and must be replaced by a real OpenAI adapter in a later change.

## Success Criteria (Summary)

- Browsing produces raw browser events and posted MetaEvents; a qualifying fatigue trigger sends one bounded MetaEvents-only request.
- Jev confidence `0.76` calls the fixed stub and shows its proposal; `0.75` or lower produces no fatigue box.
- Raw events and catalog context do not appear in the assistant request or Jev prompt, and no real OpenAI endpoint is called.
