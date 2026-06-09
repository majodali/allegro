---
name: business-rules-define-the-domain
description: Design principle — when a rule has no expressible form, extend the language; don't contort the rule
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
**Business rules define the domain, not vice versa.**

When a developer encounters a rule that doesn't fit any existing model:
- ❌ Contort the rule to fit, or escape to a lower tier and code around it
- ✅ Extend the domain model (or introduce a new one) so the rule expresses naturally

This reverses MDE's classic failure mode (the model becomes a procrustean bed). It's a top-down commitment: the *rule* is authoritative; the *model* is a tool to express it precisely.

**Why:** Vivace's value proposition is provability + safety at the domain layer. Forcing rules through ill-fitting abstractions defeats this — the model no longer reflects the real domain, so its predicates and effects don't carry meaningful assurance. Better to invest in the model.

**How to apply:**
- When a Vivace developer hits a rule that won't fit, the right next move is *not* "drop a tier and code it directly" — it's "what extension to the model expresses this?" That extension may be authored by the developer, an agent, or a third-party library.
- Lack of expertise to define domain terms soundly is comparable to a developer today who can't write a GraphQL query — solved by collaboration, time-boxing, learning, or specialized authors. Not by escaping the abstraction.
- This principle bounds Vivace's "easy and fun" goal: the system stays easy at the consumption layer; *defining* domains remains a specialized activity (and that's fine).
- When evaluating proposed Vivace features, check: does this make rule-expression more direct, or does it add ceremony that pressures rules out of the model?
