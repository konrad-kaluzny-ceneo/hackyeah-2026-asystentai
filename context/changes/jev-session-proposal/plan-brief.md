# Odpowiedź z Jev i OpenAI — Plan Brief

> Full plan: `context/changes/jev-session-proposal/plan.md`  
> Kontrakt dla UI: `context/changes/assistant-proposal-box/interface.md`

## What & Why

Serwer analizuje minimalne podsumowanie MetaEvents przez Jev (Typesafe). Pewny, niehedgowany wynik `DECISION_FATIGUE` z niepustym draftem zwraca skrót Jev; pozostałe poprawne wyniki przechodzą do OpenAI, które zwraca wyłącznie `title` i `message`. Akcja przejścia do filtrów pozostaje lokalna w UI.

## Desired End State

Route przyjmuje 1–10 MetaEvents w body do 64 KiB i zwraca JSON zgodny z `interface.md`. Prompt pomija surowe eventy, ścieżki i identyfikatory sesji/eventu. Jev ma timeout 3 s, OpenAI osobny timeout 5 s z retry wyłączonymi, rate limit 30/min/IP i 10/min/proces.

## Key Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Request | `{ metaEvents }`, 1–10 elementów | Bez stanu i eventów katalogu w payloadzie |
| Jev shortcut | `DECISION_FATIGUE`, confidence `>= 0.75`, brak hedgingu i niepusty draft | Zwraca `show` z draftem Jev i pomija drugie wywołanie modelu |
| OpenAI | Zwalidowane wyjście Jev → `{ title, message }` | Model tworzy treść, ale nie wybiera akcji ani filtrów |
| Filtry | Klucze sanityzowane do dostępnych filtrów kategorii | Nieznane filtry nie przechodzą do UI |
| Czas | 3 s dla Jev, 5 s dla OpenAI | Osobne deadline’y; retry OpenAI SDK wyłączone |
| Błąd providera | `{ status: "hide" }` poza developmentem | Bezpieczny kontrakt UI; development ujawnia wyjątek |

## Scope

- MetaEvents-only request validation, prywatnościowy prompt i bounded history.
- Jev shortcut/OpenAI composition, rate limits, timeouty i action/data response.
- UI fetch lifecycle, lokalne copy, mute, abort i obsługa stale response.

## Out of Scope

- Surowe eventy, `CatalogState` lub `CatalogEvent[]` w żądaniu do modeli.
- Odczyt debug store przez asystenta.
- Nowe typy propozycji, loader, drugi box lub Redis limiter.

## Success Criteria

- Jev/OpenAI zwracają poprawny kontrakt action/data; UI używa lokalnego copy.
- MetaEvent history jest ograniczona do 10 unikalnych eventów.
- Odrzucone payloady i błędy providerów nie pokazują propozycji.
- `search_friction` pozostaje lokalne, a wyciszenie boxa trwa 15 minut.
