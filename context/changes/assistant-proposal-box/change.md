---
change_id: assistant-proposal-box
title: Box propozycji asystenta na listingu
status: implementing
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Notes

S-05 now triggers classification from the count of successfully sent MetaEvents rather than a browser-side fatigue decision: the first request starts at one event, then each new event retries while no proposal is visible. The server gates a deterministic demo proposal for any recognized Jev situation above 0.75.

Only validated MetaEvents are sent to Jev; raw events and catalog facts remain out of the proposal request. A local fixed-response stub replaces the unfinished OpenAI branch for this demo; a real OpenAI client remains future work. Local empty-search recovery and the one-proposal rule remain.

The revised implementation phase breakdown is in `plan.md`; the cross-slice API contract is documented in `interface.md`.
