# Polyphonic Tracing — Plotkin

**Phase D1 chunks 2 + 3 combined: higher-order effect annotations + effect polymorphism + EffectSet→PredicateSet unification.**

This is a decision artifact. Slice it into implementation chunks at any granularity that makes sense — the dependencies between sections are noted but the user picks the cuts.

---

## Goal

Close the higher-order soundness gap in chunk 1 effect inference and unify the effects machinery with the predicate-set / abstract-domain infrastructure that Phase B+C put in place. After this work:

- A function declaring `effects pure` that calls a parameter cannot silently launder I/O through that parameter.
- Stdlib HOFs (`Array.map`, `Array.filter`, `Array.reduce`, the `lib/functional.alg` combinators) propagate their callback's effects to the caller's inferred set.
- Effect bounds are first-class type predicates — they live in `PredicateSet`, compose with refinements (`Int && _ > 0 && pure`), and discharge through the same PE-first / runtime-fallback path as every other predicate.
- Functions without complete effect derivation produce a `Notification` in `CompilationReport`. Project config decides whether notifications surface as warnings or errors.

This validates the falsifiable design constraint from `design_provability_thesis.md`: no parallel infrastructure for the new safety feature.

---

## Architectural commitments (settled in design discussion)

1. **Effects are type predicates.** `EffectSet` folds into `PredicateSet`. Effect bounds carry `source: "effects-bound"` (declared) and `source: "effects-inferred"` (derived). The standalone `effects: string[]` field on `PrimitiveFunctionValue` becomes the data shape behind a predicate, not a parallel record.

2. **Both surfaces ship.** Param-type slot (`f: pure`) AND body-form clause (`param_effects f: pure`). They lower to the same predicate-set entry. Neither subsumes the other in practice — A reads cleaner for the common case, C lets you separate type and effect declaration when the param has a non-trivial type.

3. **Effect names are normal lowercase identifiers** (`pure`, `io`, `net`, `time`, plus extension labels like `build_io`). Snake_case allowed. Kebab-case deferred until real demand.

4. **Soundness via mandatory notification.** Functions without a complete effect derivation produce a Notification. No silent under-approximation; no silent "unknown" that lets a stdlib's incompleteness contaminate a caller's `effects pure (declared, verified)` badge.

5. **Compile-time first, runtime fallback configurable.** Effects discharge by PE like every other predicate. Where PE leaves a residual, runtime check is acceptable in some projects — project config decides allow / warn / error.

6. **`applyComposed` should usually trace at compile time** to a union of all possible inputs' effects. This is a hypothesis to validate during implementation. Where it fails (functions parsed from runtime text — `fetch`'d code, REPL input, user-provided sources), runtime check is the right answer.

---

## Surface design

### Surface A — param-type slot

```
map_pure(arr, f: pure) =>
  effects pure
  arr.map(f)

log_each(arr, f: io) =>
  effects io
  arr.map(f)

// composes with other type predicates
sum_safe(arr, f: pure && (Int) => Int) =>
  effects pure
  arr.map(f).reduce((a, b) => a + b, 0)
```

Effect names appear in any type-expression position. Type expressions become uniform: `Int`, `Int && _ > 0`, `pure`, `(Int) => Int && pure`, `pure && net[api.example.com]`.

### Surface C — body-form clause

```
process(arr, f: SomeNonEffectType) =>
  effects io
  param_effects f: io
  print("processing")
  arr.map(f)
```

Symmetric with `requires` / `ensures` / `effects`. Useful when the param has a non-trivial shape annotation and you don't want to compose effects into the same expression.

### Effect polymorphism — chunk-3 surface

```
// Stdlib annotation
map[A, B, e: Effect](arr: Array[A], f: (A) => B && e): Array[B] && e

// Caller automatically inherits the effect
caller(arr) =>
  effects io
  arr.map(print)    // e = io, propagates to caller's inferred set
```

Effect variables are declared in a generic parameter list `[e: Effect]` after the function name — same syntax as type parameters, since they play the same role. The explicit declaration is needed because lowercase identifiers are effect names by convention; bare `f: e` would silently capture any in-scope `e` binding. `[T]` for type variables remains optional (current implicit behavior continues to work); `[e: Effect]` for effect variables is the standard form.

This generalizes Allegro's existing implicit type-variable mechanism with an explicit declaration form. Implementation note: the function-declaration grammar must be extended to accept `[…]` after the name, with optional kind annotations (`T` defaults to `Type`; `e: Effect` is explicit).

User has noted: **inside a function**, transformations or conditional dependencies between effect variables get complex fast. Out of scope. Polymorphism here means "this param's effects flow through unchanged" — not effect arithmetic.

### Notification surface

```
// CompilationReport now has three categories:
// - errors: compilation halts
// - warnings: compilation proceeds
// - notifications: project config decides

// Default project config: notifications surface as warnings.
// Strict project config: notifications surface as errors.
```

Triggers for notifications in this chunk:
- Function with `effects` declaration but missing param effect bound on a called param
- Function whose inferred effect set could not be fully derived (param called whose bound is unknown)
- Function value passed to a context expecting an effect bound, where the value's effects can't be statically traced (runtime-fallback case unless explicitly enabled)

---

## Implementation pieces (the user picks chunks)

Logical dependency order — earlier pieces are foundations for later ones, but several can interleave.

### P1. EffectSet → PredicateSet unification (refactor)

- New predicate kind: `EffectsPredicate` carrying an `EffectSet` (still `Set<string>` underneath, but referenced via predicate-set machinery).
- `domainFromPredicate` extended to recognise effect predicates and produce the appropriate domain shape.
- Lattice ops (`intersect`, `join`, `imply`) extended for effect predicates — `pure` implies `pure`, `pure` does NOT imply `io`, `{io}` implies `{io, net}` if the bound is `{io, net}`.
- Existing chunk 1 inference (`src/effects.ts inferFunctionEffects`) refactored to produce predicates with `source: "effects-inferred"`. Declared `effects` clauses produce `source: "effects-declared"`.
- `effects_attach` becomes a predicate-attachment, not a separate metadata channel.
- `introspect.ts` reads effects from the predicate set instead of the standalone field. The three render formats (`pure (inferred)` / `io (declared, verified)` / `io (declared) ⊇ pure (inferred) ✓`) still work but pull from the unified source.
- Pure-literal arithmetic stays uninstrumented (same rule as Phase B).

### P2. Param effect bounds — surface A

- Grammar: extend type-expression syntax to accept lowercase effect labels in any type-expression position. The labels are recognised against the registered effect-label set (which is extension-driven; libraries register their own labels).
- Tree-builder: type expressions containing effect labels produce predicate set entries on the param. A bare `pure` / `io` is sugar for an effect-only predicate; combined `Int && _ > 0 && pure` produces a predicate set with a refinement plus an effect bound.
- `applyComposed` checks the param's predicate set against the arg's inferred effects when binding (call-site check) — same dispatch as refinement check.

### P3. Param effect bounds — surface C

- `lib/effects.alg` adds `param_effects` stmt_form: `param_effects f: pure` (and multi-line / multi-param forms).
- Tree-builder's block-expression preprocessor handles `param_effects_decl_marker` similarly to other contract markers — extracts and attaches the bound to the relevant param's predicate set before the body.
- A and C both lower to the same `PredicateSet` entry on the param. Either or both may be present without conflict.

### P4. HOF inference walker (chunk-2 core)

- `src/effects.ts inferFunctionEffects` walker recognises `Expression(Param(p), …)` calls.
- Looks up `p`'s effect-bound predicate from its predicate set.
- Adds the bound's effect set to the running inferred set (same path as primitive intrinsic effects).
- Call-site check: when applying a function whose params declare effect bounds, check each arg's inferred effects ⊆ bound. Mismatch produces a `CompilationReport` error (same shape as chunk 1's declared/inferred mismatch).
- **Alias tracking** (`g = f; arr.map(g)`) is **in scope**. Effect predicates flow through value bindings like any other type information.

### P5. Effect polymorphism — chunk-3 core

- Effect variables declared via generic parameter list: `map[e: Effect](arr, f: e): Array && e`. Same syntax as type parameters; reuses `[]` brackets for declaration (a generalization of the existing `[]` for application — `Array[T]`).
- Function-declaration grammar extended to accept `[T1, T2, e: Effect]` after the function name. Kind annotation optional; default kind is `Type`. Implicit type-variable mechanism continues to work for the unambiguous cases.
- New predicate-set entry: effect variable — symbolic, bound at call site.
- Function signatures may carry effect variables in param-type and return-type positions; the variable in the return type refers to the same declaration.
- At call site: solve the effect variable from the arg's actual effects, propagate to the return's effect predicate.
- **Multi-variable polymorphism** (e.g. `compose[e1: Effect, e2: Effect](f: e1, g: e2): e1 && e2`) is in scope. Conjunction `&&` over Effect values is operator dispatch on the Effect type — `&&` is already overloaded by left-operand meta-type (logical AND, refinement, now effect conjunction). PE simplifies (e.g. `e && e == e` by idempotence; `pure && e == e` by identity) via existing expression simplification — no special type-level lattice infrastructure.
- **Auto-promotion** of unannotated function-typed params: falls out of the existing type-variable mechanism. An unannotated function param has an unresolved effect-bound slot, treated as a fresh effect variable. The variable propagates through the function's inferred effect set and binds at call time. Explicit `[e: Effect]` declaration is for clarity / contract honesty, not soundness — both forms produce equivalent inference.
- **Effect expressions** in declaration positions: any valid expression producing an `Effect` value is allowed (`if cond then io else pure`, `e1 && e2`, method calls on Effect, etc.). PE handles concrete cases; residuals handle symbolic. Equivalent to how refinement predicates work.

### P6. Stdlib HOF annotations

Target shape (settled in design discussion):

```alg
// Array methods (built-in / lib/collections.alg)
map[A, B, e: Effect](arr: Array[A], f: (A) => B && e): Array[B] && e
filter[A, e: Effect](arr: Array[A], pred: (A) => Bool && e): Array[A] && e
reduce[A, B, e: Effect](arr: Array[A], f: (B, A) => B && e, init: B): B && e
all[A, e: Effect](arr: Array[A], pred: (A) => Bool && e): Bool && e
any[A, e: Effect](arr: Array[A], pred: (A) => Bool && e): Bool && e

// lib/collections.alg pure operations (no effect-polymorphic params)
range(start: Int, end: Int): Array[Int]                       // effects pure
zip[A, B](a: Array[A], b: Array[B]): Array[(A, B)]            // effects pure
flatten[A](arr: Array[Array[A]]): Array[A]                    // effects pure
take[A](n: Int, arr: Array[A]): Array[A]                      // effects pure
head[A](arr: Array[A]): A                                     // effects pure
sum(arr: Array[Int]): Int                                     // effects pure

// lib/functional.alg combinators
identity[A](x: A): A                                          // effects pure
constant[A, B](x: A): (B) => A                                // outer + inner pure
flip[A, B, C, e: Effect](f: (A, B) => C && e): (B, A) => C && e
apply[A, B, e: Effect](f: (A) => B && e, x: A): B && e
twice[A, e: Effect](f: (A) => A && e, x: A): A && e           // e && e simplifies to e
thrice[A, e: Effect](f: (A) => A && e, x: A): A && e          // same
compose[A, B, C, e1: Effect, e2: Effect]
  (f: (B) => C && e2, g: (A) => B && e1): (A) => C && (e1 && e2)
pipe[A, B, C, e1: Effect, e2: Effect]
  (f: (A) => B && e1, g: (B) => C && e2): (A) => C && (e1 && e2)
on[A, B, C, e1: Effect, e2: Effect]
  (f: (B, B) => C && e1, g: (A) => B && e2, x: A, y: A): C && (e1 && e2)
```

- Conjunction simplification (`e && e == e`, `pure && e == e`) handled by PE's existing expression simplification.
- Tests verify effect propagation works end-to-end: concrete callbacks (`map(arr, print)` → `io`), polymorphic chaining (`compose(f, g)` preserves both), nested HOFs (`map(arr, x => filter(x, pred))`).

### P7. Notification category in CompilationReport

- New `Notification` category alongside `errors` and `warnings`.
- Project config: `notifications: "error" | "warning"` (default `"warning"` for now; can be tightened later).
- Notifications produced in this chunk:
  - Param called but no effect bound declared (under-approximation)
  - Function value's effects can't be statically traced and runtime fallback isn't enabled
  - Param effect bound declared but param not actually called in the body (unused bound — minor)
- Per-binding suppression: deferred unless strong case emerges.

### P8. Runtime-effect-check fallback

- Project config: `runtime_effect_checks: "allow" | "warn" | "error"` (default `"warn"`).
- When PE leaves an effect predicate residual at a call site, behaviour depends on config:
  - `allow`: emit runtime check; no notification.
  - `warn`: emit runtime check; emit notification (default).
  - `error`: refuse to compile; emit error.
- Runtime check shape: the function value carries an effects-metadata field; the check verifies metadata ⊆ bound at call time. Function values constructed dynamically (e.g. parsed from text) carry an opaque marker that fails the check unless the bound is `unknown`.

### P9. `applyComposed` compile-time tracing — hypothesis test

- Validate the user's claim: `applyComposed` (and similar dynamic-application sites) can usually trace at compile time to a union of the inputs' effects.
- Where it works, integrate the union into the inference walker.
- Where it fails, document the failure mode and route through P8's runtime fallback.
- This is a research piece, not a deliverable. Possible outcome: most of `applyComposed` traces cleanly; a few patterns fall through to runtime.

### P10. Pilot + tests + website

- Pilot: `lib/math.alg` and `lib/collections.alg` updated to demonstrate HOF effects in a meaningful way (e.g. `Array.map`'s annotation actually flows through `lib/collections.alg` combinators).
- `tests/effects-hof-demo.alg` — surface A + C, basic param bound check, call-site check.
- `tests/effects-polymorphic-demo.alg` — polymorphic stdlib HOFs, propagation through caller chains.
- `tests/effects-notifications-demo.alg` — notification triggers, project-config flagging.
- Website: extend the Effects sandbox with a HOF example (per `project_website_loop.md` — features get a website update each cycle). Lead with the soundness gap → fix narrative.

---

## Out of scope (explicit)

- **Per-binding notification suppression.** Project config only, unless a strong case emerges.
- **Kebab-case effect names.** Lowercase + underscore for now.
- **Runtime parsing of functions from text** (full lifecycle). Recognized as a runtime-only case; runtime check via P8.
- **`mutation` effect label.** Waits on mutable references landing in the language.

(Multi-variable polymorphism, alias tracking, conjunction-based effect expressions, and effect arithmetic — formerly listed here — are now all in scope per the harmonic-grounding-tarski design discussion. They fall out of the effects-as-values framing without special infrastructure: any valid Allegro expression that produces an Effect value is allowed in declaration positions, with PE handling simplification and residuals.)

---

## Open hypotheses (to validate during implementation)

1. **`applyComposed` compile-time tracing covers the common case.** P9. Test by walking real call sites in `lib/` and `tests/` and seeing how many trace cleanly.
2. **Generic-parameter-list grammar interactions.** Adding `[…]` after function names introduces grammar ambiguity in some contexts (e.g. `f[x]` could be parsed as a function `f` with generic param `x`, or as indexing `x` in `f`). The function-declaration position should disambiguate cleanly, but worth validating against real code during implementation.
3. **Notification default = warning is the right starting point.** May need to tighten to error after a few real uses.

---

## Slicing (settled)

Two slices, end-to-end soundness preserved:

**Slice 1 — Foundation (invisible to users).** Type-system meta-type cleanup + Effects-as-values runtime substrate + EffectSet → PredicateSet refactor + Notification category + stdlib HOFs marked `opaque` as placeholder. Chunk 1 behavior unchanged. Reviewable as pure infrastructure.

Sub-chunks (in order):

- **1.0 — `NominalType` → `Type` collapse.** Single meta-type, optional `__name`, shape-aware comparison methods. `~T` projects to anonymous (clears `__name`). Touches `types-std.ts`, `evaluator.ts` `PRIM_TO_METHOD` paths, primitive dispatch, introspection, tests. Validate `~T` semantics on a couple of cases (`~Int instanceof Int`, `~Animal subtypeof Animal`). Necessary substrate for Effect's named + anonymous shapes. See `memory/design_type_system_meta_types.md`. **Multiple inheritance is explicitly deferred** — error-on-conflict design captured in backlog for future revisit.
- **1.1 — Effect type substrate.** `Effect` meta-type defined in `types-std.ts` (lives close to `Type`). One `Effect` with shape-aware named/anonymous dispatch (now possible thanks to 1.0). `pure` and `opaque` as core absolutes (lattice bottom and top). Lattice methods (`subset_of`, `implies`, `intersect`, `union`) as members on `Effect`. `&` operator overload (currently undefined in Allegro grammar) for type intersection / effect conjunction. Tests at the Value level.
- **1.2 — `EffectSet` → `PredicateSet` refactor.** P1 from the pieces list above. New `EffectsPredicate` predicate kind with `source: "effects-declared"` / `"effects-inferred"`. `effects_attach` becomes a predicate-attachment, not a separate metadata channel. Chunk 1 behavior preserved.
- **1.3 — Notification category + stdlib `opaque` marking.** P7 from the pieces list. `CompilationReport.notifications` collection with per-project severity (replaces hard-coded errors-vs-warnings; tracked separately on the backlog as a broader effort). Stdlib HOFs (`Array.map`, etc.) tagged `opaque` as placeholder until Slice 2 polymorphism lands. Sustains soundness through the in-between window.

No new public surface in Slice 1.

**Slice 2 — Full HOF story (chunks 2+3 combined).** Surfaces A + C, generic param list grammar, HOF walker with alias tracking, polymorphism with multi-variable + auto-promotion + effect expressions, stdlib HOF annotations (proper polymorphic per the draft), runtime-fallback config, `applyComposed` hypothesis test, pilot + tests + website.

Pieces: P2, P3, P4, P5, P6, P8, P9, P10.

After Slice 2: complete chunks 2+3 story, end-to-end soundness, no in-between window with misleading badges.

Why combined 2+3 and not separate:
- Auto-promotion needs polymorphism infrastructure anyway (a function param's effect bound is treated as a fresh variable when unannotated — that's the type-variable mechanism, which Slice 3's polymorphism work enables).
- Param-type-slot effect bounds and generic param lists are coupled grammar work; doing them in one pass is more coherent.
- Avoids stdlib churn (mark `opaque` then re-annotate properly).
- Slice 1's `opaque` placeholder for stdlib HOFs sustains soundness through the in-between window — but if Slice 2 didn't follow promptly, every `arr.map(print)` would trigger a notification, which becomes its own kind of noise.
