# Kontrakt: propozycja asystenta z MetaEvents

Wspólna umowa dla serverowego przepływu Jev/OpenAI i boxa S-05. UI wysyła snapshot od pierwszego unikalnego MetaEventu z poprawnie wysłanego batcha, a potem po każdym nowym evencie, dopóki propozycja nie zostanie pokazana albo asystent nie zostanie wyciszony. Serwer przekazuje Jev bezpieczne podsumowanie zagregowanych MetaEvents. Pewny, niehedgowany wynik `DECISION_FATIGUE` z niepustym draftem może zwrócić tekst Jev bez drugiego wywołania modelu; pozostałe poprawne wyniki przechodzą do OpenAI, które zwraca wyłącznie `title` i `message`.

**Kontrakty w kodzie:** `src/lib/assistant-proposal-api.ts` zawiera request/response UI; `src/behavior/meta-event-schema.ts` jest współdzielonym, ścisłym schematem MetaEvent. `/api/meta-events` zachowuje dotychczasowy format batcha.

## Podział plików

| Plik / obszar | Owner | Uwagi |
| --- | --- | --- |
| `src/behavior/meta-event-schema.ts` | wspólny | Ścisły schemat zdarzenia i allowlista metryk; używany po stronie klienta i serwera |
| `src/lib/assistant-proposal-api.ts` | S-04 / S-05 | Wspólny request MetaEvents-only oraz parser odpowiedzi |
| `src/app/api/assistant-proposal/route.ts` | S-04 | Walidacja, limity, Jev i kompozycja odpowiedzi |
| `src/server/assistant-proposal/*` | S-04 | Klient Jev/OpenAI i prompt z minimalnym podsumowaniem |
| `src/components/assistant/assistant-proposal-coordinator.tsx` | S-05 | Root coordinator: próg 1 MetaEvent, kolejkowanie requestów, mute gate i abort/requeue |
| `src/lib/assistant-proposal-state.ts` | S-05 | Wspólny stan jednej propozycji serwerowej i widocznego local recovery |
| `src/components/assistant/assistant-inline.tsx` | S-05 | Render propozycji, lokalne empty-search recovery i mute boxa |
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

Root coordinator obsługuje próg i kolejkę także podczas nawigacji poza listingiem; po powrocie box odczytuje propozycję ze wspólnego stanu. Serwer nie przekazuje Jev pełnego obiektu MetaEvent ani osobnego stanu katalogu. Prompt jest zbudowany z nazw eventów, względnego czasu, typu strony, typu subjectu i metryk z allowlisty. Pomija identyfikatory sesji/eventu, ścieżki, absolutne znaczniki czasu, surowe eventy i `quality.strength`; nie dołącza osobnych `CatalogState` ani `CatalogEvent[]`.

## Request gate i zachowanie serwera

- S-05 woła route od pierwszego unikalnego eventu z poprawnie wysłanego batcha, a następnie dla każdego nowego eventu, dopóki nie ma widocznej propozycji; `search_friction` pozostaje lokalne.
- Jev jest wywoływany dopiero po walidacji requestu.
- Skrót Jev wymaga `DECISION_FATIGUE`, `proposal.confidence >= 0.75`, `hedging_required === false` i niepustego `message_draft`; zwraca `show` z tytułem ustalonym przez aplikację i draftem Jev jako wiadomością.
- Pozostałe poprawne wyniki Jev przechodzą do OpenAI. OpenAI dostaje wyłącznie zwalidowany wynik Jev i zwraca krótki `title` oraz `message`.
- Nieprawidłowe body, błąd walidacji Jev, timeout, rate limit albo błąd OpenAI skutkują `{ status: "hide" }`.
- Akcja serwerowej propozycji (`narrow-choice`) i etykieta linku są ustalane lokalnie przez UI; model nie wybiera akcji, filtrów ani payloadu.

## Response (HTTP 200)

```ts
type AssistantProposalResponse =
  | {
      status: "show";
      title: string;
      message: string;
    }
  | { status: "hide" };
```

### Przykład `show`

```json
{
  "status": "show",
  "title": "Pomóc zawęzić wybór?",
  "message": "Wskaż parametr, który jest dla Ciebie najważniejszy."
}
```

### Przykład `show` (OpenAI)

OpenAI zwraca wyłącznie tekst propozycji:

```json
{
  "status": "show",
  "title": "Zawęźmy wybór",
  "message": "Wybierz jeden parametr, aby łatwiej porównać dostępne modele."
}
```

### Przykład `hide`

```json
{
  "status": "hide"
}
```

Reguły:

- `status: "hide"` — brak boxa dla tego wywołania (nieprawidłowe body, błąd/timeout Jev, rate limit lub błąd OpenAI).
- Skrót Jev i odpowiedź OpenAI mają ten sam kształt `show`: `title` + `message`.
- Akcja `narrow-choice` i etykieta „Przejdź do filtrów” są ustawiane przez aplikację, nie przez model.
- Wywołanie OpenAI ma osobny timeout 5 s; SDK nie ponawia requestu automatycznie.

## Semantyka `hide` vs pusty wynik

- `search_friction` **nie** używa tego endpointu — UI bierze copy z `DecisionEngine` (S-03).

## Wersjonowanie

Zmiana kształtu JSON → ten plik + `assistant-proposal-api.ts` + oba plany change. UI i route importują wyłącznie moduł współdzielony.
