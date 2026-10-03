---
change_id: jev-session-proposal
title: Odpowiedź z Jev albo z OpenAI
status: implementing
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

Offline’owy generator promptów był tylko PoC. Serwer klasyfikuje ograniczone MetaEvents przez Jev (Typesafe), a każda znana sytuacja powyżej progu confidence przechodzi przez deterministyczny lokalny stub; prawdziwe OpenAI jest odroczone. S-05 wywołuje route od piątego MetaEvent. Deliverable tego change: `POST /api/assistant-proposal` + typy z `context/changes/assistant-proposal-box/interface.md`.

Wyświetlanie boxa wycięte do `assistant-proposal-box` (S-05, Michał).

Plan review 2026-10-03: SOUND (fazy 1–3 z UI). Po podziale scope 2026-10-03: fazy 1–2 serwer + kontrakt; przed implementacją warto krótki re-review zakresu.
