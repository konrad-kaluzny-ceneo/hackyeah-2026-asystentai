# Progress format

`## Progress` at the bottom of `plan.md` is the only execution state. No sidecar file.

- Phase blocks use plain `- ` bullets. No `[ ]` or `[x]` outside `## Progress`.
- Inside Progress: `- [ ]` pending, `- [x]` done. When a step lands, append ` — <commit sha>`. Do not rename the step title.
- One `### Phase N: <phase name>` per phase.
- `#### Automated` and `#### Manual`. Omit a subsection that has no items.
- Each Success Criteria bullet from that phase becomes `- [ ] <phase>.<index> <title>`, in the same order. Automated items first, then manual.

In `plan.md` the headings are **Kryteria sukcesu**, **Automated Verification**, and **Manual Verification**. Do not abbreviate them to `AC`. When a task is synced to Azure DevOps, map that section to **Kryteria ukończenia**.
