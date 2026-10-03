import {
  SHOPPING_INTENT_KINDS,
  type ShoppingIntentKind,
} from "@/domain/shopping-intent";

export const INTENT_TIMELINE_WINDOW_SECONDS = 30;

export type IntentPolarity = "negative" | "positive" | "neutral";

export type IntentDefinition = Readonly<{
  id: ShoppingIntentKind;
  label: string;
  polarity: IntentPolarity;
  color: string;
}>;

export type IntentPoint = Readonly<{
  second: number;
  value: number;
}>;

export type IntentSeries = IntentDefinition &
  Readonly<{
    points: readonly IntentPoint[];
  }>;

export type StackedIntentPoint = Readonly<{
  second: number;
  lower: number;
  upper: number;
}>;

export type StackedIntentSeries = IntentDefinition &
  Readonly<{
    points: readonly StackedIntentPoint[];
  }>;

export type IntentAnnotation = Readonly<{
  second: number;
  intentId: ShoppingIntentKind;
  comment: string;
}>;

export type IntentTimelineResponse = Readonly<{
  schemaVersion: "2.0";
  source: "jev" | "empty";
  windowSeconds: typeof INTENT_TIMELINE_WINDOW_SECONDS;
  currentSecond: number;
  windowStartSecond: number;
  windowEndSecond: number;
  generatedAt: string;
  series: readonly IntentSeries[];
  annotations: readonly IntentAnnotation[];
}>;

export const INTENT_DEFINITIONS: readonly IntentDefinition[] = [
  { id: "exploring", label: "Exploring", polarity: "neutral", color: "#0ea5e9" },
  { id: "researching", label: "Researching", polarity: "neutral", color: "#2563eb" },
  { id: "comparing", label: "Comparing", polarity: "neutral", color: "#7c3aed" },
  { id: "deciding", label: "Deciding", polarity: "positive", color: "#16a34a" },
  { id: "ready_to_buy", label: "Ready to buy", polarity: "positive", color: "#15803d" },
  { id: "price_sensitive", label: "Price sensitive", polarity: "neutral", color: "#d97706" },
  { id: "overloaded", label: "Overloaded", polarity: "negative", color: "#dc2626" },
  { id: "hesitant", label: "Hesitant", polarity: "negative", color: "#ea580c" },
] as const;

export function emptyIntentProbabilities(): Record<ShoppingIntentKind, number> {
  return Object.fromEntries(
    SHOPPING_INTENT_KINDS.map((kind) => [kind, 0]),
  ) as Record<ShoppingIntentKind, number>;
}

export function buildStackedIntentSeries(
  series: readonly IntentSeries[],
): readonly StackedIntentSeries[] {
  const totalsBySecond = new Map<number, number>();

  return series.map((intent) => ({
    ...intent,
    points: intent.points.map((point) => {
      const lower = totalsBySecond.get(point.second) ?? 0;
      const value = Math.max(0, Math.min(1, point.value));
      const upper = lower + value;
      totalsBySecond.set(point.second, upper);
      return { second: point.second, lower, upper };
    }),
  }));
}
