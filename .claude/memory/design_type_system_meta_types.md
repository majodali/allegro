---
name: type-system-meta-types
description: NominalType collapses into Type with optional `__name`; MI deferred to backlog with explicit-conflict design; NominalType-as-mixin is a third option also deferred
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
**Decision (2026-05-01):** Collapse `NominalType` into `Type` with optional `__name`. Multiple inheritance deferred.

## Why this came up

Effect needed a meta-type that handles both named effects (subtypes like `io`, `time`) and anonymous effects (conjunctions like `io & time`). The existing `Type` / `NominalType` split forces a choice: either two `Effect` variants (and `e instanceof Effect` doesn't always hold), or some other fix. Same pattern recurs for `Predicate`, `Function`, `Symbol`.

## What we picked

**Option 1 — collapse `NominalType` into `Type`.** Single meta-type, optional `__name`. Methods become shape-aware: nominal comparison if `__name` is set, structural otherwise. `~T` projects to anonymous (clears `__name`). Bootstrap simplifies — no `Type → NominalType` chain.

This is the right framing because named-vs-anonymous is a *value-shape distinction* (one bit of state: `__name` present or not), not a *type-of-types distinction*. The same framing settled for Effect itself — it just lifts up one level.

## What we deferred

**Multiple inheritance — backlog.** With explicit-error-on-conflict semantics (no MRO), MI becomes much cleaner than typical OO models:
- `__extends: Type[]` allows multiple parents
- `instanceof T` is graph-reachability over the transitive parent DAG
- Conflicts in `__members` lookup are errors; user resolves explicitly (mirroring Mixin's name-conflict policy)
- More natural mathematically — `instanceof` and `subtypeof` reduce to logical/set definitions instead of arbitrary class-hierarchy choices

Deferred for now because:
- Option 1 already solves the immediate Effect problem
- No second concrete use case yet (Predicate, Function, Symbol may also be solved by Option 1's collapse)
- One foundational change at a time is easier to review and bisect
- MI has its own design surface (constructor inheritance, getter inheritance, `__getMember` composition) that deserves focused thinking, not "while we're in there"
- Aligns with `feedback_review_and_redo` — wait for corpus to drive foundational decisions

Trigger to revisit: a second concrete use case beyond Effect surfaces, or Phase G/H domain library work pulls on it.

**`NominalType` as a mixin — also backlog.** Nominal vs structural is genuinely a behavior set (the comparison methods); `__name` is immutable so it could be an additive mixin member rather than a meta-type distinction. Worth considering when re-evaluating MI.

## How to apply

- **Now (Slice 1 sub-chunk 1.0):** Implement Option 1 — collapse `NominalType` into `Type`. Touches `types-std.ts`, `evaluator.ts` `PRIM_TO_METHOD` paths, primitive dispatch, introspection. Validate `~T` semantics on a couple of cases (does `~Int instanceof Int` still hold? does `~Animal subtypeof Animal`?) before committing.
- **Later:** Revisit MI when a second concrete pull surfaces.
- **Don't do both at once.** Effect work depends on the collapse; MI is independent and can wait.
