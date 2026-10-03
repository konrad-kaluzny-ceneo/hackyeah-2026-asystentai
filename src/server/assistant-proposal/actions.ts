import type { AssistantAction, AssistantActionData } from "@/lib/catalog-types";
import type { JevProposal } from "./schema";
import { getProductBySlug } from "@/lib/catalog-repository";

/**
 * Registry of assistant action skills.
 *
 * Each entry maps a Jev action_type to the concrete UI action the app can
 * execute. Descriptions double as prompt copy and as docs. The single source
 * of truth for which tools the model may use; the UI never decides a tool —
 * it renders whatever the contract carries.
 *
 * COMPARE_MODELS is intentionally absent: the PRD forbids a comparison view
 * (Non-Goal). If Jev asks for it, mapJevActionToProposalAction downgrades it
 * to EXPLAIN_CHOICE (copy-only) before the response is built.
 */
export type AssistantSkillDefinition = {
  /** UI action value carried on the API response and rendered by the widget. */
  action: AssistantAction;
  /** Polish button label. Empty for "none" (no button). */
  label: string;
  /** Which action_payload keys must be present for the action to be usable. */
  requiredPayload: readonly (keyof AssistantActionData)[];
  /** Long description used in the Jev prompt. */
  description: string;
};

export const ASSISTANT_SKILLS = {
  NARROW_BY_SPEC: {
    action: "narrow-choice",
    label: "Przejdź do filtrów",
    requiredPayload: ["filterKeys"],
    description:
      "Zaproponuj zawężenie wyników według jednego ważnego parametru. W action_payload.filterKeys podaj klucze filtrów do podświetlenia.",
  },
  COMPARE_MODELS: {
    action: "explain-choice",
    label: "Zobacz podpowiedź",
    requiredPayload: [],
    description:
      "Użytkownik oscyluje między modelami. Nie mamy widoku porównania; wybierz EXPLAIN_CHOICE z krótkim wyjaśnieniem i jednym parametrem do rozstrzygnięcia.",
  },
  RESET_FILTERS: {
    action: "clear-search-and-filters",
    label: "Wyczyść wyszukiwanie i filtry",
    requiredPayload: [],
    description:
      "Zaproponuj usunięcie aktywnych filtrów lub frazy wyszukiwania, gdy blokują postęp (0 wyników, UI_FRICTION, NO_PROGRESS_STALL).",
  },
  GO_TO_PRODUCT: {
    action: "go-to-product",
    label: "Otwórz produkt",
    requiredPayload: ["productSlug"],
    description:
      "Zaproponuj bezpośrednie przejście do jednej karty produktu (PRODUCT_HESITATION). W action_payload.productSlug podaj slug istniejącego produktu.",
  },
  SORT_BY_PRICE: {
    action: "sort-by-price",
    label: "Posortuj po cenie",
    requiredPayload: ["sort"],
    description:
      "Zaproponuj posortowanie listy po cenie (rosnąco lub malejąco) przy skupieniu na cenie lub braku postępu. W action_payload.sort: price_asc lub price_desc.",
  },
  EXPLAIN_CHOICE: {
    action: "explain-choice",
    label: "Pokaż wskazówkę",
    requiredPayload: [],
    description:
      "Pokaż samą treść merytoryczną (bez nawigacji). Dla niepewnych sygnałów lub gdy brak lepszej akcji. Pole message niesie całą wartość.",
  },
  DO_NOTHING: {
    action: "none",
    label: "",
    requiredPayload: [],
    description:
      "Nie pokazuj propozycji — sesja jest płynna lub sygnał zbyt słaby. Odpowiedź zostanie zdegradowana do hide.",
  },
} as const satisfies Record<string, AssistantSkillDefinition>;

export type JevActionType = keyof typeof ASSISTANT_SKILLS;

export function getSkillDefinition(actionType: string | undefined) {
  if (!actionType || !(actionType in ASSISTANT_SKILLS)) return undefined;
  return ASSISTANT_SKILLS[actionType as JevActionType];
}

/** Maps a validated Jev proposal to the UI action + data the contract carries. */
export async function mapJevActionToProposalAction(
  proposal: JevProposal,
): Promise<{ action: AssistantAction; data: AssistantActionData } | null> {
  const skill = getSkillDefinition(proposal.action_type);
  if (!skill) return null;

  if (skill.action === "none") return null;

  const payload = proposal.action_payload ?? {};
  const data: AssistantActionData = {
    target: "catalog",
    filterKeys: [],
  };

  switch (skill.action) {
    case "narrow-choice": {
      data.target = "filters";
      data.filterKeys = payload.filterKeys ?? [];
      break;
    }
    case "clear-search-and-filters": {
      data.target = "catalog";
      break;
    }
    case "go-to-product": {
      const slug = payload.productSlug;
      if (!slug) return null; // required payload missing
      const product = await getProductBySlug(slug);
      if (!product) return null; // slug invalidated server-side
      data.target = "product";
      data.productSlug = slug;
      break;
    }
    case "sort-by-price": {
      const sort = payload.sort;
      if (sort !== "price_asc" && sort !== "price_desc") return null;
      data.target = "catalog";
      data.sort = sort;
      break;
    }
    case "explain-choice": {
      data.target = "catalog";
      break;
    }
  }

  return { action: skill.action, data };
}
