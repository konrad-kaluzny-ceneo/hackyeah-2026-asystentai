# Odpowiedź z Jev i lokalnego stubu — Plan Brief

> Full plan: `context/changes/jev-session-proposal/plan.md`  
> Kontrakt dla UI: `context/changes/assistant-proposal-box/interface.md` (S-05, Michał)

## What & Why

Serwer analizuje minimalne podsumowanie MetaEvents przez Jev (Typesafe). Każda znana sytuacja z pewnością `> 0.75` uruchamia lokalny, deterministyczny stub propozycji; niższa pewność i nieznane sytuacje zwracają `hide`. Prawdziwy klient OpenAI pozostaje odroczony.

## Starting Point

Box na listingu obecnie nadal używa `DecisionEngine` jako bramki requestu dla fatigue; S-05 przenosi klasyfikację stanu na serwer. Pusty wynik pozostaje lokalnym recovery. Brak klienta LLM w aplikacji. Klucze tylko po stronie serwera.

## Desired End State

Route przyjmuje 1–10 MetaEvents w body do 64 KiB i zwraca JSON zgodny z `interface.md`. Prompt Jev pomija surowe dane, ścieżki, identyfikatory oraz stan i fakty katalogu. Jev ma limit 3 s, rate limit 30/min IP i 10/min proces. S-05 wywołuje route po pięciu MetaEvents, a potem przy kolejnych zdarzeniach do wyświetlenia propozycji.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Granica slice’a | Kontrakt HTTP + serwer | UI jest w `assistant-proposal-box` (Michał) |
| PoC offline | Porzucony | Prompt z pliku nie opisuje sesji na demo |
| Sprawdzenie | Schemat `JevAssistantResponse` | Bramka przed zdaniem dla kupującego |
| Rozpoznane sytuacje | Pięć stanów z promptu Jev; dowolny znany stan może przejść bramkę | Serwer klasyfikuje zachowanie zamiast klienta |
| Pewność | `confidence` > 0,75; dokładnie 0,75 ukrywa propozycję | Zgodne z wymaganym progiem |
| Jev | `TYPESAFE_API_KEY` | Pierwsze wywołanie ma własny klucz |
| Generowanie propozycji | Deterministyczny lokalny stub dla `confidence > 0.75` | Demo ćwiczy cały przepływ bez połączenia OpenAI |
| OpenAI | Prawdziwy klient odroczony | Stub zostanie później zastąpiony integracją S-04 |
| Porażka Jev / stub / limit | `{ status: "hide" }` | Stałe S-02 nie jest fallbackiem |
| Wywołanie route | Od piątego MetaEvent i potem na każde nowe zdarzenie, dopóki nie ma propozycji | S-05 nie rozstrzyga fatigue lokalnie |
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

Prompt składany na serwerze z allowlistowanego podsumowania MetaEvents; nie zawiera identyfikatorów sesji/eventów, ścieżek ani stanu katalogu. `DecisionEngine` nie steruje wywołaniem route w S-05. Klient liczy successfully sent MetaEvents, a serwer klasyfikuje snapshot Jev-em. Route zwraca stały wynik ze stubu dla znanej sytuacji powyżej progu, bez prawdziwego klienta OpenAI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bramka Jev | Schemat, limit, Typesafe, `hide`/`show` (skrót) | Adres HTTP Typesafe poza repo |
| 2. Stub + kontrakt | Wysoka pewność → stałe `show`, niższa pewność → `hide` | Prawdziwy OpenAI klient pozostaje przyszłą pracą |

**Prerequisites:** S-02, S-03. Klucze lokalnie.  
**Estimated effort:** około 2 sesje (2 fazy).

## Success Criteria (Summary)

- `POST` z fixture znanej sytuacji → `show` lub `hide` wg reguł.
- Znana sytuacja z `confidence > 0.75` wywołuje lokalny stub; `0.75` i niżej oraz nieznana sytuacja daje `hide`.
- Żaden runtime/test tej ścieżki nie wykonuje żądania do OpenAI.
- 31. IP / 11. proces w minucie → `hide`, bez wołania Jev.
- Odpowiedź JSON pasuje do `interface.md` (test parsowania / Zod).
