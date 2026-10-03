---
name: board
description: >
  Sync the diagrams.net drawing context/foundation/board.drawio into
  context/foundation/board.md. Regenerates the graph and writes the journal
  from the drawing in the same turn. Asks only when a fragment has two
  readings the file does not settle. Use when the user says /board,
  "tablica", "zaktualizuj tablicę", "wnioski z tablicy", or "board".
default-language: pl
---

## Język

Domyślny język: **polski** (komunikacja z użytkownikiem, pytania, podsumowania). Treść `claim` i `because` jest w języku etykiet na tablicy. Nie tłumacz: kod, identyfikatory, ścieżki, nazwy skilli, statusy wpisu. Gdy użytkownik pisze po angielsku — odpowiadaj po angielsku.

# Board

Read [board-schema.md](references/board-schema.md) before every write. Editor and compression: [editor.md](references/editor.md). Filled example: `context/foundation/board.drawio` and `context/foundation/board.md`.

Drawing: `context/foundation/board.drawio`. Contract: `context/foundation/board.md`. Edit both in place. Do not run `/shape`, `/prd`, or any other skill.

## Hard rules

1. Do not edit the drawing except to copy [empty-board.drawio](references/empty-board.drawio) when the file is missing.
2. One drawing and one journal. No second path and no dated copy.
3. Regenerate `## Graph`. Append journal entries. The only edit to an existing entry is `status: stale`.
4. In this turn, append every entry the drawing states. Do not stop after the first flow, and do not ask the user to confirm a flow, a status, or a cluster.
5. Ask only when the file leaves two readings and either reading would change the sentence. One turn may ask several such questions. Write nothing for a fragment you asked about.
6. Do not require a notation (C4, event storming, colors, shape types).
7. A compressed drawing stops the run. Do not read cell text from a screenshot or from base64.

## Entry

1. Both files missing → copy the empty template to `context/foundation/board.drawio`. Write `board.md` with today's date, the lead below, an empty graph for page `tablica`, and `## Journal` with no entries. Tell the user to draw and run `/board` again. Stop.

```markdown
# Tablica

Żywy schemat projektu. Źródłem rysunku jest `board.drawio`. Ten plik jest z niego wygenerowany.
```

2. Drawing missing, `board.md` present → stop. Do not rebuild the drawing from the journal.
3. Otherwise read both files and run the loop.

## Loop

1. Parse the drawing with the schema.
2. No nodes and no edges → rewrite the graph, leave the journal, ask the user to draw, and stop.
3. Mark stale entries from the previous tables, then rewrite `## Graph` and set `updated` to today.
4. Write the journal from the new graph. Stale replacements first (oldest `created`, then lowest id), then uncovered fragments in file order of the seed node.
5. A fragment with two live readings stays out of the journal. After the certain entries are saved, ask those questions and stop.
6. Nothing left to write and nothing uncertain → say the journal covers the board and stop.

## What to write

The drawing is the decision. Write the sentence a reader of the labels and arrows would write. Use only words supported by those labels and arrows. `because` is the arrow or the neighboring label that makes the claim true. Do not add a user, a cause, or a consequence that no label states.

Group nodes into the smallest set that makes one sentence true. Start from an uncovered node. Add a neighbor when that arrow belongs in the same sentence. Several sentences are several entries. A connected page is not one entry by default.

Status comes from the drawing:

- The labels and arrows state the current design → `decision`. A plain schema is a decision.
- The label is a question, or the cell says the point is unresolved → `open`.
- The drawing rejects the fragment (strike-through, „nie”, „odrzucone”) → `rejected`.

**Stale.** When the new cells still support one sentence, append a new entry and set `supersedes` to the stale id. Drop cells that no longer exist. When every covered cell is gone, the claim says the fragment was removed.

**Uncovered.** Leave `supersedes` empty.

These are determined, so write them:

- An unlabeled arrow. The sentence is that the source leads to the target, in the words of the two labels.
- A page of boxes and arrows that already names the steps.
- A box that is not phrased as a question. Status is `decision`.
- Spelling that is readable. Copy the label.

## When to ask

Ask when one of these is true:

- A label is empty, or after normalization it has no words.
- An edge has no `source` or `target`, or the endpoint is not a node.
- Two labels or two arrows on the same fragment contradict each other (`tak` and `nie` on the same pair), and nothing else on the board settles which one stands.
- A stale entry's cells changed into two different sentences, and the file does not show which one replaces the old claim.
- The sentence would require a fact that is not in a label or an edge.

The question names the cell ids, states the two readings, and asks which one is true. Use the structured question tool. Several uncertain fragments go in one form. Do not add options for status, width, or postponing.

## After an answer

Append the entries that the answer settles. Leave any fragment the answer does not settle unwritten. Do not ask again about an entry already saved. If the drawing changed since the question, parse it again before writing.
