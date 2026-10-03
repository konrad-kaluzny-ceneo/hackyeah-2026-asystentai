/**
 * Shopping-intent domain (PRD FR-002, FR-005, US-01).
 *
 * `src/behavior` is a different context. Its meta events are UI observations
 * (rage click, filter churn, product revisit). They can later be evidence.
 * They are not these kinds, and `MetaEvent.quality.strength` is detector
 * confidence, not `ShoppingSignal.strength`.
 *
 * Classification itself is slice S-01. This module only keeps the language
 * so a rage click cannot be treated as decision fatigue.
 */

export const SHOPPING_SIGNAL_KINDS = [
  "brand",
  "uncertainty",
  "decision_fatigue",
  "weak_budget",
  "search_friction",
] as const;

export type ShoppingSignalKind = (typeof SHOPPING_SIGNAL_KINDS)[number];

/**
 * How strongly the session supports this reading, from 0 to 1.
 * Not a purchase probability and not a detector score.
 */
export type SignalStrength = number;

export type ShoppingSignal = Readonly<{
  kind: ShoppingSignalKind;
  strength: SignalStrength;
  sessionId: string;
}>;

export function isShoppingSignalKind(
  value: string,
): value is ShoppingSignalKind {
  return (SHOPPING_SIGNAL_KINDS as readonly string[]).includes(value);
}
