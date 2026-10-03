# Plan: Behavior meta events 2

## Outcome
System zapisuje trzy dodatkowe sygnaly: `price_focus`, `search_refinement_loop` i `assistant_proposal_dismissed`.

## Phase 1: Instrumentacja UI i raw search_submitted
- Tag `data-element-id="product-price"` na boxie ceny na stronie produktu.
- Tagi na boxie asystenta: `assistant-proposal`, `assistant-dismiss`, `assistant-action`.
- Raw `search_submitted` emitowany z submit formularza wyszukiwania (przez event window, analogicznie do CATALOG_PRODUCT_VIEW_EVENT, emitterem jest `updateQuery`; submit serwerowy dodatkowo).
- Tagi na przyciskach paginacji (`pagination-prev`/`pagination-next`) na wypadek przyszłych detektorow.

## Phase 2: Detektory
- `price_focus` — kumulacyjny dwell ≥ 3s ekspozycji boxa ceny w oknie 60s na stronie produktu. Metryki: `dwellMs`, `exposureCount`, `productId`.
- `search_refinement_loop` — ≥3 `search_submitted` w 90s. Metryki: `searchCount`, `windowMs`.
- `assistant_proposal_dismissed` — klik na `assistant-dismiss` w ciągu 60s. Metryki: `pageType`.
- Rejestracja, progi, cooldowny, allowlista.

## Verification
- Testy detektorow, pelny `npm test`, typecheck, lint.
- Ręcznie: filtry, search, dismiss boxa, dwell na cenie → meta eventy w overlay i POST.

## Progress
- [x] 1.1 Instrumentacja UI + raw search_submitted
- [x] 2.1 Detektory 3 meta eventow
- [x] 2.2 Testy i dokumentacja
- [x] 2.3 Walidacja pelna
- [ ] 2.4 Ręczna weryfikacja
