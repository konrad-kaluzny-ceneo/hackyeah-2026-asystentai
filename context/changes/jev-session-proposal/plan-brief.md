# Odpowiedź z Jev albo z OpenAI — Plan Brief

> Full plan: `context/changes/jev-session-proposal/plan.md`

## What & Why

Kupujący w momencie decision fatigue dostaje jedną odpowiedź ułożoną na żywo. Jev klasyfikuje sesję katalogu. Gdy przypadek to `DECISION_FATIGUE` i pewność jest wysoka, tekst bierze się z wyjścia Jev. W pozostałych poprawnych wyjściach zdanie układa OpenAI. Generator promptów w `data_processor/` był próbą i nie wchodzi do tej ścieżki.

## Starting Point

Box na listingu woła `DecisionEngine` w przeglądarce i pokazuje stałe zdania. Pusty wynik i decision fatigue są już rozpoznawane. W repozytorium nie ma klienta modelu. Klucze są tylko w lokalnym środowisku, po stronie serwera.

## Desired End State

Przy decision fatigue box pojawia się z jedną odpowiedzią modelu albo nie pojawia się wcale. Pusty wynik dalej pokazuje stałą propozycję wyczyszczenia filtrów. Nowe przeliczenie tej samej reguły woła modele od nowa, a starsza odpowiedź nie wchodzi na ekran.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Gdzie wynik | Box na stronie | Kupujący ma zobaczyć odpowiedź w istniejącym boxie |
| PoC offline | Porzucony | Prompt z pliku nie opisuje sesji osoby na demo |
| Sprawdzenie | Schemat `JevAssistantResponse` | Bramka jest automatyczna, zanim powstanie zdanie |
| Popularny przypadek | Tylko `DECISION_FATIGUE` | Jeden przypadek, zgodny z gwiazdą przewodnią |
| Pewność | `confidence` ≥ 0,75 i `hedging_required` false | Ta granica już stoi w system promptcie próbnym |
| Jev | `TYPESAFE_API_KEY` | Pierwsze wywołanie ma własny klucz |
| Mocniejszy model | OpenAI, `OPENAI_API_KEY` | Drugi model jest osobnym wywołaniem |
| Porażka Jev | Schowaj box | Stałe zdanie S-02 nie jest zapasem |
| Porażka OpenAI | Schowaj box | Szkic Jev nie wchodzi na ekran, skoro reguła kazała iść wyżej |
| Który moment | Tylko decision fatigue | Pusty wynik zostaje przy S-03 |
| Jak często | Przy każdym przeliczeniu reguły, w progu Jev | Tekst ma nadążać za zmianą sesji, a pętla nie pali klucza |
| Limit Jev | 30/min na IP i 10/min na proces | Demo i wspólne WiFi mieszczą się w luźnym progu IP; sufit procesu trzyma okno nadużycia poniżej około 5 USD przy koszcie do 0,10 USD za żądanie |
| Licznik | `InMemoryRateLimiter` w route | Ten sam wzorzec co meta eventy; bez Redisa |
| Body POST | `CatalogState` i `CatalogEvent[]` | Katalog nie ma osobnego id sesji, a limiter kluczuje IP |
| Czas | 3 s tylko na Jev | OpenAI może trwać dłużej, a box pojawia się po jego odpowiedzi |
| Akcja boxa | Zostaje link do filtrów | Model podmienia tekst, nie dokładamy porównania modeli |

## Scope

**In scope:**

- Serwerowe wywołanie Jev i sprawdzenie schematu w 3 sekundy
- Gałąź OpenAI dla poprawnego wyjścia poza regułą skrótu
- Podpięcie boxa decision fatigue i odrzucenie nieaktualnej odpowiedzi
- Testy reguły, schematu, limitu Jev, gałęzi OpenAI i wyścigu odpowiedzi

**Out of scope:**

- `data_processor/` i `data/jev_prompts.jsonl` jako ścieżka działania
- Model przy pustym wyniku
- Czytanie meta eventów z `src/behavior/`
- Porównanie kilku modeli w boxie, stan ładowania, zapis odpowiedzi do bazy
- Usuwanie plików PoC
- Wspólny licznik Redis albo Upstash

## Architecture / Approach

`DecisionEngine` nadal tylko rozpoznaje moment. Dla decision fatigue przeglądarka woła `POST /api/assistant-proposal` z faktami katalogu. Serwer najpierw sprawdza limit Jev, potem składa prompt, woła Typesafe, waliduje JSON i albo zwraca tekst Jev, albo woła OpenAI. Po progu zwraca ukrycie boxa i nie woła modelu. Klucze zostają w modułach serwerowych. Pusty wynik nie idzie tą drogą.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bramka Jev | Reguła, schemat, limit Jev, wywołanie Typesafe, ukrycie przy porażce | Adres HTTP Typesafe nie leży w repo |
| 2. Gałąź OpenAI | Jedna odpowiedź dla wyjścia poza skrótem | OpenAI może wrócić późno albo wcale |
| 3. Box | Podpięcie listingu i wygrana najnowszego wywołania | Przeliczenie w progu jest płatnym strzałem |

**Prerequisites:** S-02 i S-03 są na stronie. Klucze `TYPESAFE_API_KEY` i `OPENAI_API_KEY` są w lokalnym środowisku serwera.
**Estimated effort:** około 2–3 sesje na 3 fazy

## Open Risks & Assumptions

- Kształt żądania Typesafe nie jest w repozytorium. Zna go tylko adapter Jev, a produktowa umowa to JSON zgodny ze schematem.
- Przy każdym przeliczeniu decision fatigue idzie prawdziwe wywołanie, dopóki mieści się w progu 30/min na IP i 10/min na proces. Licznik jest w pamięci jednej instancji. Cennika w repozytorium nie ma: próg procesu trzyma kilka minut pełnego dobijania poniżej 5 USD przy koszcie do około 0,10 USD za żądanie.
- OpenAI nie ma limitu 3 sekund, więc podpowiedź może wejść później niż reszta strony.
- Skrót `DECISION_FATIGUE` może nieść akcję porównania. Box i tak pokazuje jedno zdanie i link do filtrów.

## Success Criteria (Summary)

- Trzy podobne produkty i powrót na listę dają jedną odpowiedź modelu albo brak boxa.
- Wysoka pewność `DECISION_FATIGUE` nie woła OpenAI.
- Inne poprawne wyjście Jev woła OpenAI i pokazuje jedno zdanie.
- Zły JSON, błąd, Jev po 3 sekundach, albo przekroczenie progu Jev chowa box.
- 31. żądanie z jednego IP w ciągu minuty oraz 11. w procesie dają `hide` i nie wołają Jev.
- Błąd OpenAI chowa box i nie pokazuje szkicu Jev.
- Pusty wynik nadal czyści filtry stałym tekstem.
