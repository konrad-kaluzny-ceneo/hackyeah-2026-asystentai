---
project: "Asystent AI — intencje na bieżąco"
updated: 2026-10-04
---

# Domena: intencja zakupowa

Dwa konteksty. Nie mieszać ich nazw.

## Obserwacja zachowania

Kod: `src/behavior/`, `src/server/meta-events/`, tabela `meta_events`.

To wzorce UI. Pełna lista nazw jest w `META_EVENT_NAMES` (`src/behavior/types.ts`): obok wczesnych detektorów tarcia są też `sustained_product_interest`, `category_interest`, `filter_engagement`, `hesitation_dwell`, `rapid_scroll_burst`, `navigation_loop`, `price_focus`, `description_focus`, `search_refinement_loop` i `assistant_proposal_dismissed`.

`MetaEvent.quality.strength` to pewność heurystyki detektora (0–1). To nie jest moc sygnału zakupowego z FR-002.

Te zdarzenia nie są typami intencji zakupowej: `comparison_oscillation` i `product_revisit` same w sobie nie oznaczają decision fatigue. S-05 kolejkuje request po pięciu unikalnych MetaEventach z poprawnie wysłanego batcha i wysyła okno ostatnich 10. Serwer pokazuje propozycję, gdy suma intencji innych niż spokojne przeglądanie przekracza 0.9. Zaakceptowany batch uruchamia też intent JEV, którego osiem probabilistyk trafia do snapshotu timeline. Lokalny `DecisionEngine` nadal klasyfikuje `CatalogEvent`, ale jego fatigue nie steruje requestem do S-04.

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
