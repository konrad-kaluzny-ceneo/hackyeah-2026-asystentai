---
project: "Asystent AI — intencje na bieżąco"
version: 1
status: draft
created: 2026-10-03
updated: 2026-10-03
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 2
  hard_deadline: null
  after_hours_only: true
---

# Asystent AI — intencje na bieżąco

## Vision & Problem Statement

Kupujący AGD na dużym marketplace traci czas, gdy przegląda wiele produktów o podobnych parametrach — wie, czego szuka, ale ma zbyt wiele opcji (decision fatigue). Typowy moment: lista wyników po filtrach i kolejne karty produktów bez decyzji. Koszt: porzucenie sesji, cofanie filtrów, powrót do wyszukiwarki.

Produkt łączy sygnały zachowania na stronie (search, filtry, karty) z jedną kontekstową propozycją następnego kroku, ważoną mocą sygnału, zamiast generycznego czatu lub agresywnych rekomendacji.

## User & Persona

Osoba kupująca sprzęt AGD online, korzystająca z filtrów i wyszukiwarki na stronie katalogu. Nie jest ekspertem od parametrów; chce szybko zawęzić wybór bez irytujących popupów.

## Success Criteria

### Primary

- W demo MVP: po sekwencji sygnałów „podobne parametry” (decision fatigue) użytkownik dostaje dokładnie jedną propozycję (rekomendacja lub pytanie doprecyzowujące) i może przejść do sugerowanego działania (np. zawężenie filtrów).

### Secondary

- Scenariusz tarcia: pusty wynik search + filtry → jedna propozycja cofnięcia lub zmiany filtrów.
- Metryki z tablicy (mniej porzuceń, wyższy koszyk, powrót użytkownika) — pomiar po podpięciu do produkcyjnego ruchu, poza hackathonowym MVP.

### Guardrails

- Co najwyżej jedna propozycja na raz.
- Pomoc przy aktywnym koszyku ma priorytet nad nową inspiracją (w MVP bez akcji na koszyku — reguła zachowana na później).
- Przy słabym sygnale — język niepewności.
- Zamknięcie boxa wycisza propozycje na zdefiniowany czas w sesji.
- Bez wielokrotnego pytania o tę samą informację; możliwość korekty założenia.

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

### US-03: Kupujący dostaje jedną odpowiedź z Jev albo z mocniejszego modelu

- **Given** dla sesji jest gotowy prompt do modelu Jev
- **When** model Jev zwróci sprawdzone wyjście
- **Then** przy najbardziej popularnym przypadku i największej pewności kupujący dostaje jedną odpowiedź ułożoną z tego wyjścia, a w pozostałych przypadkach jedną odpowiedź ułożoną przez mocniejszy model na podstawie tego wyjścia

Value: przy popularnym i pewnym przypadku wystarcza Jev, a mocniejszy model układa odpowiedź tylko poza tym

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

- FR-010: Asystent może ułożyć jedną odpowiedź dla kupującego z wyjścia modelu Jev, gdy przypadek jest wśród najbardziej popularnych i pewność jest największa, a w pozostałych przypadkach z mocniejszego modelu zasilonego tym wyjściem. Priority: must-have
- FR-011: System obserwacji zapisuje meta eventy opisujące zainteresowanie produktami i kategoriami oraz dynamikę przeglądania: `sustained_product_interest`, `category_interest`, `filter_engagement`, `hesitation_dwell`, `rapid_scroll_burst`, `navigation_loop`. Meta eventy opisują wzorzec zachowania, nie emocje ani intencje. Priority: should-have
- FR-012: System obserwacji zapisuje meta eventy o sygnałach bliskich decyzji i feedbacku do asystenta: `price_focus`, `search_refinement_loop`, `assistant_proposal_dismissed`. Priority: could-have

## Non-Functional Requirements

- Użytkownik widzi co najwyżej jedną propozycję asystenta w danym momencie.
- Treść propozycji odzwierciedla siłę dowodu (pewny / sugerowany / warunkowy język).
- Po zamknięciu boxa użytkownik nie dostaje nowych propozycji przez 15 minut w tej samej sesji.
- Użytkownik może skorygować założenie asystenta bez powtarzania tego samego pytania w sesji.
- Propozycja pojawia się w ciągu 3 sekund od spełnienia progu sygnału (postrzegane przez użytkownika na demo).
- Demo działa w najnowszej wersji Chrome i Edge na desktopie.

## Business Logic

Asystent prezentuje co najwyżej jedną propozycję następnego działania na raz, waży język pewności według mocy obserwowanych sygnałów zakupowych i tarcia, a propozycje pomocy przy aktywnym koszyku traktuje jako ważniejsze niż nową inspirację.

Wejścia: kategorie, search, filtry, karty produktu, zdarzenia tarcia, opcjonalnie pytania użytkownika. Wyjście: typ boxa + treść propozycji + opcjonalne przekierowanie do filtrów. Mapowanie: silny sygnał marki → rekomendacja w tej marce; podobne parametry → decision fatigue → pytanie lub zawężenie; zero wyników → recovery filtrów.

## Access Control

Sesja anonimowa: brak logowania w MVP. Identyfikacja sesji w przeglądarce. Brak ról i panelu administracyjnego. Dane zachowania na stronie demo minimalnie, na potrzeby inferencji w tej sesji.

## Non-Goals

- **Dodawanie do koszyka przez asystenta** — granica zaufania; użytkownik wykonuje akcję sam.
- **Składanie gotowego zestawu produktów** — po MVP.
- **Inicjowanie kontaktu z obsługą** — poza MVP.
- **Porównanie wielu modeli w jednym boxie** — po walidacji US-01.
- **Cross-selling filtrów do modelu** — nie w pierwszym przepływie.
- **Pełna personalizacja (ulubione marki)** — bez UI w MVP (tablica B-019).
- **Logowanie i synchronizacja między urządzeniami** — sesja lokalna na demo.
- **Gwarancja dostępności WCAG-AA** — poza celem hackathonu.

## Open Questions

1. **Jakie sygnały uzasadniają przerwanie przeglądania (B-017)?** — Owner: user. Block: no.
2. **Pełna lista danych dostępnych poza filtrami (B-018)?** — Owner: user. Block: no (mock w MVP).
3. **Progi liczbowe mocy sygnału i kalibracja na prawdziwym ruchu** — Owner: team. Block: no.
4. **Podpięcie mock katalogu vs integracja Ceneo** — Owner: team. By: po bootstrapie.
5. **Baseline i cele biznesowe (porzucenia, koszyk, powrót) — definicja pomiaru** — Owner: user. Block: no.
