# Kontrakt: propozycja asystenta z MetaEvents

Wspólna umowa dla serverowego przepływu Jev/OpenAI i boxa S-05. UI woła route tylko przy decyzji fatigue; serwer przekazuje Jev bezpieczne podsumowanie zagregowanych MetaEvents. Przy pewnym, niehedgowanym wyniku Jev używa skrótu; w pozostałych poprawnych przypadkach decyzję podejmuje OpenAI.

**Kontrakty w kodzie:** `src/lib/assistant-proposal-api.ts` zawiera request/response UI; `src/behavior/meta-event-schema.ts` jest współdzielonym, ścisłym schematem MetaEvent. `/api/meta-events` zachowuje dotychczasowy format batcha.

## Podział plików

| Plik / obszar | Owner | Uwagi |
| --- | --- | --- |
| `src/behavior/meta-event-schema.ts` | wspólny | Ścisły schemat zdarzenia i allowlista metryk; używany po stronie klienta i serwera |
| `src/lib/assistant-proposal-api.ts` | S-04 / S-05 | Wspólny request MetaEvents-only oraz parser odpowiedzi |
| `src/app/api/assistant-proposal/route.ts` | S-04 | Walidacja, limity, Jev i kompozycja odpowiedzi |
| `src/server/assistant-proposal/*` | S-04 | Klient Jev/OpenAI i prompt z minimalnym podsumowaniem |
| `src/components/assistant/assistant-inline.tsx` | S-05 | Fetch, mute, render i lifecycle boxa (Phase 3) |
| `src/behavior/assistant-meta-event-history.ts` | S-05 | Ostatnie 10 MetaEvents z poprawnie wysłanych batchy |

## Endpoint

`POST /api/assistant-proposal`

- `Content-Type: application/json`
- Maksymalny body: 64 KiB; maksymalnie 10 zdarzeń.
- Odpowiedzi biznesowe i odrzucone żądania: HTTP 200 z `show` albo `hide`.
- Jev ma timeout 3 s; limity: 30/min/IP i 10/min/proces.

## Request

```ts
type AssistantProposalRequest = {
  metaEvents: MetaEvent[]; // od 1 do 10, każde zdarzenie zgodne z MetaEventSchema
};
```

Przykład:

```json
{
  "metaEvents": [
    {
      "schemaVersion": "1.0",
      "eventId": "evt-example-0001",
      "name": "rage_click",
      "detectedAt": "2026-10-03T14:00:00.000Z",
      "window": {
        "startedAt": "2026-10-03T13:59:55.000Z",
        "endedAt": "2026-10-03T14:00:00.000Z",
        "durationMs": 5000
      },
      "identity": {
        "sessionId": "session-example-1",
        "pageViewId": "pageview-example-1"
      },
      "page": { "type": "catalog", "pathname": "/katalog" },
      "ecommerce": { "activeFilters": [], "activeFiltersCount": 0 },
      "metrics": { "clickCount": 4, "windowMs": 5000 },
      "quality": {
        "strength": 0.8,
        "evidenceCount": 4,
        "algorithmVersion": "1.0",
        "partialData": false
      },
      "privacy": { "containsFreeText": false, "rawDataUploaded": false }
    }
  ]
}
```

Body zawiera wyłącznie MetaEvents; nie zawiera `CatalogState` ani `CatalogEvent[]`. Zdarzenia przechodzą ścisłą walidację, w tym flag prywatności i allowlisty metryk. Historia klienta jest ograniczona do 10 unikalnych eventów po poprawnym POST do `/api/meta-events`.

Serwer nie przekazuje Jev pełnego obiektu MetaEvent ani osobnego stanu katalogu. Prompt jest zbudowany z nazw eventów, względnego czasu, typu strony, typu subjectu i metryk z allowlisty. Pomija identyfikatory sesji/eventu, ścieżki, absolutne znaczniki czasu, surowe eventy i `quality.strength`; nie dołącza osobnych `CatalogState` ani `CatalogEvent[]`.

## Request gate i zachowanie serwera

- S-05 woła route przy `decision_fatigue`, gdy ma niepustą historię; `search_friction` pozostaje lokalne.
- Jev jest wywoływany dopiero po walidacji requestu.
- Pewny, niehedgowany `DECISION_FATIGUE` z niepustym szkicem Jev może użyć skrótu. Pozostałe poprawne wyniki przechodzą do OpenAI.
- Nieprawidłowe body, błąd walidacji Jev, timeout, rate limit albo błąd OpenAI skutkują `{ status: "hide" }`.
- Odpowiedź API zawiera wyłącznie status, akcję i jej dane; tekst prezentacyjny jest własnością UI.

## Response (HTTP 200)

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

### Przykład `show`

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

- `status: "hide"` — brak boxa dla tego wywołania (błąd modelu, limit Jev, timeout Jev 3 s, zły JSON Jev, porażka OpenAI lub rate limit).
- `action` jest decyzją OpenAI z zamkniętego enuma: `"narrow-choice"` albo `"clear-search-and-filters"`.
- `data` jest obiektem payloadu akcji: `target` wskazuje obszar aplikacji, a `filterKeys` może wskazać maksymalnie trzy filtry.
- Skrót Jev i OpenAI zwracają ten sam minimalny kształt `action` + `data`.
- Wywołanie OpenAI ma osobny timeout 5 s; SDK nie ponawia requestu automatycznie.

## Semantyka `hide` vs pusty wynik

- `search_friction` **nie** używa tego endpointu — UI bierze copy z `DecisionEngine` (S-03).

## Wersjonowanie

Zmiana kształtu JSON → ten plik + `assistant-proposal-api.ts` + oba plany change. UI i route importują wyłącznie moduł współdzielony.
