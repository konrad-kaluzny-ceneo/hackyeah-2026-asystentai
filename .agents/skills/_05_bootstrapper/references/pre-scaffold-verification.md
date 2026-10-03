# Pre-scaffold verification (Step 1)

The light verification slot. Educational visibility — not a gate. Even a "stale" finding never blocks the scaffold; it just lands a warning in conversation and a record in `verification.md`.

## Slot purpose

Before running the starter's CLI, give the user a one-screen heads-up about whether the starter is still actively maintained. Two signals:

1. **Package recency** (JS-family starters only) — when `cmd_template` invokes a CLI distributed via npm (`npm create next-app`, `npm create astro`, `npm create vite`, etc.), the published version date is a cheap proxy for "the CLI you are about to run was updated recently".
2. **Repo recency** (all starters with a GitHub `docs_url`) — `pushed_at` on the canonical repo tells the user whether the project still ships commits.

Both are read-only network calls. No clone. No install. No filesystem changes.

## Checks per ecosystem

### JS-family starters (`hints.language_family == js`)

Two checks, in this order:

```bash
# Resolve the npm package name from cmd_template (e.g., `npm create next-app` -> `create-next-app`).
# Then:
npm view <package> version
npm view <package> time.modified
```

Then run the GitHub check below.

If the package name cannot be derived from `cmd_template` (e.g., `cmd_template` starts with `git clone` — the `astro-starter` case), skip the npm step and run only the GitHub check.

### Non-JS starters

```bash
# Parse `docs_url` from the chosen card. If it points at github.com/<owner>/<repo>:
gh api repos/<owner>/<repo> --jq '.pushed_at'
```

If `docs_url` is not a GitHub URL or is missing, log "no recency signal available" and proceed with no warning.

## Severity

Compare the most recent timestamp (npm `time.modified` for JS, otherwise GitHub `pushed_at`) against today:

- **fresh** — within the last 3 months
- **aged** — between 3 and 6 months
- **stale** — older than 6 months

Severity drives the wording in the conversation summary, not the proceed/halt decision.

## Surfacing rule

Print one line in conversation summarising both checks:

```
Recency: <package> v<X.Y.Z> published <date> (<severity>); <repo> last pushed <date> (<severity>). Proceeding.
```

If only the GitHub check ran:

```
Recency: <repo> last pushed <date> (<severity>). Proceeding.
```

If a `stale` severity appears, prepend a one-line warning:

```
Heads-up: <signal> looks stale (<date>). The starter may still scaffold cleanly — proceeding, but inspect the result.
```

Stage the full record (both timestamps, both severities, the resolved npm package name if any, the GitHub repo URL if any) for the verification log. The file write happens at Step 4; do not write here.

## Failure mode

WARN-AND-CONTINUE on every branch:

- Network call fails (offline, gh not authenticated, npm registry unreachable) — log the error, print "recency check unavailable: <reason>", proceed.
- `docs_url` malformed or absent — log, print "no recency signal available", proceed.
- Stale severity — warn, proceed.

The only thing that halts the skill at Step 1 is the populated-cwd guard from Step 0 (handled by `refusal-protocol.md`), which is not part of this slot.

## What this slot does NOT do

- Does not install dependencies.
- Does not clone the starter repo.
- Does not run security audits — that is Step 3 (`post-scaffold-verification.md`), after install.
- Does not check the user's local toolchain (Node version, Python version, etc.). Toolchain mismatches surface as CLI errors at Step 2 and are caught by the HARD-STOP exit-code check there.
