import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
  RawEvent,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.dead_click_cluster;

const EFFECT_EVENTS: ReadonlySet<RawEvent["name"]> = new Set([
  "url_changed",
  "page_enter",
  "page_leave",
  "ui_state_changed",
  "request_failed", // a request was attempted, even if it failed
]);

/**
 * dead_click_cluster — ≥2 clicks on the same element followed by complete
 * silence: no navigation, no request, no DOM/state change, no focus change.
 * Indicates a dead control or a misleading affordance.
 */
export class DeadClickClusterDetector implements MetaEventDetector {
  readonly name = "dead_click_cluster" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const clicks = ctx.events.filter(
      (e) =>
        e.name === "element_click" &&
        e.elementId !== undefined &&
        e.timestamp >= windowStart &&
        e.timestamp <= ctx.window.endedAt - T.silenceMs,
    );
    if (clicks.length < T.minClicks) {
      return [];
    }
    const byElement = new Map<string, RawEvent[]>();
    for (const click of clicks) {
      const list = byElement.get(click.elementId as string) ?? [];
      list.push(click);
      byElement.set(click.elementId as string, list);
    }

    const results: MetaEvent[] = [];
    for (const [elementId, list] of byElement) {
      if (list.length < T.minClicks) continue;
      const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
      const last = sorted[sorted.length - 1];
      // Silence check: no EFFECT_EVENTS between the last click and last click + silenceMs.
      const silenceEnd = last.timestamp + T.silenceMs;
      const hadEffect = ctx.events.some(
        (e) =>
          EFFECT_EVENTS.has(e.name) &&
          e.timestamp >= last.timestamp &&
          e.timestamp <= silenceEnd,
      );
      if (hadEffect) continue;
      // Confirm no new clicks AFTER the silence window (otherwise user just kept clicking).
      const followUps = ctx.events.some(
        (e) =>
          e.name === "element_click" &&
          e.elementId === elementId &&
          e.timestamp > silenceEnd,
      );
      if (followUps) continue;
      results.push(
        buildMetaEvent({
          name: this.name,
          ctx,
          evidence: sorted,
          strength: Math.min(1, sorted.length / (T.minClicks + 2)),
          metrics: {
            clickCount: sorted.length,
            windowMs: T.windowMs,
            elementId,
          },
          eventId: this.generateEventId(),
          detectedAtMs: silenceEnd,
        }),
      );
    }
    return results;
  }
}
