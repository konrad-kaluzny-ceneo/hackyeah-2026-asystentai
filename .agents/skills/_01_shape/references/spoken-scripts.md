# Spoken scripts

Print the named script verbatim when a step says so. Fill only the bracketed slots.

## Oversized MVP

```
This first version is bigger than what typically ships in three weeks of
after-hours work. The trap is shipping nothing because the first
version was too big to finish. Two valid paths from here:

  Scope down — keep the timeline tight. Common moves:
    - Drop the [identified expensive piece] for v1; add it in v2 once anything works.
    - Replace [identified integration] with a manual / hardcoded version for now.
    - Cut the user count to one (yourself) for v1.

  Commit to the longer timeline — own the cost. A multi-week MVP is doable, but
  it requires sustained dedication, hard work over a stretch of evenings or
  weekends, and tolerance for periods where progress feels invisible. Most
  new projects that exceed their first estimate die not from the work
  itself but from the gap between expected and actual effort.
```

## Empty CRUD

```
What you've described is a CRUD list — and that's a known
anti-pattern. CRUD without a domain decision means the app provides no value
the user couldn't get from a spreadsheet or a notes file. The product is
hollow.

A real domain rule answers "what does the application decide for the user?".
Common shapes:

  - Recommendation:  app suggests items based on user state
  - Prioritization:  app orders items by an inferred urgency / importance
  - Classification:  app tags items by category / sentiment / quality
  - Validation:      app checks items against a domain rule and flags problems
  - Scoring:         app rates items so the user can compare them
  - Workflow:        app moves items through states with transition rules
  - Calculation:     app computes a value from inputs the user supplies

What rule does YOUR app apply?
```
