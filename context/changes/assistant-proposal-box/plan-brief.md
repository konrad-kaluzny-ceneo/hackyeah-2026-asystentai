# Assistant Proposal from Aggregated MetaEvents — Plan Brief

> Full plan: `context/changes/assistant-proposal-box/plan.md`
> API contract: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Connect the existing behavior MetaEvent pipeline to the single assistant proposal box without a browser-side fatigue decision. The client sends its first bounded snapshot when one MetaEvent from a successful batch has been recorded, then asks again on each new event while no proposal is visible. Jev classifies the summary, and a deterministic local stub returns the demo proposal for any recognized situation with confidence strictly above `0.75`.

This broadens S-05 beyond its original UI-only boundary. The live OpenAI client remains deferred; the stub makes the complete request and display flow demonstrable without an OpenAI key or external call.

## Starting Point

Raw events stay in the browser, while detectors create privacy-safe MetaEvents that are batched to `/api/meta-events`. The dispatcher exposes full MetaEvents after a successful HTTP response, and the app retains a separate bounded history for assistant requests. `AssistantInline` currently gates Jev calls on a local `DecisionEngine` fatigue result.

The proposal route currently accepts only MetaEvents. Its confidence gate is still fatigue-only; this revision broadens it to the known Jev situations.

## Desired End State

The app retains the latest 10 unique MetaEvents in a production-purpose in-memory store, separate from the debug overlay and raw event buffer. At one event, and for every later event while there is no visible proposal and the user is not muted, the client sends `{ metaEvents }` only to `/api/assistant-proposal`. It does not decide whether the shopper has fatigue.

The server validates those events and builds a Jev prompt without raw events, catalog facts, or session/page-view identifiers. Any recognized Jev situation with `proposal.confidence > 0.75` invokes a fixed-response stub and shows one generic Jev proposal. Unknown situations, confidence at or below the threshold, missing event context, invalid output, timeout, rate limiting, or failure return `hide`.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Jev request context | MetaEvents only | Catalog facts remain local and are not used as the Jev request gate. |
| Request trigger | One distinct successfully sent MetaEvent, then each new event until a proposal is visible | Moves state classification to the server and implements the user's requested cadence. |
| Confidence boundary | Strictly greater than `0.75`; exactly `0.75` hides | Matches the requested threshold. |
| Recognized situations | `DECISION_FATIGUE`, `PRODUCT_HESITATION`, `NO_PROGRESS_STALL`, `UI_FRICTION`, `SMOOTH_EXPLORATION` | Match the situation vocabulary in the Jev prompt; unknown values hide. |
| High-confidence output | The same generic fixed local demo proposal for every recognized situation | Exercises the full flow without a real OpenAI request or labeling every result as fatigue. |
| Recent event window | Latest 10 unique MetaEvents after successful dispatch | Bounds request size and uses the existing dispatcher callback. |
| No usable MetaEvents | Do not call Jev before the first event | Prevents empty-context or tracker-disabled requests. |
| Existing friction behavior | Keep `search_friction` local and preserve one-box priority | Keeps the S-03 recovery path intact. |

## Scope

**In scope:**

- Production-purpose bounded MetaEvent history from successful `/api/meta-events` dispatches.
- MetaEvents-only request validation, server prompt, Jev confidence gate, and deterministic proposal stub.
- Client threshold trigger, per-new-event retry, abort/stale-response handling, existing mute, and one-box rendering.
- Server allowlist of known Jev situations, strict confidence gate, generic stub response, and shared response type.
- Align the shared interface, S-04 notes, PRD FR-010, domain notes, and roadmap acceptance wording.

**Out of scope:**

- Raw events, catalog state, or catalog events sent to Jev.
- Reading assistant context from the dev-only debug store.
- A live OpenAI client, OpenAI credentials, or network call.
- Detector or decision-fatigue rule changes, new proposal types, loader, or second box.

## Architecture / Approach

The dispatcher’s successful-batch callback publishes full MetaEvents into a bounded app store. `AssistantInline` reacts to history changes: once the count reaches five it posts a latest-10 snapshot on each new event while no proposal is visible. The route validates the request, calls Jev under existing timeout/rate limits, and sends any recognized output above the confidence threshold to the local stub.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Retain recent MetaEvents | Bounded production history from successful dispatcher batches | Coupling it to debug-only state would fail in production. |
| 2. Jev route and stub | MetaEvents-only contract, strict confidence gate, deterministic `show` or `hide` | Old S-04 shortcut and OpenAI plan conflict with the new branch. |
| 3. Move classification to the server | Five-event threshold, per-event retries, any-state confidence gate, and one validated proposal | Duplicate or stale requests could render old content; route limits still cap Jev calls. |

**Prerequisites:** The behavior tracker is enabled; the existing S-04 Jev route and response schema remain available to adapt.
**Estimated effort:** Three implementation phases across the client pipeline, shared contract, server route, and assistant UI.

## Open Risks & Assumptions

- MetaEvent history is in memory for the mounted tracker lifetime; a full page reload clears it. Client-side catalog navigation retains it.
- Existing server limits are 30 requests/minute per IP and 10/minute per process; requests over those limits return `hide` without calling Jev.
- The fixed stub copy is demo-only and must be replaced by a real OpenAI adapter in a later change.

## Success Criteria (Summary)

- Four MetaEvents send no request; the fifth starts classification, and each further event retries after a hidden/failed response until one proposal is shown.
- A recognized non-fatigue state at confidence `0.76` calls the fixed stub and shows one generic proposal; `0.75` or lower stays hidden.
- Raw events and catalog context do not appear in the assistant request or Jev prompt, and no real OpenAI endpoint is called.
