export const SHOPPING_INTENT_KINDS = [
  "exploring",
  "researching",
  "comparing",
  "deciding",
  "ready_to_buy",
  "price_sensitive",
  "overloaded",
  "hesitant",
] as const;

export type ShoppingIntentKind = (typeof SHOPPING_INTENT_KINDS)[number];

export type IntentProbabilities = Readonly<
  Record<ShoppingIntentKind, number>
>;

export type IntentEventWindow = Readonly<{
  windowStartedAt: string;
  windowEndedAt: string;
  eventCount: number;
}>;

export function isShoppingIntentKind(
  value: string,
): value is ShoppingIntentKind {
  return (SHOPPING_INTENT_KINDS as readonly string[]).includes(value);
}
