# Kontrakt: propozycja asystenta z MetaEvents

Wspólna umowa dla serverowego przepływu Jev i boxa S-05. UI woła route tylko przy decyzji fatigue; serwer przekazuje Jev bezpieczne podsumowanie zagregowanych MetaEvents. Odpowiedź o wysokiej pewności przechodzi przez lokalny stub propozycji.

**Kontrakty w kodzie:** `src/lib/assistant-proposal-api.ts` zawiera request/response UI; `src/behavior/meta-event-schema.ts` jest współdzielonym, ścisłym schematem MetaEvent. `/api/meta-events` zachowuje dotychczasowy format batcha.

## Podział plików

| Plik / obszar | Owner | Uwagi |
| --- | --- | --- |
| `src/behavior/meta-event-schema.ts` | wspólny | Ścisły schemat zdarzenia i allowlista metryk; używany po stronie klienta i serwera |
| `src/lib/assistant-proposal-api.ts` | S-04 / S-05 | Wspólny request MetaEvents-only oraz parser odpowiedzi |
| `src/app/api/assistant-proposal/route.ts` | S-04 | Walidacja, limity, Jev, bramka pewności i lokalny stub |
| `src/server/assistant-proposal/*` | S-04 | Klient Jev, prompt z minimalnym podsumowaniem i stub przyszłego OpenAI |
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
- Tylko `situation === "DECISION_FATIGUE"` i `proposal.confidence > 0.75` wywołuje lokalny stub propozycji.
- Przy pewności równej `0.75` lub niższej, innej sytuacji, pustym/nieprawidłowym body, błędzie walidacji Jev, timeout, rate limit albo błędzie stubu route zwraca `hide`.
- Stub zwraca stały tekst demonstracyjny i nie wykonuje żądania sieciowego. Prawdziwy klient OpenAI pozostaje przyszłym zadaniem.

## Response (HTTP 200)

```ts
type AssistantProposalResponse =
  | {
      status: "show";
      kind: "decision_fatigue";
      title: string;
      message: string;
      action: "narrow-choice";
      actionLabel: string;
    }
  | { status: "hide" };
```

Przykład `show` ze stubu:

```json
{
  "status": "show",
  "kind": "decision_fatigue",
  "title": "Pomóc zawęzić wybór?",
  "message": "Wybierzmy jeden parametr, na przykład pojemność, aby szybciej zawęzić wyniki.",
  "action": "narrow-choice",
  "actionLabel": "Przejdź do filtrów"
}
```

Przykład `hide`:

```json
{ "status": "hide" }
```

`search_friction` nie używa tego endpointu. Box zachowuje jedno widoczne zalecenie i istniejące 15-minutowe wyciszenie.
