# Editor

The drawing is schemas and arrows in `context/foundation/board.drawio`. `/board` reads nodes, labels, and edges from that file and ignores position and style. Mermaid in `board.md` is a view of those tables, not a second source.

Use diagrams.net (draw.io): the Draw.io Integration extension in Cursor, or [app.diagrams.net](https://app.diagrams.net/) saving over the same path. Keep the file uncompressed (`compressed="false"`, raw `<mxGraphModel>`). If the body is base64, stop. Tell the user to open File → Properties, uncheck Compressed, save, and run `/board` again.

One person edits the file at a time, or the team shares one screen.

## Why not Obsidian

Obsidian would be a second application beside Cursor.

Obsidian Canvas (`.canvas`) is a sticky board. Each card stores pixel position. Flow schemas — orthogonal arrows, shape types, several pages — are weaker there. The team would also keep a vault beside the repo.

Obsidian mind-map plugins project Markdown headings. This board is not a tree.

Use Canvas only if the board becomes loose cards, or if several people must draw at once outside git. Until then, do not add a `.canvas` source.
