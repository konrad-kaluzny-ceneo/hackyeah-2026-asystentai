import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector, RawEvent } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.navigation_loop;

type LoopMatch = Readonly<{
  cycleLength: number;
  repeatCount: number;
  pattern: readonly string[];
  evidence: readonly RawEvent[];
}>;

export class NavigationLoopDetector implements MetaEventDetector {
  readonly name = "navigation_loop" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const entries = ctx.events.filter(
      (event) =>
        event.name === "page_enter" &&
        event.timestamp >= windowStart &&
        event.timestamp <= ctx.window.endedAt,
    );
    const match = findLoop(entries);
    if (match === undefined) return [];

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: match.evidence,
        strength: Math.min(
          1,
          match.repeatCount / (T.minRepeatCount * 2) +
            match.cycleLength / (T.maxCycleLength * 2),
        ),
        metrics: {
          cycleLength: match.cycleLength,
          repeatCount: match.repeatCount,
          pageTypes: match.pattern.join(">"),
        },
        detectedAtMs: match.evidence[match.evidence.length - 1].timestamp,
        eventId: this.generateEventId(),
      }),
    ];
  }
}

function findLoop(entries: readonly RawEvent[]): LoopMatch | undefined {
  const sequence = entries.map((event) => event.pageType);
  for (
    let cycleLength = T.minCycleLength;
    cycleLength <= T.maxCycleLength;
    cycleLength += 1
  ) {
    if (sequence.length < cycleLength * T.minRepeatCount) continue;
    const pattern = sequence.slice(sequence.length - cycleLength);
    let repeatCount = 1;
    while (repeatCount < Math.floor(sequence.length / cycleLength)) {
      const start = sequence.length - (repeatCount + 1) * cycleLength;
      if (start < 0) break;
      const candidate = sequence.slice(start, start + cycleLength);
      if (!candidate.every((value, index) => value === pattern[index])) break;
      repeatCount += 1;
    }
    if (repeatCount < T.minRepeatCount) continue;
    const evidence = entries.slice(
      entries.length - repeatCount * cycleLength,
    );
    return { cycleLength, repeatCount, pattern, evidence };
  }
  return undefined;
}
