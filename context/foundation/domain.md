---
project: "Asystent AI — intencje na bieżąco"
updated: 2026-10-03
---

# Domena: intencja zakupowa

Dwa konteksty. Nie mieszać ich nazw.

## Obserwacja zachowania

Kod: `src/behavior/`, `src/server/meta-events/`, tabela `meta_events`.

To wzorce UI: `rage_click`, `dead_click_cluster`, `rapid_filter_churn`, `no_progress_window`, `product_revisit`, `comparison_oscillation`.

`MetaEvent.quality.strength` to pewność heurystyki detektora (0–1). To nie jest moc sygnału zakupowego z FR-002.

Te zdarzenia nie są typami intencji zakupowej: `comparison_oscillation` i `product_revisit` same w sobie nie oznaczają decision fatigue. S-05 przekazuje Jev wyłącznie ograniczone podsumowanie zwalidowanych MetaEvents po osiągnięciu progu pięciu zdarzeń; serwer klasyfikuje sytuację i stosuje próg confidence. Lokalny `DecisionEngine` nadal klasyfikuje `CatalogEvent`, ale jego fatigue nie steruje requestem do S-04.

## Intencja zakupowa

Fakty sesji: `CatalogEvent` w sessionStorage (`src/lib/assistant-events.ts`). Klasyfikacja: `DecisionEngine` w `src/lib/decision-engine.ts`. Nazwy rodzajów: `src/domain/shopping-signal.ts`.

Silnik zwraca co najwyżej jedną propozycję. Pusty wynik ma pierwszeństwo przed decision fatigue.

| Kind | Stan w MVP |
|---|---|
| `decision_fatigue` | Działa. Trzy podobne produkty w kategorii, potem powrót na listę. |
| `search_friction` | Działa jako pusty wynik przy aktywnym searchu lub filtrach. |
| `brand` | Nazwane, nieklasyfikowane. |
| `uncertainty` | Nazwane, nieklasyfikowane. |
| `weak_budget` | Nazwane, nieklasyfikowane. |

`ShoppingSignal.strength` w typie to siła interpretacji. Silnik jej nie liczy: reguła albo pasuje, albo nie.

## Reguła na hackathon

Nie dokładamy detektorów UX jako zamiennika intencji. Nowe rodzaje sygnału dopisujemy do `SHOPPING_SIGNAL_KINDS` i do `IMPLEMENTED_SIGNAL_KINDS` dopiero wtedy, gdy `DecisionEngine` je naprawdę zwraca.
