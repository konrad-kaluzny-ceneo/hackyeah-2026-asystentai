import { z } from "zod";

import { META_EVENT_SCHEMA_VERSION } from "@/behavior/types";
import { MetaEventSchema } from "@/behavior/meta-event-schema";

// Keep existing server imports stable while the schema itself is client-safe.
export { MetaEventSchema } from "@/behavior/meta-event-schema";
export type { ValidatedMetaEvent } from "@/behavior/meta-event-schema";

/** Server-side constraints applied to incoming batches. */
export const BATCH_LIMITS = {
  maxBatchEvents: 50,
  /** Defensive byte ceiling checked before JSON parse on the server. */
  maxBatchBytes: 128 * 1024,
} as const;

export const BatchPayloadSchema = z
  .object({
    schemaVersion: z.literal(META_EVENT_SCHEMA_VERSION),
    batchId: z.string().min(8).max(64),
    sentAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "expected ISO-8601 date string",
    }),
    events: z.array(MetaEventSchema).max(BATCH_LIMITS.maxBatchEvents).readonly(),
  })
  .strict();

export type ValidatedBatchPayload = z.infer<typeof BatchPayloadSchema>;
