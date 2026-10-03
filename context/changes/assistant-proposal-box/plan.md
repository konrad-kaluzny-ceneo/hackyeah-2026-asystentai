# Assistant Proposal from Aggregated MetaEvents — Implementation Plan

## Overview

Connect the existing behavior MetaEvent pipeline to the assistant proposal flow. The client keeps a bounded window of successfully dispatched MetaEvents and, when the existing decision-fatigue gate fires, sends that window to the server. The server asks Jev to classify the event summary; only `DECISION_FATIGUE` with Jev `proposal.confidence > 0.75` reaches a deterministic OpenAI stub that returns the demo proposal. Lower confidence and failures produce no box. Real OpenAI integration remains future work.

## Current State Analysis

- Raw behavior events are collected and analyzed in the browser. Detectors emit privacy-safe `MetaEvent`s; the dispatcher batches them to `POST /api/meta-events`. Raw events stay in the browser (`src/behavior/types.ts:54-57,171-173`).
- The full MetaEvent batch is available after a successful HTTP response through the dispatcher's `onBatchSent` callback (`src/behavior/dispatcher/dispatcher.ts:87-105`). The production tracker shell currently sends that callback only to the dev debug summary store (`src/app/behavior-debug-shell.tsx:33-43`). That store retains summaries, not full events (`src/behavior/ui/debug-store.ts:89-124`), and is not an assistant data source.
- `AssistantInline` currently uses `DecisionEngine` to render fixed local copy. It does not call `/api/assistant-proposal` (`src/components/assistant/assistant-inline.tsx:28-48`). The existing mute lasts 15 minutes (`:52-55`).
- The existing proposal endpoint accepts `{ state, events }` with catalog state and `CatalogEvent[]`; the Jev prompt reads category, query, filters, and product slugs (`src/lib/assistant-proposal-api.ts:54-60,100-116`; `src/server/assistant-proposal/prompt.ts:3-25`).
- The route currently returns Jev's own draft directly for a high-confidence fatigue result; other valid outputs return `hide` because the OpenAI branch is unfinished (`src/server/assistant-proposal/route-decision.ts:12-35`; `src/app/api/assistant-proposal/route.ts:86-102`).
- `DecisionEngine` already supplies an occasional client-side gate: three distinct pairwise-similar product views followed by a return to the listing, with no later route or catalog change (`src/lib/decision-engine.ts:104-183`). The request body will contain MetaEvents only; catalog events remain local to this gate.

### Key Discoveries:

- `MetaEvent.quality.strength` is detector confidence, not Jev's proposal confidence (`src/behavior/types.ts:222-230`). The route threshold must use Jev's `proposal.confidence`.
- The assistant must read from a production-purpose bounded MetaEvent store, not `debug-store` or the raw-event checkpoint.
- `MetaEventSchema` already strictly validates the event shape, privacy flags, and metric allowlist (`src/server/meta-events/validation.ts:111-143`). Make the shared validation client-safe rather than duplicating or weakening it.

## Desired End State

When the current decision-fatigue gate fires, the client sends one `POST /api/assistant-proposal` containing only a bounded array of recent MetaEvents that were sent to `/api/meta-events`. The server validates and summarizes those events for Jev without sending raw events or catalog state. For a valid `DECISION_FATIGUE` result with confidence strictly above `0.75`, the server calls a fixed local proposal stub and returns its valid `show` response. Confidence at or below `0.75`, other situations, empty input, invalid output, timeout, rate limit, or model error return `hide` and render no fatigue box.

The existing single-box behavior remains: local `search_friction` stays local, the fatigue proposal has no loader, stale requests are ignored, and dismissal mutes the assistant for 15 minutes. The real OpenAI API client and key are not part of this change.

## What We're NOT Doing

- Sending raw events, raw-event checkpoints, catalog state, or `CatalogEvent[]` to Jev.
- Reusing `src/behavior/ui/debug-store.ts` as an assistant data source.
- Calling Jev for every browsing event, for `search_friction`, while muted, or when the behavior tracker is disabled.
- Implementing a real OpenAI request, API key handling, or a second proposal box.
- Changing detector definitions, thresholds, or `DecisionEngine` criteria.

## Implementation Approach

Use the existing fatigue proposal ID as the request identity. A separate application-purpose store receives full MetaEvents from the tracker's successful-batch callback, keeps only the most recent 10 unique events, and notifies `AssistantInline`. The UI calls the route once for a given fatigue proposal ID when the store has events and the assistant is not muted. The shared API contract changes to `{ metaEvents: MetaEvent[] }`; the route validates that bounded request, gives Jev a server-built summary, then either hides or invokes a deterministic stub. Existing route rate limits and Jev's three-second timeout remain in force.

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

Replace the catalog-event request contract and the Jev shortcut with the requested confidence-gated stub branch.

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

**Intent**: Apply the requested strict confidence gate for the existing fatigue proposal path.

**Contract**: Only `situation === "DECISION_FATIGUE"` and `proposal.confidence > 0.75` reaches the proposal stub. At exactly `0.75` or below, return `hide`; do not use Jev's `message_draft` as a shortcut. The fatigue situation condition preserves the current product scope.

**File**: `src/server/assistant-proposal/openai-stub.ts` (new)

**Intent**: Stand in for the future OpenAI generation step so the full flow can be demonstrated now.

**Contract**: Export a deterministic async proposal function that accepts validated Jev output and returns one fixed, valid `{ title, message }`. It performs no network request and requires no OpenAI key. Mark the function as the replacement seam for the future S-04 OpenAI client.

#### 3. Route orchestration and documentation alignment

**File**: `src/app/api/assistant-proposal/route.ts`

**Intent**: Validate MetaEvents, call Jev, apply the confidence gate, and invoke the stub only for the qualifying branch.

**Contract**: Preserve 30/min per-IP and 10/min per-process limits and Jev's three-second timeout. Empty/invalid input, invalid Jev schema, non-fatigue, confidence `<= 0.75`, timeout, rate limit, or stub failure returns `{ status: "hide" }`; confidence `> 0.75` for fatigue invokes the stub and returns the existing `show` schema.

**File**: `context/changes/jev-session-proposal/plan.md` and `context/changes/jev-session-proposal/plan-brief.md`

**Intent**: Align the S-04 server notes with the new shared route behavior and remove the now-deferred live OpenAI work from this flow.

**Contract**: Document the stub as the current boundary and leave the real OpenAI client/key as future work. Do not change unrelated S-04 status history.

**File**: `context/foundation/prd.md` and `context/foundation/roadmap.md`

**Intent**: Align FR-010 and S-04/S-05 acceptance text with the agreed confidence-gated demo flow.

**Contract**: Preserve the one-proposal guardrail and state that confidence at or below `0.75` yields no proposal; actual OpenAI generation remains deferred.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/assistant-proposal/assistant-proposal-api.test.ts tests/assistant-proposal/schema.test.ts tests/assistant-proposal/route-decision.test.ts tests/assistant-proposal/route.test.ts tests/behavior/validation.test.ts`
- `npm run typecheck`

#### Manual Verification:

- Valid fatigue output at `0.76` invokes the stub and returns the fixed valid `show` response.
- Confidence `0.75` and below, a non-fatigue situation, invalid Jev output, Jev timeout, or stub failure returns `hide` and does not invoke any real OpenAI endpoint.
- Invalid/raw-event payloads and more than 10 events are rejected before Jev is called.

**Implementation Note**: After automated checks pass, pause for the manual checks before starting Phase 3.

## Phase 3: Wire the Existing Assistant Box

### Overview

Call the revised endpoint from the existing fatigue UI gate and render only the validated stub response.

### Changes Required:

#### 1. Request lifecycle and rendering

**File**: `src/components/assistant/assistant-inline.tsx`

**Intent**: Subscribe to assistant MetaEvent history and use it as the only request payload while retaining existing local behavior for empty-search recovery.

**Contract**:

- `DecisionEngine === null`: render nothing and do not call the endpoint.
- `search_friction`: render the existing local recovery proposal and do not call Jev.
- `decision_fatigue`: if not muted and the MetaEvent history is non-empty, call `POST /api/assistant-proposal` once for that fatigue proposal ID with `{ metaEvents }` only.
- `show`: render one proposal from the shared response parser; `hide`, HTTP failure, or invalid response renders nothing.
- Keep the 15-minute mute, abort superseded requests, ignore stale responses, and do not add a loader or a second box.

**File**: `tests/components/assistant/assistant-inline.test.tsx` (new)

**Intent**: Cover request gating and the existing single-box lifecycle.

**Contract**: Verify fatigue with recent MetaEvents sends one events-only request; no history, muted, null, or friction does not call the endpoint; hide and invalid responses render no fatigue box; a fixed show renders one box; stale requests cannot replace newer state.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/components/assistant/assistant-inline.test.tsx tests/lib/assistant-events.test.ts`
- `npm run typecheck`

#### Manual Verification:

- Browse three similar products and return to the listing with tracking enabled. Confirm `/api/meta-events` receives detector MetaEvents, followed by one `/api/assistant-proposal` request whose body contains only a bounded `metaEvents` array.
- Confirm the server calls Jev; a qualifying response calls the local stub and displays its fixed proposal. Lower/equal confidence produces no fatigue box.
- Confirm empty-search recovery stays local, dismissal mutes for 15 minutes, and another proposal cannot appear at the same time.

## Testing Strategy

### Unit Tests:

- MetaEvent history ordering, deduplication, max-10 bound, and clear behavior.
- Shared MetaEvent validation and request count/body-size limits.
- Jev confidence boundary (`0.75` hides; `0.76` invokes the stub), non-fatigue hide, stub output validation, and failure paths.
- UI gate, mute, abort, and stale-request handling.

### Integration Tests:

- Route with mocked Jev output and the local stub: MetaEvents-only request → Jev → confidence gate → `show` or `hide`.
- No test or runtime path makes an external OpenAI call.

### Manual Testing Steps:

1. Enable `NEXT_PUBLIC_BEHAVIOR_TRACKING=true` and browse between product pages and a category listing.
2. Confirm raw events remain in the local debug overlay and MetaEvents continue to post to `/api/meta-events`.
3. Trigger decision fatigue by viewing three similar products and returning to the listing.
4. Inspect `/api/assistant-proposal`: it contains no raw events, catalog state, or catalog events, only the bounded MetaEvent array.
5. Use mocked Jev boundary outputs: `0.76` shows the fixed stub proposal; `0.75` hides it.
6. Dismiss the proposal and confirm the 15-minute mute; verify empty-search recovery remains local.

## Performance Considerations

Retain and send no more than 10 MetaEvents per proposal request, with a 64 KiB body ceiling. Preserve the existing Jev timeout and rate limits. The fixed stub must not add an external network wait.

## Migration Notes

The request contract changes from `{ state, events: CatalogEvent[] }` to `{ metaEvents: MetaEvent[] }`. The browser and route must ship together. Existing meta-event persistence remains unchanged; the assistant keeps only a bounded in-memory window of events received through the successful batch callback. A page reload clears this assistant window, while client-side catalog navigation preserves it for the mounted tracker lifetime.

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

- [x] 2.1 Extract/reuse strict shared MetaEvent validation and change request schema to events-only.
- [x] 2.2 Add MetaEvent-only prompt, strict confidence gate, and deterministic proposal stub.
- [x] 2.3 Update route, interface, S-04 notes, PRD/roadmap acceptance, and focused tests.
- [x] 2.4 Run focused assistant/meta-event validation tests and typecheck.

#### Manual

- [x] 2.5 Verify `0.76` calls stub and returns `show`; `0.75` returns `hide` without OpenAI network traffic.
- [x] 2.6 Verify invalid/oversized inputs and Jev/stub failures return `hide`.

### Phase 3: Wire the Existing Assistant Box

#### Automated

- [ ] 3.1 Subscribe the UI to recent MetaEvents and post once per fatigue trigger.
- [ ] 3.2 Preserve local friction, mute, abort, stale-response, and one-box behavior with tests.
- [ ] 3.3 Run focused UI tests and typecheck.

#### Manual

- [ ] 3.4 Verify the full browse → meta-events → proposal request → Jev → stub → single box flow.
