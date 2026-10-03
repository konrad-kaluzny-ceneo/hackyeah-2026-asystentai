---
project: "Asystent AI — intencje na bieżąco"
version: 1
status: draft
created: 2026-10-03
updated: 2026-10-03
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Asystent AI — intencje na bieżąco

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Asystent na stronie katalogu AGD wykrywa decision fatigue i tarcie wyszukiwania, a następnie proponuje jeden następny krok dopasowany do siły sygnału. Hackathonowe MVP dowodzi przepływu na mock katalogu, bez akcji na koszyku.

## North star

**S-02: Decision fatigue → jedna propozycja** — najmniejszy end-to-end przepływ, który potwierdza hipotezę produktu: sygnały zachowania + reguła mocy → jedna użyteczna propozycja (US-01, Primary Success Criterion).

> North star to najmniejszy pionowy slice, który dowodzi głównej hipotezy produktu, umieszczony jak najwcześniej pozwala graf zależności.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | app-scaffold | (foundation) uruchomić pustą aplikację web z routingiem pod demo katalogu | — | Access Control | proposed |
| F-02 | demo-catalog-events | (foundation) przeglądać mock katalog i emitować zdarzenia sygnałów | F-01 | FR-001 | proposed |
| S-01 | signal-strength-engine | … system klasyfikuje moc sygnału z zebranych zdarzeń | F-02 | FR-001, FR-002 | proposed |
| S-02 | decision-fatigue-box | … dostać jedną propozycję przy decision fatigue | S-01 | US-01, FR-007, FR-008, FR-009 | proposed |
| S-03 | empty-search-recovery | … dostać jedną propozycję recovery przy zerowych wynikach | S-01 | US-02, FR-005, FR-007 | proposed |

## Streams

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Sygnały → inferencja | `F-01` → `F-02` → `S-01` | Wspólna baza pod oba scenariusze użytkownika. |
| B | Decision fatigue | `S-02` | Gwiazda przewodnia; dołącza do Stream A po `S-01`. |
| C | Tarcie wyszukiwania | `S-03` | Równoległy z Stream B po `S-01`; ten sam box UX. |

## Baseline

What's already in place in the codebase as of `2026-10-03` (auto-researched + user-confirmed).

Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** absent — brak `package.json`, tylko `context/` i README (`README.md`)
- **Backend / API:** absent — brak serwera aplikacji
- **Data:** absent — brak persystencji poza plikami kontekstu
- **Auth:** absent — zgodnie z PRD, sesja anonimowa; nic nie wdrożone
- **Deploy / infra:** absent — brak Dockerfile / CI
- **Observability:** absent — brak logowania operacyjnego

## Foundations

### F-01: Szkielet aplikacji web

- **Outcome:** (foundation) deweloper może uruchomić aplikację web z podstawowym routingiem pod stronę demo katalogu.
- **Change ID:** app-scaffold
- **PRD refs:** Access Control
- **Unlocks:** F-02, S-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez szkieletu nie ma warstwy na box asystenta ani eventy; blokuje cały hackathon.
- **Status:** proposed

### F-02: Mock katalog i zdarzenia zachowania

- **Outcome:** (foundation) kupujący może filtrować i oglądać mock produkty AGD, a aplikacja rejestruje zdarzenia sygnałów w sesji.
- **Change ID:** demo-catalog-events
- **PRD refs:** FR-001
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Zakres mock danych (ile produktów, jakie atrybuty) — Owner: team. Block: no.
- **Risk:** Bez realistycznych eventów reguła mocy sygnału nie da się pokazać na demo.
- **Status:** proposed

## Slices

### S-01: Silnik mocy sygnału

- **Outcome:** system klasyfikuje moc sygnału (marka, niepewność, decision fatigue, słaby budżet) na podstawie zdarzeń z sesji demo.
- **Change ID:** signal-strength-engine
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Dokładne progi (liczba produktów, okno czasu) — Owner: team. Block: no.
- **Risk:** Błędna kalibracja psuje US-01; MVP używa jawnych, tunowalnych progów.
- **Status:** proposed

### S-02: Box przy decision fatigue

- **Outcome:** kupujący dostaje co najwyżej jedną propozycję (rekomendacja lub pytanie doprecyzowujące) po sygnale decision fatigue.
- **Change ID:** decision-fatigue-box
- **PRD refs:** US-01, FR-007, FR-008, FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To jest walidacja hipotezy produktu; opóźnienie tego slice’a opóźnia cały sens demo.
- **Status:** proposed

### S-03: Recovery przy pustym wyniku

- **Outcome:** kupujący dostaje jedną propozycję cofnięcia lub zmiany filtrów przy zerowych wynikach wyszukiwania.
- **Change ID:** empty-search-recovery
- **PRD refs:** US-02, FR-005, FR-007
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Drugi must-have scenariusz tarcia; można odłożyć po S-02 przy skrajnej presji czasu.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/plan` | Notes |
|---|---|---|---|---|
| F-01 | app-scaffold | Scaffold web app for demo catalog | no | Pierwszy krok; baseline pusty |
| F-02 | demo-catalog-events | Mock AGD catalog and behavior events | no | Wymaga F-01 |
| S-01 | signal-strength-engine | Classify shopping signal strength | no | Wymaga F-02 |
| S-02 | decision-fatigue-box | One assistant proposal on decision fatigue | no | North star; wymaga S-01 |
| S-03 | empty-search-recovery | Filter recovery on empty search | no | Wymaga S-01 |

## Open Roadmap Questions

1. **Mock katalog vs integracja Ceneo na demo** — Owner: team. Block: roadmap-wide (nie blokuje F-01).
2. **Sygnały przerwania przeglądania (B-017)** — Owner: user. Block: no.
3. **Pipeline inferencji (model Jev) — hosting i klucze** — Owner: team. Block: S-02 jeśli brak decyzji przed implementacją propozycji tekstowej.

## Parked

- **FR-003, FR-004, FR-006 (nice-to-have)** — Why parked: `main_goal: speed`; po S-02.
- **Porównanie modeli, cross-sell, pełne stany boxa z tablicy** — Why parked: PRD Non-Goals.
- **Metryki biznesowe (porzucenia, koszyk, powrót)** — Why parked: wymagają produkcyjnego ruchu; poza hackathon MVP.

## Done
