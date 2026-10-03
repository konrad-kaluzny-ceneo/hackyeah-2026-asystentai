# Assistant Proposal from Aggregated MetaEvents — Implementation Plan

## Overview

Connect the behavior MetaEvent pipeline to assistant proposals without asking the browser to decide whether the shopper has decision fatigue. Once the client has five distinct MetaEvents from successfully delivered `/api/meta-events` batches, it calls `/api/assistant-proposal`; each later MetaEvent triggers another request while no proposal is visible. The server asks Jev to classify the bounded event summary and returns a deterministic demo proposal for any recognized situation with confidence strictly above 0.75. Lower confidence, unknown situations, and failures produce no Jev proposal. Real OpenAI integration remains future work.

## Current State Analysis

- Raw behavior events are collected and analyzed in the browser. Detectors emit privacy-safe `MetaEvent`s; the dispatcher batches them to `POST /api/meta-events`. Raw events stay in the browser (`src/behavior/types.ts:54-57,171-173`).
- The full MetaEvent batch is available after a successful HTTP response through the dispatcher's `onBatchSent` callback (`src/behavior/dispatcher/dispatcher.ts:87-105`). The tracker shell publishes full events into `assistant-meta-event-history` and separately records reduced summaries for the dev overlay; the assistant store is not the debug store.
- Before Phase 3, `AssistantInline` gated requests on a local `DecisionEngine` fatigue result and called `/api/assistant-proposal` once per fatigue proposal ID when the history was non-empty. The existing mute lasts 15 minutes (`src/components/assistant/assistant-inline.tsx`).
- The proposal endpoint already accepts only `{ metaEvents }` (1–10 strict MetaEvents) and the Jev prompt builds a minimized summary; raw/catalog events and catalog state are not part of this request (`src/lib/assistant-proposal-api.ts`; `src/server/assistant-proposal/prompt.ts`).
- Before Phase 3, the route invoked the local stub only for `DECISION_FATIGUE` with confidence above 0.75; every other valid Jev situation returned `hide` (`src/server/assistant-proposal/route-decision.ts`; `src/app/api/assistant-proposal/route.ts`).
- `DecisionEngine` currently supplies the client-side fatigue gate: three distinct pairwise-similar product views followed by a return to the listing, with no later route or catalog change (`src/lib/decision-engine.ts:104-183`). Phase 3 removes this gate from the Jev request path; catalog events remain local.

### Key Discoveries:

- `MetaEvent.quality.strength` is detector confidence, not Jev's proposal confidence (`src/behavior/types.ts:222-230`). The route threshold must use Jev's `proposal.confidence`.
- The assistant must read from a production-purpose bounded MetaEvent store, not `debug-store` or the raw-event checkpoint.
- `MetaEventSchema` already strictly validates the event shape, privacy flags, and metric allowlist (`src/server/meta-events/validation.ts:111-143`). Make the shared validation client-safe rather than duplicating or weakening it.

## Desired End State

When the client history first reaches five distinct MetaEvents from successful `/api/meta-events` batches, the client sends `POST /api/assistant-proposal` with only the latest bounded MetaEvent snapshot. Every later distinct event triggers another request while no proposal is visible and the assistant is not muted. The browser does not use `DecisionEngine` to decide whether fatigue or another state has been reached. The server validates and summarizes the events for Jev without sending raw events or catalog state. A recognized Jev situation with confidence strictly above `0.75` reaches the deterministic local proposal stub; unknown situations, confidence at or below `0.75`, invalid input/output, timeout, rate limit, or model error return `hide`. The local empty-search recovery remains local and keeps the single-box priority.

The existing single-box behavior remains: local `search_friction` stays local, there is no loader, stale requests are ignored, and dismissal mutes the assistant for 15 minutes. The real OpenAI API client and key are not part of this change.

## What We're NOT Doing

- Sending raw events, raw-event checkpoints, catalog state, or `CatalogEvent[]` to Jev.
- Reusing `src/behavior/ui/debug-store.ts` as an assistant data source.
- Calling Jev before five distinct successfully sent MetaEvents, for a visible local `search_friction` proposal, while muted, or when the behavior tracker is disabled.
- Implementing a real OpenAI request, API key handling, or a second proposal box.
- Changing detector definitions, thresholds, or `DecisionEngine` criteria.

## Implementation Approach

The application-purpose store receives full MetaEvents from the tracker's successful-batch callback, keeps only the most recent 10 unique events, and queues one immutable snapshot when the fifth and each later distinct event arrives. A coordinator mounted in the root behavior shell drains these triggers in order while no proposal is visible and the assistant is not muted, including while the shopper is on a product page. Each request carries at most 10 MetaEvents. The shared request remains `{ metaEvents: MetaEvent[] }`. The route validates that bounded request, gives Jev a server-built summary, validates Jev's situation against the known prompt vocabulary, then hides or invokes the deterministic demo stub based on the strict confidence threshold. Existing route rate limits and Jev's three-second timeout remain in force.

## Phase 1: Retain Recent MetaEvents for the Assistant

### Overview

Expose a bounded, production-safe snapshot of full MetaEvents without involving the debug overlay or raw event storage.

### Changes Required:

#### 1. Assistant MetaEvent history

**File**: `src/behavior/assistant-meta-event-history.ts` (new)

**Intent**: Provide an app-purpose in-memory store and subscription for recent complete MetaEvents. Keep this separate from detector raw buffers and the development debug store.

**Contract**: Deduplicate by `eventId`, preserve chronological order, retain at most 10 events, expose a read-only snapshot and subscribe/unsubscribe functions, and clear the snapshot when the behavior tracker/session is torn down. An empty snapshot means no assistant request is eligible.

#### 2. Publish successfully dispatched batches

**File**: `src/behavior/initializer/initializer.ts`

**Intent**: Publish only MetaEvents from batches whose `/api/meta-events` transport received HTTP 2xx, using the existing dispatcher callback seam.

**Contract**: Keep the existing optional `onBatchSent` hook and preserve its full batch payload. The application history subscriber receives full events; raw events and event checkpoints are never exposed through this path.

**File**: `src/app/behavior-debug-shell.tsx`

**Intent**: Connect the app-purpose history and existing debug summary callback to tracker batches while the tracker is mounted in development and production.

**Contract**: Compose the production history update with `recordBatchSent`; the assistant does not import or subscribe to `debug-store`.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/behavior/dispatcher.test.ts tests/behavior/assistant-meta-event-history.test.ts`
- `npm run typecheck`

#### Manual Verification:

- With behavior tracking enabled, browse across catalog and product pages and confirm that only successfully sent MetaEvents enter the assistant history.
- Confirm history is chronological, capped at 10 unique events, clears with the tracker, and contains no raw events.

**Implementation Note**: After automated checks pass, pause for the manual check before starting Phase 2.

## Phase 2: MetaEvents-Only Jev Route and Proposal Stub

### Overview

This completed phase replaced the earlier catalog-event request contract with a MetaEvents-only request and introduced the initial fatigue-only confidence-gated local stub. Phase 3 revises the request trigger and broadens the server gate.

### Changes Required:

#### 1. Shared MetaEvent request contract

**File**: `src/behavior/meta-event-schema.ts` (new shared schema; extract the current `MetaEventSchema`)

**Intent**: Make the existing strict MetaEvent validator usable by both the browser request contract and server routes without importing a server-layer module into client code.

**Contract**: Preserve the current strict field, privacy-flag, and per-event metric allowlist validation. Keep `/api/meta-events` validation behavior unchanged.

**File**: `src/server/meta-events/validation.ts`

**Intent**: Continue using the shared schema for stored meta-event batches.

**Contract**: Existing `BatchPayloadSchema` keeps its envelope and limits; it composes the extracted shared `MetaEventSchema`.

**File**: `src/lib/assistant-proposal-api.ts`

**Intent**: Define the single shared request and response contract consumed by the route and client.

**Contract**: The request is `{ metaEvents: MetaEvent[] }`, with 1–10 strict MetaEvents and a 64 KiB request-body ceiling. Remove `state` and catalog `events` from this endpoint's request. Keep the existing `show | hide` response union.

**File**: `context/changes/assistant-proposal-box/interface.md`

**Intent**: Document the revised request, Jev confidence behavior, stub response, and hide cases for both S-04 and S-05.

**Contract**: State explicitly that only aggregated MetaEvents are sent, raw/catalog events are excluded, the threshold is strictly `> 0.75`, and the OpenAI integration is a fixed local stub for this slice.

#### 2. Jev prompt, gate, and fixed stub

**File**: `src/server/assistant-proposal/prompt.ts`

**Intent**: Build Jev input from the bounded MetaEvent array instead of catalog facts.

**Contract**: Summarize allowlisted event names, relative timing/window, page type, safe subject context, and allowlisted metrics. Do not include session/page-view identifiers, paths, raw events, catalog state, or catalog events. Do not describe detector `quality.strength` as Jev confidence.

**File**: `src/server/assistant-proposal/route-decision.ts`

**Intent**: Apply the original strict confidence gate for the decision-fatigue proposal path; Phase 3 supersedes this fatigue-only restriction.

**Contract**: At this phase's completion, only `situation === "DECISION_FATIGUE"` and `proposal.confidence > 0.75` reached the proposal stub. At exactly `0.75` or below, the route returned `hide`; Jev's `message_draft` was not used as a shortcut. Phase 3 updates this gate to any recognized Jev situation.

**File**: `src/server/assistant-proposal/openai-stub.ts` (new)

**Intent**: Stand in for the future OpenAI generation step so the full flow can be demonstrated now.

**Contract**: Export a deterministic async proposal function that accepts validated Jev output and returns one fixed, valid `{ title, message }`. It performs no network request and requires no OpenAI key. Mark the function as the replacement seam for the future S-04 OpenAI client.

#### 3. Route orchestration and documentation alignment

**File**: `src/app/api/assistant-proposal/route.ts`

**Intent**: Validate MetaEvents, call Jev, apply the confidence gate, and invoke the stub only for the qualifying branch.

**Contract**: Preserve 30/min per-IP and 10/min per-process limits and Jev's three-second timeout. Empty/invalid input, invalid Jev schema, unknown situation, confidence `<= 0.75`, timeout, rate limit, or stub failure returns `{ status: "hide" }`; any recognized situation above the confidence threshold invokes the stub and returns the revised `show` schema.

**File**: `context/changes/jev-session-proposal/plan.md` and `context/changes/jev-session-proposal/plan-brief.md`

**Intent**: Align the S-04 server notes with the new shared route behavior and remove the now-deferred live OpenAI work from this flow.

**Contract**: Document the stub as the current boundary and leave the real OpenAI client/key as future work. Update the S-04 gate from fatigue-only to all recognized Jev situations without changing unrelated S-04 status history.

**File**: `context/foundation/prd.md` and `context/foundation/roadmap.md`

**Intent**: Align FR-010 and S-04/S-05 acceptance text with the agreed confidence-gated demo flow.

**Contract**: Preserve the one-proposal guardrail and document the five-event threshold, server classification for known Jev situations, and confidence boundary; actual OpenAI generation remains deferred.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/assistant-proposal/assistant-proposal-api.test.ts tests/assistant-proposal/schema.test.ts tests/assistant-proposal/route-decision.test.ts tests/assistant-proposal/route.test.ts tests/behavior/validation.test.ts`
- `npm run typecheck`

#### Manual Verification:

- A recognized fatigue or non-fatigue output at `0.76` invokes the stub and returns the fixed valid `show` response.
- Confidence `0.75` and below, an unknown situation, invalid Jev output, Jev timeout, or stub failure returns `hide` and does not invoke any real OpenAI endpoint.
- Invalid/raw-event payloads and more than 10 events are rejected before Jev is called.

**Implementation Note**: After automated checks pass, pause for the manual checks before starting Phase 3.

## Phase 3: Wire the Existing Assistant Box

### Overview

Replace the client fatigue gate with a MetaEvent-count trigger and broaden the server gate to all recognized Jev situations.

### Changes Required:

#### 1. Persistent client request lifecycle

**File**: `src/components/assistant/assistant-proposal-coordinator.tsx` (new)

**Intent**: Drain queued MetaEvent request triggers from the root behavior shell so classification continues while the listing box is unmounted on product pages.

**Contract**: When the history first reaches five distinct events, call `POST /api/assistant-proposal` with the latest at most 10 events; send another request for each newly observed event thereafter while no proposal is visible and the assistant is not muted. Serialize requests in event order. `show` publishes one validated proposal; `hide`, HTTP failure, or invalid response leaves it hidden and proceeds to the next queued new-event trigger. A visible local search-recovery box or a mute clears queued triggers and aborts an in-flight request.

**File**: `src/lib/assistant-proposal-state.ts` (new)

**Intent**: Share the single server proposal and local search-recovery visibility between the persistent coordinator and the listing renderer.

**Contract**: Keep at most one Jev proposal; local search recovery takes precedence and tells the coordinator to pause. The store contains proposal UI data only, not event or catalog context.

#### 2. Existing assistant box rendering

**File**: `src/components/assistant/assistant-inline.tsx`

**Intent**: Render the server proposal published by the root coordinator while retaining the existing local empty-search recovery.

**Contract**:

- Do not subscribe to MetaEvents to make Jev requests here; the root coordinator owns that lifecycle.
- Do not use `DecisionEngine`'s `decision_fatigue` result as an assistant-request condition. Preserve `search_friction` as local recovery and give it priority over a Jev proposal.
- Render one validated Jev proposal from shared state; keep the 15-minute mute, one-box behavior, and no-loader UI.

**File**: `tests/components/assistant/assistant-inline.test.tsx`

**Intent**: Cover the five-event threshold, event-by-event retries across page navigation, and the existing single-box lifecycle.

**Contract**: Verify four events send nothing, the fifth sends one events-only request without a fatigue decision, each later event retries after a hide, a shown proposal stops further requests, mute and local visible search recovery suppress requests, invalid responses render no Jev box, and stale responses cannot replace newer state.

#### 2. Server known-state gate and generic demo proposal

**Files**: `src/server/assistant-proposal/schema.ts`, `src/server/assistant-proposal/route-decision.ts`, `src/server/assistant-proposal/openai-stub.ts`, `src/app/api/assistant-proposal/route.ts`, `src/lib/assistant-proposal-api.ts`

**Intent**: Let Jev classify fatigue and other recognized situations, then make the confidence decision on the server before invoking the deterministic demo stub.

**Contract**: Validate `situation` against the five states in the Jev prompt: `DECISION_FATIGUE`, `PRODUCT_HESITATION`, `NO_PROGRESS_STALL`, `UI_FRICTION`, and `SMOOTH_EXPLORATION`. Any recognized situation with Jev proposal confidence strictly greater than `0.75` invokes the same deterministic demo stub; at or below the threshold, or for an unknown situation, return `hide`. The `show` response identifies a generic Jev proposal rather than mislabeling every result as decision fatigue. The stub remains local and makes no OpenAI network call.

**Files**: `tests/assistant-proposal/route-decision.test.ts`, `tests/assistant-proposal/route.test.ts`, `tests/assistant-proposal/assistant-proposal-api.test.ts`

**Intent**: Cover recognized-state allowlisting and the confidence boundary across route and response contract.

**Contract**: Verify a non-fatigue known situation above threshold calls the stub and returns `show`; unknown situations and confidence `<= 0.75` return `hide`.

#### 3. Documentation alignment

**Files**: `context/changes/assistant-proposal-box/interface.md`, `context/changes/jev-session-proposal/plan.md`, `context/changes/jev-session-proposal/plan-brief.md`, `context/foundation/prd.md`, `context/foundation/roadmap.md`, `context/foundation/domain.md`

**Intent**: Make the documented S-04/S-05 contract match the new browser threshold and server-owned Jev classification.

**Contract**: Document five successful MetaEvents as the initial request threshold, one new request per later event while no proposal is visible, server classification for all recognized Jev situations, the strict confidence gate, generic deterministic stub, and unchanged privacy and one-box rules.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/components/assistant/assistant-inline.test.tsx tests/behavior/assistant-meta-event-history.test.ts tests/assistant-proposal/schema.test.ts tests/assistant-proposal/route-decision.test.ts tests/assistant-proposal/route.test.ts tests/assistant-proposal/assistant-proposal-api.test.ts tests/lib/assistant-events.test.ts`
- `npm run typecheck`

#### Manual Verification:

- With tracking enabled, send four distinct MetaEvents successfully and confirm no proposal request; while on a product page, send the fifth and confirm one `/api/assistant-proposal` request containing only the latest bounded `metaEvents`.
- Return `hide`, then add a sixth event and confirm another request. Return a high-confidence known non-fatigue Jev situation and confirm the generic demo proposal appears; further events must not create another box or request while it is visible.
- Return confidence `0.75` or below and confirm no box; add a later event and confirm classification is retried. Confirm unknown Jev situations hide.
- Confirm empty-search recovery remains local, dismissal mutes for 15 minutes, and the request contains no raw events, catalog state, or catalog events.

## Testing Strategy

### Unit Tests:

- MetaEvent history ordering, deduplication, max-10 bound, and clear behavior.
- Shared MetaEvent validation and request count/body-size limits.
- Jev confidence boundary (`0.75` hides; `0.76` invokes the stub for a known state), known-state allowlist, stub output validation, and failure paths.
- Five-event threshold, per-event queued snapshots, mute, abort, and stale-response handling.

### Integration Tests:

- Route with mocked Jev output and the local stub: MetaEvents-only request → Jev → confidence gate → `show` or `hide`.
- No test or runtime path makes an external OpenAI call.

### Manual Testing Steps:

1. Enable `NEXT_PUBLIC_BEHAVIOR_TRACKING=true` and browse between product pages and a category listing.
2. Confirm raw events remain in the local debug overlay and MetaEvents continue to post to `/api/meta-events`.
3. Browse with existing detectors until five distinct MetaEvents have been successfully posted to `/api/meta-events`; no fatigue-specific catalog sequence is required.
4. Inspect `/api/assistant-proposal`: it contains no raw events, catalog state, or catalog events, only the bounded MetaEvent array.
5. Use mocked Jev boundary outputs: a known state at `0.76` shows the fixed stub proposal; `0.75` hides it. After a hidden result, one new MetaEvent triggers another request.
6. Dismiss the proposal and confirm the 15-minute mute; verify empty-search recovery remains local.

## Performance Considerations

Retain and send no more than 10 MetaEvents per proposal request, with a 64 KiB body ceiling. Preserve the existing Jev timeout and rate limits; requests beyond those limits still return `hide`. The fixed stub must not add an external network wait.

## Migration Notes

The request contract remains `{ metaEvents: MetaEvent[] }`; this revision changes its trigger and server decision policy. The browser and route response contract must ship together. Existing meta-event persistence remains unchanged; the assistant keeps only a bounded in-memory window of events received through the successful batch callback. A page reload clears this assistant window, while client-side catalog navigation preserves it for the mounted tracker lifetime.

## References

- API contract: `context/changes/assistant-proposal-box/interface.md`
- Previous server plan to align: `context/changes/jev-session-proposal/plan.md`
- MetaEvent contract: `src/behavior/types.ts`, `src/server/meta-events/validation.ts`
- Dispatcher callback: `src/behavior/dispatcher/dispatcher.ts`
- Current client fatigue gate: `src/lib/decision-engine.ts`
- Current shared API module: `src/lib/assistant-proposal-api.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands.

### Phase 1: Retain Recent MetaEvents for the Assistant

#### Automated

- [x] 1.1 Add bounded MetaEvent history store and tests. — e9aba2a
- [x] 1.2 Publish full successful dispatcher batches to the app store without using debug-store. — e9aba2a
- [x] 1.3 Run focused behavior tests and typecheck. — e9aba2a

#### Manual

- [x] 1.4 Verify recent history updates only after `/api/meta-events` receives HTTP 2xx and is capped at 10. — e9aba2a

### Phase 2: MetaEvents-Only Jev Route and Proposal Stub

#### Automated

- [x] 2.1 Extract/reuse strict shared MetaEvent validation and change request schema to events-only. — f18f06b
- [x] 2.2 Add MetaEvent-only prompt, strict confidence gate, and deterministic proposal stub. — f18f06b
- [x] 2.3 Update route, interface, S-04 notes, PRD/roadmap acceptance, and focused tests. — f18f06b
- [x] 2.4 Run focused assistant/meta-event validation tests and typecheck. — f18f06b

#### Manual

- [x] 2.5 Verify `0.76` calls stub and returns `show`; `0.75` returns `hide` without OpenAI network traffic. — f18f06b
- [x] 2.6 Verify invalid/oversized inputs and Jev/stub failures return `hide`. — f18f06b

### Phase 3: Server-Driven Classification from MetaEvent Threshold

#### Automated

- [x] 3.1 Replace the client fatigue gate with a five-event threshold and a new-event request trigger, stopping after a proposal is shown.
- [x] 3.2 Gate the server demo stub on any recognized Jev situation with confidence above 0.75 and update the response type so it is not fatigue-only.
- [x] 3.3 Align the S-04/S-05 interface, product requirements, roadmap, and domain notes.
- [x] 3.4 Run focused route/UI/history tests and typecheck.

#### Manual

- [ ] 3.5 Verify the five-event threshold, retry on each later event after hide, high-confidence non-fatigue show, and single-box/mute behavior.
