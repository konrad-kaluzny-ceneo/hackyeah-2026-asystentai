# Intencje JEV w osi czasu sesji — plan implementacji

## Zakres

- 8 intencji: `exploring`, `researching`, `comparing`, `deciding`, `ready_to_buy`, `price_sensitive`, `overloaded`, `hesitant`.
- Atomowe snapshoty JEV zapisywane per anonimowa sesja z timestampem.
- `GET /api/emotions-timeline?sessionId=...` czyta bazę i generuje siatkę co sekundę z forward-fill ostatniego znanego stanu.
- Debug overlay rysuje intencje zamiast emocji.
- Wywołanie JEV i trigger zapisu są dostarczane przez osobną lane.

## Progress

### Phase 1 — domena i schema DB

- [x] 1.1 Domena ośmiu intencji
- [x] 1.2 Tabela `session_intent_snapshots` i migracja

### Phase 2 — kontrakt zapisu i odczyt

- [x] 2.1 Walidacja snapshotu
- [x] 2.2 Serwis zapisu snapshotu
- [x] 2.3 Odczyt timeline z forward-fill

### Phase 3 — endpoint

- [x] 3.1 Realny response endpointu dla `sessionId`
- [x] 3.2 Obsługa braku identyfikatora i błędu bazy

### Phase 4 — wykres

- [x] 4.1 Typy i definicje intencji
- [x] 4.2 Polling z identyfikatorem sesji i renderowanie 8 serii

### Phase 5 — testy i dokumentacja

- [x] 5.1 Testy kontraktu, zapisu i forward-fill
- [x] 5.2 Test endpointu i wykresu
- [x] 5.3 Aktualizacja roadmapy, PRD i AGENTS.md
- [x] 5.4 Typecheck, lint, testy i build
