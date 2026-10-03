# Odpowiedź z Jev albo z OpenAI — Implementation Plan

## Overview

Serwer dla decision fatigue składa jedną odpowiedź na żywo z faktów katalogu. Jev (Typesafe) klasyfikuje sesję; przy `DECISION_FATIGUE`, pewności ≥ 0,75 i bez hedgingu tekst może pochodzić ze skrótu Jev. Inne poprawne wyjścia przechodzą przez OpenAI. Porażka, limit i timeout zwracają `{ status: "hide" }`. **Ten change kończy się na HTTP i wspólnym kontrakcie** — box na listingu jest w `assistant-proposal-box` (S-05).

Kontrakt (przykłady JSON, kody HTTP, podział plików): [`context/changes/assistant-proposal-box/interface.md`](../assistant-proposal-box/interface.md).

## Current State Analysis

Box na listingu woła `DecisionEngine` i rysuje stałe zdania — to zostaje do S-05. Pusty wynik i decision fatigue są rozpoznawane po stronie klienta.

Pipeline `data_processor/` nie jest runtime. Aplikacja nie ma klienta LLM. Jedyny route POST produktowy to meta eventy.

Klucze modelu są w lokalnym środowisku serwera. Asystent nie czyta `src/behavior/`.

### Key Discoveries:

- Stały tekst decision fatigue: `src/lib/decision-engine.ts` (S-05 przestanie go renderować dla fatigue).
- Wzorzec route POST: `src/app/api/meta-events/route.ts`.
- Rate limit: `src/server/meta-events/rate-limit.ts`.
- Schemat próbny Jev: `data_processor/prompt_builder.py:99` (kontrakt walidacji, nie runtime).

## Desired End State

`POST /api/assistant-proposal` przyjmuje `CatalogState` + `CatalogEvent[]` i zwraca JSON zgodny z `interface.md`. Skrót Jev → `show` bez OpenAI. Wyjście poza skrótem → OpenAI → `show` lub `hide`. Rate limit Jev: 30/min IP, 10/min proces. Jev: abort 3 s. **Brak zmian w `assistant-inline.tsx` w tym change** (opcjonalnie tylko wspólny plik typów).

Weryfikacja: testy route + ręczne `curl`/Postman z fixture; pełne demo w przeglądarce po S-05.

## What We're NOT Doing

- Podpięcie boxa, `fetch`, `requestId`, wyciszenie UI — S-05.
- `data_processor/` / `jev_prompts.jsonl` w runtime.
- Model przy pustym wyniku.
- Meta eventy z `src/behavior/`.
- Loader, drugi box, Redis limiter.
- Stałe S-02 jako fallback przy błędzie modelu.

## Implementation Approach

Prompt po polsku składany na serwerze z body, katalogu (`catalog-data`) i oglądanych produktów. Route: limit → Jev (3 s) → Zod → `routeJevOutput` → skrót lub OpenAI → mapowanie na `AssistantProposalResponse`. Typy i parser odpowiedzi w `src/lib/assistant-proposal-api.ts` (single source of truth z `interface.md`).

## Critical Implementation Details

- **Serwer:** przekroczenie limitu, zły JSON, błąd Jev, abort 3 s → `hide`, bez OpenAI. OpenAI tylko po poprawnym Jev i decyzji `needs_openai`; błąd OpenAI → `hide` (bez `message_draft` w body).
- **Skrót Jev:** `message` z `message_draft`; serwer uzupełnia `title`, `action: "narrow-choice"`, `actionLabel` (stałe produktowe, spójne z dziś S-02).
- **OpenAI:** zwraca `title` + `message`; serwer ustawia `action` / `actionLabel` jak w kontrakcie.
- **Spend:** licznik rośnie przy przyjęciu żądania, przed wołaniem Jev.
- **UI (S-05):** brak loadera; konsument woła endpoint tylko gdy silnik zwróci `decision_fatigue`.

## Phase 1: Bramka Jev

### Overview

Route, limit, Jev, schemat, reguła skrótu → `show` | `hide`. Bez OpenAI.

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

**Contract**: `routeJevOutput` → `shortcut` | `needs_openai` (progi bez zmian).

#### 4. Klient Jev

**File**: `src/server/assistant-proposal/jev-client.ts`

**Contract**: `requestJev(prompt, signal)`, `TYPESAFE_API_KEY`, 3 s od wołającego.

#### 5. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: `POST` — walidacja body (`AssistantProposalRequest`), limit IP/proces (`InMemoryRateLimiter`, klucz IP jak meta eventy), `compose` tylko Jev+skrót w tej fazie. `needs_openai` → `hide`. Odpowiedź 200: union z `interface.md`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — reguła skrótu, schemat, porażka Jev → `hide`, limit 31/11.
- `npm test` — odpowiedź `show` przechodzi Zod z `assistant-proposal-api.ts`.
- `npm run typecheck`.

#### Manual Verification:

- Fixture skrótu → `show` z oczekiwanymi polami.
- 0,74 / hedging / inna sytuacja → `hide`.
- Zły JSON / abort 3 s → `hide`.

**Implementation Note**: Po fazie 1 — pauza na manual, potem faza 2.

---

## Phase 2: Gałąź OpenAI i domknięcie kontraktu

### Overview

`needs_openai` woła OpenAI. Route zwraca pełny kształt `show`. Slice S-04 uznany za gotowy do S-05.

### Changes Required:

#### 1. Klient OpenAI

**File**: `src/server/assistant-proposal/openai-client.ts`

**Contract**: `requestStrongerReply(jevOutput)` → `{ title, message }`, `OPENAI_API_KEY`, bez limitu 3 s.

#### 2. Złożenie odpowiedzi

**File**: `src/server/assistant-proposal/compose.ts`

**Contract**: Jev → schema → route → skrót `show` lub OpenAI → `show` / `hide`.

#### 3. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Contract**: Woła `composeProposal`. Limity przed compose. Mapowanie zawsze na typy z `assistant-proposal-api.ts`.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` — skrót bez OpenAI; poza skrótem woła; błąd OpenAI → `hide`.
- Test integracyjny route z mock klientami.
- `npm run typecheck`.

#### Manual Verification:

- Wyjście poza skrótem → `show` z tekstem OpenAI.
- Błąd OpenAI → `hide`.

**Implementation Note**: Po fazie 2 S-04 jest gotowe; Michał może startować S-05 względem `interface.md`.

---

## Testing Strategy

### Unit Tests:

- Skrót / brak skrótu / pusty draft.
- Jev fail / timeout → `hide`, bez OpenAI.
- Rate limit 31 IP / 11 proces.
- OpenAI fail → `hide`.
- Response JSON vs Zod w `assistant-proposal-api.ts`.

### Integration Tests:

- Route z mock Jev/OpenAI — fixture decision fatigue → `show` | `hide`.

### Manual Testing Steps (serwer):

1. POST z body symulującym fatigue po trzech product_view (events w sessionStorage można wkleić z devtools).
2. Sprawdzić `show` / `hide` i pola `action`.
3. 31 szybkich POST z jednego IP → `hide`.

Pełny flow w przeglądarce — checklist w `assistant-proposal-box/plan.md`.

## Performance Considerations

Jev 3 s → `hide`. OpenAI bez limitu czasu w route (konsument w S-05 czeka bez loadera). Rate limit jak wcześniej.

## Migration Notes

`DecisionEngine` bez zmian w S-04. UI nadal pokazuje stały fatigue do S-05. Gałąź `search_friction` bez route.

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
- [x] 1.2 `npm test` — skrót, schemat, porażka Jev, limit
- [x] 1.3 `npm run typecheck`

#### Manual

- [ ] 1.4 Skrót Jev → `show` zgodny z `interface.md`
- [ ] 1.5 Poza skrótem (faza 1) → `hide`
- [ ] 1.6 JSON / timeout → `hide`

### Phase 2: OpenAI + kontrakt

#### Automated

- [ ] 2.1 `npm test` — gałąź OpenAI
- [ ] 2.2 Test integracyjny route
- [ ] 2.3 `npm run typecheck`

#### Manual

- [ ] 2.4 OpenAI → `show`
- [ ] 2.5 Błąd OpenAI → `hide`
