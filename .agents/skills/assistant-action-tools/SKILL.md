---
name: assistant-action-tools
description: How to add or modify a tool (action skill) the assistant proposal can execute. Single source of truth lives in src/server/assistant-proposal/actions.ts. Use when the user says /new-action, "dodaj akcję", "nowy przycisk asystenta", "nowe narzędzie dla Jev", or asks to extend what the proposal UI can do. Not for adding detectors (see docs/adding-detector.md) or Jev intent kinds.
default-language: pl
---

# Assistant Action Tools

Asystent może zwrócić **co najwyżej jedną propozycję** z dokładnie **jednym narzędziem** (PRD Guardrail). Wszystkie legalne narzędzia są zdefiniowane w rejestrze `ASSISTANT_SKILLS` w [src/server/assistant-proposal/actions.ts](../../../src/server/assistant-proposal/actions.ts). UI **nie wybiera** narzędzia — wyświetla to, co przyjdzie w odpowiedzi kontraktu.

## Co już istnieje

| action_type (Jev)       | action (UI)               | target UI | payload wymagany | przeznaczenie |
|-------------------------|---------------------------|-----------|------------------|---------------|
| `NARROW_BY_SPEC`        | `narrow-choice`           | `filters` | `filterKeys[]`   | zawężenie wyników, scroll + highlight filtra |
| `RESET_FILTERS`         | `clear-search-and-filters`| `catalog` | —                | wyczyszczenie query + filtrów |
| `GO_TO_PRODUCT`         | `go-to-product`           | `product` | `productSlug`    | Link do `/produkt/<slug>` |
| `SORT_BY_PRICE`         | `sort-by-price`           | `catalog` | `sort`           | sortowanie listy (lokalny stan) |
| `EXPLAIN_CHOICE`        | `explain-choice`          | `catalog` | —                | tylko copy, bez nawigacji |
| `DO_NOTHING`            | `none`                    | —         | —                | ukryj odpowiedź (`hide`) |
| `COMPARE_MODELS`        | — (degradacja)            | —         | —                | mapowane na `explain-choice`; brak widoku porównania (PRD Non-Goal) |

`COMPARE_MODELS` zostaje taksonomyjnie (PRD, offline prompt w `data_processor/prompt_builder.py`), ale runtime go nie wykonuje.

## Jak dodać nowe narzędzie

Kolejność konieczna (każdy krok waliduje poprzedni). Nie mieszaj w jednym commicie z Fazą UI innego slice'a.

### Krok 1 — Contract + typy (Faza 0/1)

1. Dodaj wariant do `AssistantAction` w [src/lib/catalog-types.ts](../../../src/lib/catalog-types.ts) (np. `"open-brand-filter"`).
2. W razie potrzeby rozszerz `AssistantActionData` (pole opcjonalne; zachowaj `target` i `filterKeys`).
3. Dodaj wariant do `ASSISTANT_PROPOSAL_ACTIONS` w [src/lib/assistant-proposal-api.ts](../../../src/lib/assistant-proposal-api.ts). Zadbaj, by `AssistantProposalActionDataSchema` walidowała nowe pole.
4. W [src/server/assistant-proposal/schema.ts](../../../src/server/assistant-proposal/schema.ts) dodaj nowy `action_type` (uppercase) do `JEV_ACTION_TYPES` i — jeśli ma payload — wariant w `JevActionPayloadSchema` (zawsze `.strict()`).

### Krok 2 — Rejestr narzędzia

W [src/server/assistant-proposal/actions.ts](../../../src/server/assistant-proposal/actions.ts) dodaj wpis:

```ts
NEW_ACTION_NAME: {
  action: "new-action",
  label: "Krótka etykieta PL",  // ≤ 40 znaków
  requiredPayload: [],          // pola z action_payload, bez których akcja nie ma sensu
  description: "Zdanie do promptu Jev — kiedy używać i co zwrócić w action_payload.",
},
```

W `mapJevActionToProposalAction` dodaj gałąź switch. Zweryfikuj wymagane payloady po stronie serwera (np. `productSlug` sprawdzany przez `getProductBySlug`). Jeśli walidacja się nie powiedzie → zwróć `null`, co da `hide`.

### Krok 3 — Prompt

W [src/server/assistant-proposal/prompt.ts](../../../src/server/assistant-proposal/prompt.ts) dodaj do `ACTION_SKILLS_CATALOG` nazwę, opis (kiedy użyć) i wymagane klucze payloadu. W `renderTools()` pokaże się automatycznie.

### Krok 4 — Jev choices

W [src/server/assistant-proposal/jev-client.ts](../../../src/server/assistant-proposal/jev-client.ts):

- dodaj wartość do `JevActionTypeSchema`,
- dodaj `criteria[NEW_ACTION_NAME]` — krótkie polskie zdanie, po którym Jev rozpozna sytuację.

Jeśli akcja ma dostać shortcut (bez OpenAI) w [src/server/assistant-proposal/route-decision.ts](../../../src/server/assistant-proposal/route-decision.ts), dodaj regułę w `routeJevOutput` i odpowiadający `shortcutMessage` w `jev-client.ts`.

### Krok 5 — OpenAI

W [src/server/assistant-proposal/openai-client.ts](../../../src/server/assistant-proposal/openai-client.ts) dodaj do instrukcji wiersz `- new-action: ...` opisujący zachowanie przycisku i źródła payloadu. Nie zmieniaj schemy — zaciąga ją z `ASSISTANT_PROPOSAL_ACTIONS`.

### Krok 6 — Dispatch (kanał side-effectu)

Jeśli akcja robi coś w katalogu (nie tylko przyciski Link/button):
- dodaj wariant do `AssistantCatalogAction` i dispatch/subscribe w [src/lib/assistant-proposal-state.ts](../../../src/lib/assistant-proposal-state.ts),
- obsłuż go w [src/components/catalog/catalog-listing.tsx](../../../src/components/catalog/catalog-listing.tsx) (w `subscribeAssistantCatalogAction`).

### Krok 7 — Widget rendering

W [src/components/assistant/assistant-proposal-widget.tsx](../../../src/components/assistant/assistant-proposal-widget.tsx) dodaj gałąź w `ProposalAction`. Zasady:

- `go-to-product` → `<Link>` do `/produkt/<slug>` (primary button).
- `clear-search-and-filters`, `sort-by-price` → `<button>` wywołujący `dispatchAssistantCatalogAction`.
- `explain-choice` → secondary link `#filters`.
- `none` → nie renderuj przycisku.

Zachowaj **co najwyżej jeden primary i jeden secondary** w jednym pudełku (PRD: jedna propozycja na raz).

### Krok 8 — Testy

W `tests/assistant-proposal/`:
- `assistant-proposal-api.test.ts` — akceptuje `show` z nową akcją, odrzuca nieznane wartości.
- `route-decision.test.ts` — jeśli shortcut, dołożyć przypadek.
- `route.test.ts` — end-to-end Jev→OpenAI zwraca nowe pola `action`, `actionLabel`, `data`.

W `tests/components/assistant/` — widget renderuje nowy wariant przycisku (tag, tekst, href/dispatch).

## Czego NIE robić

- Nie wprowadzaj nowych widoków (porównanie, lista koszyka, panel logowania) — to PRD Non-Goals. Jeśli nowa akcja by tego wymagała, odrzuć ją na etapie Krok 1/2 i zamień na `explain-choice`.
- Nie wysyłaj raw eventów, catalog state ani debug-store do Jev — dozwolone są tylko walidowane MetaEventy z ostatnich batchy (AGENTS.md Hard rules).
- Nie dodawaj drugiego komunikatu obok proposal — jedna propozycja na raz.
- Nie hardkoduj etykiet/anachorów w koordynatorze — czytaj z odpowiedzi kontraktu.

## Weryfikacja

1. `npm run typecheck` — 0 błędów.
2. `npm test` — wszystkie testy zielone.
3. `npm run build` — jeśli zmiana dotyczy app code.
4. W przeglądarce (manualnie) tylko gdy nowa akcja wymaga click-through (np. sort lub highlight filtra).
