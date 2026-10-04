# Assistant Proposal from Aggregated MetaEvents — Implementation Plan

> Historyczny plan. Slice jest na `main`. Próg requestu to 5 unikalnych MetaEventów. Aktualny kontrakt: [`interface.md`](interface.md).

## Overview

Connect the existing behavior MetaEvent pipeline to the assistant proposal flow. The client keeps a bounded window of successfully dispatched MetaEvents and queues a request after the first unique event, then after each new event while no proposal is visible. The server asks Jev to classify the event summary, then uses a confident Jev text shortcut or asks OpenAI for `{ title, message }`. Failures produce no box; the filter action remains local to the UI.

## Current State Analysis

- Raw behavior events are collected and analyzed in the browser. Detectors emit privacy-safe `MetaEvent`s; the dispatcher batches them to `POST /api/meta-events`. Raw events stay in the browser (`src/behavior/types.ts:54-57,171-173`).
- The full MetaEvent batch is available after a successful HTTP response through the dispatcher's `onBatchSent` callback (`src/behavior/dispatcher/dispatcher.ts:87-105`). The production tracker shell currently sends that callback only to the dev debug summary store (`src/app/behavior-debug-shell.tsx:33-43`). That store retains summaries, not full events (`src/behavior/ui/debug-store.ts:89-124`), and is not an assistant data source.
- `AssistantInline` currently uses `DecisionEngine` to render fixed local copy. It does not call `/api/assistant-proposal` (`src/components/assistant/assistant-inline.tsx:28-48`). The existing mute lasts 15 minutes (`:52-55`).
- The shared proposal request accepts `{ metaEvents }` only. The Jev prompt minimizes event data and excludes raw events, session/page-view identifiers, and paths.
- A confident, unhedged Jev fatigue result with a non-empty draft can use the shortcut; other valid outputs use OpenAI and return the same title/message contract.
- `DecisionEngine` still supplies local empty-search recovery and a fatigue copy candidate, but the S-05 server request cadence is now event-count based. Catalog events never enter the request.

### Key Discoveries:

- `MetaEvent.quality.strength` is detector confidence, not Jev's proposal confidence (`src/behavior/types.ts:222-230`). The route threshold must use Jev's `proposal.confidence`.
- The assistant must read from a production-purpose bounded MetaEvent store, not `debug-store` or the raw-event checkpoint.
- `MetaEventSchema` already strictly validates the event shape, privacy flags, and metric allowlist (`src/server/meta-events/validation.ts:111-143`). Make the shared validation client-safe rather than duplicating or weakening it.

## Desired End State

After one unique MetaEvent from a successful `/api/meta-events` batch, the client queues one `POST /api/assistant-proposal` per new event while unmuted and without a visible proposal. Each request contains only a bounded array of recent MetaEvents. The server validates and summarizes those events for Jev without sending raw events or catalog state. Jev may provide a confident shortcut; other valid results go to OpenAI. The API returns `show` with a title and message, or `hide`; the UI applies its local filter action.

The existing single-box behavior remains: local `search_friction` stays local, the fatigue proposal has no loader, stale requests are ignored, and dismissal mutes the assistant for 15 minutes. OpenAI has a separate short deadline with SDK retries disabled.

## What We're NOT Doing

- Sending raw events, raw-event checkpoints, catalog state, or `CatalogEvent[]` to Jev.
- Reusing `src/behavior/ui/debug-store.ts` as an assistant data source.
- Calling Jev before the first unique event, for local `search_friction`, while muted, or when the behavior tracker is disabled.
- Sending raw events or catalog facts to Jev/OpenAI, or adding a second proposal box.
- Changing detector definitions, thresholds, or `DecisionEngine` criteria.

## Implementation Approach

An application-purpose store receives full MetaEvents from the tracker's successful-batch callback, keeps only the most recent 10 unique events, and queues snapshots beginning at event one. The root-mounted `AssistantProposalCoordinator` serially drains queued snapshots while unmuted and without a visible proposal, including while the listing box is unmounted; an interrupted request is requeued on coordinator unmount. `AssistantInline` renders from shared proposal state and retains local empty-search recovery. The route validates `{ metaEvents }`, gives Jev a server-built summary, then uses the Jev shortcut or OpenAI. The API returns status/title/message and the UI supplies the local filter action.

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

## Phase 2: MetaEvents-Only Jev Route and OpenAI Copy

### Overview

Replace the catalog-event request contract with bounded MetaEvents and connect the Jev/OpenAI composition while preserving the shortcut branch.

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

**Intent**: Document the revised request, Jev/OpenAI behavior, title/message response, and hide cases for both S-04 and S-05.

**Contract**: State explicitly that only aggregated MetaEvents are sent, raw/catalog events are excluded, Jev may use a confident shortcut, and OpenAI returns only title/message.

#### 2. Jev prompt, gate, and OpenAI copy

**File**: `src/server/assistant-proposal/prompt.ts`

**Intent**: Build Jev input from the bounded MetaEvent array instead of catalog facts.

**Contract**: Summarize allowlisted event names, relative timing/window, page type, safe subject context, and allowlisted metrics. Do not include session/page-view identifiers, paths, raw events, catalog state, or catalog events. Do not describe detector `quality.strength` as Jev confidence.

**File**: `src/server/assistant-proposal/route-decision.ts`

**Intent**: Apply the requested strict confidence gate for the existing fatigue proposal path.

**Contract**: Only `DECISION_FATIGUE` with confidence `>= 0.75`, no hedging, and a non-empty Jev draft takes the shortcut; other valid outputs use OpenAI. OpenAI returns structured `{ title, message }`, not an action or filter payload.

#### 3. Route orchestration and documentation alignment

**File**: `src/app/api/assistant-proposal/route.ts`

**Intent**: Validate MetaEvents and call the shared Jev/OpenAI composition.

**Contract**: Preserve body/rate limits and Jev's three-second timeout. OpenAI has its own deadline with retries disabled. The API returns only status/title/message; invalid input and provider failures return `{ status: "hide" }`.

**File**: `context/changes/jev-session-proposal/plan.md` and `context/changes/jev-session-proposal/plan-brief.md`

**Intent**: Align the S-04 server notes with the shared MetaEvents request and OpenAI title/message response.

**Contract**: Document the shortcut/OpenAI flow, timeout and retry behavior, and the minimal response contract.

**File**: `context/foundation/prd.md` and `context/foundation/roadmap.md`

**Intent**: Align FR-010 and S-04/S-05 acceptance text with the agreed confidence-gated demo flow.

**Contract**: Preserve the one-proposal guardrail and document that OpenAI generates copy for valid non-shortcut outputs while the UI owns the action.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/assistant-proposal/assistant-proposal-api.test.ts tests/assistant-proposal/schema.test.ts tests/assistant-proposal/route-decision.test.ts tests/assistant-proposal/route.test.ts tests/behavior/validation.test.ts`
- `npm run typecheck`

#### Manual Verification:

- A confident, unhedged Jev shortcut returns a valid `show`; other valid outputs use OpenAI and return validated title/message.
- Invalid Jev output, timeout, rate limit, or provider failure returns `hide`.
- Invalid/raw-event payloads and more than 10 events are rejected before Jev is called.

**Implementation Note**: After automated checks pass, pause for the manual checks before starting Phase 3.

## Phase 3: Wire the Existing Assistant Box

### Overview

Call the revised endpoint from the serialized event-trigger queue and combine validated title/message with the local filter action.

### Changes Required:

#### 1. Request lifecycle and rendering

**File**: `src/components/assistant/assistant-proposal-coordinator.tsx` (new)

**Intent**: Keep the serialized request worker mounted with the behavior shell so it continues across category/product navigation.

**Contract**: Observe the bounded MetaEvent trigger queue and shared UI state; process one request at a time while unmuted, without a server proposal or local recovery, and abort/requeue an interrupted trigger on unmount. Combine validated response title/message with the local filter action.

**File**: `src/lib/assistant-proposal-state.ts` (new)

**Intent**: Share the current server proposal and local recovery visibility between the root coordinator and listing UI.

**Contract**: Expose a subscribable external store with one proposal maximum and a flag that pauses remote requests while local empty-search recovery is visible.

**File**: `src/components/assistant/assistant-inline.tsx`

**Intent**: Render the shared server proposal while retaining existing local behavior for empty-search recovery and dismissal.

**Contract**:

- Do not own the request queue or call the endpoint; that lifecycle belongs to the root coordinator.
- `search_friction`: render the existing local recovery proposal and do not call Jev.
- `show`: render one proposal from shared state using parsed server title/message and the local filter action; `hide`, HTTP failure, or invalid response renders nothing.
- Keep the 15-minute mute, abort in-flight requests on mute/unmount, requeue an interrupted trigger, and do not add a loader or a second box.

**File**: `tests/components/assistant/assistant-inline.test.tsx` (new)

**Intent**: Cover the event threshold, queued request lifecycle, and the existing single-box behavior.

**Contract**: Verify the first event and later events queue bounded events-only requests, mute/friction stop the queue, hide responses allow later queued triggers to proceed, and show responses render one box with server copy and a local action.

### Phase Success Criteria

#### Automated Verification:

- `npm test -- tests/components/assistant/assistant-inline.test.tsx tests/lib/assistant-events.test.ts`
- `npm run typecheck`

#### Manual Verification:

- With tracking enabled, confirm the first unique MetaEvent starts classification and subsequent events queue one bounded request each until a proposal is visible.
- Confirm the server calls Jev and then either uses a confident shortcut or calls OpenAI; the UI displays the returned copy with its local filter action.
- Confirm empty-search recovery stays local, dismissal mutes for 15 minutes, and another proposal cannot appear at the same time.

## Testing Strategy

### Unit Tests:

- MetaEvent history ordering, deduplication, max-10 bound, and clear behavior.
- Shared MetaEvent validation and request count/body-size limits.
- Jev shortcut boundary, OpenAI fallback, title/message validation, and provider failure paths.
- First-event threshold, queue ordering, mute, abort/requeue, and single-box UI behavior.

### Integration Tests:

- Route with mocked Jev/OpenAI output: MetaEvents-only request → Jev → shortcut/OpenAI → `show` or `hide`.
- No test or runtime path makes an external OpenAI call.

### Manual Testing Steps:

1. Enable `NEXT_PUBLIC_BEHAVIOR_TRACKING=true` and browse between product pages and a category listing.
2. Confirm raw events remain in the local debug overlay and MetaEvents continue to post to `/api/meta-events`.
3. Generate unique MetaEvents from successfully sent batches; verify each event can queue a request while the assistant is available.
4. Inspect `/api/assistant-proposal`: it contains no raw events, catalog state, or catalog events, only the bounded MetaEvent array.
5. Use mocked Jev/OpenAI output to verify the shortcut and OpenAI paths return the same title/message shape.
6. Dismiss the proposal and confirm the 15-minute mute; verify empty-search recovery remains local.

## Performance Considerations

Retain and send no more than 10 MetaEvents per proposal request, with a 64 KiB body ceiling. Preserve the Jev timeout/rate limits and keep OpenAI bounded by its own deadline without SDK retries.

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

> Stan na `main` (2026-10-04): fazy 1–3 są w kodzie. Próg requestu to 5 unikalnych MetaEventów, nie pierwszy. Otwarty zostaje tylko ręczny przebieg w przeglądarce (3.4).

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands.

### Phase 1: Retain Recent MetaEvents for the Assistant

#### Automated

- [x] 1.1 Add bounded MetaEvent history store and tests. — e9aba2a
- [x] 1.2 Publish full successful dispatcher batches to the app store without using debug-store. — e9aba2a
- [x] 1.3 Run focused behavior tests and typecheck. — e9aba2a

#### Manual

- [x] 1.4 Verify recent history updates only after `/api/meta-events` receives HTTP 2xx and is capped at 10. — e9aba2a

### Phase 2: MetaEvents-Only Jev Route and OpenAI Action

#### Automated

- [x] 2.1 Extract/reuse strict shared MetaEvent validation and change request schema to events-only. — f18f06b
- [x] 2.2 Add MetaEvent-only prompt and connect the Jev/OpenAI action flow. — f18f06b
- [x] 2.3 Update route, interface, S-04 notes, PRD/roadmap acceptance, and focused tests. — f18f06b
- [x] 2.4 Run focused assistant/meta-event validation tests and typecheck. — f18f06b

#### Manual

- [x] 2.5 Verify the Jev shortcut and OpenAI fallback return the shared action/data contract.
- [x] 2.6 Verify invalid/oversized inputs and Jev/OpenAI failures return `hide`.

### Phase 3: Wire the Existing Assistant Box

#### Automated

- [x] 3.1 Subscribe the UI to recent MetaEvents and serialize requests from the five-event threshold onward.
- [x] 3.2 Preserve local friction, mute, abort/requeue, and one-box behavior with tests.
- [x] 3.3 Run focused UI tests and typecheck.

#### Manual

- [ ] 3.4 Verify the full browse → meta-events → proposal request → Jev/OpenAI → single box flow.
