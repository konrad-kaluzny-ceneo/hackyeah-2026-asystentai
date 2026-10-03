# Adding a new meta-event detector

Detectors are pure, isolated modules. Each gets the same `AnalysisContext`
and returns zero or more `MetaEvent` objects. They never touch the DOM,
network, or storage — only the raw events materialized for the analysis
window.

## Steps

1. **Add the name to the contract** — extend `META_EVENT_NAMES` and
   `META_EVENT_METRICS_ALLOWLIST` in [src/behavior/types.ts](../src/behavior/types.ts).
   The allowlist is enforced by the Zod schema; any metric key not on the
   list will be rejected at the server.

2. **Add thresholds** — add a section to `THRESHOLDS.detectors.<your_name>`
   in [src/behavior/config/thresholds.ts](../src/behavior/config/thresholds.ts). All
   thresholds are centralized there; do not introduce magic numbers into
   detector code.

3. **Add a cooldown entry** — add an entry to
   `THRESHOLDS.deduplicator.cooldowns` in the same file. The cooldown is
   enforced by [src/behavior/deduplicator/deduplicator.ts](../src/behavior/deduplicator/deduplicator.ts).

4. **Implement the detector** — create `src/behavior/detectors/<your-name>.ts`:

   ```ts
   import { THRESHOLDS } from "../config/thresholds";
   import type {
     AnalysisContext,
     MetaEvent,
     MetaEventDetector,
   } from "../types";

   import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

   const T = THRESHOLDS.detectors.<your_name>;

   export class YourNameDetector implements MetaEventDetector {
     readonly name = "<your_name>" as const;

     constructor(private readonly generateEventId: MetaEventIdGenerator) {}

     analyze(ctx: AnalysisContext): readonly MetaEvent[] {
       // ...filter raw events, check thresholds, return [] when below.
       return [
         buildMetaEvent({
           name: this.name,
           ctx,
           evidence: /* raw events that fired the detection */,
           strength: /* 0..1 */,
           metrics: { /* allowlisted keys only */ },
           eventId: this.generateEventId(),
           detectedAtMs: ctx.window.endedAt,
         }),
       ];
     }
   }
   ```

   Always use `buildMetaEvent` from [src/behavior/detectors/base.ts](../src/behavior/detectors/base.ts).
   Never construct the MetaEvent shape by hand — the builder fills in
   `schemaVersion`, `algorithmVersion`, `privacy`, and computes the window
   from evidence.

5. **Register the detector** — add it to `buildDetectorRegistry()` in
   [src/behavior/detectors/index.ts](../src/behavior/detectors/index.ts). Nothing else in the
   pipeline needs to change.

6. **Write tests** — add a test under `tests/behavior/detectors/<your-name>.test.ts`
   covering: threshold met (emit), threshold NOT met (no emit), edge cases.
   Use `makeAnalysisContext` and friends from [tests/behavior/fixtures.ts](../tests/behavior/fixtures.ts)
   so the time is deterministic and the assertion is structural.

## Hard rules

- Detectors observe **patterns in behavior**. They never infer emotion,
  intent, or demographics.
- Detectors never emit free-text metrics. `metrics: Record<string, string|number|boolean>` —
  but strings must be identifiers (catalog IDs, bucket labels, enum values),
  never user input.
- One meta event per detector per detection. The deduplicator + cooldown
  gate takes care of repetition; your detector should emit at most once per
  call to `analyze`.
- A failing detector must not poison others. Wrap risky logic in try/catch
  and return `[]` on uncertainty; the analyzer already isolates exceptions.
