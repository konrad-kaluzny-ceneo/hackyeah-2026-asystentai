---
name: research
description: >
  Research the codebase with parallel read-only sub-agents and write
  context/changes/<change-id>/research.md. Use when the user says /research,
  "research the codebase", "how does X work in this repo", "zbadaj kod",
  or needs grounded findings before /plan. Skip when the question is already
  answered by a file the user named and they only want that file explained.
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania, pliki w `context/`). Nie tłumacz: kod, identyfikatory, ścieżki, commity w stylu repo. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Research

Answer a codebase question with parallel read-only sub-agents, then write one `research.md`. The main agent synthesizes. Sub-agents read.

## Hard rules

1. **Read files the user named yourself, fully, before any sub-agent.**
2. **Wait for every sub-agent before synthesizing.** Live code outranks `context/changes/**/` and `context/archive/**/`. Those folders are history.
3. **No placeholder values** in `research.md`. Gather git metadata first.
4. **One research file per change.** Follow-ups append to it.
5. **An archived change is refused.** If the resolved path is under `context/archive/`, print `This change is archived. Open a new change with /new instead.` and stop.
6. **Do not invent a researcher name.** Use `git config user.name`, or `unknown`.

## Entry

No question yet → print the block below and wait.

```
Gotowy do researchu. Podaj pytanie albo `/research <change-id>`.
```

A question, or `/research <change-id>`, → step 1.

## 1. Read first

Read every file the user named, fully. If `context/foundation/lessons.md` exists, read it and treat its rules as already accepted. Do not re-investigate a pattern the lesson already settles unless the question asks for it.

## 2. Split the question

Turn the query into 2–4 areas. Each area names the directories, symbols, or prior-change folders to search. If the host has a task list, one task per area, marked done as that area returns. No task list → continue without one.

## 3. Align scope

Skip this step when the query is already tight (one behavior, one symbol, one directory).

Otherwise ask 1–3 questions with the host's structured question tool. Each question has 2–4 concrete options. Headers stay short: Scope, Depth, Focus.

Ask only what the query leaves open:

- Scope — this feature only, or the systems it touches
- Depth — overview vs the architecture, edge cases, and security
- Focus — structure, integration boundaries, or history in `context/changes/**/` and `context/archive/**/`
- Output — short summary vs the full research document

Example for "how does authentication work": depth (overview / detailed analysis / I will narrow the question) and focus (structure / integration / history). A query like "find every caller of TaskCreate" skips this step.

## 4. Spawn

In one message, spawn 2–4 sub-agents:

- **Explore** — find files, trace a path, search a pattern
- **general-purpose** — read many files and explain a system

Each prompt is one area, read-only, and requires `file:line` plus how the code is used, not only where it is defined. Typical split: one search for the live code, one search of prior decisions under `context/changes/**/` and `context/archive/**/`, one analysis of how the system fits together.

## 5. Synthesize

Wait until every sub-agent has returned. Connect the findings. Prefer the current tree. Cite `file:line` for each claim.

## 6. Choose the change folder

- `/research <change-id>` and `context/changes/<change-id>/` exists → use it.
- Otherwise derive a kebab-case id from the topic (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`). If `context/changes/<id>/` or `context/archive/<id>/` already exists, pick a free id. Create the folder and `change.md` the way `/new` does (`status: new`, title from the topic, notes = the question).
- Path under `context/archive/` → the refusal in the hard rules. Stop.

Then set `updated` to today. If `status` is `new`, set it to `preparing`. Do not change any other status.

The artifact path is `context/changes/<change-id>/research.md`.

## 7. Write

Read [references/research-doc.md](references/research-doc.md) and write that document. Run its metadata commands first. Apply its permalink rule after the draft exists.

## 8. Present

Give the path `context/changes/<change-id>/research.md` and the `file:line` citations required in section 5. Then ask whether they want a follow-up.

## 9. Follow-up

On a follow-up, append to the same `research.md` using the follow-up block in `references/research-doc.md`. Spawn more sub-agents only for the new question. Then present again.
