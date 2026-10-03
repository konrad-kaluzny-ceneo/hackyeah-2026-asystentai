# Stakeholder summary output

Read this at the draft step. Default language is Polish. If the user named another language, translate the headings too.

## Template

```markdown
# [Nazwa projektu] — [Okres lub temat]

**Dla:** Dyrektor techniczny (bez kontekstu projektu)
**Status:** [W terminie | Zagrożone | Zablokowane | Zakończone]

## W jednym zdaniu
[Co zrobiono i po co — ogólne pojęcia inżynierskie, bez żargonu domenowego produktu]

## Co dostarczono
- [Efekt techniczny lub produktowy 1 — język ogólny]
- [Efekt 2]

## Co to oznacza
[1–3 zdania: wpływ na ryzyko zmian, utrzymanie, jakość dostarczenia, harmonogram]

## Pewność i weryfikacja
- [Co przetestowano lub sprawdzono]
- [Czego jeszcze nie zweryfikowano — jeśli cokolwiek]

## Co dalej
- [Kolejny konkretny krok z orientacyjnym timingiem]

## Potrzebujemy Twojej decyzji (tylko jeśli dotyczy)
- [Decyzja lub zależność od odbiorcy]

## Użyte terminy (tylko jeśli nie da się uniknąć)
- **[Termin]**: [jednozdaniowa definicja ogólna]

---
_Ślad techniczny (opcjonalnie, pomijaj w mailu do klienta): [PR #, change-id, zakres commitów]_
```

Omit an empty section. **Użyte terminy** only when a contractual or brand name must stay, at most 3 items. The traceability line only when the user asked for it.

Change **Dla:** when the audience was overridden.

## Delivery

- **One-pager (default)** — the full template. One "Było / Jest" line when user-visible behavior changed.
- **Email** — subject `[Projekt] — [temat]`. Body is the template without the H1.
- **Slack** — start with "W jednym zdaniu". The rest is bullets. Six bullets maximum.
- **Talking points** — "W jednym zdaniu", "Co dalej", and "Potrzebujemy Twojej decyzji" when that section exists.

## Voice

Internal voice, wrong:

> Zaimplementowano F-07 wedge-transition-conductor, mutex w pomodoro-dashboard, belt e2e green. B-05 complete.

Domain metaphor after a shallow translation, still wrong:

> Ulepszyliśmy przewodnictwo między blokami focusu: użytkownik widzi co najwyżej jeden beat naraz, zgodnie z regułą wedge.

Technical director, Polish, right:

> Logika przejść między stanami głównego ekranu timera jest teraz w jednym module zamiast rozproszona po wielu komponentach. To zmniejsza blast radius przy kolejnych zmianach w tym obszarze i egzekwuje mutex — co najwyżej jeden overlay naraz. Automatyczne testy regresji przeszły; wariant mobilny nie był ponownie weryfikowany w tej iteracji.

Client override, Polish, right:

> Aplikacja rzadziej „przeskakuje” między komunikatami podczas pracy z timerem — widzisz co najwyżej jeden prompt naraz, więc przepływ jest spokojniejszy. Przed oddaniem uruchomiliśmy automatyczne testy regresji.
