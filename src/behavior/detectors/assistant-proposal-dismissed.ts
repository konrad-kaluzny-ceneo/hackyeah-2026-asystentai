import { THRESHOLDS } from "../config/thresholds";
import type { AnalysisContext, MetaEvent, MetaEventDetector } from "../types";

import { buildMetaEvent, type MetaEventIdGenerator } from "./base";

const T = THRESHOLDS.detectors.assistant_proposal_dismissed;

/**
 * assistant_proposal_dismissed — explicit dismiss click on the assistant
 * proposal box. Negative feedback spike; stateless within the window.
 */
export class AssistantProposalDismissedDetector implements MetaEventDetector {
  readonly name = "assistant_proposal_dismissed" as const;

  constructor(private readonly generateEventId: MetaEventIdGenerator) {}

  analyze(ctx: AnalysisContext): readonly MetaEvent[] {
    const windowStart = ctx.window.endedAt - T.windowMs;
    const dismiss = ctx.events.find(
      (event) =>
        event.name === "element_click" &&
        event.elementId === "assistant-dismiss" &&
        event.timestamp >= windowStart &&
        event.timestamp <= ctx.window.endedAt,
    );
    if (dismiss === undefined) return [];

    return [
      buildMetaEvent({
        name: this.name,
        ctx,
        evidence: [dismiss],
        strength: 1,
        metrics: { pageType: ctx.pageType },
        detectedAtMs: dismiss.timestamp,
        eventId: this.generateEventId(),
      }),
    ];
  }
}
