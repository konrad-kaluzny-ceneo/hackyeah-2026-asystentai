import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
  RawEvent,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.rage_click;

/**
 * rage_click — ≥3 clicks on the same semantic element within 2.5 s, with NO
 * observed UI change (ui_state_changed / navigation / page transition) after
 * the first click.
 *
 * Reports observable behavior only; never infers emotion.
 */
export class RageClickDetector implements MetaEventDetector {
  readonly name = "rage_click" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const candidates = ctx.events.filter(
      (e) =>
        e.name === "element_click" &&
        e.elementId !== undefined &&
        e.timestamp >= windowStart &&
        e.timestamp <= ctx.window.endedAt,
    );
    if (candidates.length < T.minClicks) {
      return [];
    }

    // Group by elementId.
    const byElement = new Map<string, RawEvent[]>();
    for (const click of candidates) {
      const list = byElement.get(click.elementId as string) ?? [];
      list.push(click);
      byElement.set(click.elementId as string, list);
    }

    const results: MetaEvent[] = [];
    for (const [elementId, clicks] of byElement) {
      if (clicks.length < T.minClicks) {
        continue;
      }
      // Sliding window: any sub-window of size windowMs containing ≥ minClicks.
      const sorted = [...clicks].sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i + T.minClicks <= sorted.length; i += 1) {
        const first = sorted[i];
        const last = sorted[i + T.minClicks - 1];
        if (last.timestamp - first.timestamp > T.windowMs) {
          continue;
        }
        // Check there was NO UI state change after the first click.
        const graceEnds = first.timestamp + T.uiChangeGraceMs;
        const uiChanged = ctx.events.some(
          (e) =>
            e.timestamp > first.timestamp &&
            e.timestamp <= Math.min(last.timestamp + 1, graceEnds + T.windowMs) &&
            (e.name === "ui_state_changed" ||
              e.name === "url_changed" ||
              e.name === "page_leave" ||
              e.name === "page_enter"),
        );
        if (uiChanged) {
          continue;
        }
        const evidence = sorted.slice(i, i + T.minClicks);
        results.push(
          buildMetaEvent({
            name: this.name,
            ctx,
            evidence,
            strength: Math.min(1, clicks.length / (T.minClicks + 2)),
            metrics: {
              clickCount: clicks.length,
              windowMs: T.windowMs,
              elementId,
            },
            eventId: this.generateEventId(),
            detectedAtMs: last.timestamp,
          }),
        );
        // One detection per elementId per analysis window.
        break;
      }
    }
    return results;
  }
}
