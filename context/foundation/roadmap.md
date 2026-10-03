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
| F-02 | demo-catalog-events | (foundation) przeglądać mock katalog i emitować fakty katalogu | F-01 | FR-001 | proposed |
| F-03 | emotion-overlay-chart | (foundation) demonstracyjnie oglądać mockową oś czasu emocji w debug overlay | F-01 | FR-001 | done |
| S-01 | signal-strength-engine | … system klasyfikuje rodzaj intencji zakupowej z faktów katalogu | F-02 | FR-001, FR-002 | proposed |
| S-02 | decision-fatigue-box | … dostać jedną propozycję przy decision fatigue | S-01 | US-01, FR-007, FR-008, FR-009 | proposed |
| S-03 | empty-search-recovery | … dostać jedną propozycję recovery przy zerowych wynikach | S-01 | US-02, FR-005, FR-007 | proposed |

## Streams

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Sygnały → inferencja | `F-01` → `F-02` → `S-01` | Wspólna baza pod oba scenariusze użytkownika. |
| B | Decision fatigue | `S-02` | Gwiazda przewodnia; dołącza do Stream A po `S-01`. |
| C | Tarcie wyszukiwania | `S-03` | Równoległy z Stream B po `S-01`; ten sam box UX. |

## Baseline

What's already in place in the codebase as of `2026-10-03` (caught up on the hackathon; the earlier "empty repo" baseline was stale).

Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** Next.js App Router, TypeScript, Tailwind. Routes `/` and `/katalog`. `/katalog` is still an empty placeholder.
- **Backend / API:** `POST /api/meta-events` validates and stores observation meta events.
- **Data:** Drizzle + PostgreSQL table `meta_events` (`drizzle/0000_init_meta_events.sql`). Requires `DATABASE_URL`.
- **Auth:** absent — anonymous session, as in the PRD.
- **Deploy / infra:** absent — no Dockerfile / CI.
- **Observability:** client observation pipeline behind `NEXT_PUBLIC_BEHAVIOR_TRACKING`. Not product analytics of shopping intent.

## Built beside the slices

Not closed as F-02 or S-01. Do not rebuild it, and do not treat it as the shopping domain.

- Client pipeline `src/behavior/`: collector → buffer → analyzer → detectors → dispatcher. Raw events stay in the browser.
- Active detectors: `rage_click`, `dead_click_cluster`, `rapid_filter_churn`, `no_progress_window`, `product_revisit`, `comparison_oscillation`.
- Demo context provider returns empty commerce fields until F-02.

### DDD correction

`src/behavior` is an observation context. `src/domain/shopping-signal.ts` is the shopping-intent language. See `context/foundation/domain.md`.

- `MetaEvent.quality.strength` is detector confidence. `ShoppingSignal.strength` is how strongly the session supports a shopping reading. They are different numbers.
- `comparison_oscillation` and `product_revisit` are not `decision_fatigue`. Decision fatigue needs similar product attributes (US-01).
- Do not add more UX detectors as a substitute for S-01.

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

- **Outcome:** (foundation) kupujący może filtrować i oglądać mock produkty AGD, a aplikacja rejestruje fakty katalogu (produkt, parametry, filtry, search, liczba wyników) w sesji. Fakty idą do istniejącego kolektora. Ten slice nie dokłada detektorów UX i nie klasyfikuje intencji.
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

### F-03: Mockowa oś czasu emocji w debug overlay

- **Outcome:** (foundation) zespół może demonstracyjnie oglądać 30-sekundową, zapętloną oś czasu 9 emocji z komentarzami zdarzeń w dev-only debug overlay. Dane pochodzą z mockowego endpointu i są odświeżane co sekundę; nie są jeszcze podłączone do backendowej inferencji.
- **Change ID:** emotion-overlay-chart
- **PRD refs:** FR-001
- **Unlocks:** —
- **Prerequisites:** F-01
- **Parallel with:** F-02, S-01
- **Blockers:** —
- **Unknowns:**
  - Mapowanie realnych sygnałów na emocje i kalibracja wartości — Owner: team. Block: no.
- **Risk:** Mock może sugerować gotową inferencję emocji, jeśli nie zostanie wyraźnie oznaczony jako demonstracyjny.
- **Status:** done

## Slices

### S-01: Silnik mocy sygnału

- **Outcome:** system klasyfikuje jeden `ShoppingSignalKind` (`brand`, `uncertainty`, `decision_fatigue`, `weak_budget`, `search_friction`) z faktów katalogu. Nie używa `MetaEvent.quality.strength` jako tej mocy.
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
| F-01 | app-scaffold | Scaffold web app for demo catalog | no | Done; patrz ## Done |
| F-02 | demo-catalog-events | Mock AGD catalog and catalog facts | no | F-01 done. Kolektor obserwacji już jest; slice dokłada fakty katalogu |
| F-03 | emotion-overlay-chart | Mock emotion timeline in debug overlay | no | Dev-only demonstrator; wymaga późniejszego podpięcia realnego backendu |
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

- **F-01** `app-scaffold` (2026-10-03) — Next.js App Router, trasy `/` i `/katalog`, sesja anonimowa. Zamknięte bez folderu change: hackathonowe nadgonienie, kod był już w repo.
