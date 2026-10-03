# Odpowiedź z Jev albo z OpenAI — Implementation Plan

## Overview

W momencie decision fatigue kupujący dostaje jedną odpowiedź ułożoną na żywo. Jev, wołany kluczem Typesafe, klasyfikuje fakty katalogu tej sesji. Przy sytuacji `DECISION_FATIGUE`, pewności co najmniej 0,75 i bez wymaganego języka niepewności tekst pochodzi z tego wyjścia. Każde inne poprawne wyjście idzie do OpenAI, które układa jedno zdanie. Porażka chowa box.

## Current State Analysis

Box na listingu jest komponentem klienckim. Przy zmianie sesji katalogu woła `DecisionEngine` i od razu rysuje stały tytuł oraz zdanie. Pusty wynik wygrywa z decision fatigue i pokazuje propozycję wyczyszczenia filtrów. Decision fatigue wymaga trzech podobnych produktów i powrotu na listę.

Pipeline `data_processor/` buduje prompty do pliku `data/jev_prompts.jsonl` z meta eventów. Nic tego pliku nie wysyła do modelu. Aplikacja Next nie ma klienta LLM. `package.json` nie zawiera biblioteki AI. Jedyny route POST to `src/app/api/meta-events/route.ts` i przyjmuje obserwacje zachowania, nie propozycję asystenta.

Klucze modelu są w lokalnym środowisku serwera. Asystent nie czyta `src/behavior/`.

### Key Discoveries:

- Stały tekst decision fatigue powstaje w `src/lib/decision-engine.ts:33` i wraca z `DecisionEngine` w `src/lib/decision-engine.ts:178`.
- Box rysuje ten obiekt w `src/components/assistant/assistant-inline.tsx:37` i znika, gdy propozycja jest pusta (`src/components/assistant/assistant-inline.tsx:48`).
- Pusty wynik jest osobną gałęzią w `src/lib/decision-engine.ts:111`.
- Schemat próbnego wyjścia Jev, z polem `proposal.confidence` i `hedging_required`, stoi w `data_processor/prompt_builder.py:99`. To kontrakt sprawdzenia, nie ścieżka działania.
- Wzorzec route POST z walidacją Zod jest w `src/app/api/meta-events/route.ts:39`.
- Licznik w pamięci procesu, `InMemoryRateLimiter`, stoi w `src/server/meta-events/rate-limit.ts`. Route meta eventów woła go, zanim zrobi dalszą robotę (`src/app/api/meta-events/route.ts:43`). Domyślne 30 żądań na minutę jest na batche obserwacji, nie na model.

## Desired End State

Przy decision fatigue box albo pokazuje jedną odpowiedź modelu, albo nie pokazuje nic. Tekst skrótu pochodzi z Jev. Tekst poza skrótem pochodzi z OpenAI. Pusty wynik zostaje przy stałej propozycji S-03. Wyciszenie na 15 minut działa jak dziś. Wywołania Jev mają sufit: 30 na minutę z jednego IP i 10 na minutę w procesie. Po suficie box zostaje ukryty. Sprawdzenie: przejść trzy podobne produkty i wrócić na listę, oraz osobno doprowadzić do zera wyników.

## What We're NOT Doing

- Nie uruchamiamy `data_processor/` ani nie czytamy `data/jev_prompts.jsonl` w aplikacji.
- Nie wołamy modelu przy pustym wyniku.
- Nie karmimy asystenta meta eventami z `src/behavior/`.
- Nie dodajemy porównania kilku modeli, stanu ładowania ani zapisu odpowiedzi do bazy.
- Nie usuwamy plików PoC.
- Stałe zdanie decision fatigue nie jest zapasem przy błędzie.
- Nie stawiamy wspólnego licznika w Redis ani Upstash. Licznik Jev żyje w pamięci procesu i zeruje się przy zimnym starcie, tak jak limiter meta eventów.

## Implementation Approach

`DecisionEngine` zostaje bramką „czy to decision fatigue”. Dla tej gałęzi przeglądarka nie rysuje stałego zdania. Wysyła fakty katalogu na `POST /api/assistant-proposal`. Serwer, zanim złoży prompt, sprawdza limit wywołań Jev. Mieści się w progu: woła Typesafe z limitem 3 sekund i parsuje JSON. Skrót zwraca tekst Jev. Reszta poprawnych wyjść woła OpenAI bez limitu 3 sekund. Przekroczenie progu Jev chowa box i nie woła żadnego modelu. Klucze czyta tylko kod serwerowy.

Do fazy 2 poprawne wyjście poza skrótem kończy się ukryciem boxa. Faza 2 podstawia w to miejsce OpenAI.

## Critical Implementation Details

- Timing and lifecycle — box decision fatigue zostaje niewidoczny, dopóki nie wróci wygrywająca odpowiedź. Jev ma `AbortSignal` na 3 sekundy. OpenAI tego limitu nie dostaje. Przekroczenie limitu Jev, zły JSON i błąd sieci chowają box i nie wołają OpenAI.
- User experience — nie ma stanu ładowania. Link „Przejdź do filtrów” zostaje. Model podmienia tytuł i treść. Akcja porównania z wyjścia Jev nie dostaje własnego UI.
- State sequencing — każde nowe przeliczenie decision fatigue anuluje poprzednie żądanie. Odpowiedź ze starszego numeru jest ignorowana. Pusty wynik i brak sygnału nie startują żądania. Wyciszenie też nie.
- Spend — limit liczy próbę Jev w route, zanim wystartuje model. OpenAI nie ma osobnego licznika, bo startuje tylko po Jev, który już przeszedł próg.

## Phase 1: Bramka Jev

### Overview

Serwer przyjmuje fakty katalogu, sprawdza limit Jev, woła model, sprawdza schemat i w 3 sekundy zwraca albo tekst skrótu, albo polecenie schowania boxa. Gałąź OpenAI jeszcze nie woła drugiego modelu.

### Changes Required:

#### 1. Schemat i reguła

**File**: `src/server/assistant-proposal/schema.ts`

**Intent**: Jedno miejsce, które uznaje wyjście Jev za zdatne do routingu. Dzięki temu zły JSON nie staje się zdaniem na stronie.

**Contract**: Zod powtarza pola potrzebne do decyzji: `situation`, `proposal.confidence` od 0 do 1, `proposal.hedging_required`, `proposal.message_draft` jako string albo null. `situation` przyjmuje `DECISION_FATIGUE`, `PRODUCT_HESITATION`, `NO_PROGRESS_STALL`, `UI_FRICTION`, `SMOOTH_EXPLORATION`. Reszta obiektu może przejść, byle te pola były zgodne.

#### 2. Czysta decyzja

**File**: `src/server/assistant-proposal/route-decision.ts`

**Intent**: Reguła skrótu jest funkcją bez sieci, żeby test złapał progi bez klucza.

**Contract**: `routeJevOutput` zwraca `shortcut` albo `needs_openai`. `shortcut` wymaga naraz: `situation === "DECISION_FATIGUE"`, `proposal.confidence >= 0.75`, `proposal.hedging_required === false` i niepusty `message_draft`. Inaczej `needs_openai`.

```ts
situation === "DECISION_FATIGUE" &&
  proposal.confidence >= 0.75 &&
  proposal.hedging_required === false &&
  proposal.message_draft.trim().length > 0
```

#### 3. Klient Jev

**File**: `src/server/assistant-proposal/jev-client.ts`

**Intent**: Jedyny moduł, który zna żądanie Typesafe i czyta `TYPESAFE_API_KEY`. Reszta aplikacji widzi już sparsowane wyjście albo błąd.

**Contract**: `requestJev(prompt, signal)` zwraca nieznany JSON albo rzuca przy błędzie sieci, braku klucza i przerwaniu. Wołający przekazuje sygnał z limitem 3 sekund. Klucz nie dostaje prefiksu `NEXT_PUBLIC_`.

#### 4. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Intent**: Przeglądarka oddaje fakty sesji i dostaje jedną z dwóch odpowiedzi: pokaż tekst albo schowaj box.

**Contract**: `POST` przyjmuje `CatalogState` i listę `CatalogEvent` tego samego kształtu co `src/lib/catalog-types.ts`. Body nie ma identyfikatora sesji: katalog trzyma zdarzenia bez osobnego id, a `behavior.sessionId` nie wchodzi do tego route. Serwer sam czyta produkty z `src/lib/catalog-data.ts` i składa prompt po polsku: jedna propozycja, fakty oglądanych produktów, filtrów i kategorii. Nie wysyła meta eventów. Wynik HTTP to `{ status: "show", title, message }` albo `{ status: "hide" }`. `shortcut` zwraca `show` z `message_draft` jako `message`. `needs_openai`, zły schemat, brak klucza, błąd i przerwanie po 3 sekundach zwracają `hide`. Ta faza nie woła OpenAI.

Zanim route złoży prompt i zanim woła `requestJev`, sprawdza dwie instancje `InMemoryRateLimiter` trzymane w module tego route. To nie jest `DEFAULT_RATE_LIMIT`. Licznik rośnie w momencie przyjęcia żądania, także gdy poprzednie wywołanie Jev jeszcze trwa. Klucz IP liczy się tak samo jak w `extractClientKey` przy meta eventach: pierwszy adres z `x-forwarded-for`, potem `x-real-ip`, inaczej `anonymous`.

- Na IP: 30 wywołań Jev na 60 sekund. Próg jest luźny, żeby demo, podwójne odpalenie efektu i wspólne WiFi sali zostawiały box w spokoju. Dwie szybkie zmiany sesji z fazy 3 mieszczą się w nim swobodnie.
- Na proces: 10 wywołań Jev na 60 sekund, jeden wspólny klucz. To hamulec na pętlę w jednej instancji. W repozytorium nie ma cennika. Dziesięć żądań na minutę przez kilka minut zostaje poniżej 5 USD, dopóki jedno żądanie — sam Jev, a poza skrótem Jev i OpenAI — kosztuje do około 0,10 USD. Droższe wywołanie obniża ten sam próg.

Przekroczenie któregoś progu zwraca `{ status: "hide" }` i nie woła Jev.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` przechodzi dla reguły skrótu, odrzucenia schematu i mapowania porażki Jev na `hide`.
- `npm test` przechodzi dla limitu Jev: 31. żądanie z tego samego IP w ciągu 60 sekund oraz 11. żądanie w procesie w ciągu 60 sekund dają `hide` i nie wołają klienta Jev.
- `npm run typecheck` przechodzi.

#### Manual Verification:

- Żądanie, przy którym podmieniony klient Jev zwraca `DECISION_FATIGUE` z pewnością 0,75 i bez hedgingu, dostaje `show` i ten tekst.
- Pewność 0,74, hedging albo inna sytuacja daje `hide`.
- Niepoprawny JSON i przerwanie po 3 sekundach dają `hide`.

**Implementation Note**: After this phase's automated checks pass, pause for the human to confirm the manual checks before the next phase.

---

## Phase 2: Gałąź OpenAI

### Overview

Poprawne wyjście Jev poza skrótem idzie do OpenAI. Błąd OpenAI chowa box i nie oddaje szkicu Jev. Skrót nadal nie woła OpenAI.

### Changes Required:

#### 1. Klient OpenAI

**File**: `src/server/assistant-proposal/openai-client.ts`

**Intent**: Drugi model dostaje już sprawdzone wyjście Jev i oddaje jedno zdanie dla kupującego. Limit 3 sekund go nie dotyczy.

**Contract**: `requestStrongerReply(jevOutput)` czyta wyłącznie `OPENAI_API_KEY` i zwraca `{ title: string, message: string }` z niepustymi polami. Rzuca przy błędzie, pustej treści i braku klucza. Nie przyjmuje sygnału 3 sekund.

#### 2. Złożenie odpowiedzi

**File**: `src/server/assistant-proposal/compose.ts`

**Intent**: Route nie zna kolejności modeli. Jedna funkcja pilnuje, że OpenAI startuje tylko po poprawnym Jev i tylko poza skrótem.

**Contract**: `composeProposal` woła Jev, potem schema, potem `routeJevOutput`. `shortcut` zwraca `show` bez OpenAI. `needs_openai` woła OpenAI i przy sukcesie zwraca `show` z jego tytułem i treścią. Wyjątek OpenAI zwraca `hide`. W odpowiedzi `hide` nie ma `message_draft`.

#### 3. Route

**File**: `src/app/api/assistant-proposal/route.ts`

**Intent**: Odpowiedź HTTP zaczyna umieć pokazać zdanie z OpenAI.

**Contract**: Route woła `composeProposal` zamiast kończyć na decyzji Jev. Oba progi Jev zostają w route, przed `composeProposal`. Odrzucenie zwraca `hide` i nie woła ani Jev, ani OpenAI. Kształt `{ status: "show" | "hide" }` zostaje.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` przechodzi dla gałęzi: skrót nie woła OpenAI, wyjście poza skrótem woła, błąd OpenAI daje `hide` bez tekstu Jev.
- `npm run typecheck` przechodzi.

#### Manual Verification:

- Przy podmienionym Jev, który zwraca poprawną sytuację inną niż skrót, odpowiedź `show` ma tekst z OpenAI.
- Przy błędzie OpenAI odpowiedź to `hide` i nie zawiera szkicu Jev.

**Implementation Note**: After this phase's automated checks pass, pause for the human to confirm the manual checks before the next phase.

---

## Phase 3: Box

### Overview

Listing używa bramki tylko dla decision fatigue. Pusty wynik zostaje natychmiastową, stałą propozycją. Najnowsze przeliczenie wygrywa.

### Changes Required:

#### 1. Box

**File**: `src/components/assistant/assistant-inline.tsx`

**Intent**: Stałe zdanie decision fatigue przestaje być tym, co widzi kupujący. Reszta boxa, w tym wyciszenie, zostaje.

**Contract**: Gdy `DecisionEngine` zwróci `search_friction` albo `null`, zachowanie jest jak dziś i nie ma `fetch`. Gdy zwróci `decision_fatigue`, komponent nie wstawia jego `title` ani `message`. Startuje `POST /api/assistant-proposal` z aktualnymi faktami. `show` rysuje istniejący układ: tytuł, treść i link do filtrów z tą samą akcją `narrow-choice`. `hide` zostawia `proposal` puste. Przed startem żądania komponent podnosi numer i przerywa poprzedni `AbortController`. Po odpowiedzi rysuje wynik tylko wtedy, gdy numer nadal jest bieżący.

```ts
const current = ++requestId;
abortPrevious();
const result = await fetch("/api/assistant-proposal", { signal });
if (current !== requestId) return;
```

Wyciszenie nadal czyści box i nie startuje nowego żądania.

### Kryteria sukcesu

#### Automated Verification:

- `npm test` przechodzi dla selekcji: `search_friction` nie woła route, a starszy numer odpowiedzi nie rysuje boxa.
- `npm run typecheck` przechodzi.

#### Manual Verification:

- Trzy podobne produkty i powrót na listę pokazują jeden box z tekstem modelu i linkiem do filtrów.
- Zepsuty klucz Typesafe albo zły JSON nie pokazują boxa decision fatigue.
- Zero wyników nadal pokazuje stałą propozycję wyczyszczenia filtrów i nie woła modelu.
- Dwie szybkie zmiany sesji, obie w decision fatigue, zostawiają tekst z późniejszej.
- Zamknięcie boxa chowa podpowiedzi na 15 minut.

**Implementation Note**: After this phase's automated checks pass, pause for the human to confirm the manual checks before the next phase.

---

## Testing Strategy

### Unit Tests:

- Skrót przy 0,75 bez hedgingu i z tekstem.
- Brak skrótu przy 0,74, przy hedgingu, przy innej sytuacji i przy pustym `message_draft`.
- Zły JSON, błąd Jev i przerwanie dają `hide` oraz nie wołają OpenAI.
- 31. żądanie z tego samego IP w ciągu 60 sekund oraz 11. żądanie w procesie w ciągu 60 sekund dają `hide` i nie wołają klienta Jev.
- Błąd OpenAI daje `hide` bez treści Jev.
- `search_friction` nie buduje żądania. Starszy numer odpowiedzi jest ignorowany.

### Integration Tests:

- Jeden test route z podmienionymi klientami: sesja decision fatigue kończy się `show` albo `hide` zgodnie z fixture, bez sieci.

### Manual Testing Steps:

1. Wejść w kategorię, otworzyć trzy podobne produkty i wrócić na listę.
2. Sprawdzić, że box ma jedno zdanie i link do filtrów, albo że go nie ma, gdy model nie odpowie.
3. Ustawić filtry tak, by lista była pusta, i zobaczyć stałą propozycję czyszczenia.
4. Zamknąć box i potwierdzić ciszę przez kolejne przeliczenie.

## Performance Considerations

Jev ma twardy limit 3 sekund i po nim box zostaje ukryty. OpenAI czeka bez tego limitu, więc podpowiedź poza skrótem może wejść później. Każde nowe przeliczenie decision fatigue może być płatnym strzałem Jev. Route puszcza co najwyżej 30 takich strzałów na minutę z jednego IP i 10 na minutę w całym procesie. Po progu box zostaje ukryty, a żaden model nie startuje.

## Migration Notes

Gałąź pustego wyniku w `DecisionEngine` zostaje. Gałąź decision fatigue zostaje rozpoznaniem momentu, a jej stały tytuł i zdanie przestają być rysowane. Wyciszenie na 15 minut zostaje w `assistant-inline.tsx`.

## References

- Slice: `context/foundation/roadmap.md` S-04 `jev-session-proposal`
- Similar implementation: `src/lib/decision-engine.ts:104`
- Similar implementation: `src/components/assistant/assistant-inline.tsx:26`
- Schema source, not the runtime: `data_processor/prompt_builder.py:99`
- Route pattern: `src/app/api/meta-events/route.ts:39`
- Rate limit pattern: `src/server/meta-events/rate-limit.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bramka Jev

#### Automated

- [ ] 1.1 `npm test` przechodzi dla reguły skrótu, odrzucenia schematu i mapowania porażki Jev na `hide`
- [ ] 1.2 `npm test` przechodzi dla limitu Jev: 31. żądanie z tego samego IP w ciągu 60 sekund oraz 11. żądanie w procesie w ciągu 60 sekund dają `hide` i nie wołają klienta Jev
- [ ] 1.3 `npm run typecheck` przechodzi

#### Manual

- [ ] 1.4 Żądanie ze skrótem Jev dostaje `show` i tekst szkicu
- [ ] 1.5 Pewność 0,74, hedging albo inna sytuacja daje `hide`
- [ ] 1.6 Niepoprawny JSON i przerwanie po 3 sekundach dają `hide`

### Phase 2: Gałąź OpenAI

#### Automated

- [ ] 2.1 `npm test` przechodzi dla gałęzi OpenAI: skrót jej nie woła, wyjście poza skrótem woła, błąd daje `hide` bez tekstu Jev
- [ ] 2.2 `npm run typecheck` przechodzi

#### Manual

- [ ] 2.3 Wyjście Jev poza skrótem wraca jako `show` z tekstem OpenAI
- [ ] 2.4 Błąd OpenAI wraca jako `hide` i nie zawiera szkicu Jev

### Phase 3: Box

#### Automated

- [ ] 3.1 `npm test` przechodzi dla selekcji: `search_friction` nie woła route, a starszy numer odpowiedzi nie rysuje boxa
- [ ] 3.2 `npm run typecheck` przechodzi

#### Manual

- [ ] 3.3 Trzy podobne produkty i powrót na listę pokazują jeden box z tekstem modelu i linkiem do filtrów
- [ ] 3.4 Zepsuty klucz Typesafe albo zły JSON nie pokazują boxa decision fatigue
- [ ] 3.5 Zero wyników nadal pokazuje stałą propozycję wyczyszczenia filtrów
- [ ] 3.6 Dwie szybkie zmiany sesji zostawiają tekst z późniejszej
- [ ] 3.7 Zamknięcie boxa chowa podpowiedzi na 15 minut
