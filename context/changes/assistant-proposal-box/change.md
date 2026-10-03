---
change_id: assistant-proposal-box
title: Box propozycji asystenta na listingu
status: implementing
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

S-05 covers the end-to-end proposal flow: bounded MetaEvent history, MetaEvents-only request, Jev/OpenAI decision composition, and the existing single-box UI lifecycle.

Requests start at the first unique successfully dispatched MetaEvent and queue once per new event until a proposal is visible or the assistant is muted.

Only validated MetaEvents are sent to the server; Jev receives a minimized summary without raw events, session/event identifiers, or paths. The server returns only action/data; presentation copy remains local to the UI. A confident, unhedged Jev result may use the shortcut, while other valid outputs use OpenAI.

The approved implementation phase breakdown is in `plan.md`; the cross-slice API contract is documented in `interface.md` and must be aligned during implementation.
