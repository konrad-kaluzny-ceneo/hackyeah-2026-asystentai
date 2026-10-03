# Odpowiedź z Jev i lokalnego stubu — Implementation Plan

## Overview

Serwer przyjmuje ograniczone MetaEvents, buduje z nich minimalne podsumowanie i prosi Jev (Typesafe) o klasyfikację. Tylko `DECISION_FATIGUE` z `proposal.confidence > 0.75` uruchamia stały, lokalny stub odpowiedzi. Niższa pewność, inna sytuacja, błędy, limity i timeout zwracają `{ status: "hide" }`. Prawdziwe wywołanie OpenAI pozostaje przyszłym zadaniem. **S-05** podłącza box do tego kontraktu.

Kontrakt (przykłady JSON, kody HTTP, podział plików): [`context/changes/assistant-proposal-box/interface.md`](../assistant-proposal-box/interface.md).

## Current State Analysis

Box na listingu woła `DecisionEngine` i rysuje stałe zdania — to zostaje do S-05. Pusty wynik i decision fatigue są rozpoznawane po stronie klienta.

Pipeline `data_processor/` nie jest runtime. Aplikacja nie ma klienta LLM. Jedyny route POST produktowy to meta eventy.

Klient Jev działa po stronie serwera. S-05 dostarcza zatwierdzone MetaEvents; route przekazuje Jev wyłącznie ich zminimalizowane podsumowanie.

### Key Discoveries:

- Stały tekst decision fatigue: `src/lib/decision-engine.ts` (S-05 przestanie go renderować dla fatigue).
- Wzorzec route POST: `src/app/api/meta-events/route.ts`.
- Rate limit: `src/server/meta-events/rate-limit.ts`.
- Schemat próbny Jev: `data_processor/prompt_builder.py:99` (kontrakt walidacji, nie runtime).

## Desired End State

`POST /api/assistant-proposal` przyjmuje `{ metaEvents }` (1–10 ścisłych zdarzeń, body do 64 KiB) i zwraca JSON zgodny z `interface.md`. Jev klasyfikuje minimalne podsumowanie; tylko `DECISION_FATIGUE` z pewnością `> 0.75` → lokalny, stały stub → `show`. Inaczej `hide`. Rate limit Jev: 30/min IP, 10/min proces. Jev: abort 3 s. Prawdziwy klient OpenAI jest odroczony.

Weryfikacja: testy route + ręczne `curl`/Postman z fixture; pełne demo w przeglądarce po S-05.

## What We're NOT Doing

- Podpięcie boxa, `fetch`, `requestId`, wyciszenie UI — S-05.
- `data_processor/` / `jev_prompts.jsonl` w runtime.
- Model przy pustym wyniku.
- Wysyłanie raw eventów, `CatalogState` lub `CatalogEvent[]` do Jev.
- Loader, drugi box, Redis limiter.
- Stałe S-02 jako fallback przy błędzie modelu.

## Implementation Approach

Request zawiera od 1 do 10 ścisłych MetaEvents (maks. 64 KiB), bez osobnych `CatalogState` i `CatalogEvent[]`. Serwer składa prompt wyłącznie z nazw zdarzeń, względnego czasu, typu strony, typu subjectu i metryk z allowlisty; pomija identyfikatory sesji/eventu i ścieżki. Route: limity → walidacja → Jev (3 s) → Zod → `routeJevOutput` → deterministyczny lokalny stub albo `hide` → mapowanie na `AssistantProposalResponse`. Typy request/response w `src/lib/assistant-proposal-api.ts`; wspólny schemat MetaEvent w `src/behavior/meta-event-schema.ts`.

## Critical Implementation Details

- **Serwer:** puste/nieprawidłowe body, body ponad 64 KiB, przekroczenie limitu, błąd Jev albo abort 3 s → `{ status: "hide" }` i brak dalszego wywołania.
- **Bramka Jev:** wyłącznie `situation === "DECISION_FATIGUE"` oraz `proposal.confidence > 0.75` wywołuje stub. Pole `hedging_required` i `message_draft` nie zastępują tej granicy.
- **Stub:** zwraca stałe `title` + `message`; route ustawia `action: "narrow-choice"` i `actionLabel`. Stub nie wykonuje sieciowego wywołania ani nie wymaga klucza.
- **OpenAI:** prawdziwy klient i `OPENAI_API_KEY` są poza bieżącym zakresem; stub jest miejscem przyszłej podmiany.
- **Spend:** licznik rośnie przy przyjęciu żądania, przed wołaniem Jev.
- **UI (S-05):** brak loadera; konsument woła endpoint tylko gdy silnik zwróci `decision_fatigue`.

## Phase 1: Bramka Jev

### Overview

Route, limit, Jev, schemat i ścisła bramka confidence → `show` ze stubu | `hide`. Bez sieciowego OpenAI.

### Changes Required:

#### 1. Kontrakt współdzielony

**File**: `src/lib/assistant-proposal-api.ts`

**Intent**: Jedno miejsce na typy request/response i Zod (zgodnie z `interface.md`).

**Contract**: Eksport typów i `parseAssistantProposalResponse` / walidacja body requestu. Route i przyszły UI (S-05) importują stąd.

#### 2. Schemat i reguła

**File**: `src/server/assistant-proposal/schema.ts`

**Contract**: Jak w poprzedniej wersji planu — pola `situation`, `proposal.confidence`, `hedging_required`, `message_draft`.

#### 3. Czysta decyzja

**File**: `src/server/assistant-proposal/route-decision.ts`

**Contract**: `routeJevOutput` → `generate_proposal` wyłącznie dla `DECISION_FATIGUE` i confidence `> 0.75`; pozostałe wyniki → `hide`.

#### 4. Klient Jev

**File**: `src/server/assistant-proposal/jev-client.ts`

**Contract**: `requestJev(prompt, signal)`, `TYPESAFE_API_KEY`, 3 s od wołającego.

#### 5. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: `POST` — walidacja `{ metaEvents }`, body limit 64 KiB, limit IP/proces (`InMemoryRateLimiter`), Jev i stub tylko po confidence `> 0.75`. Invalid input, błędy i pozostałe decyzje → `{ status: "hide" }`. Odpowiedź 200: union z `interface.md`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — reguła skrótu, schemat, porażka Jev → `hide`, limit 31/11.
- `npm test` — odpowiedź `show` przechodzi Zod z `assistant-proposal-api.ts`.
- `npm run typecheck`.

#### Manual Verification:

- Jev fatigue z pewnością `> 0.75` → lokalny stub i `show`.
- `0.75` lub mniej / inna sytuacja → `hide`.
- Zły JSON / abort 3 s → `hide`.

**Implementation Note**: Po fazie 1 — pauza na manual, potem faza 2.

---

## Phase 2: Stub propozycji i domknięcie kontraktu

### Overview

Wysoka pewność Jev uruchamia lokalny stub. Route zwraca pełny kształt `show`; prawdziwe OpenAI pozostaje poza zakresem tej wersji.

### Changes Required:

#### 1. Lokalny stub propozycji

**File**: `src/server/assistant-proposal/openai-stub.ts`

**Contract**: Asynchroniczna deterministyczna funkcja przyjmuje zwalidowane wyjście Jev i zwraca stałe `{ title, message }`; bez sieci i klucza OpenAI.

#### 2. Złożenie odpowiedzi

**File**: `src/server/assistant-proposal/compose.ts`

**Contract**: Jev → schema → confidence gate → stub `show` lub `hide`.

#### 3. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: Przy fatigue z pewnością `> 0.75` woła stub; pozostałe wyniki lub błędy stubu zwracają `hide`. Mapowanie zawsze na typy z `assistant-proposal-api.ts`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — confidence `> 0.75` woła stub; `0.75` i niższe zwracają `hide`.
- Test integracyjny route z mock klientami.
- `npm run typecheck`.

#### Manual Verification:

- `0.76` → `show` ze stałą propozycją; `0.75` → `hide`.
- Błąd stubu → `hide`; żadne żądanie OpenAI nie jest wykonywane.

**Implementation Note**: Po fazie 2 S-04 jest gotowe; Michał może startować S-05 względem `interface.md`.

---

## Testing Strategy

### Unit Tests:

- Granica confidence / inna sytuacja.
- Jev fail / timeout → `hide`, bez wywołania stubu.
- Rate limit 31 IP / 11 proces.
- Stub fail / niepoprawna propozycja → `hide`.
- Response JSON vs Zod w `assistant-proposal-api.ts`.

### Integration Tests:

- Route z mock Jev/stub — MetaEvents-only fixture → `show` | `hide`.

### Manual Testing Steps (serwer):

1. POST z body `{ metaEvents: [...] }` zgodnym ze schematem.
2. Mock Jev `0.76` → sprawdzić stałe `show`; `0.75` → `hide`.
3. Sprawdzić, że prompt Jev nie zawiera identyfikatorów ani ścieżek.
4. Nieprawidłowe/puste body lub więcej niż 10 zdarzeń → `hide` bez wołania Jev.
5. 31 szybkich POST z jednego IP → `hide`.

Pełny flow w przeglądarce — checklist w `assistant-proposal-box/plan.md`.

## Performance Considerations

Jev 3 s → `hide`. Stub nie dodaje zewnętrznego opóźnienia. Rate limit jak wcześniej.

## Migration Notes

Request zmienia się z `CatalogState` + `CatalogEvent[]` na `{ metaEvents }`. UI nadal potrzebuje S-05 Phase 3 do wywoływania route. Gałąź `search_friction` pozostaje lokalna; prawdziwy klient OpenAI jest odroczony.

## References

- Kontrakt UI: `context/changes/assistant-proposal-box/interface.md`
- UI plan: `context/changes/assistant-proposal-box/plan.md`
- Slice: `context/foundation/roadmap.md` S-04
- Route pattern: `src/app/api/meta-events/route.ts`
- Rate limit: `src/server/meta-events/rate-limit.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Bramka Jev

#### Automated

- [x] 1.1 `assistant-proposal-api.ts` + test Zod odpowiedzi
- [x] 1.2 `npm test` — bramka Jev, schemat, porażka Jev, limit
- [x] 1.3 `npm run typecheck`

#### Manual

- [ ] 1.4 Skrót Jev → `show` zgodny z `interface.md`
- [ ] 1.5 Confidence `0.75` lub niższe → `hide`
- [ ] 1.6 JSON / timeout → `hide`

### Phase 2: Stub + kontrakt

#### Automated

- [ ] 2.1 `npm test` — confidence gate i lokalny stub
- [ ] 2.2 Test integracyjny route
- [ ] 2.3 `npm run typecheck`

#### Manual

- [ ] 2.4 `0.76` → `show`, `0.75` → `hide`
- [ ] 2.5 Błąd stubu → `hide`, bez OpenAI
