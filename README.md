# Asystent AI — intencje na bieżąco

Szkielet demo katalogu AGD. Asystent ma z intencji przeglądania proponować jeden następny krok. Sesja jest anonimowa.

Szkielet aplikacji jest uruchomiony. Obok niego działa pipeline obserwacji UI (`src/behavior/`, meta eventy). To nie jest klasyfikacja intencji zakupowej. Katalog mockowy, sygnały zakupowe (`src/domain/shopping-signal.ts`) i box asystenta nie są jeszcze zaimplementowane. Granica domeny: [context/foundation/domain.md](context/foundation/domain.md).

Reguły produktu: [context/foundation/prd.md](context/foundation/prd.md). Kolejność slice’ów: [context/foundation/roadmap.md](context/foundation/roadmap.md).

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja nasłuchuje na [http://localhost:3000](http://localhost:3000).

- `/` — opis szkieletu
- `/katalog` — pusta trasa demo katalogu

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Behavior tracking + baza danych

Klient zbiera surowe eventy wyłącznie w przeglądarce (pamięć + sessionStorage), analizuje je lokalnie i POST-uje do `/api/meta-events` tylko meta eventy (zobacz `src/behavior/` i `src/server/meta-events/`).

Konfiguracja przez środowisko (skopiuj `.env.example` do `.env.local`):

- `DATABASE_URL` — connection string PostgreSQL (Neon/Supabase/local). Wymagany przez `npm run db:migrate` i przez endpoint `/api/meta-events`.
- `NEXT_PUBLIC_BEHAVIOR_TRACKING` — `true` włącza tracker po stronie klienta; każda inna wartość (lub brak) całkowicie wyłącza mechanizm.

Migracja schematu:

```bash
npm run db:generate   # generuje SQL z src/lib/db/schema.ts do drizzle/
npm run db:migrate    # aplikuje migracje; wymaga ustawionego DATABASE_URL
```

Rozszerzanie systemu: [docs/adding-detector.md](docs/adding-detector.md) oraz [docs/adding-page-type.md](docs/adding-page-type.md).

## Tablica koncepcji

Edycja diagramu w https://app.diagrams.net/ → skill `/board` po update.
