# Odpowiedź z Jev albo z OpenAI — Plan Brief

> Full plan: `context/changes/jev-session-proposal/plan.md`  
> Kontrakt dla UI: `context/changes/assistant-proposal-box/interface.md` (S-05, Michał)

## What & Why

Dla sesji decision fatigue serwer układa jedną odpowiedź na żywo: Jev (Typesafe) klasyfikuje fakty katalogu; przy pewnym `DECISION_FATIGUE` tekst idzie ze skrótu Jev, inaczej OpenAI. Wynik trafia do klienta przez `POST /api/assistant-proposal` — **bez** pracy nad boxem w tym change.

## Starting Point

Box na listingu dziś pokazuje stałe zdania z `DecisionEngine`. Pusty wynik i decision fatigue są rozpoznawane. Brak klienta LLM w aplikacji. Klucze tylko po stronie serwera.

## Desired End State

Route zwraca JSON zgodny z `interface.md`: `show` z `title`, `message`, akcją `narrow-choice` albo `hide`. Jev ma limit 3 s, rate limit 30/min IP i 10/min proces. Pusty wynik **nie** woła tego endpointu (nadal S-03 po stronie UI). Podpięcie boxa — osobny slice S-05.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Granica slice’a | Kontrakt HTTP + serwer | UI jest w `assistant-proposal-box` (Michał) |
| PoC offline | Porzucony | Prompt z pliku nie opisuje sesji na demo |
| Sprawdzenie | Schemat `JevAssistantResponse` | Bramka przed zdaniem dla kupującego |
| Popularny przypadek | Tylko `DECISION_FATIGUE` | Zgodne z gwiazdą przewodnią |
| Pewność | `confidence` ≥ 0,75 i `hedging_required` false | Granica ze system promptu próbnego |
| Jev | `TYPESAFE_API_KEY` | Pierwsze wywołanie ma własny klucz |
| Mocniejszy model | OpenAI, `OPENAI_API_KEY` | Osobne wywołanie poza skrótem |
| Porażka Jev / OpenAI / limit | `{ status: "hide" }` | Stałe S-02 nie jest fallbackiem |
| Który moment | Tylko decision fatigue (body z UI) | Pusty wynik poza route |
| Body POST | `CatalogState` i `CatalogEvent[]` | Brak osobnego id sesji; limiter po IP |
| Limit Jev | 30/min IP, 10/min proces | Demo + ochrona kosztów |
| Czas | 3 s tylko na Jev | OpenAI bez tego limitu (konsument może czekać bez loadera) |

## Scope

**In scope:**

- Serwer: Jev, schemat, reguła skrótu, OpenAI, rate limit, route
- Wspólne typy odpowiedzi (`src/lib/assistant-proposal-api.ts`) zgodne z `interface.md`
- Testy reguły, schematu, limitu, gałęzi OpenAI, route

**Out of scope:**

- `assistant-inline.tsx`, fetch, wyścig odpowiedzi, wyciszenie UI (S-05)
- `data_processor/` jako runtime
- Model przy pustym wyniku
- Meta eventy z `src/behavior/`
- Loader, drugi box, Redis limiter

## Architecture / Approach

Prompt składany na serwerze z `CatalogState`, `CatalogEvent[]` i katalogu. `DecisionEngine` zostaje po stronie klienta tylko do rozpoznania momentu (S-05 woła route). Ten change kończy się na działającym `POST /api/assistant-proposal`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bramka Jev | Schemat, limit, Typesafe, `hide`/`show` (skrót) | Adres HTTP Typesafe poza repo |
| 2. OpenAI + kontrakt | Gałąź mocniejszego modelu, pełna odpowiedź `interface.md` | OpenAI wolne lub błąd |

**Prerequisites:** S-02, S-03. Klucze lokalnie.  
**Estimated effort:** około 2 sesje (2 fazy).

## Success Criteria (Summary)

- `POST` z fixture decision fatigue → `show` lub `hide` wg reguł.
- Skrót Jev nie woła OpenAI.
- Wyjście poza skrótem → OpenAI → `show` lub `hide`.
- 31. IP / 11. proces w minucie → `hide`, bez wołania Jev.
- Odpowiedź JSON pasuje do `interface.md` (test parsowania / Zod).
