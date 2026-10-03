import { z } from "zod";

export const DEFAULT_TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
export const DEFAULT_TYPESAFE_MODEL = "jev-latest";

const SituationSchema = z.enum([
  "DECISION_FATIGUE",
  "PRODUCT_HESITATION",
  "NO_PROGRESS_STALL",
  "UI_FRICTION",
  "SMOOTH_EXPLORATION",
]);

const ActionTypeSchema = z.enum([
  "NARROW_BY_SPEC",
  "COMPARE_MODELS",
  "RESET_FILTERS",
  "GO_TO_PRODUCT",
  "SORT_BY_PRICE",
  "EXPLAIN_CHOICE",
  "DO_NOTHING",
]);

function choiceAnswerSchema<T extends z.ZodType<string>>(choice: T) {
  return z.object({
    type: z.literal("choice"),
    choice,
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number().min(0).max(1)),
  });
}

const TypeSafeResponseSchema = z.object({
  answers: z.object({
    situation: choiceAnswerSchema(SituationSchema),
    action_type: choiceAnswerSchema(ActionTypeSchema),
  }),
});

export async function requestJev(
  prompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TYPESAFE_API_KEY environment variable");
  }

  const apiUrl =
    process.env.TYPESAFE_API_URL ||
    process.env.TYPESAFE_BASE_URL ||
    DEFAULT_TYPESAFE_URL;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      state: prompt,
      model: process.env.TYPESAFE_MODEL || DEFAULT_TYPESAFE_MODEL,
      questions: {
        situation: {
          type: "choice",
          instructions:
            "Która sytuacja najlepiej opisuje obecną sesję zakupową?",
          criteria: {
            DECISION_FATIGUE:
              "Kupujący porównuje wiele podobnych modeli i ma trudność z zawężeniem wyboru.",
            PRODUCT_HESITATION:
              "Kupujący wielokrotnie wraca do konkretnego produktu, ale nie podejmuje decyzji.",
            NO_PROGRESS_STALL:
              "Kupujący wykonuje działania, ale sesja nie prowadzi do wyraźnego postępu.",
            UI_FRICTION:
              "Zachowanie wskazuje przede wszystkim na trudność z obsługą interfejsu lub filtrów.",
            SMOOTH_EXPLORATION:
              "Kupujący spokojnie przegląda ofertę i nie potrzebuje interwencji.",
          },
        },
        action_type: {
          type: "choice",
          instructions:
            "Jaka pojedyncza reakcja asystenta najlepiej pasuje do tej sesji?",
          criteria: {
            NARROW_BY_SPEC:
              "Zaproponuj zawężenie wyników według jednego ważnego parametru.",
            COMPARE_MODELS:
              "Zaproponuj wyjaśnienie różnicy między porównywanymi modelami (brak widoku porównania).",
            RESET_FILTERS:
              "Zaproponuj usunięcie aktywnych filtrów, które blokują postęp.",
            GO_TO_PRODUCT:
              "Zaproponuj bezpośrednie przejście do karty produktu, przy powtarzanych odwiedzinach.",
            SORT_BY_PRICE:
              "Zaproponuj posortowanie listy po cenie przy skupieniu na budżecie.",
            EXPLAIN_CHOICE:
              "Pokaż tylko treść merytoryczną bez nawigacji, przy słabym sygnale.",
            DO_NOTHING:
              "Nie pokazuj propozycji, ponieważ sesja nie wymaga pomocy.",
          },
        },
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Typesafe API returned HTTP ${response.status}`);
  }

  const parsedResponse = TypeSafeResponseSchema.safeParse(await response.json());
  if (!parsedResponse.success) {
    throw new Error("Invalid response format from Jev API");
  }

  const { situation, action_type: actionType } = parsedResponse.data.answers;
  const confidence = Math.min(situation.confidence, actionType.confidence);
  const canUseShortcut =
    (situation.choice === "DECISION_FATIGUE" &&
      actionType.choice === "NARROW_BY_SPEC") ||
    (situation.choice === "UI_FRICTION" && actionType.choice === "RESET_FILTERS");

  const shortcutMessage =
    situation.choice === "DECISION_FATIGUE" && actionType.choice === "NARROW_BY_SPEC"
      ? "Porównujesz kilka podobnych modeli. Zawęź wyniki według jednego ważnego parametru, żeby łatwiej wybrać."
      : situation.choice === "UI_FRICTION" && actionType.choice === "RESET_FILTERS"
        ? "Wyczyść obecne filtry, aby odblokować listę produktów."
        : null;

  return {
    situation: situation.choice,
    intent_probabilities: situation.probabilities,
    signal_strength: situation.confidence,
    proposal: {
      action_type: actionType.choice,
      confidence,
      hedging_required: confidence < 0.75,
      message_draft: canUseShortcut ? shortcutMessage : null,
    },
  };
}
