# board.md contract

Read this before every write to `context/foundation/board.md`. The drawing lives in `context/foundation/board.drawio`. This file is generated from that drawing plus an append-only journal. Do not invent a second format.

## File layout

```markdown
---
board: context/foundation/board.drawio
updated: YYYY-MM-DD
---

<lead paragraphs. Preserve them. Do not regenerate them.>

## Graph

Source: `context/foundation/board.drawio`

### <diagram id>

Page: <diagram name>

#### Nodes

| id | label |
| --- | --- |
| <cell id> | <label> |

#### Edges

| id | from | to | label |
| --- | --- | --- | --- |
| <cell id> | <source id> | <target id> | <label> |

#### View

A mermaid fence with `flowchart LR`. One line looks like `n_board["/board"] --> n_shape["/shape"]`.

## Journal

### B-001

- status: decision
- claim: <one sentence>
- because: <one sentence>
- covers: <diagram id>:<cell id>, <diagram id>:<cell id>
- supersedes:
- created: YYYY-MM-DD
```

`## Graph` through the line before `## Journal` is replaced on every run. Frontmatter `updated` is set to today. The lead above `## Graph` stays. `## Journal` stays, except a covered entry's `status` may change to `stale`.

## Reading `.drawio`

Accept only an uncompressed file: each `<diagram>` contains an `<mxGraphModel>`, and `compressed="false"` when the attribute is present. If a diagram body is base64 or the word `compressed` is not `false` on a non-XML body, stop. Tell the user to open the file in diagrams.net, turn off compression (File → Properties → Compressed), save, and run `/board` again. Do not decode compressed diagrams.

Ignore `mxCell` `id="0"` and `id="1"`. Every other cell with `vertex="1"` is a node. Every cell with `edge="1"` is an edge. `source` and `target` are the endpoints. One `<diagram>` is one page. Use the diagram element's `id` and `name`.

Label text is the cell's `value` after this normalization: decode `&amp;` `&lt;` `&gt;` `&quot;` `&apos;`, strip HTML tags, replace `<br>` with a space, collapse whitespace, trim. The table stores that text and nothing else. Position, size, and style are not recorded. A move on the canvas does not change the table.

Page order follows the file. Inside a page, nodes follow file order, then edges follow file order.

## Mermaid view

One `flowchart LR` per page, in a fence under `#### View`. Sanitize a cell id to `[A-Za-z0-9_]` by replacing every other character with `_`. If the result starts with a digit, prefix `n`. If two ids collide, append `_2`, `_3`, and so on. Put the label in double quotes and escape `"` as `#quot;`. An edge with an empty label is `A --> B`. An edge with a label is `A -->|label| B`. The view is derived from the tables. The tables win if Mermaid cannot show something.

## Covers and staleness

A cover token is `<diagram id>:<cell id>`. It may name a node or an edge.

Before replacing `## Graph`, read the current tables. After the new tables are known:

- An entry with `status: stale` stays stale.
- Any other entry becomes `stale` when a cover token is missing from the new graph, or when that cell's label differs from the previous table. Compare labels only. A missing previous graph (first transcription) does not mark entries stale.
- Changing `status` to `stale` is the only edit inside an existing entry.

A node is covered when at least one entry with a status other than `stale` lists it. Edges do not need their own entry. An edge listed in `covers` still goes stale when its label changes or it disappears.

## Journal entries

`status` is one of `decision`, `open`, `rejected`, `stale`.

`claim` and `because` are one line each, in the language of the labels on the board.

`supersedes` is empty or a single `B-NNN` id.

`created` is `YYYY-MM-DD`.

New ids continue from the highest `B-NNN`. Append the new entry at the end of `## Journal`. Do not rewrite older claims.

`decision`, `open`, and `rejected` all cover their tokens. `stale` does not.

## Empty drawing

A page with no nodes and no edges is an empty drawing. Do not invent nodes. Do not append a journal entry.
