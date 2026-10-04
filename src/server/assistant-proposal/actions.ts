import type { AssistantAction, AssistantActionData } from "@/lib/catalog-types";
import type { JevProposal } from "./schema";
import { getProductBySlug } from "@/lib/catalog-repository";

const CATEGORY_FILTERS: Record<string, readonly string[]> = {
  lodowki: ["capacityLiters", "heightCm"],
  pralki: ["loadKg", "spinRpm"],
  zmywarki: ["widthCm", "placeSettings"],
};

type ActionMetaEvent = { subject?: { categoryId?: string } | null };

function categorySlugFromEvents(
  events: readonly ActionMetaEvent[],
): string | undefined {
  const counts = new Map<string, number>();
  for (const event of events) {
    const categorySlug = event.subject?.categoryId;
    if (!categorySlug || !(categorySlug in CATEGORY_FILTERS)) continue;
    counts.set(categorySlug, (counts.get(categorySlug) ?? 0) + 1);
  }

  return [...counts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0];
}

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
  SET_BUDGET: {
    action: "set-budget",
    label: "Ustaw budżet",
    requiredPayload: [],
    description:
      "Otwórz filtr ceny w kategorii, aby kupujący sam określił budżet. Przy zainteresowaniu ceną; działa także z karty produktu. Nie wymaga payloadu.",
  },
  CHOOSE_BRAND: {
    action: "choose-brand",
    label: "Wybierz producenta",
    requiredPayload: [],
    description:
      "Otwórz wybór producenta w kategorii, gdy użytkownik szuka preferowanej marki. Działa także z karty produktu; nie wybieraj marki za użytkownika. Nie wymaga payloadu.",
  },
  BROWSE_CATEGORY: {
    action: "browse-category",
    label: "Zobacz kategorię",
    requiredPayload: [],
    description:
      "Przejdź do pełnej listy modeli w kategorii po utknięciu na produkcie lub przy potrzebie szerszego wyboru. Nie wymaga payloadu.",
  },
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
  metaEvents: readonly ActionMetaEvent[] = [],
): Promise<{
  action: AssistantAction;
  actionLabel: string;
  data: AssistantActionData;
} | null> {
  const skill = getSkillDefinition(proposal.action_type);
  if (!skill) return null;

  if (skill.action === "none") return null;

  const payload = proposal.action_payload ?? {};
  const data: AssistantActionData = {
    target: "catalog",
    filterKeys: [],
  };
  const categorySlug = categorySlugFromEvents(metaEvents);
  if (categorySlug) data.categorySlug = categorySlug;

  switch (skill.action) {
    case "set-budget":
    case "choose-brand": {
      if (!categorySlug) return null;
      data.target = "filters";
      data.filterKeys = [skill.action === "set-budget" ? "price" : "brand"];
      break;
    }
    case "browse-category": {
      if (!categorySlug) return null;
      data.target = "catalog";
      break;
    }
    case "narrow-choice": {
      data.target = "filters";
      const requestedKeys = payload.filterKeys ?? [];
      const validKeys = new Set([
        "price",
        "brand",
        ...(categorySlug ? CATEGORY_FILTERS[categorySlug] : []),
      ]);
      data.filterKeys = requestedKeys.filter((key) => validKeys.has(key));
      if (data.filterKeys.length === 0 && categorySlug) {
        data.filterKeys = [CATEGORY_FILTERS[categorySlug][0]!];
      }
      if (data.filterKeys.length === 0) return null;
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
      if (!categorySlug) return null;
      data.target = "catalog";
      data.sort = sort;
      break;
    }
    case "explain-choice": {
      data.target = "catalog";
      break;
    }
  }

  return { action: skill.action, actionLabel: skill.label, data };
}
