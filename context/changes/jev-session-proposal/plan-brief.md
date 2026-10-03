# Odpowiedź z Jev i lokalnego stubu — Plan Brief

> Full plan: `context/changes/jev-session-proposal/plan.md`  
> Kontrakt dla UI: `context/changes/assistant-proposal-box/interface.md` (S-05, Michał)

## What & Why

Dla sesji decision fatigue serwer analizuje minimalne podsumowanie MetaEvents przez Jev (Typesafe). Tylko `DECISION_FATIGUE` z pewnością `> 0.75` uruchamia lokalny, deterministyczny stub propozycji; niższa pewność i pozostałe przypadki zwracają `hide`. Prawdziwy klient OpenAI pozostaje odroczony.

## Starting Point

Box na listingu dziś pokazuje stałe zdania z `DecisionEngine`. Pusty wynik i decision fatigue są rozpoznawane. Brak klienta LLM w aplikacji. Klucze tylko po stronie serwera.

## Desired End State

Route przyjmuje 1–10 MetaEvents w body do 64 KiB i zwraca JSON zgodny z `interface.md`. Prompt Jev pomija surowe dane, ścieżki, identyfikatory oraz stan i fakty katalogu. Jev ma limit 3 s, rate limit 30/min IP i 10/min proces. Wywołanie route z UI i prezentacja boxa są w S-05.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Granica slice’a | Kontrakt HTTP + serwer | UI jest w `assistant-proposal-box` (Michał) |
| PoC offline | Porzucony | Prompt z pliku nie opisuje sesji na demo |
| Sprawdzenie | Schemat `JevAssistantResponse` | Bramka przed zdaniem dla kupującego |
| Popularny przypadek | Tylko `DECISION_FATIGUE` | Zgodne z gwiazdą przewodnią |
| Pewność | `confidence` > 0,75; dokładnie 0,75 ukrywa propozycję | Zgodne z wymaganym progiem |
| Jev | `TYPESAFE_API_KEY` | Pierwsze wywołanie ma własny klucz |
| Generowanie propozycji | Deterministyczny lokalny stub dla `confidence > 0.75` | Demo ćwiczy cały przepływ bez połączenia OpenAI |
| OpenAI | Prawdziwy klient odroczony | Stub zostanie później zastąpiony integracją S-04 |
| Porażka Jev / stub / limit | `{ status: "hide" }` | Stałe S-02 nie jest fallbackiem |
| Który moment | Tylko decision fatigue (body z UI) | Pusty wynik poza route |
| Body POST | `{ metaEvents }`, 1–10 elementów | Bez bieżącego stanu katalogu i eventów katalogowych |
| Limit Jev | 30/min IP, 10/min proces | Demo + ochrona kosztów |
| Czas | 3 s na Jev; lokalny stub | Bez zewnętrznego wywołania OpenAI |

## Scope

**In scope:**

- Serwer: Jev, schemat, confidence gate, lokalny stub, rate limit, route
- Wspólne typy odpowiedzi (`src/lib/assistant-proposal-api.ts`) zgodne z `interface.md`
- Testy reguły, schematu, limitu, stubu i route

**Out of scope:**

- `assistant-inline.tsx`, fetch, wyścig odpowiedzi, wyciszenie UI (S-05)
- `data_processor/` jako runtime
- Model przy pustym wyniku
- Meta eventy z `src/behavior/`
- Loader, drugi box, Redis limiter

## Architecture / Approach

Prompt składany na serwerze z allowlistowanego podsumowania MetaEvents; nie zawiera identyfikatorów sesji/eventów, ścieżek ani stanu katalogu. `DecisionEngine` zostaje po stronie klienta tylko do rozpoznania momentu (S-05 woła route). Bieżący route zwraca stały wynik ze stubu, bez prawdziwego klienta OpenAI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bramka Jev | Schemat, limit, Typesafe, `hide`/`show` (skrót) | Adres HTTP Typesafe poza repo |
| 2. Stub + kontrakt | Wysoka pewność → stałe `show`, niższa pewność → `hide` | Prawdziwy OpenAI klient pozostaje przyszłą pracą |

**Prerequisites:** S-02, S-03. Klucze lokalnie.  
**Estimated effort:** około 2 sesje (2 fazy).

## Success Criteria (Summary)

- `POST` z fixture decision fatigue → `show` lub `hide` wg reguł.
- Fatigue z `confidence > 0.75` wywołuje lokalny stub; `0.75` i niżej daje `hide`.
- Żaden runtime/test tej ścieżki nie wykonuje żądania do OpenAI.
- 31. IP / 11. proces w minucie → `hide`, bez wołania Jev.
- Odpowiedź JSON pasuje do `interface.md` (test parsowania / Zod).
