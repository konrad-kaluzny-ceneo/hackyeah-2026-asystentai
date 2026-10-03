---
name: stakeholder-summary
description: >
  Summarize agent or development work for people outside the project, in Polish
  by default. The default reader is a technical director who knows engineering
  but not this product. Use when the user asks for a stakeholder summary,
  client update, executive brief, non-technical recap, "podsumowanie dla
  stakeholderów", or "explain this work to someone who wasn't on the project".
default-language: pl
---

## Hard rules

1. **Default reader:** a technical director who understands architecture, testing, delivery risk, coupling, and refactoring, and does not know this product. They should not need the PRD, domain notes, or ticket ids.
2. **Outcomes, not activity.** "Scentralizowano logikę przejść UI — mniejsze ryzyko regresji przy zmianach w module timera." A filename plus a slice code is not a sentence.
3. **Docs are for understanding, then they disappear.** Read `prd.md`, domain notes, and the roadmap only to learn what happened. The summary uses general engineering language.
4. **Honesty.** Separate done, in progress, and not started. A risk is a plain sentence ("we haven't tested on mobile yet"), not a code ("F-07 mutex untested"). Do not invent progress. "Ready for production" only when the input supports it. Do not bury a blocker. A spike is a learning and a recommendation, not a shipped feature.
5. **Diff noise.** Ignore renames, import churn, and lint-only diffs unless the user saw the change.
6. **Length.** Technical director: at most 400 words in the body. Client or non-technical executive: at most 250, unless they asked for more.

## Vocabulary

Allowed for the default reader: „scentralizowaliśmy logikę”, „zmniejszyliśmy coupling”, „testy regresji”, „blast radius”, „warstwa API”, „dług techniczny”.

Not allowed: product feature names, PRD metaphors („wedge”, „beat”, „bramka”), roadmap codes (`S-24`, `F-07`), and a metaphor that only this app uses. "Między blokami focusu" becomes "między kolejnymi krokami w module timera" or "w przepływie głównego ekranu".

| Internal | Write |
| --- | --- |
| Slice / change-id | „ten etap prac” or „ta iteracja” |
| Domain term | the engineering fact: „logika przejść UI”, „warunek wyświetlenia promptu”, „mutex między overlayami” |
| E2E belt / Vitest / tRPC | „automatyczne testy regresji”, „testy jednostkowe”, „warstwa API” |
| Optimistic update | „UI aktualizuje się od razu, zapis idzie w tle” |
| Refactor / ACL / aggregate | „uporządkowaliśmy granice modułów”, „warstwa pośrednicząca między domeną a infrastrukturą” |

A contract or brand name that must stay is defined under **Użyte terminy** in [references/output.md](references/output.md).

## Język

Domyślny język podsumowania: **polski**. Inny język albo inny odbiorca tylko wtedy, gdy użytkownik o to poprosi. Nie tłumacz: kod, identyfikatory, ścieżki, nazwy marek, które muszą zostać.

# Stakeholder summary

Do not use this for code review, drift checks, or planning the next slice.

## How to ask

Use the host's structured question tool. When they gave no material, ask only:

- What work should be summarized? (session, slice, PR, date range)
- Delivery format? (email / Slack / talking points / one-pager — default: one-pager)

Do not ask about language or reader.

Then say you will write in Polish for a technical director who does not know the project, in general engineering language.

## Audience

| Reader | Emphasis | Depth |
| --- | --- | --- |
| Technical director (default) | trade-offs, blast radius, test and deploy confidence | ≤400 words, no product jargon |
| Client | what the user sees, reliability, timeline | no stack names unless they asked |
| Executive, non-technical | outcome, risk, cost of delay | ≤250 words |
| Mixed | outcomes first, detail after | summary plus a short appendix |

A client or executive may hear user-facing product language. Still no internal codes.

## Process

1. **Facts.** From what they gave — transcript, `plan.md`, `research.md`, a PR, a commit range, a diff — list only what you can verify: delivered, validated, deferred, open questions.
2. **Jargon.** For each domain term and each id (`S-24`, `B-05`, `F-07`), find the user-facing meaning in the docs, then drop the id from the body.
3. **Draft.** Read [references/output.md](references/output.md) and fill that template. Every filled section uses a heading from that file. **Co to oznacza** is 1–3 sentences on change risk, maintenance, delivery quality, or schedule.
4. **Check.** No roadmap code (`S-24`, `F-07`), no term from the Not allowed list, and no unexplained acronym or ticket id in the body. General engineering words, not app metaphors. At least one sentence of user or business impact. Risks and next steps fit this reader's role. Length matches the Audience table. Reject a draft that matches either wrong sample in [references/output.md](references/output.md).

Open a row in the Input table only to resolve one term or one done-versus-pending fact. Quote at most one sentence from that file.

| Input | Use |
| --- | --- |
| `context/foundation/prd.md` | names and goals, then translate them away |
| `context/domain/*` | term to plain language |
| `context/changes/*/plan.md` | done versus pending |
| Git log / diff | what actually changed |
| Conversation | decisions that are not in files |

Present the summary. Stop.
