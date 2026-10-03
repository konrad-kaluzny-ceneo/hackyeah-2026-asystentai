# research.md contract

Read this when writing or appending `context/changes/<change-id>/research.md`. Section headings stay in English. Prose under them follows the skill's language rule. Do not leave placeholder tokens.

## New document

```markdown
---
date: <ISO-8601 with timezone>
researcher: <git config user.name, or unknown>
git_commit: <full HEAD hash>
branch: <current branch>
repository: <repo name>
topic: "<user question>"
tags: [research, codebase, <component-names>]
status: complete
last_updated: <YYYY-MM-DD>
last_updated_by: <same as researcher>
---

# Research: <user question>

**Date**: <same as date>
**Researcher**: <same as researcher>
**Git Commit**: <same as git_commit>
**Branch**: <same as branch>
**Repository**: <same as repository>

## Research Question

<original user query>

## Summary

<findings that answer the question>

## Detailed Findings

### <Component or area>

- Finding with reference ([file.ext:line](link))
- Connection to other components
- Implementation detail

## Code References

- `path/to/file.py:123` - What is there
- `another/file.ts:45-67` - What the block does

## Architecture Insights

<patterns, conventions, and design decisions>

## Historical Context (from prior changes)

<insights from context/changes/**/ and context/archive/**/>

- `context/changes/<other-change>/plan.md` - Decision about X
- `context/archive/YYYY-MM-DD-<other-change>/research.md` - Earlier look at Y

## Related Research

<links to other research.md files under context/changes/ or context/archive/>

## Open Questions

<what this pass did not resolve>
```

Metadata commands, run in the repo:

- `git rev-parse HEAD`
- `git branch --show-current`
- `git config user.name` — if empty, `unknown`. Do not invent a name.
- `gh repo view --json name -q .name` — if that fails, the git toplevel directory name.

`date` is the current local time as ISO-8601 with a timezone offset. `last_updated` is `YYYY-MM-DD`.

## Permalinks

After the draft exists, if the branch is `main` or `master`, or `git status` shows this commit is already on the upstream (not ahead), replace local file references with:

`https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`

Owner and repo: `gh repo view --json owner,name`. Skip permalinks when the commit is not on the remote. Leave the local `path:line` form.

## Follow-up

Append to the same file. Do not create a second research file.

- Set `last_updated` and `last_updated_by`.
- Add `last_updated_note: "Added follow-up research for <brief description>"`.
- Add `## Follow-up Research <ISO timestamp>` with the new findings and references.
