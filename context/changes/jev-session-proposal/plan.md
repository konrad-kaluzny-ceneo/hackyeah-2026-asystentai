# Odpowiedź z Jev i OpenAI — Implementation Plan

## Overview

Serwer przyjmuje ograniczone MetaEvents, buduje z nich minimalne podsumowanie i prosi Jev (Typesafe) o klasyfikację. Pewny, niehedgowany wynik `DECISION_FATIGUE` może użyć skrótu Jev; pozostałe poprawne wyniki są rozstrzygane przez OpenAI. Odpowiedź API zawiera tylko akcję i jej dane; copy należy do UI. Błędy modeli, limity i timeouty skutkują `{ status: "hide" }`. **S-05** podłącza box do tego kontraktu.

Kontrakt (przykłady JSON, kody HTTP, podział plików): [`context/changes/assistant-proposal-box/interface.md`](../assistant-proposal-box/interface.md).

## Current State Analysis

Box na listingu woła `DecisionEngine` i rysuje stałe zdania — to zostaje do S-05. Pusty wynik i decision fatigue są rozpoznawane po stronie klienta.

Pipeline `data_processor/` nie jest runtime. Klient Jev i klient OpenAI działają wyłącznie po stronie serwera.

Klient Jev działa po stronie serwera. S-05 dostarcza zatwierdzone MetaEvents; route przekazuje Jev wyłącznie ich zminimalizowane podsumowanie.

### Key Discoveries:

- Stały tekst decision fatigue: `src/lib/decision-engine.ts` (S-05 przestanie go renderować dla fatigue).
- Wzorzec route POST: `src/app/api/meta-events/route.ts`.
- Rate limit: `src/server/meta-events/rate-limit.ts`.
- Schemat próbny Jev: `data_processor/prompt_builder.py:99` (kontrakt walidacji, nie runtime).

## Desired End State

`POST /api/assistant-proposal` przyjmuje `{ metaEvents }` (1–10 ścisłych zdarzeń, body do 64 KiB) i zwraca JSON zgodny z `interface.md`. Jev klasyfikuje minimalne podsumowanie; pewny, niehedgowany wynik fatigue może zwrócić skrót, a pozostałe poprawne wyjścia przechodzą przez OpenAI. Rate limit: 30/min/IP i 10/min/proces. Jev ma timeout 3 s, OpenAI osobny timeout 5 s bez retry.

Weryfikacja: testy route + ręczne `curl`/Postman z fixture; pełne demo w przeglądarce po S-05.

## What We're NOT Doing

- Podpięcie boxa, `fetch`, `requestId`, wyciszenie UI — S-05.
- `data_processor/` / `jev_prompts.jsonl` w runtime.
- Model przy pustym wyniku.
- Wysyłanie raw eventów, `CatalogState` lub `CatalogEvent[]` do Jev.
- Loader, drugi box, Redis limiter.
- Stałe S-02 jako fallback przy błędzie modelu.

## Implementation Approach

Request zawiera od 1 do 10 ścisłych MetaEvents (maks. 64 KiB), bez osobnych `CatalogState` i `CatalogEvent[]`. Serwer składa prompt wyłącznie z nazw zdarzeń, względnego czasu, typu strony, typu subjectu i metryk z allowlisty; pomija identyfikatory sesji/eventu i ścieżki. Route: limity → walidacja → Jev (3 s) → Zod → skrót Jev albo OpenAI (5 s, bez retry) → sanityzacja kluczy filtrów → `AssistantProposalResponse`. Typy request/response w `src/lib/assistant-proposal-api.ts`; wspólny schemat MetaEvent w `src/behavior/meta-event-schema.ts`.

## Critical Implementation Details

- **Serwer:** puste/nieprawidłowe body, body ponad 64 KiB, przekroczenie limitu, błąd Jev albo abort 3 s → `{ status: "hide" }` i brak dalszego wywołania.
- **Bramka Jev:** pewny, niehedgowany `DECISION_FATIGUE` z niepustym `message_draft` może użyć skrótu. Pozostałe poprawne wyjścia przechodzą do OpenAI.
- **OpenAI:** zwraca wyłącznie zamkniętą akcję i payload; klucze filtrów są ograniczane do filtrów kategorii dostępnych w danych requestu.
- **UI:** tekst tytułu, wiadomości i przycisku powstaje lokalnie; API nie generuje copy.
- **Spend:** licznik rośnie przy przyjęciu żądania, przed wołaniem Jev.
- **UI (S-05):** brak loadera; konsument woła endpoint tylko gdy silnik zwróci `decision_fatigue`.

## Phase 1: Bramka Jev

### Overview

Route, limit, Jev, schemat i bramka skrótu → `show` ze skrótu | OpenAI | `hide`.

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

**Contract**: Pewny, niehedgowany `DECISION_FATIGUE` z niepustym szkicem Jev → `shortcut`; pozostałe poprawne wyniki → `needs_openai`.

#### 4. Klient Jev

**File**: `src/server/assistant-proposal/jev-client.ts`

**Contract**: `requestJev(prompt, signal)`, `TYPESAFE_API_KEY`, 3 s od wołającego.

#### 5. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: `POST` — walidacja `{ metaEvents }`, body limit 64 KiB, limity IP/proces, Jev, skrót lub OpenAI. Nieprawidłowe wejście i błędy providerów → `{ status: "hide" }`. Odpowiedź 200: union z `interface.md`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — reguła skrótu, schemat, porażka Jev → `hide`, limit 31/11.
- `npm test` — odpowiedź `show` przechodzi Zod z `assistant-proposal-api.ts`.
- `npm run typecheck`.

#### Manual Verification:

- Pewny, niehedgowany Jev fatigue → skrót `show`; niepewny wynik → OpenAI.
- Błąd Jev/OpenAI oraz timeouty → bezpieczne `hide` poza developmentem.
- Zły JSON / abort Jev 3 s → `hide`.

**Implementation Note**: Po fazie 1 — pauza na manual, potem faza 2.

---

## Phase 2: OpenAI i domknięcie kontraktu

### Overview

Niepewne lub inne poprawne wyniki Jev przechodzą do OpenAI. Route zwraca minimalny kontrakt `status` + `action` + `data`.

### Changes Required:

#### 1. Klient OpenAI

**File**: `src/server/assistant-proposal/openai-client.ts`

**Contract**: Strukturalna odpowiedź zwraca wyłącznie `action` i `data`; request ma osobny timeout 5 s, `maxRetries: 0` i sygnał anulowania żądania klienta.

#### 2. Złożenie odpowiedzi

**File**: `src/server/assistant-proposal/compose.ts`

**Contract**: Jev → schema → skrót lub OpenAI → walidacja i sanityzacja → `show` albo `hide`.

#### 3. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: Route przyjmuje tylko zwalidowane MetaEvents, nakłada limity body/rate, buduje prompt prywatnościowy i przekazuje request do `composeProposal`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — skrót Jev i ścieżka OpenAI zwracają minimalny kontrakt.
- Test integracyjny route z mock klientami.
- `npm run typecheck`.

#### Manual Verification:

- Pewny skrót Jev → `show`; niepewna klasyfikacja → OpenAI.
- Błąd Jev/OpenAI oraz timeouty → bezpieczne `hide` poza developmentem.

**Implementation Note**: Po fazie 2 S-04 jest gotowe; Michał może startować S-05 względem `interface.md`.

---

## Testing Strategy

### Unit Tests:

- Granica confidence / inna sytuacja.
- Jev fail / timeout → `hide`, bez wywołania OpenAI.
- Rate limit 31 IP / 11 proces.
- OpenAI fail / timeout i sanityzacja kluczy filtrów.
- Response JSON vs Zod w `assistant-proposal-api.ts`.

### Integration Tests:

- Route z mock Jev/OpenAI — MetaEvents-only fixture → `show` | `hide`.

### Manual Testing Steps (serwer):

1. POST z body `{ metaEvents: [...] }` zgodnym ze schematem.
2. Pewny, niehedgowany Jev fatigue ze szkicem → skrót; inny poprawny wynik → OpenAI.
3. Sprawdzić, że prompt Jev nie zawiera identyfikatorów ani ścieżek.
4. Nieprawidłowe/puste body lub więcej niż 10 zdarzeń → `hide` bez wołania Jev.
5. 31 szybkich POST z jednego IP → `hide`.

Pełny flow w przeglądarce — checklist w `assistant-proposal-box/plan.md`.

## Performance Considerations

Jev ma timeout 3 s, OpenAI osobny timeout 5 s bez automatycznych retry. Rate limits pozostają bez zmian.

## Migration Notes

Request używa `{ metaEvents }`; UI wywołuje route wyłącznie dla fatigue. Gałąź `search_friction` pozostaje lokalna. Prezentacyjne copy zostaje po stronie UI.

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

### Phase 2: OpenAI + kontrakt

#### Automated

- [x] 2.1 `npm test` — gałąź OpenAI
- [x] 2.2 Test integracyjny route
- [x] 2.3 `npm run typecheck`

#### Manual

- [ ] 2.4 Pewny Jev → skrót; pozostałe poprawne wyjścia → OpenAI
- [ ] 2.5 Błąd OpenAI → `hide`
