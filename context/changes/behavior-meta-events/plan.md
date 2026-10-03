# Plan: Behavior meta events

## Outcome
System zapisuje dodatkowe sygnaly zachowania: `sustained_product_interest`, `category_interest`, `filter_engagement`, `hesitation_dwell`, `rapid_scroll_burst` i `navigation_loop`.

## Phase 1: Instrumentacja DOM i raw signals
- Dodac stabilne `data-element-id` do filtrow i wierszy specyfikacji.
- Emitowac `filter_added` albo `filter_removed` z delegowanego listenera `change`, bez wysylania wartosci formularza.
- Emitowac `idle_started` i `idle_ended` na podstawie aktywnosci uzytkownika.
- Emitowac `scroll_burst` dla szybkich, duzych lub zmieniajacych kierunek serii scrolla.
- Dodac testy kolektora dla filtrow, idle i scroll burst.

### Automated verification
- `npm test -- tests/behavior/collector.navigation.test.ts tests/behavior/collector.dom-trackers.test.ts`
- `npm run typecheck`
- `npm run lint`

### Manual verification
- With `NEXT_PUBLIC_BEHAVIOR_TRACKING=true`, change a filter, stop interacting, and scroll quickly. Confirm raw events in the dev overlay, corresponding meta events (`filter_engagement`, `hesitation_dwell`, `rapid_scroll_burst`) and a successful `POST /api/meta-events`; no form values may appear in event payloads.

## Phase 2: Interest detectors
- Implement and register `sustained_product_interest`, `category_interest`, and `navigation_loop`.
- Add thresholds, allowlisted metrics, and focused detector tests.

## Phase 3: Interaction detectors
- Implement and register `filter_engagement`, `hesitation_dwell`, and `rapid_scroll_burst`.
- Add thresholds, allowlisted metrics, contract documentation, and focused detector tests.

## Progress
- [x] 1.1 Instrument DOM selectors and filter events
- [x] 1.2 Add idle and scroll burst raw events
- [x] 1.3 Add collector tests
- [x] 1.4 Run phase 1 automated verification
- [x] 1.5 Manual behavior verification
- [x] 2.1 Implement interest detectors
- [x] 3.1 Implement interaction detectors
