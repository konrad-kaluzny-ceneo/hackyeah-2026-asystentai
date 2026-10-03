---
name: agents-md
description: >
  Generate an AGENTS.md onboarding document for AI coding agents. Inspects the
  repo (manifest, README, scripts, lint and test config, layout, commit
  history) and writes a short "Repository Guidelines" file. Use when the user
  says /agents-md, "create AGENTS.md", "write an agent onboarding doc",
  "generate contributor guide for agents", or "stwórz AGENTS.md".
---

# Agents MD

Write one `AGENTS.md`. Critical rules and the commands an agent actually runs go first. Every claim comes from a file, command, or commit you inspected.

## Hard rules

1. **Do not invent project facts.** Do not restate framework defaults or language tutorials. If you could have written the line without opening the repo, cut it.
2. **No generic advice.** "Clean code", "best practices", "be consistent", "handle errors properly", "keep it simple", "modern patterns" do not belong. A rule stays only if a reviewer can flag a diff against it.
3. **No multi-line snippets.** A fenced block is one command line (`pnpm test`). Point at files with `@package.json`, `@tsconfig.json`, `@docs/architecture.md`.
4. **Write one markdown file and stop.** Do not edit unrelated files. Do not propose follow-ups.
5. **An existing file is a surgical edit.** Do not overwrite it unless the user picks Full regenerate, or the file is empty or a stub.

## Quality guards

All five pass before a write or after an update. Directory scope uses 120–250 words and "local rules first" for guard 5.

1. **Length.** Repo body is 200–400 words. Under 200 skipped specifics. Over 400 padded or inlined a reference.
2. **No multi-line snippets.**
3. **Every rule is checkable** against a diff.
4. **No redundant knowledge.** A line that duplicates `README.md`, `package.json`, or a lint config becomes an `@` reference.
5. **Critical rules first.** The first third holds the highest-stakes rules and the most-used commands. Cut a welcome or values opening.

## Output structure

Title: `# Repository Guidelines`. Omit an empty section. Open with one or two sentences: what the project is and the primary stack. No mission statement.

1. Hard rules — "never do X" and tripwires. Skip if the repo has none.
2. Project structure — source, tests, assets, packages. Deeper docs are `@path`.
3. Build, test, and development — 3–6 commands with a one-line purpose. Prefer the project's wrapper (`pnpm <script>`, `make <target>`) over the raw tool.
4. Coding style and naming — indentation, language version, one naming pattern, the tools that enforce them.
5. Testing — framework, location, naming, one-test command, a coverage threshold only if the repo checks it.
6. Commit and pull request — prefixes seen in `git log`, PR expectations, required CI checks.
7. Security and configuration — optional: secrets, env file, a validator that fails CI.
8. Architecture — optional, 3–6 bullets, and only when no `@` reference already covers it.

Tone: second person or imperative. Stay within the Scope word budget (200–400 at the repo root, 120–250 in a subdirectory). Do not add a mission, vision, or values sentence; the opening is the one or two sentences above.

## How to ask

Use the host's structured question tool. If none exists, ask in chat with the labelled options. The first time you ask, say which tool you used.

## Input

`$ARGUMENTS` is optional.

- Empty → `AGENTS.md` at the repo root.
- A directory → `AGENTS.md` inside it.
- A path ending in `.md` → that file.

## Scope

Target directory is the argument path, or the working directory when the argument is empty or a `.md` file's parent. Compare it to `git rev-parse --show-toplevel`.

**Repo root.** Use the output structure above. Body **200–400 words**.

**A subdirectory.** The reader already knows the repo. Discover files next to the target: siblings, the nearest `index.*` / `mod.rs` / `__init__.py`, co-located tests, a parent README, and local config that overrides the root (`tsconfig.json`, `.eslintrc`, route manifests). Read root `README.md` and `CLAUDE.md` only to resolve a conflict or to take one `@` reference. Capture the convention you see in siblings (naming, exports, where types, styles, and tests live, what may not be imported). Body **120–250 words**. Skip the repo map, package list, global CI overview, and commit-convention recap. One link: `See @AGENTS.md at the repo root for repo-wide rules.` Guard 5 becomes local rules first: the line that stops a wrong-shaped sibling goes at the top.

Useful directory sections, only when the files support them:

- Adding a new unit — steps for the dominant artifact, citing `@./<sibling-file>`.
- File layout and naming — co-location and barrel exports if one exists.
- Local conventions — props or args, data flow, allowed and forbidden imports.
- Testing this unit — the neighbor pattern and the command that runs this directory.
- Tripwires — a "never do X" visible in siblings or a nearby `AGENTS.md`.

## Discovery

If the host can spawn isolated agents, and the repo has more than about 20 top-level files, and you have not already read these files: fan out in one message. Each report is facts only, at most 200 words, with `path:line`. Do not delegate the draft.

- `README.md`, `CLAUDE.md`, existing `AGENTS.md`, top-level `docs/` index.
- Manifest and lint, format, and type config.
- Test config and CI workflows.
- Git history: commit style, last touch of the target file, diff since `LAST_TOUCH`.

Otherwise read those yourself. Synthesis stays in this context so the word budget, order, and `@` policy hold.

## Create

Use this when the target does not exist, or exists and is empty or a stub.

1. Read what exists, in this order: `README.md`, `CLAUDE.md`, `AGENTS.md`, top-level `docs/`; manifest (`package.json` scripts, workspaces, engines, or `pyproject.toml` / `Cargo.toml` / `go.mod` / `Gemfile`); `.eslintrc*`, `oxlint*`, `biome.json`, `tsconfig.json`, `ruff.toml`, `.editorconfig`; `vitest.config.*`, `jest.config.*`, `pytest.ini`, `playwright.config.*`, where `*.test.*` live; one or two `.github/workflows/*`; the top two tree levels; `git log --oneline -n 30`; `git config remote.origin.url`.
2. Note the 1–3 commands an agent runs most, the conventions a reviewer would flag, any "never do X" in `CLAUDE.md`, the README, or CI, and where deeper docs live.
3. Draft. Run the five guards. Revise until they pass, then write once.
4. Report path, body word count, the section order in one line, and: test the file by running a real task with a fresh agent session — onboarding docs only prove themselves on the next run.

## Update

1. Read the file. List headings, rules, commands, every `@` reference, and every path it cites.
2. `git log --follow --format="%h %ad %s" --date=short -- <path>`. `LAST_TOUCH` is the latest hash and date. If `git ls-files --error-unmatch <path>` fails, the file is untracked: run Create discovery, skip the diff commands, and keep project-specific lines the user wrote.
3. `git diff HEAD -- <path>` shows uncommitted edits. Those lines are KEEP unless they contradict a CI-enforced rule.
4. Diff since `LAST_TOUCH` only for things the file mentions: `README.md`, `CLAUDE.md`, `docs/`; the manifest's scripts, dependencies, engines, workspaces; lint and type configs; test configs; `.github/workflows/`; `git log --oneline -n 30` against the commit-style claim. Check each cited path. Missing or renamed means that line is stale. If `LAST_TOUCH` is the repo's first commit, skip the range and compare the file to the current tree line by line.
5. Classify each line. Show the table before editing if they ask; otherwise keep it for the confirm step.
   - **KEEP** — the cited file, command, or path still matches.
   - **UPDATE** — right idea, stale detail. Name the replacement and cite `package.json:42` or the equivalent.
   - **REMOVE** — the thing is gone, or `CLAUDE.md` or the README contradicts it.
   - **MISSING** — a new package, script, CI "never", or commit convention that belongs in the file.
   Cite `path:line` in the current `AGENTS.md` for every UPDATE and REMOVE.
6. Ask once. Header: `AGENTS.md`.
   - **Apply the proposed updates** — targeted edits for UPDATE, REMOVE, and MISSING. Do not touch KEEP lines.
   - **Show me the change list first** — print the table, edit nothing, then ask again.
   - **Full regenerate** — discard the file and run Create. Only when it is mostly stale or they asked for a clean slate.
   - **Cancel** — no changes.
7. Apply with one edit per entry, not a full rewrite. You may move a whole section when guard 5 fails and they approved updates. Do not silently reword a KEEP rule.
8. Run the guards again. If the body exceeds the budget, trim KEEP lines from optional sections 7 and 8 first, then a directory section the files do not support, and only then drop a MISSING line.
9. Report path, word count, and one line such as `3 updated, 1 removed, 2 added; section order unchanged`.

## Edge cases

- No `README.md` and no manifest → stop. Ask for a one-paragraph description before drafting.
- Monorepo → root `AGENTS.md` lists packages and `@`-references each package README. Suggest `packages/<name>/AGENTS.md` only where that package's rules differ.
- A rich `CLAUDE.md` is authoritative. Distill it. Point back with `@CLAUDE.md`. Do not copy it.
- No commit history → omit commit conventions. Say in the PR section that the convention is not defined yet.
- Several stacks → the Build section follows the stack with the most files. Mention another stack only when it has its own command an agent must run.
