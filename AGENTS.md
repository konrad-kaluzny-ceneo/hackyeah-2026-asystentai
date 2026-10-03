<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

Hackathon web app for one contextual next step while someone browses an appliance catalog. Stack is Next.js App Router, TypeScript, Tailwind, and npm (`@package.json`). Product rules are `@context/foundation/prd.md`. Slice order is `@context/foundation/roadmap.md`.

## Hard rules

- Do not add login, roles, or an admin panel. The MVP session is anonymous (`prd.md` Access Control).
- Do not add to cart, assemble a product set, contact support, compare several models in one box, or cross-sell. Those are Non-Goals in `@context/foundation/prd.md`.
- Show at most one assistant proposal at a time. This shell does not render a proposal yet; do not add a second competing prompt.
- Do not invent catalog products or signal events on `/katalog`. That route is an empty placeholder until the demo-catalog slice.
- Do not commit `.env*` files. `@.gitignore` ignores them.

## Project structure

- `src/app/page.tsx` — shell description.
- `src/app/katalog/page.tsx` — empty demo-catalog route.
- `src/app/layout.tsx` — Polish document language and the shared header.
- `src/app/api/meta-events/route.ts` — POST endpoint for client behavior meta events.
- `src/behavior/` — client-side pipeline (collector → buffer → analyzer → detectors → dispatcher). Raw events never leave the browser.
- `src/server/meta-events/` — Zod validation and persistence of meta events.
- `src/lib/db/` — Drizzle ORM schema (`meta_events` table) and lazy pg client.
- `@/*` maps to `src/*` in `@tsconfig.json`.
- Living product docs stay under `context/foundation/`. Do not copy them into `src/`.

## Commands

- `npm run dev` — local app at http://localhost:3000.
- `npm run lint` — ESLint (`@eslint.config.mjs`).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — production build. Run it before a PR that changes the app.
- `npm test` — Vitest suite under `tests/` (`@vitest.config.ts`, happy-dom). Use `npm run test:watch` while iterating.
- `npm run db:generate` — drizzle-kit generates SQL migrations into `drizzle/` from `@src/lib/db/schema.ts`.
- `npm run db:migrate` — drizzle-kit applies pending migrations; requires `DATABASE_URL` (see `@.env.example`).

## Behavior-tracking rules

- Raw events stay in the browser (memory + sessionStorage). Only meta events are POSTed to `/api/meta-events`.
- `add_to_cart`, `compare_added`, `compare_removed`, `favorite_added` exist in the TypeScript contract for future reuse, but the demo collector never emits them (PRD Non-Goals; `@context/foundation/prd.md`).
- Feature flag: `NEXT_PUBLIC_BEHAVIOR_TRACKING=true` enables the tracker client-side. Anything else disables it.
- Detectors, page-type rules, thresholds and the detector dedupe/cooldown live under `src/behavior/`. See `docs/adding-detector.md` and `docs/adding-page-type.md` before extending.
