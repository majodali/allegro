# Pattern matching — design decisions

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Syntax reference: `CLAUDE.md` §Base Parser Syntax; implementation in
> `src/grammar2/base-grammar.ts` (when/is/then), `src/primitives.ts`
> (`eval_when`).

## 1. Surface: `when/is/then` [implemented]

```
when shape
  is Circle(r) then pi * r * r
  is Rectangle(w, h) then w * h
```

Chosen over ML-style, Rust-style, and arrow-style alternatives —
stylistically matches the existing `if/then/else`; readable without being
verbose.

## 2. Shipped semantics [implemented]

- Type destructuring (nominal): `is Circle(r)`, `is Object(x: a)` rename.
- Structural destructuring: `is {x, y}`, `is {x: a}` rename.
- Nested destructuring: colon introduces a sub-pattern, matched recursively.
- Guard clauses: `is n and n > 0 then …` (`and`/`or` keyword synonyms).
- MultiValue component access is a general expression feature, not
  pattern-specific: `type of x`, `error of x`.

**Type-as-value resolution in cases** (resolve-first semantics):

1. Non-type value pattern → matches the input's primary (`is 42`).
2. Type pattern, input is not a type → matches the input's type component
   (`is Int` on `42`).
3. Type pattern, input IS a type → matches primary OR type (pragmatic).
4. Explicit component access removes ambiguity: `type of shape == Type`.

Exhaustiveness: `when` chains without an `else`/wildcard are analyzed by the
totality checker (finite-domain types report missing literals; uncountable
types report the missing fallback) — confidence policy applies: silent when
the subject's static type can't be determined.

## 3. Deferred [designed]

- **Unification in pattern matching** — full expression parsing in pattern
  mode with unification semantics.
- **when-branch predicate refinement** — `when/is/then` case branches do not
  yet narrow predicate sets the way `if` branches do (branch-sensitive
  refinement landed for `if` in Phase C chunk 2; the `when` analogue was
  noted during that work and never implemented). Worth a dedicated pass;
  tracked in the backlog.

---

*Source: `design_pattern_matching` (memory), promoted 2026-06. The
when-branch refinement gap was recovered from memory during the 2026-06
review — it was previously tracked nowhere else.*
