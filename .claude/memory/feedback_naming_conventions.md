---
name: feedback-naming-conventions
description: No stuttering names; three locked tier names (no further Italian); flat phase numbers; evocative plan-doc labels
type: feedback
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Naming preferences observed:

- **No stuttering.** `TypeType`, `NamedType.NamedType` — bad. Pick a different word for one of them. (User: "I'd prefer we don't use type names like TypeType where the word 'Type' is repeated.")
- **Three tier names — locked, no more Italian.** Allegretto (base), Allegro Standard, Allegro Vivace (top tier; renamed from "Allegro High"). User: "we don't need any more Italian musical terms — more than three will make people cringe." Don't propose new Italian musical names for sub-tiers, modes, or extensions.
- **Flat phase numbering.** Prefer D1, D2, D3 over primed notation (D', D'', D'''). User explicitly: "let's rename the D prime phases to D1–D5."
- **Plan docs in `.claude/plans/`** use evocative two-word + named-author labels (e.g. `crystal-proving-curry.md`, `lucid-discharging-lambek.md`). Continue this style for new plans.

**Why:** Naming is the user-facing surface of the language and its design narrative. Stuttering reads as careless; over-applied themes feel kitschy; primed notation suggests something hackish; evocative plan-doc names make the project feel intentional.

**How to apply:** When introducing types, primitives, phase identifiers, or plan docs, prefer distinct words. When the user invents an Italian-musical name for one of the three tiers, use it consistently in CLAUDE.md / BACKLOG.md / docs. For new sub-tiers or modes, choose a different naming theme entirely.
