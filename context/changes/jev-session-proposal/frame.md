# Frame Brief: Gałąź OpenAI dla `needs_openai`

> Framing step before /plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Endpoint potrafi zwrócić gotowy skrót albo ukryć propozycję, ale przypadek
`needs_openai` zawsze kończy się `hide`.

## Initial Framing (preserved)

- **User's stated cause or approach**: brakującą decyzję powinien podejmować
  model OpenAI na podstawie danych żądania.
- **User's proposed direction**: dodać gałąź OpenAI w
  `POST /api/assistant-proposal`.
- **Pre-dispatch narrowing**: „Jeden konkretny przypadek” — chodzi tylko o
  istniejącą gałąź `needs_openai`.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Brak wywołania** — `needs_openai` jest już poprawnie wykrywane, ale
   endpoint nie realizuje jeszcze drugiej fazy i bezwarunkowo zwraca `hide`.
2. **Granica danych modelu** — OpenAI mogłoby dostać surowe `CatalogState`
   i `CatalogEvent[]` zamiast zwalidowanego wyjścia Jev. ← initial framing
3. **Zakres decyzji modelu** — OpenAI mogłoby wybierać `show` / `hide` oraz
   akcję zamiast tylko przygotować treść odpowiedzi w granicach kontraktu.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Gałąź `needs_openai` nie ma jeszcze implementacji fazy 2 | `src/app/api/assistant-proposal/route.ts:100` nazywa obecne `hide` zachowaniem fazy 1; `context/changes/jev-session-proposal/plan.md:113` przypisuje wywołanie OpenAI do fazy 2; planowane `openai-client.ts` i `compose.ts` jeszcze nie istnieją | STRONG |
| OpenAI powinno decydować bezpośrednio na podstawie surowych danych żądania | `context/foundation/prd.md:73` i FR-010 w `context/foundation/prd.md:106` wymagają zasilenia mocniejszego modelu wyjściem Jev; `context/changes/jev-session-proposal/plan.md:121` definiuje `requestStrongerReply(jevOutput)` | NONE |
| OpenAI powinno wybierać dowolny status i akcję | `context/changes/jev-session-proposal/plan.md:121` ogranicza wynik modelu do `{ title, message }`; `src/lib/assistant-proposal-api.ts:3` ogranicza odpowiedź `show` do jednego rodzaju i akcji; błąd modelu ma dawać `hide` po stronie serwera | NONE |

## Narrowing Signals

- Użytkownik wskazał jeden konkretny przypadek: istniejące
  `needs_openai`, a nie kilka braków endpointu ani szerszą klasę decyzji.
- Reguły routingu mają kompletne testy dla progu pewności, hedgingu, innej
  sytuacji i pustego draftu w
  `tests/assistant-proposal/route-decision.test.ts`.
- Test endpointu w `tests/assistant-proposal/route.test.ts:126` nazywa
  `needs_openai` → `hide` zachowaniem fazy 1, więc obserwacja jest
  zaplanowanym stanem przejściowym.
- Step 3 znalazł silne dowody wyłącznie dla brakującej implementacji fazy 2;
  dlatego dodatkowe pytania zawężające zostały pominięte.
- Niezależny pressure-test nie znalazł kontraktu ani wymagania pozwalającego
  wysyłać do OpenAI surowe zdarzenia lub delegować mu dowolną akcję.

## Cross-System Convention

Projekt stosuje warstwowy fallback: Jev klasyfikuje sesję, czysta funkcja
wybiera skrót albo mocniejszy model, OpenAI układa treść z poprawnego wyjścia
Jev, a serwer zachowuje kontrolę nad kontraktem HTTP i zachowaniem awaryjnym.
Ten podział jest spójny między FR-010, aktywnym planem, kontraktem odpowiedzi
i istniejącą implementacją fazy 1.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: ukończyć zaplanowaną fazę 2,
> aby `needs_openai` przekazywało zwalidowane wyjście Jev do OpenAI i
> mapowało `{ title, message }` na istniejący kontrakt odpowiedzi, z `hide`
> przy porażce modelu.

Pierwotny kierunek integracji OpenAI był poprawny, ale zakres odpowiedzialności
modelu wymagał doprecyzowania. OpenAI nie zastępuje Jev w klasyfikowaniu
surowych danych i nie wybiera dowolnego działania; domyka treść jednej
propozycji w granicach już zatwierdzonego kontraktu.

## Confidence

- **HIGH** — kod jawnie oznacza obecne zachowanie jako fazę 1, plan opisuje
  brakujące pliki i przepływ fazy 2, a PRD potwierdza granicę danych między
  Jev i mocniejszym modelem. Niezależny pressure-test nie znalazł sprzeczności.

## What Changes for /plan

Nie trzeba tworzyć nowego planu ani zmieniać architektury. Istniejący plan
fazy 2 jest właściwym zakresem implementacji; należy zachować wejście OpenAI
jako `jevOutput`, wynik `{ title, message }` oraz serwerowy fallback `hide`.

## References

- Source files: `src/app/api/assistant-proposal/route.ts:91`,
  `src/server/assistant-proposal/route-decision.ts:8`,
  `src/lib/assistant-proposal-api.ts:3`,
  `tests/assistant-proposal/route.test.ts:126`
- Product documents: `context/foundation/prd.md:69`,
  `context/foundation/prd.md:106`,
  `context/changes/jev-session-proposal/plan.md:109`,
  `context/changes/assistant-proposal-box/interface.md:128`
- Investigation tasks: Step 3 Explore checks for missing invocation, model
  data boundary, and decision authority; Step 5 independent pressure-test