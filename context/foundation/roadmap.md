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
| F-01 | app-scaffold | (foundation) uruchomić pustą aplikację web z routingiem pod demo katalogu | — | Access Control | done |
| F-02 | demo-catalog-events | (foundation) przeglądać mock katalog i emitować fakty katalogu | F-01 | FR-001 | done |
| S-01 | signal-strength-engine | … system klasyfikuje rodzaj intencji zakupowej z faktów katalogu | F-02 | FR-001, FR-002 | done |
| S-02 | decision-fatigue-box | … dostać jedną propozycję przy decision fatigue | S-01 | US-01, FR-007, FR-008, FR-009 | done |
| S-03 | empty-search-recovery | … dostać jedną propozycję recovery przy zerowych wynikach | S-01 | US-02, FR-005, FR-007 | done |
| S-04 | jev-session-proposal | … dostać jedną odpowiedź: z wyjścia Jev przy popularnym i pewnym przypadku, inaczej od mocniejszego modelu | — | US-03, FR-010 | ready |

## Streams

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Sygnały → inferencja | `F-01` → `F-02` → `S-01` | Wspólna baza pod oba scenariusze użytkownika. |
| B | Decision fatigue | `S-02` | Gwiazda przewodnia; dołącza do Stream A po `S-01`. |
| C | Tarcie wyszukiwania | `S-03` | Równoległy z Stream B po `S-01`; ten sam box UX. |
| D | Treść propozycji | prompt Jev → `S-04` | Gotowy prompt idzie do Jev. Popularny i pewny przypadek zostaje na Jev. Reszta idzie do mocniejszego modelu. Lane: Edyta. |

## Baseline

What's already in place in the codebase as of `2026-10-03` (caught up on the hackathon; the earlier "empty repo" baseline was stale).

Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** Next.js App Router, TypeScript, Tailwind. Routes `/`, `/katalog`, `/katalog/[category]`, `/produkt/[slug]`. Mock catalog with search, filters, and one assistant proposal.
- **Backend / API:** `POST /api/meta-events` validates and stores observation meta events.
- **Data:** Drizzle + PostgreSQL table `meta_events` (`drizzle/0000_init_meta_events.sql`). Requires `DATABASE_URL`.
- **Auth:** absent — anonymous session, as in the PRD.
- **Deploy / infra:** absent — no Dockerfile / CI.
- **Observability:** client observation pipeline behind `NEXT_PUBLIC_BEHAVIOR_TRACKING`. Not product analytics of shopping intent.

## Built beside the slices

Not closed as F-02 or S-01. Do not rebuild it, and do not treat it as the shopping domain.

- Client pipeline `src/behavior/`: collector → buffer → analyzer → detectors → dispatcher. Raw events stay in the browser.
- Active detectors: `rage_click`, `dead_click_cluster`, `rapid_filter_churn`, `no_progress_window`, `product_revisit`, `comparison_oscillation`.
- The assistant does not read this pipeline. Catalog facts are `CatalogEvent` records in sessionStorage.

### DDD correction

`src/behavior` is an observation context. Shopping intent is `CatalogEvent` + `DecisionEngine`, with kind names in `src/domain/shopping-signal.ts`. See `context/foundation/domain.md`.

- `MetaEvent.quality.strength` is detector confidence. The decision engine does not use it.
- `comparison_oscillation` and `product_revisit` are not `decision_fatigue`.
- Implemented kinds: `decision_fatigue`, `search_friction`. Named but not classified: `brand`, `uncertainty`, `weak_budget`.
- Do not add more UX detectors as a substitute for those missing kinds.

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
- **Status:** done

### F-02: Mock katalog i fakty katalogu

- **Outcome:** (foundation) kupujący może filtrować i oglądać mock produkty AGD, a aplikacja zapisuje fakty katalogu jako `CatalogEvent` w sessionStorage. Te fakty nie idą do kolektora `src/behavior/`.
- **Change ID:** demo-catalog-events
- **PRD refs:** FR-001
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Zakres mock danych (ile produktów, jakie atrybuty) — Owner: team. Block: no.
- **Risk:** Bez realistycznych eventów reguła mocy sygnału nie da się pokazać na demo.
- **Status:** done

## Slices

### S-01: Silnik mocy sygnału

- **Outcome:** system klasyfikuje jeden zaimplementowany rodzaj (`decision_fatigue` albo `search_friction`) z faktów katalogu. `brand`, `uncertainty` i `weak_budget` są nazwane i nie są liczone. Silnik nie używa `MetaEvent.quality.strength`.
- **Change ID:** signal-strength-engine
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Dokładne progi (liczba produktów, okno czasu) — Owner: team. Block: no.
- **Risk:** Błędna kalibracja psuje US-01; MVP używa jawnych, tunowalnych progów.
- **Status:** done

### S-02: Box przy decision fatigue

- **Outcome:** kupujący dostaje co najwyżej jedną propozycję (rekomendacja lub pytanie doprecyzowujące) po sygnale decision fatigue.
- **Change ID:** decision-fatigue-box
- **PRD refs:** US-01, FR-007, FR-008, FR-009
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To jest walidacja hipotezy produktu; opóźnienie tego slice’a opóźnia cały sens demo.
- **Status:** done

### S-03: Recovery przy pustym wyniku

- **Outcome:** kupujący dostaje jedną propozycję cofnięcia lub zmiany filtrów przy zerowych wynikach wyszukiwania.
- **Change ID:** empty-search-recovery
- **PRD refs:** US-02, FR-005, FR-007
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Drugi must-have scenariusz tarcia; można odłożyć po S-02 przy skrajnej presji czasu.
- **Status:** done

### S-04: Odpowiedź z Jev albo z mocniejszego modelu

- **Outcome:** kupujący dostaje jedną odpowiedź. Gotowy prompt ze skryptu przechodzi przez model Jev. Po sprawdzeniu wyjścia odpowiedź powstaje z tego wyjścia, gdy przypadek jest wśród najbardziej popularnych i pewność jest największa. W pozostałych przypadkach mocniejszy model układa jedną odpowiedź na podstawie wyjścia Jev.
- **Change ID:** jev-session-proposal
- **PRD refs:** US-03, FR-010
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Acceptance:**
  - Prompt zbudowany przez istniejący skrypt jest wysyłany do modelu Jev, a wyjście zostaje zachowane.
  - Wyjście Jev jest sprawdzone, zanim powstanie odpowiedź dla kupującego.
  - Przy najbardziej popularnym przypadku i największej pewności odpowiedź dla kupującego powstaje z wyjścia Jev, bez mocniejszego modelu.
  - W pozostałych przypadkach mocniejszy model układa jedną odpowiedź dla kupującego na podstawie wyjścia Jev.
- **Unknowns:**
  - Które przypadki liczą się jako najbardziej popularne — Owner: team. Block: no.
  - Jaki próg jest największą pewnością — Owner: team. Block: no.
  - Który model jest tym mocniejszym — Owner: team. Block: no.
  - Czy odpowiedź w tym slice wchodzi do boxa na stronie, czy zostaje wynikiem pipeline’u — Owner: team. Block: no.
- **Risk:** Za niski próg puści słabą odpowiedź prosto do kupującego. Za wysoki próg wywoła mocniejszy model prawie zawsze.
- **Status:** ready

Source / Lineage:

- Added via `/roadmap-add` on 2026-10-03. Poprawione 2026-10-03: wejściem jest gotowy prompt do Jev, nie fakty katalogu w boxie.
- Goal: przy popularnym i pewnym przypadku wystarcza Jev, a mocniejszy model układa odpowiedź tylko poza tym.
- Lane: Edyta.

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/plan` | Notes |
|---|---|---|---|---|
| F-01 | app-scaffold | Scaffold web app for demo catalog | no | Done; patrz ## Done |
| F-02 | demo-catalog-events | Mock AGD catalog and catalog facts | no | Done |
| S-01 | signal-strength-engine | Classify shopping signal strength | no | Done dla dwóch rodzajów; trzy nazwane bez klasyfikacji |
| S-02 | decision-fatigue-box | One assistant proposal on decision fatigue | no | Done |
| S-03 | empty-search-recovery | Filter recovery on empty search | no | Done |
| S-04 | jev-session-proposal | Route Jev output to a shopper reply or a stronger model | yes | Lane: Edyta. Prompt już jest. Klucze są lokalnie, poza gitem. |

## Open Roadmap Questions

1. **Mock katalog vs integracja Ceneo na demo** — Owner: team. Block: roadmap-wide (nie blokuje F-01).
2. **Sygnały przerwania przeglądania (B-017)** — Owner: user. Block: no.
3. **Pipeline inferencji (model Jev) — hosting i klucze** — Owner: team. Zamknięte 2026-10-03: hosting i klucze są w lokalnym środowisku. Dalsza praca to S-04.

## Parked

- **FR-003, FR-004, FR-006 (nice-to-have)** — Why parked: `main_goal: speed`; po S-02.
- **Porównanie modeli, cross-sell, pełne stany boxa z tablicy** — Why parked: PRD Non-Goals.
- **Metryki biznesowe (porzucenia, koszyk, powrót)** — Why parked: wymagają produkcyjnego ruchu; poza hackathon MVP.

## Done

- **F-01** `app-scaffold` (2026-10-03) — Next.js App Router, trasy `/` i `/katalog`, sesja anonimowa. Zamknięte bez folderu change: hackathonowe nadgonienie, kod był już w repo.
- **F-02** `demo-catalog-events` (2026-10-03) — mock katalog, search, filtry, karty produktu. Fakty sesji to `CatalogEvent` w sessionStorage, nie meta eventy.
- **S-01** `signal-strength-engine` (2026-10-03) — `DecisionEngine` zwraca `decision_fatigue` albo `search_friction`. Bez `brand`, `uncertainty`, `weak_budget` i bez liczbowej mocy sygnału.
- **S-02** `decision-fatigue-box` (2026-10-03) — jedna podpowiedź przy trzech podobnych produktach i powrocie na listę. Zamknięcie wycisza na 15 minut.
- **S-03** `empty-search-recovery` (2026-10-03) — jedna podpowiedź przy zerowych wynikach, z wyczyszczeniem searcha i filtrów. Pusty wynik wygrywa z decision fatigue.
