# Kontrakt: propozycja asystenta (decision fatigue)

Wspólna umowa między **S-04** (`jev-session-proposal`, Edyta) a **S-05** (`assistant-proposal-box`, Michał). Serwer implementuje route; UI konsumuje odpowiedź.

**Single source of truth w kodzie:** `src/lib/assistant-proposal-api.ts` — tworzy i utrzymuje **S-04** (Zod + typy TS). **S-05** tylko importuje; nie duplikuje schematu.

## Podział plików

| Plik / obszar | Owner | Uwagi |
| --- | --- | --- |
| `src/lib/assistant-proposal-api.ts` | Edyta (S-04) | Request/response Zod, parser odpowiedzi |
| `src/app/api/assistant-proposal/route.ts` | Edyta | POST, rate limit, mapowanie na kontrakt |
| `src/server/assistant-proposal/*` | Edyta | Jev, OpenAI, compose, schemat wyjścia Jev |
| `src/lib/decision-engine.ts` | poza S-04/S-05* | *Zmiany progów osobnym slice; S-05 tylko woła silnik |
| `src/components/assistant/assistant-inline.tsx` | Michał (S-05) | Fetch, mute, render |
| `src/lib/assistant-events.ts` | Michał (S-05) | Tylko jeśli potrzeba pod lifecycle boxa; bez zmian semantyki eventów |
| Ten plik `interface.md` | oboje | Zmiana kształtu JSON → aktualizacja tutaj + oba plany |

## Endpoint

`POST /api/assistant-proposal`

- Content-Type: `application/json`
- Brak identyfikatora sesji w body (limiter po IP jak meta eventy).
- Sukces biznesowy: **zawsze HTTP 200** z body `show` | `hide` (patrz niżej). UI nie interpretuje `4xx`/`5xx` jako treści propozycji.

### Kody HTTP

| Kod | Kiedy | Body (orientacyjnie) | Zachowanie UI (S-05) |
| --- | --- | --- | --- |
| `200` | Poprawne przetworzenie | `AssistantProposalResponse` | `show` → box; `hide` → brak boxa |
| `400` | Złe body (Zod) | `{ error: string }` — jak meta-events | Traktować jak brak propozycji (nie pokazywać boxa fatigue) |
| `405` | Nie POST | — | Nie wołać z UI |
| `500` | Wyjątek nieobsłużony w route | `{ error: string }` opcjonalnie | Jak `hide` — brak boxa |

## Request

```ts
type AssistantProposalRequest = {
  state: CatalogState;
  events: CatalogEvent[];
};
```

`CatalogState` i `CatalogEvent` — ten sam kształt co w `src/lib/catalog-types.ts`.

### Przykład request

```json
{
  "state": {
    "categorySlug": "lodowki",
    "query": "",
    "filters": {},
    "resultCount": 12,
    "page": 1
  },
  "events": [
    {
      "id": "e1",
      "timestamp": "2026-10-03T14:00:00.000Z",
      "type": "product_view",
      "categorySlug": "lodowki",
      "productSlug": "lodowka-a"
    },
    {
      "id": "e2",
      "timestamp": "2026-10-03T14:01:00.000Z",
      "type": "product_view",
      "categorySlug": "lodowki",
      "productSlug": "lodowka-b"
    },
    {
      "id": "e3",
      "timestamp": "2026-10-03T14:02:00.000Z",
      "type": "return_to_listing",
      "categorySlug": "lodowki"
    },
    {
      "id": "e4",
      "timestamp": "2026-10-03T14:02:01.000Z",
      "type": "listing_view",
      "categorySlug": "lodowki"
    }
  ]
}
```

**Kiedy UI woła endpoint (S-05, poza implementacją S-04):**

- Tylko gdy `DecisionEngine(...)` zwróci propozycję z `kind: "decision_fatigue"`.
- Nie wołać przy `search_friction`, `null` ani gdy asystent jest wyciszony (15 min).

## Response (HTTP 200)

Discriminated union:

```ts
type AssistantProposalResponse =
  | {
      status: "show";
      action: "narrow-choice" | "clear-search-and-filters";
      data: {
        target: "filters" | "catalog";
        filterKeys: string[];
      };
    }
  | { status: "hide" };
```

### Przykład `show` (skrót Jev)

```json
{
  "status": "show",
  "action": "narrow-choice",
  "data": {
    "target": "filters",
    "filterKeys": ["capacity"]
  }
}
```

### Przykład `show` (OpenAI)

OpenAI zwraca wyłącznie decyzję i jej dane:

```json
{
  "status": "show",
  "action": "clear-search-and-filters",
  "data": {
    "target": "catalog",
    "filterKeys": []
  }
}
```

### Przykład `hide`

```json
{
  "status": "hide"
}
```

Reguły:

- `status: "hide"` — brak boxa dla tego wywołania (błąd modelu, limit Jev, timeout Jev 3 s, zły JSON Jev, porażka OpenAI, rate limit, faza 1 S-04 gdy `needs_openai`).
- `action` jest decyzją OpenAI z zamkniętego enuma: `"narrow-choice"` albo `"clear-search-and-filters"`.
- `data` jest obiektem payloadu akcji: `target` wskazuje obszar aplikacji, a `filterKeys` może wskazać maksymalnie trzy filtry.
- Skrót Jev i OpenAI zwracają ten sam minimalny kształt `action` + `data`.

## Semantyka `hide` vs pusty wynik

- `search_friction` **nie** używa tego endpointu — UI bierze copy z `DecisionEngine` (S-03).

## Wersjonowanie

Zmiana kształtu JSON → ten plik + `assistant-proposal-api.ts` + oba plany change. UI i route importują wyłącznie moduł współdzielony.
