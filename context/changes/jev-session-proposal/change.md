---
change_id: jev-session-proposal
title: Odpowiedź z Jev albo z OpenAI
status: plan_reviewed
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

Offline’owy generator promptów był tylko PoC. Na stronie, w momencie decision fatigue, jedną odpowiedź układa Jev (Typesafe) albo OpenAI.

Plan review 2026-10-03: SOUND. Limit Jev zamknięty w planie: 30/min na IP, 10/min na proces, `InMemoryRateLimiter` w route, przekroczenie zwraca `hide` i nie woła modelu.
