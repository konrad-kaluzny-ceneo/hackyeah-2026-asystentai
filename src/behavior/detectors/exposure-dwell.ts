import type { AnalysisContext, RawEvent } from "../types";

export type ProductExposureSummary = Readonly<{
  productId: string;
  categoryId?: string;
  brandId?: string;
  dwellMs: number;
  exposureCount: number;
  startedAtMs: number;
  evidence: readonly RawEvent[];
}>;

type OpenExposure = {
  readonly key: string;
  readonly started: RawEvent;
};

type MutableSummary = {
  productId: string;
  categoryId?: string;
  brandId?: string;
  dwellMs: number;
  exposureCount: number;
  startedAtMs: number;
  evidence: RawEvent[];
};

export function collectProductExposureDwell(
  ctx: AnalysisContext,
  windowMs: number,
): readonly ProductExposureSummary[] {
  const windowStart = ctx.window.endedAt - windowMs;
  const events = [...ctx.events]
    .filter(
      (event) =>
        event.timestamp >= windowStart && event.timestamp <= ctx.window.endedAt,
    )
    .sort((left, right) => left.timestamp - right.timestamp);
  const open = new Map<string, OpenExposure>();
  const summaries = new Map<string, MutableSummary>();

  for (const event of events) {
    const productId = event.subject?.productId;
    if (productId === undefined) continue;
    const key = `${productId}:${event.elementId ?? "product"}`;
    if (event.name === "element_exposure_started") {
      open.set(key, { key, started: event });
      continue;
    }
    if (event.name !== "element_exposure_ended") continue;
    const current = open.get(key);
    if (current === undefined) continue;
    addExposure(summaries, current.started, event);
    open.delete(key);
  }

  for (const current of open.values()) {
    addExposure(summaries, current.started, {
      ...current.started,
      timestamp: ctx.window.endedAt,
      id: `${current.started.id}:open`,
      name: "element_exposure_ended",
    });
  }

  return [...summaries.values()];
}

function addExposure(
  summaries: Map<string, MutableSummary>,
  started: RawEvent,
  ended: RawEvent,
): void {
  const productId = started.subject?.productId;
  if (productId === undefined) return;
  const current = summaries.get(productId) ?? {
    productId,
    categoryId: started.subject?.categoryId,
    brandId: started.subject?.brandId,
    dwellMs: 0,
    exposureCount: 0,
    startedAtMs: started.timestamp,
    evidence: [],
  };
  current.dwellMs += Math.max(0, ended.timestamp - started.timestamp);
  current.exposureCount += 1;
  current.startedAtMs = Math.min(current.startedAtMs, started.timestamp);
  current.categoryId ??= started.subject?.categoryId;
  current.brandId ??= started.subject?.brandId;
  current.evidence.push(started, ended);
  summaries.set(productId, current);
}
