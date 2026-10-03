import type { AssistantProposalRequest } from "@/lib/assistant-proposal-api";

export function buildAssistantPrompt(request: AssistantProposalRequest): string {
  const { state, events } = request;

  const category = state.categorySlug ?? "wszystkie";
  const query = state.query ? `"${state.query}"` : "brak";
  const filtersList = Object.entries(state.filters)
    .filter(([, val]) => Boolean(val))
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const activeFilters = filtersList.length > 0 ? filtersList : "brak";

  const viewedProducts: string[] = [];
  for (const ev of events) {
    if (ev.type === "product_view" && ev.productSlug) {
      if (!viewedProducts.includes(ev.productSlug)) {
        viewedProducts.push(ev.productSlug);
      }
    }
  }

  const eventsSummary = events
    .slice(-10)
    .map((e) => `[${e.type}] ${"productSlug" in e ? e.productSlug : ""}`)
    .join(" -> ");

  return `PRZEANALIZUJ SESJĘ ZAKUPOWĄ I ZWRÓĆ JEDNĄ PROPOZYCJĘ ASYSTENTA.

KONTEKST KATALOGU:
- Kategoria: ${category}
- Wyszukiwanie: ${query}
- Aktywne filtry: ${activeFilters}
- Liczba pasujących produktów: ${state.resultCount}
- Oglądane produkty w tej sesji: ${viewedProducts.length > 0 ? viewedProducts.join(", ") : "brak"}
- Ostatnie akcje użytkownika: ${eventsSummary || "brak"}

ZADANIE:
Oceń, czy kupujący doświadcza przeciążenia decyzyjnego (DECISION_FATIGUE) z powodu porównywania zbyt wielu podobnych modeli AGD bez decyzji, czy innej sytuacji.
Zwróć wynik WYŁĄCZNIE jako obiekt JSON o polach:
{
  "situation": "DECISION_FATIGUE" | "PRODUCT_HESITATION" | "NO_PROGRESS_STALL" | "UI_FRICTION" | "SMOOTH_EXPLORATION",
  "proposal": {
    "action_type": "NARROW_BY_SPEC" | "COMPARE_MODELS" | "RESET_FILTERS" | "DO_NOTHING",
    "confidence": 0.0 do 1.0,
    "hedging_required": true/false (true gdy confidence < 0.75),
    "message_draft": "krótka, empatyczna treść propozycji po polsku (lub null dla DO_NOTHING)",
    "reasoning": "krótkie uzasadnienie"
  }
}`;
}
