---
change_id: assistant-proposal-box
title: Box propozycji asystenta na listingu
status: implementing
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

S-05 expanded to cover the end-to-end proposal flow: bounded MetaEvent history, MetaEvents-only request, Jev confidence gate, deterministic OpenAI stub, and existing single-box UI lifecycle.

Only validated MetaEvents are sent to Jev; raw events and catalog facts remain out of the proposal request. A local fixed-response stub replaces the unfinished OpenAI branch for this demo; a real OpenAI client remains future work.

The approved implementation phase breakdown is in `plan.md`; the cross-slice API contract is documented in `interface.md` and must be aligned during implementation.
