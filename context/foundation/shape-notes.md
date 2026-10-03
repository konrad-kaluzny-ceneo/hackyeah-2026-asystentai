---
project: "Asystent AI — intencje na bieżąco"
created: 2026-10-03
updated: 2026-10-03
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "MVP scope vs tablica"
      decision: "Pierwszy przepływ: decision fatigue (podobne parametry) → jedna rekomendacja; bez koszyka, zestawów, obsługi"
    - topic: "Granice agenta (B-020)"
      decision: "MVP tylko sugeruje: filtry, nawigacja, pytania doprecyzowujące; bez dodawania do koszyka i bez kontaktu z obsługą"
    - topic: "Dostęp"
      decision: "Sesja anonimowa bez logowania; wyciszenie w ramach sesji przeglądarki"
    - topic: "Timeline"
      decision: "2 tygodnie after-hours, hackathon; brak twardego deadline w PRD"
  frs_drafted: 9
  quality_check_status: warned
---

# Asystent AI — intencje na bieżąco

## Vision & Problem Statement

Kupujący AGD na dużym marketplace (np. porównywarka) traci czas, gdy przegląda wiele produktów o podobnych parametrach — wie, czego szuka, ale ma zbyt wiele opcji (decision fatigue). Moment: lista wyników po filtrach, kolejne karty produktów bez decyzji. Koszt dziś: porzucenie sesji, cofanie filtrów, powrót do wyszukiwarki.

Produkt łączy sygnały zachowania na stronie (search, filtry, karty) z jedną, kontekstową propozycją następnego kroku — ważoną mocą sygnału — zamiast generycznego czatu lub pełnoekranowych rekomendacji.

## User & Persona

**Primary persona:** Osoba kupująca sprzęt AGD online, korzystająca z filtrów i wyszukiwarki na stronie katalogu. Nie jest ekspertem od parametrów; chce szybko zawęzić wybór bez irytujących popupów.

## Success Criteria

### Primary

- W demo MVP: po sekwencji sygnałów „podobne parametry” (decision fatigue) użytkownik dostaje dokładnie jedną propozycję (rekomendacja lub pytanie doprecyzowujące) i może przejść do sugerowanego działania (np. zawężenie filtrów).

### Secondary

- Scenariusz tarcia: pusty wynik search + filtry → jedna propozycja cofnięcia / zmiany filtrów.
- Metryki biznesowe z tablicy (mniej porzuceń, wyższy koszyk, powrót) — pomiar po podpięciu do prawdziwego ruchu, poza hackathonowym MVP.

### Guardrails

- Co najwyżej jedna propozycja na raz.
- Pomoc przy aktywnym koszyku ma priorytet nad nową inspiracją (w MVP bez akcji na koszyku — reguła zachowana na później).
- Przy słabym sygnale — język niepewności, bez udawania pewności.
- Zamknięcie boxa wycisza propozycje na zdefiniowany czas w sesji.
- Bez wielokrotnego pytania o tę samą informację; możliwość korekty założenia przez użytkownika.

## Access Control

Sesja anonimowa: brak logowania w MVP. Identyfikacja sesji po stronie klienta (sesja przeglądarki). Brak ról i panelu admina w MVP. Dane zachowania na stronie demo trzymane minimalnie na potrzeby inferencji w tej sesji.

## Functional Requirements

### Sygnały i stany

- FR-001: Asystent może wnioskować intencję zakupową z kategorii, wyszukiwania, filtrów, kart produktu i zdarzeń na stronie demo. Priority: must-have
  > Socratic: Counter: „same eventy to CRUD logów”. Resolution: eventy służą regule mocy sygnału i wyboru typu propozycji, nie archiwizacji.

- FR-002: Asystent może rozróżniać moc sygnału (m.in. search marki = silny sygnał marki; różne parametry = niepewność; podobne parametry = decision fatigue; kategoria = słaby sygnał budżetu). Priority: must-have
  > Socratic: Counter: „heurystyki bez danych producenta zawiodą”. Resolution: MVP na mock katalogu + jawne progi; kalibracja później.

- FR-003: Asystent może wnioskować potrzebę doradztwa z otwierania opisów, pytań do asystenta i przeglądania produktów o różnych parametrach. Priority: nice-to-have

- FR-004: Asystent może wnioskować ograniczenia z filtrów i oglądanych produktów (budżet, wymiary, zabudowa, marka, energia, kolor). Priority: nice-to-have

- FR-005: Asystent może wykryć tarcie: pusty wynik wyszukiwania, wielokrotne zmiany filtrów, błąd strony, cofanie kroków. Priority: must-have
  > Socratic: Counter: „fałszywe alarmy przy eksperymentowaniu z filtrami”. Resolution: próg liczby zmian w oknie czasu; jedna propozycja recovery.

- FR-006: Asystent może uwzględnić historię sesji i wiek konta jako sygnał etapu relacji. Priority: nice-to-have

### Propozycje i box

- FR-007: Asystent może zaproponować poradę kontekstową, rekomendację produktów, pytanie doprecyzowujące, nawigację do filtrów lub cofnięcie filtrów przy zerowych wynikach. Priority: must-have
  > Socratic: Counter: „porównanie modeli i cross-sell rozdmuchują MVP”. Resolution: porównanie i cross-sell poza must-have; w MVP rekomendacja + pytania + filtry.

- FR-008: Asystent może prezentować stany boxa: ukryty, dyskretny, porada, rekomendacja, pytanie doprecyzowujące, nawigacja, recovery filtrów, wyciszony, ładowanie. Priority: must-have
  > Socratic: Counter: „za dużo stanów UI”. Resolution: must-have subset; porównanie i cross-sell w nice-to-have / non-goals.

- FR-009: Asystent respektuje: jedna propozycja na raz, priorytet koszyka nad inspiracją, wyciszenie po zamknięciu, brak powtórek pytań, korekta założeń, honest uncertainty przy słabym sygnale. Priority: must-have

## User Stories

### US-01: Kupujący dostaje jedną trafną propozycję przy decision fatigue

- **Given** kupujący na stronie demo oglądał co najmniej trzy produkty o podobnych parametrach w tej samej sesji
- **When** system uzna sygnał decision fatigue jako wystarczająco mocny
- **Then** box asystenta pokazuje co najwyżej jedną propozycję (rekomendacja lub pytanie doprecyzowujące) dopasowaną do siły sygnału

#### Acceptance Criteria

- Przed progiem sygnału box pozostaje ukryty lub dyskretny.
- Propozycja nie udaje pewności przy słabym sygnale.
- Zamknięcie boxa wycisza kolejne propozycje przez 15 minut w tej sesji.

### US-02: Kupujący dostaje pomoc przy pustym wyniku wyszukiwania

- **Given** kupujący zastosował wyszukiwanie i filtry dające zero produktów
- **When** system wykryje tarcie wyszukiwania
- **Then** asystent proponuje jedno konkretne działanie (np. cofnięcie wybranego filtra lub zmiana frazy)

## Business Logic

Asystent prezentuje co najwyżej jedną propozycję następnego działania na raz, waży język pewności według mocy obserwowanych sygnałów zakupowych i tarcia, a propozycje pomocy przy aktywnym koszyku traktuje jako ważniejsze niż nową inspirację.

Wejścia: kategorie, search, filtry, karty produktu, zdarzenia tarcia, opcjonalnie pytania użytkownika. Wyjście: typ boxa + treść propozycji + opcjonalne przekierowanie do filtrów. Mapowanie: silny sygnał marki → rekomendacja w tej marce; podobne parametry → decision fatigue → pytanie lub zawężenie; zero wyników → recovery filtrów.

## Non-Functional Requirements

- Użytkownik widzi co najwyżej jedną propozycję asystenta w danym momencie.
- Treść propozycji odzwierciedla siłę dowodu (pewny / sugerowany / warunkowy język).
- Po zamknięciu boxa użytkownik nie dostaje nowych propozycji przez 15 minut w tej samej sesji.
- Użytkownik może skorygować założenie asystenta bez powtarzania tego samego pytania w sesji.
- Propozycja pojawia się w ciągu 3 sekund od spełnienia progu sygnału (postrzegane przez użytkownika na demo).
- Demo działa w najnowszej wersji Chrome i Edge na desktopie.

## Non-Goals

- **Dodawanie do koszyka przez asystenta** — granica zaufania i scope hackathonu; użytkownik klika sam.
- **Składanie gotowego zestawu produktów** — wymaga głębszej integracji katalogu; po MVP.
- **Inicjowanie kontaktu z obsługą** — poza MVP.
- **Porównanie wielu modeli w jednym boxie** — osobny slice po walidacji US-01.
- **Cross-selling filtrów do modelu** — nice-to-have z tablicy, nie w pierwszym przepływie.
- **Pełna personalizacja (ulubione marki itd.)** — otwarte B-019; bez UI personalizacji w MVP.
- **Logowanie i synchronizacja między urządzeniami** — sesja lokalna wystarczy na demo.
- **Certyfikacja dostępności WCAG-AA** — nie cel hackathonu.

## Timeline acknowledgment

Acknowledged on 2026-10-03: 2-week MVP wymaga sustained effort; user accepted (hackathon, after-hours).

## Quality cross-check

- **Business Logic:** pełna reguła jednym zdaniem — OK.
- **Timeline-cost ack:** mvp_weeks=2 > 3 — użytkownik zaakceptował via Timeline acknowledgment.
- Pozostałe pięć punktów: present.

## Forward: tech-stack

- Inferencja intencji: model „Jev” / LLM w pipeline — wybór stacku w /tech-stack-selector, nie w PRD.
- Integracja z prawdziwym Ceneo vs mock katalog — decyzja implementacyjna po bootstrapie.

## Forward: technical-roadmap

- Mock katalog AGD na start; później podmiana źródła produktów.
- Telemetria zachowania (eventy) jako warstwa wspólna dla wszystkich slice’ów.
