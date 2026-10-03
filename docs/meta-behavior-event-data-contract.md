# Draft kontraktu danych dla data scientista

Status: draft  
Wersja kontraktu: `1.0`  
Tabela: `meta_events`

## 1. Najprostsze wyjaśnienie

System nie zapisuje każdego kliknięcia użytkownika w bazie.

Przeglądarka zbiera surowe eventy lokalnie, analizuje je na miejscu i wysyła
tylko wynik detekcji. Jeden rekord w tabeli `meta_events` oznacza:

> "W tej anonimowej sesji wykryliśmy określony wzorzec zachowania, w tym
> konkretnym czasie i kontekście strony."

To są sygnały zachowania, a nie gotowe etykiety emocji. Na przykład
`rage_click` oznacza powtarzające się kliknięcia bez widocznej reakcji strony;
nie oznacza, że mamy pewność, że użytkownik był zły.

## 2. Przepływ danych

```text
surowe eventy w przeglądarce
        -> lokalny analizator i detektory
        -> MetaEvent
        -> POST /api/meta-events
        -> walidacja Zod
        -> tabela meta_events
```

Surowe eventy, pełny DOM, pełne URL-e z query stringiem, treść formularzy i
tekst wpisywany przez użytkownika nie trafiają do bazy przez ten kontrakt.

## 3. Jeden rekord w bazie

Poniższe pola są zapisywane jako kolumny tabeli `meta_events`.

| Pole | Typ | Znaczenie |
|---|---|---|
| `id` | bigint | Techniczny klucz bazy. |
| `event_id` | text, unique | ID jednej detekcji. Używamy go do deduplikacji retry. |
| `batch_id` | text | ID paczki wysłanej przez klienta. |
| `schema_version` | varchar | Wersja kontraktu, obecnie `1.0`. |
| `event_name` | varchar | Nazwa wykrytego wzorca. |
| `detected_at` | timestamp | Czas detekcji według zegara przeglądarki. |
| `server_received_at` | timestamp | Czas przyjęcia rekordu przez serwer. |
| `window_started_at` | timestamp | Początek okna zachowania użytego przez detektor. |
| `window_ended_at` | timestamp | Koniec tego okna. |
| `window_duration_ms` | integer | Długość okna w milisekundach. |
| `session_id` | text | Anonimowy identyfikator sesji w jednej karcie. To nie jest user ID. |
| `page_view_id` | text | Identyfikator jednego widoku strony. |
| `journey_id` | text nullable | Miejsce na identyfikator ścieżki; obecnie zwykle puste. |
| `page_type` | varchar | Typ strony, np. `catalog` albo `product`. |
| `previous_page_type` | varchar nullable | Poprzedni typ strony, jeśli jest znany. |
| `route_template` | text nullable | Bezpieczny szablon trasy, np. `/product/[id]`, albo sanitizowana ścieżka. |
| `subject_type` | varchar nullable | Typ obiektu, którego dotyczy sygnał: `product`, `category`, `offer`, `search`, `form`. |
| `subject_id` | text nullable | ID obiektu, jeśli detektor je zna. |
| `category_id` | text nullable | ID kategorii obiektu. |
| `brand_id` | text nullable | ID marki obiektu. |
| `ecommerce_context` | jsonb | Kontekst filtrów i strony w momencie detekcji. |
| `metrics` | jsonb | Metryki właściwe dla danego `event_name`. |
| `strength` | double precision | Heurystyczna siła sygnału od `0` do `1`. To nie jest prawdopodobieństwo. |
| `evidence_count` | integer | Liczba surowych eventów, które wsparły detekcję. |
| `algorithm_version` | varchar | Wersja heurystyk detektora, obecnie `1.0`. |
| `partial_data` | boolean | Czy część danych okna mogła zostać usunięta. |
| `consent_version` | varchar nullable | Wersja zgody, jeśli jest używana. |
| `created_at` | timestamp | Czas utworzenia rekordu w bazie. |

`sentAt` z paczki klienta służy do kontraktu API, ale nie jest osobną kolumną
w bazie. Do czasu serwerowego należy używać `server_received_at` lub
`created_at`.

## 4. Aktualne typy sygnałów w MVP

Obecnie aktywnych jest dwanaście detektorów:

| `event_name` | Co oznacza | Metryki w `metrics` |
|---|---|---|
| `rage_click` | Co najmniej kilka kliknięć tego samego elementu bez widocznej reakcji UI. | `clickCount`, `windowMs`, `elementId` |
| `dead_click_cluster` | Kilka kliknięć tego samego elementu i cisza po kliknięciach. | `clickCount`, `windowMs`, `elementId` |
| `rapid_filter_churn` | Szybkie zmiany filtrów, w tym cofanie zmian, bez przejścia do postępu. | `filterChanges`, `windowMs`, `undoneCount` |
| `no_progress_window` | Aktywność użytkownika w oknie, ale bez zdarzenia uznanego za postęp. | `activeMs`, `clickCount`, `scrollCount`, `filterChanges` |
| `product_revisit` | Powrót do produktu po obejrzeniu innych produktów. | `revisitCount`, `distinctIntermediates`, `productId` |
| `comparison_oscillation` | Wielokrotne przechodzenie między małym zestawem produktów bez zawężenia wyboru. | `candidateCount`, `transitionCount` |
| `sustained_product_interest` | Łączny czas ekspozycji konkretnej karty produktu osiąga próg zainteresowania. | `productId`, `dwellMs`, `exposureCount` |
| `category_interest` | Łączny czas ekspozycji produktów wskazuje zainteresowanie kategorią. | `categoryId`, `dwellMs`, `uniqueProducts` |
| `filter_engagement` | Użytkownik zmienia kilka filtrów i pozostawia co najmniej jeden aktywny. | `filterCount`, `filterIds`, `windowMs`, `retainedCount` |
| `hesitation_dwell` | Użytkownik pozostaje bez aktywności na stronie katalogu lub produktu. | `idleMs`, `pageType` |
| `rapid_scroll_burst` | Wystąpiła szybka seria scrolli o dużym dystansie lub z nawrotami. | `burstCount`, `distanceRatioBucket`, `reversalCount` |
| `navigation_loop` | Powtarza się cykl wejść na typy stron bez wyjścia do nowego etapu. | `cycleLength`, `repeatCount`, `pageTypes` |

W kontrakcie istnieją też nazwy przygotowane na przyszłość:
`repeated_validation_failure`, `technical_friction`,
`delivery_information_seeking` i `availability_information_seeking`. Nie
należy zakładać, że te rekordy już powstają, dopóki detektory nie zostaną
zarejestrowane.

Raw `scroll_burst`, `idle_started` i `idle_ended` pozostają lokalnymi eventami
wejściowymi. Do bazy trafiają dopiero wyniki detekcji: odpowiednio
`rapid_scroll_burst` i `hesitation_dwell`.

### Identyfikatory i trasy katalogu AGD

W aplikacji identyfikatory katalogowe są kluczami głównymi PostgreSQL, nie
slugami z adresów URL:

- `subject.id` dla produktu oraz `metrics.productId` wskazują `products.id`;
- `subject.categoryId` wskazuje `categories.id`;
- `subject.brandId` wskazuje `brands.id`.

Aktualne bezpieczne szablony tras to `/`, `/katalog`,
`/katalog/[categorySlug]` i `/produkt/[productSlug]`. Wartość
`route_template` nie zawiera query stringa. Parametry z wyszukiwarki oraz
numeryczne wartości pól filtrów nie są wysyłane. Aktywne filtry są opisywane
przez stabilne identyfikatory: dla filtra zakresowego zapisujemy samo `id`, a
dla wyboru opcji `id` i `valueIds`. `sortingType` pozostaje pominięte, dopóki
interfejs nie udostępnia sortowania.

## 5. Struktura pól JSONB

### `ecommerce_context`

Przykładowa wartość:

```json
{
  "activeFilters": [
    { "id": "width", "valueIds": ["60cm"] }
  ],
  "activeFiltersCount": 1,
  "sortingType": "price_asc",
  "resultsCountBucket": "6-20",
  "priceBucket": "2000-4000",
  "availability": "in_stock",
  "priceVisible": true,
  "deliveryVisible": true,
  "availabilityVisible": true
}
```

Pola są opcjonalne poza `activeFilters` i `activeFiltersCount`. W obecnym
demo providerze wiele wartości jest puste, bo pełny katalog mockowy nie jest
jeszcze podłączony.

### `metrics`

`metrics` nie ma jednego wspólnego schematu. Schemat zależy od
`event_name`. Serwer odrzuca metrykę, która nie jest dozwolona dla danego typu.

Wartości mogą być tylko stringiem, liczbą albo booleanem. String powinien być
identyfikatorem, enumem albo bucketem, a nie tekstem wpisanym przez użytkownika.

## 6. Przykład rekordu logicznego

To jest przykład danych po połączeniu kolumn i JSONB w jeden obiekt. W bazie
`ecommerce_context` i `metrics` są osobnymi kolumnami JSONB.

```json
{
  "event_id": "evt_01jexample",
  "batch_id": "batch_01jexample",
  "schema_version": "1.0",
  "event_name": "product_revisit",
  "detected_at": "2026-10-03T10:15:22.000Z",
  "server_received_at": "2026-10-03T10:15:23.100Z",
  "window_started_at": "2026-10-03T10:12:00.000Z",
  "window_ended_at": "2026-10-03T10:15:22.000Z",
  "window_duration_ms": 202000,
  "session_id": "anonymous-session-id",
  "page_view_id": "page-view-id",
  "journey_id": null,
  "page_type": "product",
  "previous_page_type": "catalog",
  "route_template": "/product/[id]",
  "subject_type": "product",
  "subject_id": "product-123",
  "category_id": "fridges",
  "brand_id": "brand-7",
  "ecommerce_context": {
    "activeFilters": [],
    "activeFiltersCount": 0,
    "priceVisible": true
  },
  "metrics": {
    "revisitCount": 2,
    "distinctIntermediates": 3,
    "productId": "product-123"
  },
  "strength": 0.8,
  "evidence_count": 5,
  "algorithm_version": "1.0",
  "partial_data": false,
  "consent_version": null,
  "created_at": "2026-10-03T10:15:23.100Z"
}
```

## 7. Jak to interpretować w analizie

- Jeden rekord to jedna detekcja wzorca, nie jedna akcja użytkownika.
- Ta sama sesja może mieć wiele rekordów tego samego typu.
- `event_id` jest kluczem deduplikacji. Nie licz retry jako nowych detekcji.
- `session_id` oznacza anonimową kartę/przeglądarkę. Nie łącz go automatycznie z osobą.
- `detected_at` pochodzi z klienta i może mieć niedokładny zegar. Do kolejności serwerowej użyj `server_received_at`.
- Okna detekcji mogą się na siebie nakładać. Nie sumuj bezpośrednio wszystkich `window_duration_ms` jako czasu użytkownika.
- `strength` służy do porównywania siły heurystyki. Nie traktuj go jako prawdopodobieństwa emocji ani zakupu.
- `evidence_count` mówi, ile raw eventów wsparło sygnał, ale raw eventy nie są dostępne w tej tabeli.
- `partial_data = true` oznacza, że wynik może być oparty na niepełnym oknie i wymaga ostrożniejszej interpretacji.
- `algorithm_version` trzeba zachować w analizach, bo zmiana progów może zmienić znaczenie tego samego `event_name`.

## 8. Czego nie wolno wywnioskować z tego kontraktu

Na podstawie tych danych nie można bez dodatkowych źródeł stwierdzić:

- że użytkownik odczuwał konkretną emocję;
- kim jest użytkownik i czy dwie sesje należą do tej samej osoby;
- jaka była treść wyszukiwania, formularza albo wiadomości;
- że użytkownik kupił produkt;
- że detekcja jest prawdziwa w sensie statystycznym — to heurystyka;
- że brak rekordu oznacza brak problemu;
- że rekord jest sygnałem zakupowym z FR-002 (`brand`, `uncertainty`,
  `decision_fatigue`, `weak_budget`, `search_friction`). `strength` w tej
  tabeli to pewność detektora, nie moc intencji. Klasyfikacja intencji
  jest osobnym kontekstem (`src/domain/shopping-signal.ts`).

## 9. Pierwsze bezpieczne agregacje

Na start można liczyć:

1. liczbę detekcji według `event_name`, dnia, `page_type` i kategorii;
2. liczbę unikalnych `session_id` z danym sygnałem;
3. średnią i rozkład `strength` dla każdego typu sygnału;
4. udział rekordów z `partial_data = true`;
5. czas między `detected_at` a `server_received_at` jako kontrolę jakości zegara/transportu;
6. współwystępowanie sygnałów w jednej sesji, z uwzględnieniem czasu i nakładania okien.

Przed raportowaniem warto zawsze filtrować po `schema_version` i
`algorithm_version`, a rekordy deduplikować po `event_id`.

## 10. Zasady zmian kontraktu

- Zmiana łamiąca strukturę lub znaczenie pól wymaga podniesienia `schema_version`.
- Zmiana progów lub logiki detektora wymaga podniesienia `algorithm_version`.
- Nowy `event_name` musi mieć opis, listę dozwolonych metryk i test detektora.
- Nowe metryki powinny być identyfikatorami, bucketami lub liczbami; nie dodajemy free textu.
- Zmiany trzeba sprawdzić osobno dla walidacji API, mapowania do tabeli i analiz downstream.
