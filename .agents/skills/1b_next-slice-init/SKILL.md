---
name: next-slice-init
description: >
  Initialize a new change folder at context/changes/<change-id>/ with a
  change.md identity file. Helper, not a numbered step (1–7). Use when the
  user says /new, "start a change", "nowy change", or after a slice is
  marked active and needs a change folder. Does not write frame.md,
  research.md, or plan.md.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# /new

Create `context/changes/<change-id>/change.md` and point at the next command. One change is one folder: research, plan, implementation, and review live there.

## Hard rules

1. **Do not create `context/changes/`.** If that directory is missing, stop. The repo is not ready.
2. **Do not write** `frame.md`, `research.md`, `plan.md`, or a progress sidecar. `change.md` is a record. This skill does not move `status`.
3. **Stop on a bad id.** No folder, no file.

## Entry

No argument → print the block below and wait.

```
I'll create a new change folder. Please provide a change-id (kebab-case slug):

Examples:
  /new context-dir-restructure
  /new oauth-login add Google sign-in so users skip the email-password step
  /new @context/changes/oauth-login/

The first token becomes the change-id. Anything after it is freeform intent — used to write a richer title and to pick the next-step suggestion. Path-style references (with or without a leading `@`) are accepted; the last path segment is used as the change-id.

The change-id must be:
- kebab-case: starts with a lowercase letter; then only lowercase letters, digits, and single hyphens (no leading, trailing, or double hyphen)
- unique across `context/changes/` and `context/archive/`
```

An argument → parse, then validate.

## Parse

Split on the first whitespace.

- First token: strip a leading `@`, strip a trailing `/`, then if it still contains `/`, take the last non-empty segment. That is `<change-id>`.
- The rest is intent. It may be empty. It is not a title to paste verbatim.

| Raw input | `<change-id>` | Intent |
|---|---|---|
| `feature-x` | `feature-x` | (empty) |
| `oauth-login add Google sign-in for faster onboarding` | `oauth-login` | `add Google sign-in for faster onboarding` |
| `@context/changes/oauth-login/` | `oauth-login` | (empty) |
| `@context/changes/oauth-login/ revisit the token-refresh edge case` | `oauth-login` | `revisit the token-refresh edge case` |
| `My Feature add OAuth` | `My Feature` (fails kebab-case) | `add OAuth` |

## Validate

1. `<change-id>` matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. Else print `error: change-id "<id>" is not kebab-case. Start with a lowercase letter, then use lowercase letters, digits, and single hyphens only (e.g., "oauth-login", not "OAuth Login" or "2fa-login").` and stop.
2. Neither `context/changes/<change-id>/` nor `context/archive/<change-id>/` exists. Else print `error: change "<id>" already exists at <path>. Pick a different change-id or work inside the existing folder.` and stop.
3. `context/changes/` exists. Else print `error: context/changes/ not found — is this repo set up for the context structure?` and stop.

## Write

1. Create `context/changes/<change-id>/`.
2. Title, ≤ 80 characters, sentence case, no trailing period. Empty intent → hyphens to spaces, first letter capitalized (`multi-course-access` → `Multi course access`). Non-empty intent → a short title from that guidance. Do not paste a paragraph.
3. Notes. Empty intent → the hint comment in [references/change.md](references/change.md) and nothing else. Non-empty intent → the user's words verbatim. Do not add the hint in that case.
4. Write `context/changes/<change-id>/change.md` from [references/change.md](references/change.md). `created` and `updated` are today as `YYYY-MM-DD`.

## Next command

Default is `/plan <change-id>`.

Match in this order. `/research <change-id>` when the intent contains `how does`, `how do`, `where is`, `where are`, `research the codebase`, or `zbadaj` (triggers from `.agents/skills/2-research/SKILL.md`). Skip `/research` when the intent only asks to explain a file path it already names. Else `/frame <change-id>` when the intent contains a bug token (`fix`, `bug`, `broken`, `why is`, `root cause`, `regression`) or a scope token (`should we even`, `is this the right`, `what's actually broken`, `rethink`, `challenge the assumption`). Else `/plan <change-id>`.

Copy that command to the clipboard (`Set-Clipboard` on Windows; `pbcopy` or `xclip -selection clipboard` elsewhere). If no clipboard tool exists, omit the copied note.

```
✓ Created context/changes/<change-id>/change.md (status: new)

Next step:
  → <NEXT_CMD>  (✓ copied to clipboard)

Other options:
  /research <change-id>   — explore the codebase first (intent contains how does, where is, or zbadaj)
  /frame <change-id>      — challenge the framing first (when the symptom and proposed fix are stated as one, or when the right scope to plan is unclear)
```

Stop. Do not run the next command.
