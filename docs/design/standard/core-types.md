# Core types — the Allegro Standard roster

> Tier 1 design doc. The ten core types shipped by the standard
> extension (`src/types-std.ts`), with their method inventories.
> Promoted from the session bootstrap during the K-002 slim (B-095
> chunk 3). Representation-level truth (carriers, flattened
> structures, `dataOf`) is `docs/design/allegretto/structures.md` §2;
> the type-system meta-protocol is
> `docs/design/standard/type-system.md`.

## The roster


- **Int** — 64-bit signed integer. Arithmetic, comparison, toString, abs, toFloat.
- **Float** — IEEE 754 double. Arithmetic, comparison, toString, sqrt, pow, abs, floor, ceil, round, sin, cos, tan, log, log2, log10, exp.
- **String** — UTF-8 encoded Bits. Concat (+), length, slice, indexOf, trim, startsWith, endsWith, includes, split, replace (all by default, optional count), toUpperCase, toLowerCase, charAt, repeat, toCharCodes, toString.
- **Bool** — Int(0/1) with Bool type. Provided as `true`/`false` context bindings.
- **Array** — Generic type `Array[T]`. Numeric-keyed structure — elements live in the Structure's dense region (C4.2: plain JS array, sole storage; legacy string-key bindings view materializes lazily; element access via slots.ts `indexGet`). length, get, map, filter, reduce, concat, slice. Element type inferred from contents. map/filter/reduce are Allegro ComposedFunctions (recursive, built via AST construction); length/get/concat/slice are primitives.
- **Object** — Typed Context. Field access via dot, keys, values, get.
- **Function** — Generic type `Function[ParamTypes, ReturnType]`. Attached to typed function definitions. Supports type variable unification at call sites.
- **UntypedFunction** — Wraps base language primitives entering standard context. Every value in standard mode has a type.
- **None** — Represents absence of a value. Singleton `none` keyword. Returned by `component_get` when a component is absent.
- **Error** — Represents a failed computation. Created via `error expr`. Error values propagate automatically through operations.
- **Any** — Matches any type. Used when generic types are used without explicit parameters (e.g., bare `Array` → `Array[Any]`).

## Notes

- Method dispatch: every method above resolves through `__members`
  descriptors via `typeMethod` (see `type-system.md` §Meta-protocol);
  operators route through the evaluator's `PRIM_TO_METHOD` mapping on
  the operand's shape.
- `Array.map`/`filter`/`reduce` being Allegro ComposedFunctions (not
  host loops) is load-bearing: their bodies partially evaluate, so
  effect and type inference see through them (D1 Slice 2 F3b).
- `UntypedFunction` is the reason "every value in Standard mode has a
  type" holds — base primitives are wrapped on entry to the standard
  context.
