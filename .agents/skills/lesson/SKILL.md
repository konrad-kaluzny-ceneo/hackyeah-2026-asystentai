---
name: lesson
description: >
  Append one recurring rule to context/foundation/lessons.md for later
  /frame, /research, /plan, /plan-review, /implement, and /impl-review runs.
  Use when the user says /lesson, "zapisz lekcję", "recurring rule", or
  "lesson learned", or when a class of bug is worth surfacing outside a
  review. Not for a one-off incident.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# /lesson

Append one entry to `context/foundation/lessons.md`. Future `/frame`, `/research`, `/plan`, `/plan-review`, `/implement`, and `/impl-review` runs read it as a prior. This is the proactive twin of "Record as lesson" in `/impl-review`.

A lesson is a recurring rule. Proceed only when the Problem names the same failure in two changes, or one past framing/fix plus where it applies again. One incident and no repeat → say this is the wrong skill and stop.

## Hard rules

1. **The user writes every field.** Pre-fill nothing. A freeform invocation is a suggestion next to the Rule prompt, not the saved text.
2. **One entry per invocation.** A second lesson is a second `/lesson`. Do not batch entries.
3. **Append-only.** Do not edit, reorder, deduplicate, or reformat existing entries. A revision is the user editing the file themselves.
4. **Create the file yourself.** Do not tell them to run `/init`. Create `context/foundation/` if it is missing.
5. **Stop after the echo.** Do not chain into another skill.

## How to ask

Use the host's structured question tool.

## Entry

A freeform description (`/lesson feature flags should always have a kill date`) seeds the Rule prompt. Then interview.

Nothing provided → print this and wait:

```
I'll record a recurring rule into context/foundation/lessons.md.

I'll ask four short questions and then append the entry. The four fields are:
  1. Context — where this rule applies (subsystem / phase / file pattern)
  2. Problem — what goes wrong without the rule
  3. Rule — the rule itself, in one or two sentences
  4. Applies to — which skills should weigh this most (frame / plan / implement / review)
```

## Interview

One round of four free-form prompts, or four turns. Each prompt's only option is "I'll fill it in", so the user types the answer. They write the wording.

- **Context** — subsystem, phase, or file pattern a later skill can match. "Any phase that adds a feature flag", not "everywhere".
- **Problem** — what goes wrong, in one or two sentences. Name the same failure in two changes, or one past framing/fix plus where it applies again.
- **Rule** — one or two imperative sentences in the form `Always …`, `Never …`, or `Before X, do Y`.
- **Applies to** — comma-separated: `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review`. Use `all` when it cuts across the lifecycle.

## Confirm

Show this block. The H2 is an imperative phrase of at most 8 words, taken from the Rule. Later skills scan the H2 list first.

```markdown
## <imperative title, ≤8 words>

- **Context**: <Context>
- **Problem**: <Problem>
- **Rule**: <Rule>
- **Applies to**: <Applies to>
```

Ask "Append this lesson to `context/foundation/lessons.md`?" Header: `Confirm`.

- "Append" — Save the entry as shown.
- "Edit" — Let me revise one or more fields before saving. Then show the block again and ask again.
- "Cancel" — Discard. Don't save anything. Stop.

## Append

Missing file → create it with this header, then the entry. The blank line after the quote is part of the header. `/impl-review` uses this same header.

```
# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /frame, /research, /plan, /plan-review, /implement, /impl-review.

```

Existing file → append at the end. Leave the rest untouched.

Re-read the file. The new H2 must be the last section. Then print:

```
Appended to context/foundation/lessons.md:
  ## <Rule title>
```

Stop.
