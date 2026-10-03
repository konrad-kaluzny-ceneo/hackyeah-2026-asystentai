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

`comparison_oscillation` i `product_revisit` nie są decision fatigue. Decision fatigue wymaga produktów o podobnych parametrach (US-01). Samo chodzenie między kartami tego nie dowodzi.

## Intencja zakupowa

Kod języka: `src/domain/shopping-signal.ts`. Klasyfikacja sesji: jeszcze nie ma (slice S-01).

| Kind | Kiedy (PRD) |
|---|---|
| `brand` | Search konkretnej marki. Silny sygnał producenta. |
| `uncertainty` | Produkty o różnych parametrach. Użytkownik nie wie, czego potrzebuje. |
| `decision_fatigue` | Co najmniej trzy produkty o podobnych parametrach. Wie, czego potrzebuje, ma za dużo opcji. |
| `weak_budget` | Sama kategoria, bez węższych dowodów. Słaby sygnał budżetu. |
| `search_friction` | Zero wyników, wielokrotne zmiany filtrów, cofanie. |

`ShoppingSignal.strength` to siła tej interpretacji sesji, nie wynik detektora.

## Reguła na hackathon

Nie dokładamy kolejnych detektorów UX jako zamiennika S-01. F-02 ma emitować fakty katalogu (produkt, parametry, filtry, search, liczba wyników) do istniejącego kolektora. S-01 z tych faktów wybiera jeden `ShoppingSignalKind`.
