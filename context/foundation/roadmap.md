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
| F-03 | emotion-overlay-chart | (foundation) demonstracyjnie oglądać mockową oś czasu emocji w debug overlay | F-01 | FR-001 | done |
| S-01 | signal-strength-engine | … system klasyfikuje rodzaj intencji zakupowej z faktów katalogu | F-02 | FR-001, FR-002 | done |
| S-02 | decision-fatigue-box | … dostać jedną propozycję przy decision fatigue | S-01 | US-01, FR-007, FR-008, FR-009 | done |
| S-03 | empty-search-recovery | … dostać jedną propozycję recovery przy zerowych wynikach | S-01 | US-02, FR-005, FR-007 | done |
| S-04 | jev-session-proposal | … (serwer) dostać JSON z Jev i deterministycznego stubu dla każdej znanej sytuacji o wysokiej pewności | — | US-03, FR-010 | ready |
| S-05 | assistant-proposal-box | … (UI) wysłać bounded MetaEvents od pierwszego zdarzenia i zobaczyć box, gdy Jev rozpozna stan z wysoką pewnością | S-04 | US-01, FR-007, FR-010 | ready |
| S-06 | behavior-meta-events | … system zapisywał sześć dodatkowych meta eventów zainteresowania i dynamiki przeglądania | S-01 | FR-011 | done |
| S-07 | behavior-meta-events-2 | … system zapisywał zainteresowanie ceną, pętlę uściślania wyszukiwania i odrzucenie propozycji asystenta | S-06 | FR-012 | active |
| S-08 | intent-timeline | … zespół oglądał realne prawdopodobieństwa 8 intencji JEV per sesja w debug overlay | S-04 | FR-013 | done |

## Streams

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Sygnały → inferencja | `F-01` → `F-02` → `S-01` | Wspólna baza pod oba scenariusze użytkownika. |
| B | Decision fatigue | `S-02` | Gwiazda przewodnia; dołącza do Stream A po `S-01`. |
| C | Tarcie wyszukiwania | `S-03` | Równoległy z Stream B po `S-01`; ten sam box UX. |
| D | Treść propozycji | `S-04` → `S-05` | S-04: route + Jev + lokalny stub (prawdziwy OpenAI odroczony). S-05: box i ograniczona historia MetaEvents (Michał). |

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
- S-05 may pass a bounded snapshot of successfully dispatched MetaEvents into the proposal flow. Catalog facts remain `CatalogEvent` records in sessionStorage and are not sent to Jev.

### DDD correction

`src/behavior` is an observation context, not the shopping-signal domain. `DecisionEngine` still classifies catalog facts, but S-05 no longer uses its fatigue result to trigger a server request. After one successfully sent MetaEvent, the client sends a bounded MetaEvent summary to Jev; Jev classifies the situation on the server. The same accepted batch triggers the server-side intent snapshot flow used by the timeline. See `context/foundation/domain.md`.

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

### S-04: Odpowiedź z Jev albo z mocniejszego modelu (serwer)

- **Outcome:** `POST /api/assistant-proposal` przyjmuje 1–10 MetaEvents (body do 64 KiB) i zwraca `show` albo `hide`. Jev dostaje ich bezpieczne podsumowanie bez osobnego stanu katalogu, identyfikatorów sesji/eventu ani ścieżek; każda rozpoznana sytuacja z confidence `> 0.75` uruchamia stały lokalny stub. Confidence `0.75` lub niższe albo nieznana sytuacja zwraca `hide`. Prawdziwe OpenAI pozostaje przyszłą pracą.
- **Change ID:** jev-session-proposal
- **PRD refs:** US-03, FR-010
- **Prerequisites:** —
- **Parallel with:** S-05 (planowanie UI może iść równolegle; implementacja boxa po kontrakcie route)
- **Blockers:** —
- **Acceptance:**
  - Wyjście Jev jest sprawdzone schematem, zanim powstanie odpowiedź HTTP.
  - Każda ze znanych sytuacji Jev (`DECISION_FATIGUE`, `PRODUCT_HESITATION`, `NO_PROGRESS_STALL`, `UI_FRICTION`, `SMOOTH_EXPLORATION`) z confidence `> 0.75` zwraca stały wynik stubu; `0.75` i niżej albo nieznana sytuacja zwraca `hide`.
  - Żadna ścieżka tego demo nie wykonuje żądania do OpenAI.
  - Rate limit Jev; błędy → `hide`.
- **Unknowns:**
  - Adres HTTP Typesafe — Owner: team. Block: implementacja klienta Jev.
- **Risk:** Niewłaściwy próg może pokazać słabą propozycję; stub ma tekst demonstracyjny i nie jest prawdziwym generowaniem OpenAI.
- **Status:** ready

Source / Lineage:

- Added via `/roadmap-add` on 2026-10-03.
- Scope split 2026-10-03: UI → S-05. Lane: Edyta.

### S-05: Box propozycji na listingu (UI)

- **Outcome:** klient wysyła ostatnie MetaEvents do S-04 po zapisaniu pierwszego zdarzenia, a potem przy każdym nowym zdarzeniu, dopóki nie ma widocznej propozycji; UI nie podejmuje decyzji o fatigue. Serwer klasyfikuje sytuację przez Jev i pokazuje jeden box ze stałą odpowiedzią stubu dla każdej znanej sytuacji z confidence `> 0.75`; niższa pewność lub nieznana sytuacja ukrywa box. Pusty wynik nadal lokalnie ze S-03. Wyciszenie 15 min bez zmian. Bez loadera.
- **Change ID:** assistant-proposal-box
- **PRD refs:** US-01, FR-007, FR-010
- **Prerequisites:** S-04 (route zgodny z `interface.md`)
- **Parallel with:** —
- **Blockers:** —
- **Acceptance:**
  - Sukcesy `/api/meta-events` zasilają ograniczoną historię 10 MetaEvents; request assistant nie dostaje `CatalogState`, `CatalogEvent[]` ani raw events.
  - Pięć MetaEvents → pierwszy fetch; każde nowe zdarzenie ponawia klasyfikację, jeśli box jest ukryty; friction → lokalnie; abort + ochrona przed starymi odpowiedziami.
  - Jev dostaje minimalne podsumowanie MetaEvents; każda znana sytuacja z `> 0.75` → stub, `0.75` lub mniej albo nieznana → `hide`.
  - Manual: cztery zdarzenia bez requestu, piąte z requestem, retry po hide, znana nie-fatigue z wysoką pewnością, pusty wynik; zamknięcie boxa.
- **Unknowns:** —
- **Risk:** Wyścig odpowiedzi bez `requestId` pokaże starą treść.
- **Status:** ready

Source / Lineage:

- Wydzielone z planu S-04 2026-10-03. Lane: Michał.

### S-06: Meta eventy zainteresowania i dynamiki

- **Outcome:** system zapisuje sześć dodatkowych meta eventów opisujących zainteresowanie produktami i kategoriami oraz dynamikę przeglądania: `sustained_product_interest`, `category_interest`, `filter_engagement`, `hesitation_dwell`, `rapid_scroll_burst`, `navigation_loop`.
- **Change ID:** behavior-meta-events
- **PRD refs:** FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Acceptance:**
  - Kontrolki filtrów i wiersze tabeli specyfikacji mają stabilne `data-element-id`.
  - Raw eventy filtrów, idle i scroll burst nie zawierają wartości formularzy ani tekstu użytkownika.
  - Sześć detektorów jest zarejestrowanych z progami, allowlistą metryk i testami.
  - Dokument kontraktu opisuje sześć nowych typów meta eventów.
- **Unknowns:**
  - Kalibracja progów dwell, idle i burst na mock katalogu — Owner: team. Block: no.
- **Risk:** Mały mock katalog może zawyżać czułość detektorów. Mitigation: progi w `THRESHOLDS` i kalibracja na danych z debug overlay.
- **Status:** done

Source / Lineage:

- Added on 2026-10-03.
- Goal: meta eventy mają opisywać zarówno pozytywne zainteresowanie, jak i dynamikę przeglądania.
- Implemented: `7d9e7bc` (six detectors), `c877129` (close-out).

### S-07: Meta eventy ceny, wyszukiwania i odrzucenia propozycji

- **Outcome:** system zapisuje trzy kolejne meta eventy: `price_focus` (uwaga na cenie), `search_refinement_loop` (wielokrotne uściślanie wyszukiwania) i `assistant_proposal_dismissed` (jawne odrzucenie propozycji asystenta).
- **Change ID:** behavior-meta-events-2
- **PRD refs:** FR-012
- **Prerequisites:** S-06
- **Parallel with:** S-04
- **Blockers:** —
- **Acceptance:**
  - Box ceny na stronie produktu ma `data-element-id="product-price"`.
  - Box asystenta i jego kontrolki mają stabilne `data-element-id`.
  - Submit wyszukiwarki emituje raw `search_submitted` bez treści frazy.
  - Trzy detektory zarejestrowane z progami, allowlistą i testami; dokument kontraktu opisuje je.
- **Unknowns:**
  - Progi dwell dla `price_focus` na stronie produktu — kalibracja. Block: no.
- **Risk:** Asystent może być rzadko pokazywany na demo, więc `assistant_proposal_dismissed` będzie rzadki. Akceptowalne — to czysty feedback negatywny.
- **Status:** done

### S-08: Timeline intencji JEV per sesja

- **Outcome:** system zapisuje atomowe snapshoty ośmiu prawdopodobieństw intencji JEV per anonimowa sesja z timestampem, a `GET /api/emotions-timeline?sessionId=...` zwraca realną oś czasu z forward-fill ostatniego znanego stanu. Debug overlay pokazuje intencje zamiast mockowanych emocji.
- **Change ID:** intent-timeline
- **PRD refs:** FR-013
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-07
- **Blockers:** —
- **Acceptance:**
  - tabela `session_intent_snapshots` przechowuje osiem wartości `0..1`, model, wersję algorytmu i czas obliczenia;
  - klient JEV przekazuje maksymalnie 10 ostatnich bezpiecznych meta-eventów i wymaga wszystkich ośmiu probabilistyk;
  - endpoint dla poprawnego `sessionId` zwraca 8 serii i uzupełnia sekundy ostatnim stanem, bez mocka;
  - wykres odświeża dane co sekundę i pokazuje `jev` albo `empty`;
  - wywołanie bez `sessionId` zachowuje mock tylko dla kompatybilności dev-demo.
- **Unknowns:** częstotliwość triggera JEV i polityka retencji snapshotów — Owner: lane inferencji. Block: no.
- **Risk:** brak triggera oznacza pustą oś czasu; `source: "empty"` odróżnia ten stan od danych modelu.
- **Status:** done

Source / Lineage:

- Added on 2026-10-03 after merge of `feature/jev-session-proposal`.
- Trigger JEV runs after an accepted `/api/meta-events` batch and persists a validated snapshot before the timeline reads it.

Source / Lineage:

- Added on 2026-10-03.
- Goal: meta eventy opisują sygnały "blisko decyzji" i jawny feedback do asystenta.

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/plan` | Notes |
|---|---|---|---|---|
| F-01 | app-scaffold | Scaffold web app for demo catalog | no | Done; patrz ## Done |
| F-02 | demo-catalog-events | Mock AGD catalog and catalog facts | no | Done |
| F-03 | emotion-overlay-chart | Mock emotion timeline in debug overlay | no | Dev-only demonstrator; wymaga późniejszego podpięcia realnego backendu |
| S-01 | signal-strength-engine | Classify shopping signal strength | no | Done dla dwóch rodzajów; trzy nazwane bez klasyfikacji |
| S-02 | decision-fatigue-box | One assistant proposal on decision fatigue | no | Done |
| S-03 | empty-search-recovery | Filter recovery on empty search | no | Done |
| S-04 | jev-session-proposal | POST /api/assistant-proposal (Jev + local stub; OpenAI deferred) | yes | Lane: Edyta. Kontrakt: `assistant-proposal-box/interface.md`. |
| S-05 | assistant-proposal-box | Wire listing box to MetaEvents-only Jev proposal flow | yes | Lane: Michał. Po kontrakcie S-04. Plan w `context/changes/assistant-proposal-box/`. |
| S-06 | behavior-meta-events | Six new behavior meta events (interest + dynamics) | no | Done (`7d9e7bc`) |
| S-07 | behavior-meta-events-2 | Price focus, search refinement loop, proposal dismissed | yes | Tagi na cenie/boxie asystenta + raw search_submitted |
| S-08 | intent-timeline | Persist JEV intent probabilities and render session timeline | yes | Eight intents, forward-fill, same timeline URL; trigger is a separate lane. |

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
