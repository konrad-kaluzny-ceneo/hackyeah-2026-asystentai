# Asystent AI — intencje na bieżąco

<<<<<<< HEAD
Demo katalogu AGD z lodówkami, pralkami i zmywarkami. Katalog jest
odczytywany z PostgreSQL, a asystent w sesji anonimowej może zaproponować
pojedynczy następny krok na podstawie lokalnej historii przeglądania.
=======
Demo katalogu AGD. Asystent proponuje co najwyżej jeden następny krok z faktów przeglądania. Sesja jest anonimowa.

Katalog jest na `/`, `/katalog`, `/katalog/[kategoria]` i `/produkt/[slug]`. Fakty sesji klasyfikuje `DecisionEngine`. Pipeline `src/behavior/` zapisuje osobne obserwacje UI i nie zasila asystenta. Granica domeny: [context/foundation/domain.md](context/foundation/domain.md).
>>>>>>> origin/main

Reguły produktu: [context/foundation/prd.md](context/foundation/prd.md). Kolejność slice’ów: [context/foundation/roadmap.md](context/foundation/roadmap.md).

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja nasłuchuje na [http://localhost:3000](http://localhost:3000).

<<<<<<< HEAD
- `/` — strona główna
- `/katalog` — kategorie i globalne wyniki wyszukiwania
- `/katalog/[categorySlug]` — listing z filtrami i paginacją
- `/produkt/[productSlug]` — szczegóły i rekomendacje produktu
=======
- `/` — wejście do katalogu
- `/katalog` — kategorie, a z parametrem `q` lista wyników
- `/katalog/[kategoria]` — lista, filtry i podpowiedź asystenta
- `/produkt/[slug]` — karta produktu
>>>>>>> origin/main

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Katalog i behavior tracking

Katalog w środowisku runtime czyta wyłącznie PostgreSQL. Pliki
`data/categories.json` i `data/products.json` są wejściem do powtarzalnego
seedowania i nie służą jako fallback, gdy baza jest niedostępna.

Skonfiguruj dwa connection stringi w `.env.local`:

- `DATABASE_URL` — PostgreSQL transaction pooler dla runtime aplikacji (na Supabase URL z sekcji **Connect**, zwykle port `6543`).
- `MIGRATION_DATABASE_URL` — bezpośredni URL PostgreSQL dla migracji i seedowania (na Supabase port `5432`; użyj session poolera, jeśli połączenie bezpośrednie jest niedostępne z sieci).

Utwórz lub zaktualizuj schemat i załaduj katalog:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Seed najpierw waliduje oba pliki JSON, a następnie zapisuje kategorie, marki i
produkty w jednej transakcji. Można uruchamiać go ponownie; istniejące rekordy
są aktualizowane.

## Behavior tracking

Klient zbiera surowe eventy wyłącznie w przeglądarce (pamięć + sessionStorage), analizuje je lokalnie i POST-uje do `/api/meta-events` tylko meta eventy (zobacz `src/behavior/` i `src/server/meta-events/`).

Konfiguracja przez środowisko (skopiuj `.env.example` do `.env.local`):

- `DATABASE_URL` jest używany przez katalog runtime i endpoint `/api/meta-events`.
- `NEXT_PUBLIC_BEHAVIOR_TRACKING` — `true` włącza tracker po stronie klienta; każda inna wartość (lub brak) całkowicie wyłącza mechanizm.

Migracja schematu:

```bash
npm run db:generate   # generuje SQL z src/lib/db/schema.ts do drizzle/
npm run db:migrate    # aplikuje migracje; wymaga MIGRATION_DATABASE_URL
```

Rozszerzanie systemu: [docs/adding-detector.md](docs/adding-detector.md) oraz [docs/adding-page-type.md](docs/adding-page-type.md).

## Tablica koncepcji

Edycja diagramu w https://app.diagrams.net/ → skill `/board` po update.
