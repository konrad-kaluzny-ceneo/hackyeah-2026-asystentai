---
project: "Asystent AI na bieżąco analizujący intencje użytkownika i proponujący dalsze działania"
version: 1
status: draft
created: 2026-10-03
product_type: "# TODO: product_type — see Open Questions"
target_scale:
  users: "# TODO: target_scale.users — see Open Questions"
  qps: "# TODO: target_scale.qps — see Open Questions"
  data_volume: "# TODO: target_scale.data_volume — see Open Questions"
timeline_budget:
  mvp_weeks: "# TODO: timeline_budget.mvp_weeks — see Open Questions"
  hard_deadline: "# TODO: timeline_budget.hard_deadline — see Open Questions"
  after_hours_only: "# TODO: timeline_budget.after_hours_only — see Open Questions"
---

# Asystent AI na bieżąco analizujący intencje użytkownika i proponujący dalsze działania

## Vision & Problem Statement

People shopping online for appliances can experience decision fatigue when comparing similar products or trying to work out which parameters matter. The board identifies repeated filter changes, empty search results, site errors, browsing products with varying parameters, and abandoned or reversed steps as signs of friction that can interfere with completing a purchase.

The assistant is intended to analyze shopping activity as it happens and suggest a next action suited to the shopper's inferred intent. The board does not yet state what current shopping experiences miss or quantify the resulting customer cost.
# TODO: State the distinguishing insight and the concrete cost to shoppers today — see Open Questions.

## User & Persona

Primary persona: a person shopping for appliances through an online product catalog. They browse categories, search, change filters, view product pages, and may add a product to their cart.
# TODO: Specify which shopper segment or retail context the MVP serves first — see Open Questions.

## Success Criteria

### Primary
- Candidate outcome: fewer abandoned product-shopping journeys.
# TODO: Confirm the primary outcome and define its baseline, target, and measurement window — see Open Questions.

### Secondary
- Candidate outcomes: higher basket value and more return visits.
# TODO: Confirm which outcomes are secondary and define how each is measured — see Open Questions.

### Guardrails
- Show at most one suggestion at a time.
- Prioritize help with an active cart over new inspiration.
- Do not present a weakly supported inference as certain.
- Remember a shopper's dismissal for a period, avoid asking for the same information repeatedly, and let the shopper correct an assumption.
# TODO: Set measurable acceptance criteria, including the dismissal period and tolerance for repeated questions — see Open Questions.

## User Stories

### US-01: Shopper receives a relevant next action

- **Given** an appliance shopper has searched, changed filters, viewed products, or added an item to a cart
- **When** their activity supports an inference about purchase intent, advice needs, preferences, or friction
- **Then** the assistant presents at most one next action that reflects the strength of the observed signals

#### Acceptance Criteria
- Browsing products with similar parameters may indicate decision fatigue; browsing products with varying parameters may indicate uncertainty.
- A brand search is treated as a stronger signal about brand preference than a category view is about budget.
- Help with an active cart takes priority over new inspiration.
- A weak signal is not presented as certain.
- Dismissing the assistant suppresses further suggestions for a defined period.
# TODO: Confirm the MVP scenarios, thresholds for acting on an inference, and the dismissal period — see Open Questions.

## Functional Requirements

### Intent and shopper state
- FR-001: AI assistant can infer shopping intent from viewed categories, on-site searches, filters, product pages, and cart additions. Priority: TBD
- FR-002: Assistant can distinguish signal strengths, including a brand search as a strong brand signal, varied product parameters as possible uncertainty, similar parameters as possible decision fatigue, and an appliance category as a weak budget signal. Priority: TBD
- FR-003: Assistant can infer a need for advice from opened descriptions, questions to the assistant, and browsing products with varied parameters. Priority: TBD
- FR-004: Assistant can infer shopper constraints and preferences from filters and viewed products, including budget, dimensions, installation style, brand, energy efficiency, and color. Priority: TBD
- FR-005: Assistant can detect shopping friction from empty search results, repeated filter changes, site errors, abandoned steps, and backtracking. Priority: TBD
- FR-006: Assistant can use session and purchase history and account age as possible signals of the shopper's relationship stage. Priority: TBD

### Suggested actions and experience
- FR-007: Assistant can offer contextual advice, product recommendations, model comparisons, clarifying questions, filter navigation or recovery, and relevant cross-selling. Priority: TBD
- FR-008: Assistant can present hidden, discreet invitation, contextual advice, recommendation, comparison, clarification, navigation, filter recovery, cross-selling, muted, and loading states. Priority: TBD
- FR-009: Assistant can offer at most one proposal at a time, prioritize cart help over new inspiration, respect dismissal, avoid repeated questions, allow corrections, and communicate uncertainty when signals are weak. Priority: TBD
# TODO: Assign each candidate FR a must-have or nice-to-have priority before defining the MVP — see Open Questions.

## Non-Functional Requirements

- A shopper sees no more than one suggestion at a time.
- A suggestion's certainty reflects the strength of the evidence available to the shopper-facing experience.
- After a shopper dismisses suggestions, the assistant remains quiet for a defined period.
- A shopper can correct an inferred assumption, and the assistant does not repeatedly request the same information.
# TODO: Define measurable targets for these behaviors and any other user-observable quality requirements — see Open Questions.

## Business Logic

An appliance-shopping intervention presents at most one next action at a time, prioritizes help with an active cart over new inspiration, and expresses certainty in proportion to the strength of the shopper's observed signals.

Signals named in the board include category views, searches, filter changes, product views, cart additions, descriptions opened, questions asked, and session or purchase history. Examples distinguish a strong brand-search signal, medium signals for uncertainty or decision fatigue, and a weak budget signal from a category view.

# TODO: Define how each inferred state maps to a suggestion and when the evidence is strong enough to act — see Open Questions.

## Access Control

# TODO: Define whether shoppers need accounts, what activity is available without an account, and any roles or access limits — see Open Questions.

## Non-Goals

# TODO: Define which capabilities and quality targets are explicitly out of scope for the MVP, including the assistant's action boundary — see Open Questions.

## Open Questions

1. **What product type is this?** — Owner: user.
2. **What target scale should the PRD assume for users, request volume, and data volume?** — Owner: user.
3. **How many weeks are available for the MVP, is there a hard deadline, and is this after-hours work?** — Owner: user.
4. **Which of fewer abandoned journeys, higher basket value, and more return visits is primary or secondary, and what are the baseline, target, and measurement window?** — Owner: user.
5. **Which shopper segment or retail context should the MVP serve first?** — Owner: user.
6. **What do current shopping experiences miss, and what concrete cost does decision fatigue create for shoppers today?** — Owner: user.
7. **Which candidate functional requirements are must-have and which are nice-to-have?** — Owner: user.
8. **What rules map inferred intent or friction to a suggestion, and what evidence is sufficient to show or interrupt the shopper?** — Owner: user.
9. **Which signals are actually available and permitted, including filters, viewed products, cart activity, session history, purchase history, and account age?** — Owner: user.
10. **What personalization can a shopper control, and which signals can it use?** — Owner: user.
11. **May the assistant only suggest actions, or may it also assemble a product set, add items to a cart, or contact customer support?** — Owner: user.
12. **What account, authentication, and access rules apply to shoppers and their activity data?** — Owner: user.
13. **What measurable targets should apply to suggestion timing, dismissal, repeated questions, uncertainty, and correction of assumptions?** — Owner: user.
14. **Which capabilities and quality dimensions are explicitly out of scope for the MVP?** — Owner: user.
