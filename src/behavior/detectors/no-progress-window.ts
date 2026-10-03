import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
  RawEvent,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.no_progress_window;
const PROGRESS_EVENTS: ReadonlySet<RawEvent["name"]> = new Set(T.progressEvents);
const ACTIVITY_EVENTS: ReadonlySet<RawEvent["name"]> = new Set([
  "element_click",
  "scroll_summary",
  "filter_added",
  "filter_removed",
  "url_changed",
  "page_enter",
]);

/**
 * no_progress_window — user is active (clicks, scrolls, filter changes,
 * page transitions) for a configurable period WITHOUT producing a
 * journey-appropriate progress event.
 */
export class NoProgressWindowDetector implements MetaEventDetector {
  readonly name = "no_progress_window" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const inWindow = ctx.events.filter(
      (e) => e.timestamp >= windowStart && e.timestamp <= ctx.window.endedAt,
    );
    if (inWindow.length === 0) {
      return [];
    }
    const hasProgress = inWindow.some((e) => PROGRESS_EVENTS.has(e.name));
    if (hasProgress) {
      return [];
    }
    let clickCount = 0;
    let scrollCount = 0;
    let filterChanges = 0;
    let activeEvents = 0;
    let firstActivityTs: number | undefined;
    let lastActivityTs: number | undefined;
    for (const e of inWindow) {
      if (!ACTIVITY_EVENTS.has(e.name)) continue;
      activeEvents += 1;
      if (e.name === "element_click") clickCount += 1;
      if (e.name === "scroll_summary") scrollCount += 1;
      if (e.name === "filter_added" || e.name === "filter_removed") {
        filterChanges += 1;
      }
      if (firstActivityTs === undefined || e.timestamp < firstActivityTs) {
        firstActivityTs = e.timestamp;
      }
      if (lastActivityTs === undefined || e.timestamp > lastActivityTs) {
        lastActivityTs = e.timestamp;
      }
    }
    if (activeEvents === 0 || firstActivityTs === undefined || lastActivityTs === undefined) {
      return [];
    }
    const activeMs = lastActivityTs - firstActivityTs;
    // Require activity spanning the dominant portion of the window, not a
    // single spike at the start.
    if (activeMs < T.windowMs * 0.5) {
      return [];
    }
    const strength = Math.min(1, activeMs / T.windowMs);
    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: inWindow,
        strength,
        metrics: {
          activeMs,
          clickCount,
          scrollCount,
          filterChanges,
        },
        eventId: this.generateEventId(),
        detectedAtMs: ctx.window.endedAt,
      }),
    ];
  }
}
