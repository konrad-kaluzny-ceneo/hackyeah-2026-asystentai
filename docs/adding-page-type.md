# Adding a new page type

Page types are decided by the URL pathname via regex rules in
[src/behavior/config/page-types.ts](../src/behavior/config/page-types.ts).

## Steps

1. **Add the type name (if new)** — extend `PAGE_TYPES` in
   [src/behavior/types.ts](../src/behavior/types.ts). Pick a short lowercase
   name; this string flows into the database `page_type` column.

2. **Add the rule** — append to `PAGE_TYPE_RULES` in
   [src/behavior/config/page-types.ts](../src/behavior/config/page-types.ts):

   ```ts
   { type: "product", pattern: /^\/produkt(?:\/|$)/ },
   ```

   The **first** matching rule wins, so put more specific patterns above
   more general ones.

3. **Do not enable speculative routes** — only add patterns for routes that
   actually exist in `src/app/`. Otherwise every URL will classify as
   `unknown`. (The roadmap's F-02 will add `/katalog/produkt/[id]` etc;
   their rules belong to that slice, not before.)

4. **Test the rule** — extend
   [tests/behavior/page-classifier.test.ts](../tests/behavior/page-classifier.test.ts)
   with positive and negative cases. Pay attention to:
   - trailing slash handling,
   - first-match-wins (order your patterns deliberately),
   - boundary characters — `(?:\/|$)` after the prefix prevents `/catalogFoo`
     from matching `^\/catalog`.

5. **Verify the demo end-to-end** — open `/your-new-route` and check the
   `page_enter` raw event in the browser console (or `sessionStorage`'s
   `behavior.rawEvents.v1` key) has the expected `pageType`.

## When NOT to add a new page type

- The page is logically the same category as an existing one (e.g. a second
  checkout step — that's a funnel, not a new page type). Use
  `currentJourneyStage` or meta-event subjects to distinguish.
- You're guessing at future structure; rules without real routes rot.
