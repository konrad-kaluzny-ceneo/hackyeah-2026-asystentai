import { z } from "zod";

import {
  META_EVENT_METRICS_ALLOWLIST,
  META_EVENT_NAMES,
  META_EVENT_SCHEMA_VERSION,
  PAGE_TYPES,
  SUBJECT_TYPES,
  type MetaEventName,
} from "@/behavior/types";

const IsoDateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expected ISO-8601 date string",
  });

const PageTypeSchema = z.enum(PAGE_TYPES);
const MetaEventNameSchema = z.enum(META_EVENT_NAMES);
const SubjectTypeSchema = z.enum(SUBJECT_TYPES);

const ActiveFilterSchema = z
  .object({
    // Filter IDs must never carry user-entered text — they are catalog IDs.
    id: z.string().min(1).max(128),
    valueIds: z.array(z.string().min(1).max(128)).max(64).readonly().optional(),
  })
  .strict();

const EcommerceSchema = z
  .object({
    activeFilters: z.array(ActiveFilterSchema).max(64).readonly(),
    activeFiltersCount: z.number().int().min(0).max(1024),
    sortingType: z.string().max(64).optional(),
    resultsCountBucket: z.string().max(32).optional(),
    priceBucket: z.string().max(32).optional(),
    deliveryCostBucket: z.string().max(32).optional(),
    availability: z.string().max(64).optional(),
    priceVisible: z.boolean().optional(),
    deliveryVisible: z.boolean().optional(),
    availabilityVisible: z.boolean().optional(),
  })
  .strict();

const SubjectSchema = z
  .object({
    type: SubjectTypeSchema,
    id: z.string().max(128).optional(),
    categoryId: z.string().max(128).optional(),
    brandId: z.string().max(128).optional(),
  })
  .strict();

const WindowSchema = z
  .object({
    startedAt: IsoDateString,
    endedAt: IsoDateString,
    durationMs: z.number().int().min(0).max(60 * 60 * 1000),
  })
  .strict();

const IdentitySchema = z
  .object({
    sessionId: z.string().min(8).max(64),
    pageViewId: z.string().min(8).max(64),
    journeyId: z.string().min(8).max(64).optional(),
  })
  .strict();

const PageSchema = z
  .object({
    type: PageTypeSchema,
    // Sanitized pathname; max length defensive.
    pathname: z.string().max(256).optional(),
    routeTemplate: z.string().max(256).optional(),
    previousPageType: PageTypeSchema.optional(),
  })
  .strict();

const MetricValueSchema = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
]);

const MetricsSchema = z.record(z.string().max(64), MetricValueSchema);

const QualitySchema = z
  .object({
    strength: z.number().min(0).max(1),
    evidenceCount: z.number().int().min(0).max(100_000),
    algorithmVersion: z.string().min(1).max(32),
    partialData: z.boolean(),
  })
  .strict();

const PrivacySchema = z
  .object({
    consentVersion: z.string().max(32).optional(),
    containsFreeText: z.literal(false),
    rawDataUploaded: z.literal(false),
  })
  .strict();

/** Strict shared MetaEvent contract for browser and server consumers. */
export const MetaEventSchema = z
  .object({
    schemaVersion: z.literal(META_EVENT_SCHEMA_VERSION),
    eventId: z.string().min(8).max(64),
    name: MetaEventNameSchema,
    detectedAt: IsoDateString,
    window: WindowSchema,
    identity: IdentitySchema,
    page: PageSchema,
    subject: SubjectSchema.optional(),
    ecommerce: EcommerceSchema,
    metrics: MetricsSchema,
    quality: QualitySchema,
    privacy: PrivacySchema,
  })
  .strict()
  .superRefine((event, ctx) => {
    const allowlist = META_EVENT_METRICS_ALLOWLIST[event.name as MetaEventName];
    if (allowlist === undefined) return;

    const allowed = new Set<string>(allowlist);
    for (const key of Object.keys(event.metrics)) {
      if (!allowed.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["metrics", key],
          message: `metric "${key}" is not allowlisted for "${event.name}"`,
        });
      }
    }
  });

export type ValidatedMetaEvent = z.infer<typeof MetaEventSchema>;
