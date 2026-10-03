---
name: grill-me
description: >
  Interview the user one question at a time about a plan or design until the
  decisions and their dependencies are resolved. Each question includes a
  recommended answer. Use when the user says /grill-me, "grill me", "grill
  this plan", "stress-test this design", "przepytaj mnie", or "przepytaj ten
  plan".
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Grill me

## Hard rules

1. **One question, then wait.** Several questions in one turn are bewildering.
2. **Every question carries your recommended answer.** Say it in the same turn, before they reply.
3. **Do not ask what the codebase can answer.** Read the repo and treat that as the answer. Ask only what the code cannot settle.
4. **Do not write a plan, edit code, or start another skill.** This interview ends when the open branches are settled.

## Loop

1. Pick the next unresolved decision that nothing else is waiting on.
2. If the repo can answer it, read the relevant files and record the answer. Do not ask.
3. Otherwise ask that one question. Lead with the recommendation and the reason, in a sentence or two. When the choice is a real set of options, use the host's structured question tool and mark the recommendation `(Recommended)`.
4. Wait. Fold the answer into the tree. A new dependency becomes the next question only after the decision it hangs on is closed.
5. When no branch is open, state the shared understanding: the decisions, in dependency order, each in one line. Ask them to confirm or correct it. Stop after they confirm.
