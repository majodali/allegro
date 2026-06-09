---
name: Type definition design decisions
description: Three type mechanisms (extends/newtype/where), fluent API before syntax
type: project
---

## Type Definition Mechanisms

Three distinct mechanisms for defining types:

1. **`extends`** — new type inheriting subtypeof chain, adds/overrides fields and methods
2. **`newtype`** (name TBD, maybe `distinct`/`opaque`) — fresh nominal identity, same representation, breaks subtypeof chain
3. **`where`/`&`** — refinement: same type + predicate constraint. Constructor is inherited + checked by default, overridable.

## Access Control
- Not syntax modifiers (no public/private keywords)
- Controlled by `__getMember` on the type — only exposes what it returns
- Type methods operate on raw Context, can access everything
- Extremely powerful: dynamic, computed, context-sensitive access is possible

## Key Decisions
- Types are predicates/constraints over values (fundamental model)
- Concrete types also provide constructors (`__construct`) and hierarchy (`subtypeof`)
- `instanceof`, `subtypeof` are infix operators desugaring to primitives
- `__construct` on types enables `T(args)` constructor syntax

## Implementation Strategy
- **Fluent type API first** — use the system before designing syntax
- Syntax for type declarations deferred until API usage patterns are clear
- The API includes: creating types, adding fields, methods, extends, constraints, constructors
