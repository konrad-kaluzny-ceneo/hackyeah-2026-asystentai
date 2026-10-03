# Box propozycji asystenta — Implementation Plan

## Overview

Warstwa UI boxa na listingu: kiedy coś pokazać, skąd wziąć treść, jak obsłużyć wyciszenie i równoległe żądania. Treść decision fatigue pochodzi wyłącznie z kontraktu w [`interface.md`](./interface.md) (implementacja serwera w `jev-session-proposal`).

## Current State

- `src/components/assistant/assistant-inline.tsx` — `DecisionEngine` → natychmiastowy render.
- `src/components/catalog/catalog-listing.tsx` — montuje `AssistantInline`.
- Wyciszenie: `muteAssistantFor` / `readAssistantMutedUntil` w `src/lib/assistant-events.ts`.

## Desired End State

Zgodnie z `plan-brief.md`. Decision fatigue nie używa `title`/`message` z obiektu zwróconego przez silnik do renderu — silnik tylko wyznacza moment i ewentualnie trigger fetch.

## Visual spec (box na listingu)

Jeden komponent: `AssistantInline` w `catalog-listing.tsx` (pod siatką / empty state). **Stany:**

| Stan | Widoczność | Źródło treści |
| --- | --- | --- |
| Brak sygnału | Nic (`null`) | `DecisionEngine` → `null` |
| Wyciszony (15 min) | Nic | `readAssistantMutedUntil` |
| `search_friction` | Box od razu | `DecisionEngine` (bez fetch) |
| `decision_fatigue`, czekanie na API | **Nic** — bez loadera | — |
| `decision_fatigue`, `hide` / błąd HTTP | Nic | — |
| `decision_fatigue`, `show` | Box | Pola z `AssistantProposalResponse` |

**Layout (MVP, jak dziś):** `aside` z etykietą „Podpowiedź asystenta”, tytuł (`h2`), akapit `message`, przycisk × (wyciszenie), jedna akcja — dla fatigue link `href="#filters"` z `actionLabel`; dla friction przycisk czyszczenia filtrów. Klasy Tailwind mogą się zmienić w fazie 2; struktura i jedna akcja zostają.

Pełny kontrakt danych i przykłady JSON: [`interface.md`](./interface.md).

## What We're NOT Doing

- Serwer, modele, prompty (S-04).
- Loader / skeleton.
- Druga propozycja, porównanie modeli, koszyk.
- Zmiana progów decision fatigue w `DecisionEngine`.

## Phase 1: Konsumpcja API

### Overview

`AssistantInline` rozgałęzia ścieżki: lokalna propozycja vs fetch.

### Changes

**File:** `src/lib/assistant-proposal-api.ts` — **import tylko** (moduł dostarcza S-04). Blokada startu S-05: plik istnieje i test Zod przechodzi.

**File:** `src/components/assistant/assistant-inline.tsx`

**Contract:**

- `DecisionEngine` → jeśli `null`: `proposal` puste, bez fetch.
- `kind === "search_friction"`: ustaw propozycję z silnika, bez fetch.
- `kind === "decision_fatigue"`: **nie** renderuj stałego tytułu/treści z silnika. Wywołaj `POST /api/assistant-proposal` z `{ state, events: readCatalogEvents() }`.
  - `show` → zmapuj na lokalny stan do renderu (title, message, akcja `narrow-choice` / label z odpowiedzi).
  - `hide` → brak boxa.
- Przed fetch: `++requestId`, `abortPrevious()`. Po odpowiedzi render tylko gdy `requestId` aktualny.
- Wyciszenie: jak dziś — bez fetch, `proposal` null.
- Zależności efektu: `state`, `catalog`, listener `CATALOG_SESSION_CHANGED`.

```ts
const current = ++requestId;
abortPrevious();
const result = await fetch("/api/assistant-proposal", { method: "POST", body: JSON.stringify(...), signal });
if (current !== requestId) return;
```

### Success criteria

**Automated:**

- Test: `search_friction` nie woła fetch (mock).
- Test: starszy `requestId` nie ustawia propozycji.

**Manual:**

- Trzy podobne produkty + powrót → box z tekstem z API lub brak przy `hide`.
- Pusty wynik → stała propozycja bez API.
- × → cisza 15 min.
- Dwie szybkie zmiany sesji → widać wynik późniejszego wywołania.

## Phase 2 (optional): Prezentacja

Dopracowanie klas Tailwind, `aria`, copy etykiety „Podpowiedź asystenta” — bez nowych akcji w boxie.

## Testing Strategy

- Vitest + mock `fetch` dla gałęzi fatigue / friction / abort.
- Manual z działającym S-04 i kluczami lokalnymi.

## References

- Kontrakt: `context/changes/assistant-proposal-box/interface.md`
- Serwer: `context/changes/jev-session-proposal/plan.md`
- Slice: `context/foundation/roadmap.md` S-05

## Progress

### Phase 1

- [ ] 1.1 Import z `assistant-proposal-api.ts` (S-04 gotowe)
- [ ] 1.2 `assistant-inline` — fetch + lifecycle
- [ ] 1.3 Testy + `npm run typecheck`

### Phase 2 (optional)

- [ ] 2.1 Polish wizualny
