---
name: effects-as-values-schema
description: Effects are values of type Effect; structure via member access; specialization via application (like generic types); lattice ops are typed methods
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
**Effects are values of type `Effect` — not a parallel namespace, not flat string labels.**

This is the settled schema for Allegro's effect system, derived during the chunk 2+3 design discussion. It supersedes Phase D1's flat-label representation (which becomes a special case: an `Effect` with no members and no parameters).

## Schema

- `Effect` is a type. Effect bindings (`pure`, `io`, `files`) are values of type `Effect`.
- Member access on an Effect produces another Effect: `files.read`, `files.read_from`. Members are scoped to the parent.
- Parameterized Effects work like generic types: `files.read_from "./config.json"` is `files.read_from` *applied* to a path argument, producing a more specific Effect — structurally identical to `Array[Int]` from `Array`.
- Lattice operations (`subset_of`, `implies`, `intersect`, `union`) are typed methods on Effect values. Same machinery as predicate-set entailment from Phase B/C.
- **Composition is via conjunction (`&&`)**. Two Effects compose into a single Effect: `io && time` represents "does both io and time." There is no separate "effect set" data type — compound effects are just conjunctions. `pure` is the empty conjunction (identity); `opaque` is universal. `&&` is overloaded by left-operand meta-type (logical AND, refinement-with-predicate, now effect conjunction).
- An effect bound on a function is an Effect (atomic or compound). Inferred and declared bounds are compared via the lattice.
- PE simplifies conjunctions automatically via existing expression simplification (`e && e == e`, `pure && e == e`). No special effect-arithmetic infrastructure.

## Concrete-arg propagation = effect polymorphism over values

A function declaring `effects files.read_from p` (where `p` is a parameter) carries the argument symbolically. When the function is called with concrete `p = "./config.json"`, the effect specializes to `files.read_from "./config.json"`. This is just predicate evaluation under PE — same path as refinement-type predicates resolving against concrete values.

## Where effects live

- **Core absolutes:** `pure`, `opaque`. Like `None` and `Any` for types — fixed, in the language core.
- **Library-defined:** everything else. `io`, `net`, `time`, `files`, `mutation`, `process`, `unsafe.*` are in standard libraries (`lib/io.alg`, `lib/files.alg`, etc.). Domain-specific effects (`auth.update_role`, `db.write T`, `service.call S`) are in domain libraries.
- **Naming via imports:** effects are imported values. Name collisions resolved the same way as any other binding collision (import-statement-driven naming).

## What's banned vs tracked

- **Banned at language level:** redefining primitives or core types/operations. Extensions allowed but cannot be forced on unwitting consumers.
- **Tracked via `unsafe` effect hierarchy:** operations that legitimately need to escape the analysis surface — direct memory writes, modifying running executables, generating code that's then executed, native FFI. These have valid use cases (build tools, JIT compilers, OS bridges, debuggers, the syscall implementations behind `lib/files.alg` etc.) but bypass the effect system.
- **Safe-API-over-unsafe-impl is the encapsulation pattern:** `files.read_from` is implemented in terms of `unsafe.ffi`, but the wrapper claims only `files.read_from`. The author bears the proof obligation externally for the unsafe step. Callers don't inherit `unsafe` because the wrapper is the encapsulation point.

## How to apply

- When designing effect machinery: don't introduce parallel infrastructure. Reuse Allegro's existing value, type, generic, member-dispatch, and method-call mechanisms.
- When discussing surface syntax for effect declarations (`effect files { ... }` vs value bindings): defer until the broader declaration-syntax pattern crystallizes. The corpus-driven review will settle it.
- When a new domain library is being designed: identify what effects it produces, declare them as Effect values with appropriate hierarchy and parameterization, tag the library's primitives.
- When implementing chunk 2+3: predicate-set unification means `EffectSet` doesn't need to be a parallel data structure. Effect bounds carry on bindings via the existing `PredicateSet` infrastructure.
