---
name: pattern-matching-syntax
description: when/is/then for pattern matching with destructuring/guards/MultiValue access shipped; unification and when-branch refinement still deferred
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
Pattern matching uses `when/is/then` syntax (chosen over ML-style, Rust-style, and arrow-style alternatives).

```
when shape
  is Circle(r) then pi * r * r
  is Rectangle(w, h) then w * h
```

**Why:** Stylistically matches existing `if/then/else`. User prefers readable but not overly verbose syntax.

**How to apply:** Use `when/is/then` keywords when extending pattern matching.

## MultiValue access syntax
`Y of x` syntax for accessing MultiValue components: `type of x`, `source of x`, `error of x`. General expression-level feature, not pattern-matching-specific.

## Type-as-value resolution in match cases
1. Non-type value pattern → matches primary of input (e.g., `is 42`)
2. Type pattern, input is not a type → matches input's type component (e.g., `is Int` on `42`)
3. Type pattern, input IS a type → matches primary OR type (pragmatic)
4. Explicit component access removes ambiguity: `type of shape == Type`

## Shipped (no longer deferred)
- Type destructuring (nominal): `is Circle(r)`, `is Object(x: a)` for rename
- Structural destructuring: `is {x, y}`, `is {x: a}` for rename
- Nested destructuring: colon introduces sub-pattern, recursive matching
- Guard clauses: `is n and n > 0 then …` (also `or` keyword synonym for `||`)
- MultiValue component access shipped as `Y of x`
- Type-as-value resolution rules implemented per the rules above

## Still deferred
- Unification in pattern matching
- when-branch refinement: when/is/then case branches don't yet narrow predicate sets the way `if` branches do (noted during Phase C work). Worth a dedicated implementation pass.
