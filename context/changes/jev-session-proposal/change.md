---
change_id: jev-session-proposal
title: Odpowiedź z Jev albo z OpenAI
status: implementing
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

Offline’owy generator promptów był tylko PoC. Dla decision fatigue serwer układa odpowiedź: typowana decyzja Jev ze skrótem lokalnego tekstu albo OpenAI. Deliverable tego change: `POST /api/assistant-proposal` + typy z `context/changes/assistant-proposal-box/interface.md`.

Wyświetlanie boxa wycięte do `assistant-proposal-box` (S-05, Michał).

Plan review 2026-10-03: SOUND (fazy 1–3 z UI). Po podziale scope 2026-10-03: fazy 1–2 serwer + kontrakt.

Adaptacja przed implementacją 2026-10-03: katalog runtime jest serwowany z Postgresa przez `src/lib/catalog-repository.ts`; nie ma `src/lib/catalog-data.ts`. Oficjalne API Jev przyjmuje typowane decyzje i nie generuje tekstu. Jev klasyfikuje sytuację i wybiera filtr, a pewny skrót składa lokalny polski tekst; niepewny wynik trafia do OpenAI w fazie 2.
