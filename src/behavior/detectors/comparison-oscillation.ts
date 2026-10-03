import { THRESHOLDS } from "../config/thresholds";
import type {
  AnalysisContext,
  MetaEvent,
  MetaEventDetector,
} from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.comparison_oscillation;

/**
 * comparison_oscillation — the user shuttles back and forth between 2–4
 * product views, with many transitions between them, and the candidate set
 * does not shrink (no product is dropped from the shuttled loop in the
 * second half of the window).
 */
export class ComparisonOscillationDetector implements MetaEventDetector {
  readonly name = "comparison_oscillation" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const views = ctx.events.filter(
      (e) =>
        e.name === "product_viewed" &&
        e.subject?.productId !== undefined &&
        e.timestamp >= windowStart &&
        e.timestamp <= ctx.window.endedAt,
    );
    if (views.length < T.minTransitions) {
      return [];
    }
    // Ordered product sequence (dedupe consecutive repeats — a re-render is
    // not a transition).
    const sequence: string[] = [];
    for (const v of views) {
      const pid = v.subject?.productId as string;
      if (sequence.length === 0 || sequence[sequence.length - 1] !== pid) {
        sequence.push(pid);
      }
    }
    if (sequence.length < T.minTransitions + 1) {
      return [];
    }
    const candidates = new Set(sequence);
    if (
      candidates.size < T.minCandidates ||
      candidates.size > T.maxCandidates
    ) {
      return [];
    }
    const transitions = sequence.length - 1;
    if (transitions < T.minTransitions) {
      return [];
    }
    // Set narrowing check: compare first-half candidates vs second-half.
    const midpoint = Math.floor(sequence.length / 2);
    const firstHalf = new Set(sequence.slice(0, midpoint));
    const secondHalf = new Set(sequence.slice(midpoint));
    const narrowed = secondHalf.size < firstHalf.size;
    if (narrowed) {
      return [];
    }
    const strength = Math.min(
      1,
      transitions / (T.minTransitions * 2) +
        (candidates.size - 1) / (T.maxCandidates * 2),
    );
    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: views,
        strength,
        metrics: {
          candidateCount: candidates.size,
          transitionCount: transitions,
        },
        eventId: this.generateEventId(),
        detectedAtMs: ctx.window.endedAt,
      }),
    ];
  }
}
