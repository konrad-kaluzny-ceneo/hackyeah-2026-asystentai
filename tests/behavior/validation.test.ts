import { describe, expect, it } from "vitest";

import { META_EVENT_NAMES, PAGE_TYPES } from "@/behavior/types";
import {
  BATCH_LIMITS,
  BatchPayloadSchema,
  MetaEventSchema,
} from "@/server/meta-events/validation";

import { makeMetaEvent, resetFixtureSeed } from "./fixtures";

describe("MetaEventSchema", () => {
  it("accepts a well-formed meta event", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click", {
      metrics: { clickCount: 3, windowMs: 2500, elementId: "btn:x" },
    });
    const result = MetaEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects an event with a metrics key outside the allowlist", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click", {
      metrics: { clickCount: 3, userAgent: "should not be here" },
    });
    const result = MetaEventSchema.safeParse(event);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["metrics", "userAgent"]);
    }
  });

  it("rejects unknown event names", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click");
    // Force an unknown name past TS via unknown cast — runtime check is what matters.
    const bad = { ...event, name: "not_a_real_meta_event" } as unknown;
    expect(MetaEventSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects extra fields (strict mode)", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click");
    const bad = { ...event, extraField: "nope" } as unknown;
    expect(MetaEventSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects privacy flags flipped to true (raw upload marker)", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click");
    const bad = {
      ...event,
      privacy: { ...event.privacy, rawDataUploaded: true },
    } as unknown;
    expect(MetaEventSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects events with PII-shaped long free-text fields", () => {
    resetFixtureSeed();
    const event = makeMetaEvent("rage_click");
    const bad = {
      ...event,
      page: { ...event.page, pathname: "x".repeat(2000) },
    };
    expect(MetaEventSchema.safeParse(bad).success).toBe(false);
  });
});

describe("BatchPayloadSchema", () => {
  it("accepts a valid batch", () => {
    resetFixtureSeed();
    const batch = {
      schemaVersion: "1.0",
      batchId: "batch-000001",
      sentAt: new Date(0).toISOString(),
      events: [makeMetaEvent("rage_click"), makeMetaEvent("dead_click_cluster")],
    };
    expect(BatchPayloadSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects batches that exceed the events ceiling", () => {
    resetFixtureSeed();
    const tooMany = Array.from({ length: BATCH_LIMITS.maxBatchEvents + 1 }, (_, i) =>
      makeMetaEvent("rage_click", { eventId: `evt-${i}-abcdef` }),
    );
    const batch = {
      schemaVersion: "1.0",
      batchId: "batch-000001",
      sentAt: new Date(0).toISOString(),
      events: tooMany,
    };
    expect(BatchPayloadSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects batches with an unknown schema version", () => {
    resetFixtureSeed();
    const batch = {
      schemaVersion: "0.9",
      batchId: "batch-000001",
      sentAt: new Date(0).toISOString(),
      events: [],
    };
    expect(BatchPayloadSchema.safeParse(batch).success).toBe(false);
  });
});

describe("Contract integrity", () => {
  it("exports the full expected list of meta event names", () => {
    expect(META_EVENT_NAMES).toContain("rage_click");
    expect(META_EVENT_NAMES).toContain("comparison_oscillation");
    expect(META_EVENT_NAMES).toHaveLength(12);
  });

  it("exports page types that cover the demo's actual routes", () => {
    expect(PAGE_TYPES).toContain("home");
    expect(PAGE_TYPES).toContain("catalog");
    expect(PAGE_TYPES).toContain("unknown");
  });
});
