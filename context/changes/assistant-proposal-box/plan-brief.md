# Box propozycji asystenta — Plan Brief

> Pełny plan: `context/changes/assistant-proposal-box/plan.md`  
> Kontrakt API: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Kupujący na listingu widzi co najwyżej jeden box asystenta. Przy decision fatigue treść pochodzi z `POST /api/assistant-proposal` (S-04). Przy pustym wyniku — nadal lokalna propozycja S-03. Michał dowodzi warstwy prezentacji i cyklu życia boxa bez dotykania Jev/OpenAI.

## Starting Point

`AssistantInline` woła `DecisionEngine` i od razu rysuje stałe zdania (w tym decision fatigue). Wyciszenie 15 min działa. Box siedzi w `CatalogListing`.

## Desired End State

- Decision fatigue: brak stałego tekstu z silnika; `fetch` do API; box pojawia się tylko przy `show`, bez loadera.
- `search_friction`: bez zmiany źródła treści (silnik).
- Anulowanie starszych żądań; wyciszenie blokuje fetch.
- Wygląd i a11y boxa można dopracować w tym samym change, o ile zostaje jedna akcja i brak drugiego promptu.

## Key Decisions

| Decision | Choice |
| --- | --- |
| Kontrakt danych | `interface.md` (przykłady + tabela ownerów) + `src/lib/assistant-proposal-api.ts` od S-04 |
| Wygląd boxa | `plan.md` → sekcja Visual spec; bez loadera |
| Loader | Brak (zgodnie z PRD/planem produktowym) |
| Owner | Michał — UI |
| Zależność | S-04 gotowe (route zwraca zgodny JSON) |

## Scope

**In:** `assistant-inline.tsx` (i ewentualny mały hook/kient), testy wyścigu i gałęzi `search_friction` vs fetch, manual demo decision fatigue.

**Out:** route, Jev, OpenAI, zmiana reguł `DecisionEngine`, meta eventy behavior, drugi box, porównanie modeli.

## Phases at a Glance

| Phase | Deliverable |
| --- | --- |
| 1 | Podpięcie API + lifecycle (`requestId`, abort, mute) |
| 2 | (Opcjonalnie) polish wizualny / copy etykiet boxa |

**Prerequisites:** S-04 zaimplementowane według `interface.md`.
