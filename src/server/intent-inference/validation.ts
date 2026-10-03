import { z } from "zod";

import { SHOPPING_INTENT_KINDS } from "@/domain/shopping-intent";

const IsoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expected ISO-8601 date string",
  });

const IntentProbabilitiesSchema = z
  .object(
    Object.fromEntries(
      SHOPPING_INTENT_KINDS.map((kind) => [kind, z.number().finite().min(0).max(1)]),
    ) as Record<(typeof SHOPPING_INTENT_KINDS)[number], z.ZodNumber>,
  )
  .strict();

const EventWindowSchema = z
  .object({
    windowStartedAt: IsoDateString,
    windowEndedAt: IsoDateString,
    eventCount: z.number().int().min(0).max(1000),
  })
  .strict()
  .superRefine((window, ctx) => {
    if (Date.parse(window.windowStartedAt) > Date.parse(window.windowEndedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["windowStartedAt"],
        message: "windowStartedAt must not be after windowEndedAt",
      });
    }
  });

export const IntentSnapshotInputSchema = z.object({
  snapshotId: z.string().min(8).max(128),
  sessionId: z.string().min(8).max(64),
  computedAt: IsoDateString,
  model: z.string().min(1).max(64),
  intents: IntentProbabilitiesSchema,
  inputEventWindow: EventWindowSchema,
  algorithmVersion: z.string().min(1).max(32),
}).strict();

export type ValidatedIntentSnapshot = z.infer<typeof IntentSnapshotInputSchema>;
