# Allegro — Project Summary & Instructions

## Methodology — binding

This project follows majodali/methodology v1.0.0 as declared in
`docs/classification.md`. That file strictly defines this project's
document lifecycles and workflows. Read it before any work; nothing
in this file or under `.claude/` overrides it.

Classification: C2 / S0 / language-tool-platform / static-site
Deviations: none

Note: this file is designated `in-progress` under the adoption
transition (`docs/classification.md` §Adoption transition) — it still
exceeds the K-002 bootstrap size and carries content that will move to
`docs/` in the methodology-adoption arc
(`docs/plans/methodology-adoption.md`).

## Documentation map (read first)

- **Vision, thesis, design principles:** `docs/VISION.md` (Tier 0 — never edit without maintainer sign-off)
- **Process, lifecycle, quality guidelines, agent rules:** `docs/PROCESS.md` (Tier 0)
- **Durable design truth per area:** `docs/design/` (type system, effects, pattern matching, grammar)
- **Plans:** `docs/plans/` — read `README.md` (manifest) first
- **What's next:** `BACKLOG.md`
- This file is the session contract: build/run, architecture summary, invariants. It is being slimmed per the 2026-06 documentation refactor — history will move to `docs/CHANGELOG.md`.

## Build & Run

```bash
npx tsc --noEmit                    # type-check
npx tsx src/index.ts                # REPL (Allegro Standard — default)
npx tsx src/index.ts file.alg       # run a file (Allegro Standard)
npx tsx src/index.ts --base         # REPL (Allegretto)
npx tsx src/index.ts --base file.alg  # run a file (Allegretto)
npx tsx src/test.ts                 # run all tests
```

**Expected output from `basics.alg`:**
```
11
42
120
42
55
42
7
```

**Test .alg files** are in `tests/` and exercise Allegro Standard features.
They are validated automatically by the test suite via `// expect:` comments.

## Project Setup

- ESM modules (`"type": "module"` in package.json, `"module": "nodenext"` in tsconfig)
- All imports use `.js` extensions (required by nodenext resolution)
- `parser.ts` is auto-generated and uses `// @ts-nocheck` — do not add type annotations to it
- `TextEncoder`/`TextDecoder` for string↔bits (web-standard, works in Node and browsers)
- The Earley parser in `parser.ts` handles its own lexing (no separate lexer)

## What is Allegro?

Allegro is a **programmable language platform** — a minimal, flexible core ("Allegretto") that serves as a substrate for building higher-level languages and DSLs. The standard language ("Allegro Standard") is a curated stack of extensions providing familiar syntax, a type system, and common data types.

- **Allegretto** — the primitive language: 7 value kinds, expression DAGs, recursive evaluator
- **Allegro Standard** — the standard language with types, modules, and extensions
- In normal use, "Allegro" refers to the standard language

### Key Design Goals
- **Human-AI collaboration**: Humans and AI agents negotiate domain abstractions, codify them as DSLs/type extensions, then both work within shared formalisms
- **Extensible grammar**: New syntactic constructs via grammar extensions, importable as modules
- **Configurable semantics**: Functional/non-functional, sync/async, type systems — all as extensions
- **Partial evaluation as compilation**: Each build phase is a partial evaluation step where phase-specific resources become available

## Architecture

```
Base language API (expression DAGs, evaluation contexts)
  → Base parser (first grammar, offside-rule blocks)
    → Grammar extension mechanism (GrammarBuilder, immutable layering)
      → Type system (types as MultiValue "type" components)
        → Module system (anonymous extensions, module loader)
          → Allegro Standard (typed literals, dot dispatch, logical ops, collections)
```

## Values: representations + computation forms (C7.1, D46)

A VALUE is (representation, channel plane). The host representations
(the `ValueKind` taxonomy — a host discriminant, not language spec):

- **Bits** — Vector of bits with a length. Encodes integers (64-bit), floats (IEEE 754), and strings (UTF-8).
- **PrimitiveFunction** — Opaque host-language function. May be `lazy` (receives unevaluated args).
- **ComposedFunction** — Expression body with declared parameter placeholders.
- **Structure** — THE one composite representation (records, arrays, types, effects, proofs — data plane + channel plane). A **carrier** is a Structure in the D15 transparent configuration — EMPTY data plane + `primary` — carrying a non-Structure value's channels (typed scalars, typed functions, residuals-with-components); it answers the same kind, discriminated host-side by primary presence (`isCarrier`). The former `MultiValue` and `Context` kinds are RETIRED (`MultiValueType` survives as the carrier's static type). **Scope** is the evaluation-environment ROLE on the shared substrate (D25) — own protocol, never dispatched or typed.

And the computation forms (things that evaluate to something else):

- **Expression** — A DAG node: function reference + ordered arguments. The core computational construct.
- **Param** — A positional placeholder within function expressions, bound on invocation.
- **Symbol** — A named reference, resolved during compilation via lexical scoping. Created by the parser for identifiers, resolved by `resolveSymbols` to bindings or Params.

The DEFINITIONAL LADDER (D46): representations (host, above) → values
(representation + channels) → types (language-level classifiers over
representations: Int over Bits, `Function[P,R]` over functions, record
types over Structures) → kinds (types whose instances are type-values).
`kind` is unobservable from Allegro — `type of`, patterns, and channel
reads answer every language-level question.

## Type System (Allegro Standard)

Types are Structure values with `__name`, `__type`, `__members`, and other meta-bindings. A typed SCALAR (Bits data) is a CARRIER — a transparent Structure with an empty data plane whose data rides in `primary` (C7.1/D15); a typed RECORD/ARRAY is a **flattened Structure** — channels attach directly (a Structure primary handed to `makeMultiValue` derives copy-on-write). Everything answers `ValueKind.Structure`; `dataOf` peels carriers and is identity for records. **Types themselves are typed** — user-visible type bindings ARE the internal type Contexts (`Int` is IntType itself; its meta-type answers through the `__type` binding via the total `getType`/`channelReadRaw`). `Int instanceof Type` returns true, and `type of Int` returns Type. The `NominalType` alias is RETIRED (C7.1) — after D44 there is no nominal checking left for the name to name; `Type` is the one root kind. Internally, type infrastructure reads data via `dataOf()` (identity for Contexts).

### Ten Core Types
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

### Generics
- Generic types are type constructors: `Array` is a function from type params to concrete types
- `Array[Int]` is a concrete type produced by applying `Array` to `Int`
- Type parameters can be types or values (e.g., `Vector[3]`)
- Concrete types are memoized — `Array[Int]` always returns the same Context
- Generic types have `type = GenericType` (C7.2a: a kind through the Effect recipe — draws Type's kind-member symbols, declares the `params` instance field; `isGenericType` is a SHAPE check, the `__isGeneric` flag is retired). The applier IS the generic's `construct` slot (D45 one-surface; the `__constructor` alias is retired). `params` is a typed `Array[String]` instance field (`Array.params` → `[T]`). GenericType holds no construct authority YET — a deferred public surface (C7.2 ruling R1 as amended: not integrity-required kernel privacy; user-defined generics await surface design — per-generic gensym'd member scopes + a spec form). Applied concretes stay shape Type with host-read `__args`/`__generic`
- Bare generic in annotations auto-applies `Any`: `arr: Array` → `arr: Array[Any]`

### Function Types and Unification
- `Function[ParamTypes, ReturnType]` — parameterized type for typed functions
- Type variables (unresolved Params in type expressions) bind progressively during function calls
- Unification: match arg types against param types, accumulate type variable bindings
- Bidirectional flow: `T` determined from one arg propagates to constrain others
- Contradictory bindings (e.g., `T = Int` and `T = String`) produce type errors

### Member Descriptors (__members)
- Every type has a `__members` Context containing named member descriptors
- **Method descriptors**: `{__type: MethodType, name: String, value: PrimitiveFunction, getter?: 1}` — executable methods with optional getter flag
- **Field descriptors**: `{__type: FieldType, name: String, fieldType: Type}` — typed field declarations (on record types)
- `typeMethod(type, name)` reads from `__members` first, falls back to direct bindings — the single bridge function for all member access
- `typeMemberDescriptor(type, name)` returns the full descriptor for dispatch-level access
- The Type meta-type stores its kind API (instanceof, subtypeof, define, distinct) in `__members`. `instanceof` and `subtypeof` are conformance checks; `define` is the NAMED FACTORY delegating to the kind's `construct` authority. The fluent API (`extend`/`where`/`interface`/`mixin`/`preserveOps`/`invariant`) is REMOVED (D44/D45, no sugar): records/methods/bundles are `Type.define(spec, ...bundles)`, refinements and invariants are the `&` mint, interfaces are `Interface.define(spec, ...bundles)`, operator preservation is the Refinement spec's `preserve` option. C7.2b: `distinct` is the SYMBOL-FRESH newtype mint (members re-declared under a fresh scope — non-conformance falls out of symbol-identity membership by construction); the post-hoc `constructor` meta-method is REMOVED — construction authority is declared at mint time via the reserved `construct` spec key (`Type.define({x: Int, construct: (a) => …})`).
- Structural checking compares `__members` collections: every member in the expected type must exist in the actual type

### Type-Directed Dispatch
- C3.1 shape/knowledge split (D36): dispatch reads the SHAPE — `typeShape` (src/slots.ts) walks past member-transparent refinement layers (predicate-carrying, `__members` shared with the parent by object identity); preserve-lifted, method-layer, and define types mint their own member sets and ARE shapes (their overrides run — Liskov). The stored `type` component keeps the full view (refinement bound included); `channelReadRaw(v, "shape")` returns the computed shape; `knowledgeOf(v)` (src/refinements.ts) returns the unified intrinsic-knowledge carrier (bound certificate + predicates, one lattice via `meetKnowledge`). `withType` refuses cross-shape re-stamps post-construction; the `typed_*` literal wrappers are construction points (`withTypeReplacing` corrects typeLiterals' 64-bit Int guess).
- `type_dispatch` checks the value's shape, looks up member descriptor from `__members`, returns a self-bound closure
- Getter descriptors are called immediately with self; method descriptors return bound functions
- Field descriptors look up the field value on the instance's primary Context
- The evaluator's `PRIM_TO_METHOD` mapping dispatches base operators (`bits_add` etc.) through `typeMethod()` on the shape when operands are typed
- Type methods return properly typed values — comparisons return Bool, arithmetic returns the operand type
- No implicit fallback — missing type method is an error
- Types can define `__getMember(self, fieldName)` as a fallback for fields not in `__members` (like Python's `__getattr__`). Object uses this for field access. Types without `__getMember` enforce strict encapsulation.
- Types can define `__construct(args...)` — when a type Context is called as a function, the evaluator invokes `__construct`. Built-in types (Int, Float, String, Bool) have constructors that wrap values with the type.

### Type Propagation
- `typeLiterals` post-parse pass wraps raw Bits with type info (64-bit → Int, other → String)
- Float and Bool literals come from grammar extensions and type system bindings
- Type methods return properly typed values (not raw Bits)

### Type Annotations
- Function parameters: `f(x: Int, y: String) => body`
- Return types: `f(x: Int): String => body`
- Type expressions support generics: `f(arr: Array[Int]) => ...`
- Untyped functions via base grammar still work (`f(x) => x + 1`)
- Type checks at call site: `applyComposed` checks arg types against FunctionType param types before substitution. Handles unions, structural, generics with arg comparison. No type_check wrappers in function bodies.
- C3.2 (D36): annotations are KNOWLEDGE UPPER-BOUNDS. Passing a Dog through `a: Animal` stamps an occurrence `bound` component — Dog-only members are hidden (`'tricks' is not visible through annotation 'Animal'`) until a `when a is Dog` type pattern narrows the arm; visible members still dispatch through the value's shape (overrides run). Crossing a boundary of the value's own shape resets the bound; intrinsic knowledge (refinement certificates) survives looser annotations. Named nominal concrete types only — Any/function/effect/interface/union/generic annotations set no bound; base Object and module types are open (no hiding).

### Type Hierarchy — the kind tower (C6.1b, D45)
- **Type** — the root kind. Concrete/record types have `__type = Type`. Type self-types (`Type.__type = Type`, the D7 fixed point).
- **Refinement** — a SUB-KIND of Type (draws Type's kind-members + declares `refines`/`constraints`). Refined types answer `__type = Refinement`; `Refinement(base, pred)` is the mint `&` sugars; the spec form is `Refinement.define({refines, where, preserve?, ...methods})`.
- **Interface** — a REFINEMENT of Type (member-transparent over Type's kind API, restricted by the declaration-only predicate: instances hold no value-constructor authority). Interfaces answer `__type = Interface`.
- The ratified half-lotus matrix: `Type : Type` ✓, `Refinement : Type` ✓, `Interface : Refinement : Type` ✓, `Refinement : Interface` ✗ (holds constructor authority). Pinned by a boundary battery.
- **Proof** — a kind since C6.3: draws Type's kind API; instances carry `proposition`/`reason`/`counterexample`/`lhs`/`rhs` as declared fields (`t.proposition` dispatches) plus the `__discharged` INTEGRITY CHANNEL. Constructor authority is KERNEL-PRIVATE — Proof holds no `construct` (`Proof.define` refuses; calling Proof mints nothing); the only mint is `makeProof` holding the module-private discharged writer. Unforgeability is an ordinary capability instance.
- **Effect** — a kind since C6.2 (D40): draws Type's kind API (no whitelist — kind-hood IS conformance to Type). Instances (`pure` = {}, `Effect("io")` = {io}, `opaque` = top) stamp `__type = Effect` and ARE their label sets, memoized so label-set identity is physical identity. Members live once on the kind (`io.union(time)` dispatches through shape; no per-instance copies, no refines chain). `io & time` mints an anonymous conjunction instance (the `&` operator is Effect's join). `pure instanceof Effect` is the membership check; `pure subtypeof Effect` is false (instances relate to each other by the kind's ORDER — `subset_of`/`implies`, label-set inclusion — never by conformance).
- Constructor authority (D45 R2): `construct` (`__construct` slot) is the per-kind minting member; call-as-function invokes it at every level (`Int(42)`, `Type({v: Int})`, `Refinement(Int, p => p > 0)`); `define` is the named factory delegating to it.
- `instanceof`/`subtypeof` on Type are ONE unified conformance check (C6.1a, D44): identity, then the loose base-name path when the expected type is anonymous (`~T`, inline `{x: Int}`), then the `__refines` chain (refinement layers), then symbol-identity membership over `__members` (declared conformance — a type conforms by DRAWING the expected type's member symbols). The nominal name-walk is deleted; there is no declared is-a edge outside refinement.
- The named-vs-anonymous distinction is a property of the type value, not of its meta-type. (The old `NominalType` alias is retired — C7.1.)

### Interfaces
- Declared via `Interface.define({member: Type, ...})` — produces a declaration-only type with `__type = Interface`
- `__members` contains Field descriptors for declared members, plus inherited non-meta members from parent
- No `__construct`, `__getMember`, or auto-generated methods — interfaces declare structure only
- `__interface` marker binding distinguishes interfaces from record types
- **Conformance is DECLARED (C5.2c, D30)**: an interface check is SYMBOL-IDENTITY membership — a type conforms by DRAWING the interface's member symbols (`Point = Type.define({x: Int, y: Int}, HasXY)` binds them), not by spelling the same member names. `42 instanceof Printable` is false unless Int drew Printable's symbols.
- **Duck-typing is `~T`** (the loose path): `~Printable` projects the interface into the base-name world — `v: ~Printable` accepts any value whose type has a same-named `toString`.
- Drawn bundles: `Interface.define({extra: Int}, Int)` copies Int's member symbols plus `extra`
- Auto-named when bound to a symbol: `Printable = Interface.define(...)` → name is "Printable"

### Method Members (the mixin surface is `define` — C6.1b)
- A `define` spec entry whose value is a FUNCTION VALUE is a method implementation: `Type.define({x: Int, mag: (self) => self.x * self.x}, Int)`. Function TYPES (`toString: Function`) still declare fields.
- Methods receive `self` (the typed instance) as first argument — field access (`self.x`) and method calls dispatch through the type
- A method whose name matches a drawn member OVERRIDES it (binds the drawn symbol — C5.2b, same rule as fields); methods do not participate in the positional constructor
- **Reusable mixins are BUNDLES**: a methods-only spec (`MagMixin = Type.define({mag: (self) => ...})`) mints a pure member set with no auto-generated construct/toString, drawn like any bundle: `Type.define({x: Int, y: Int}, Int, MagMixin)` — and drawing it declares conformance (`A subtypeof MagMixin`)
- Methods on refined scalars go through the Refinement spec: `Refinement.define({refines: Int, where: p => p > 0, double: self => self + self})` — non-reserved entries must be functions; same-name additions to the base error (no drawn bundle to override)
- Method impls are ComposedFunctions stored in Method descriptors; `type_dispatch_impl` handles self-binding for both PrimitiveFunction and ComposedFunction descriptors

### Declared vs Loose Typing (C6.1a — nominal checking is gone)
- Named types use **declared conformance** by default: `f(x: Animal)` requires x's type to hold Animal's member symbols (drawn via `Type.define(spec, Animal)`) or refine it. There is no name-based is-a walk.
- **`~` operator** (structural wrap): `~Animal` uses LOOSE structural checking — any type with same-NAMED members matches (base-name projection, the duck-typing path).
- **Interfaces** check the same way as named record types: DECLARED conformance, symbol-identity membership (C5.2c). `~Interface` erases the marker and duck-types by name.
- Dispatch happens inside Type's unified `instanceof`/`subtypeof`: identity → loose path (expected anonymous) → `__refines` chain → symbol-identity membership.
- `structuralWrap(type)` clones the type, erases its `__name` AND its `__interface` marker, and shares the member-set object. `__wraps` keeps a back-link to the original named type.
- Unnamed type expressions (inline `{ ... }`) are always structural.

### Refinement Types
- Declared via `Type & <predicate>` where `_` in the predicate refers to the value being checked: `PositiveInt = Int & _ > 0`. THE constraint surface — `where` and `invariant` folded into it (C6.1b): chained `&` gives per-clause layers (`Int & _ > 0 & _ < 100`), and record predicates reach fields through `_` (`Type.define({lo: Int, hi: Int}) & _.lo <= _.hi`). (`&` is the type/effect conjunction operator, distinct from `&&` which is purely logical AND since Slice 2 Stage 0.)
- `&&` in expression position is overloaded: if the left operand is a type (has meta-type Type), it creates a refined type via `buildRefinedType`. Otherwise it's logical AND. `typed_and_impl` dispatches at runtime.
- Compound predicates: `Int & _ > 0 && _ < 100` parses as `Int & ((_ > 0) && (_ < 100))` because `&` is at a looser precedence than `&&`. The whole `_ > 0 && _ < 100` becomes a single predicate body; `domainFromPredicate` recognises the conjunction as a single interval (`[1, 99]`) for compile-time reasoning.
- Predicate is an Allegro lambda with parameter `_`. `buildRefinedType` stores it as `__predicate` on the refined type.
- **Construction check**: `__construct` wrapper evaluates the predicate on the constructed value. If false, returns an error value instead of the refined value.
- **Annotation/call-site check**: `type_check_impl` and `checkArgType` evaluate `__predicate` after the nominal/structural base check passes. Short-circuits when `actualType === expectedType` (value was already refined through the same type).
- **Partial evaluation integration**: predicates are Allegro expressions, so they partially evaluate naturally with known values. Unresolved predicates produce residual type checks.
- **Operator preservation**: `Refinement.define({refines: Int, where: p => p > 0, preserve: ["add", "sub"]})` (or `preserve: "all"` for the default numeric set). Lifts the named operators: after the parent op runs, the result is fed through `__construct`, re-running the predicate check and tagging with the refined type. This makes `x + 3` where `x: PositiveInt` produce a `PositiveInt` instead of bare `Int`.

## Parser (Hybrid: Pratt + Recursive Descent)

The parser is a hybrid design:
- **Lexer** (`src/lexer.ts`): tokenizer with maximal munch, keyword disambiguation, float vs int, source location tracking, indentation (offside rule) support. Token tables are dynamic via `LexerConfig` — extensions add new operators/keywords without modifying lexer code. Indent tokens suppress Newline for expression continuation.
- **Pratt parser** (expression level): O(n) with data-driven precedence/associativity tables. Handles all operators, function calls, dot access, bracket access, array/object literals, if-then-else, lambdas. Expression continuation via `continuationDepth` — indented lines are treated as continuation within expressions.
- **Recursive descent** (statement level): file structure, statements, blocks, function declarations, import/export.
- **Earley parser** (`src/parser.ts`): retained as fallback for standalone grammars (JSON, custom DSLs). Grammar classes (`Grammar`, `Terminal`, `Phrase`, `Disjunction`, `Repetition`, `Optional`) and `parseGrammar` still exported.

### Keywords
Keywords (`if`, `then`, `else`, `when`, `is`, `of`, `import`, `export`, `true`, `false`, `none`, `error`, `instanceof`, `subtypeof`) are properly disambiguated from identifiers by the lexer. New keywords can be registered via `LexerConfig`.

### Grammar Extension
- **Earley extensions** (`GrammarBuilder`): still available for standalone grammars and grammar primitive tests
- **Hybrid extensions**: `HybridGrammarConfig` with prefix/infix parselet registrations and `LexerConfig` for new operators/keywords. Immutable layering via `extendLexerConfig`.
- **Parser combinators from Allegro** (Phase 1 DSL primitives): `grammar_new`, `grammar_terminal`, `grammar_phrase`, `grammar_choice`, `grammar_choice_add` (mutable append for recursion), `grammar_repeat`, `grammar_optional`, `grammar_set_target`, `grammar_parse`. Build grammars at runtime, parse strings, receive a tree of Allegro values — Terminal→String, Phrase→Array (positional), Disjunction→transparent (unwrapped), Repetition→Array (delimiters stripped), Optional→value or none. Parse errors become typed Error values. Example demo: `tests/grammar-regex.alg` implements a regex DSL end-to-end.
- **Grammar 2 formalism (new, Phase 1 in progress)** — scannerless formalism described in `docs/grammar-formalism.md`. Will replace Pratt + Earley in Phase 2. Rule union (Terminal/NonTerm/Seq/Alt/Rep/Opt/Guarded), named productions, symbolic precedence, stateful indent terminals, grammar-value extension via `Operation` deltas, user-defined `@error` productions with `@sync` panic recovery. Phase 1 status: types + engine + Allegro primitives (`grammar2_*`) + tests covering the §10.3 regex DSL. Not yet: analyzer, indent engine, left recursion via full GLL, migration of existing Allegro grammar.
- **Runtime grammar extension** (Phase 6 + 6b): modules declare syntax additions in a `grammar { … }` block:
  - **Operators** (Phase 6): `infix S prec(X) left/right/none => (l,r) => ast`, `prefix S at(X) => …`, `postfix S at(X) => …`, `expr_prefix KW => …`. Precedence clauses accept named levels (`prec(pow)`), positional constraints (`above(mul) below(unary)`, single or combined), and operator-symbol lookup (`at("*")`). Anonymous levels get gensym'd names. Level insertion in `src/grammar2/fragments.ts` splices new productions into the stratified stack via surgery on the base grammar (LEVELS array in `base-grammar.ts`).
  - **User rules + multi-token forms** (Phase 6b): `rule NAME = ebnf_body => template` adds/replaces a production; `rule NAME += …` appends an alternative. `expr_form parts => template` adds a new multi-token expression alternative (e.g. `match x with p => e | …`); `stmt_form parts => template` adds a new statement alternative. EBNF inside rule bodies supports `"lit"`, `/regex/`, ident refs, `s:rule` labels, `a*`/`a+`/`a?` postfix, `a ** sep` sep-rep, `(a | b)` grouping. Labels bind positionally to the template's params; `substituteParams` injects matched sub-ASTs at parse time. Whitespace between seq items and around rep separators is auto-interleaved.
  - **Activation**: top-of-file `use NAME` / `use import NAME` header. The pre-scanner loads the named module and harvests any `grammar { … }` Grammar values from its bindings.
  - **Validation**: cross-fragment validator runs before merging and reports `E_OPERATOR_CONFLICT` / `E_KEYWORD_CONFLICT` / `E_PRECEDENCE_CYCLE` at `use` time with aggregated messages.
  - Phase 1 `register_infix` / `register_prefix` / `register_postfix` / `register_expr_prefix` primitives retain as a lower-level back-compat path.
  - Demos: `lib/pow.alg` (adds `**` and `neg`, consumed by `tests/grammar-runtime.alg`), `lib/match_expr.alg` (adds `match x with p1 => e1 | … | pn => en`, consumed by `tests/match-demo.alg`).

## Module System

- **Anonymous extensions**: named bindings injected by the execution context, layered between primitives and source
- **ModuleLoader**: loads `.alg` files as extensions with dependency resolution, caching, circular dependency detection
- **Import syntax**: `import name` — declarative, module values provided via extensions
- **Context layering**: primitives → extensions → base (REPL persistence) → source bindings. C2.3b: real scope-chain layers (`src/scope.ts` parent links, O(1) extend, chain-walking lookup), not a flat copy — the returned eval ctx is the SOURCE layer; its own map holds only source-level bindings. Flat-view consumers use `scopeAllBindings` (chain flatten)
- **Export system**: `export("name", value)` primitive marks bindings for export. `buildModuleObject` wraps exported bindings as a typed Object. Planned: full typed module interfaces with encapsulation via type-directed dispatch.
- **Module objects**: imported modules are typed Objects — dot access dispatches through the module's type, exposing only exported fields.
- **Module encapsulation**: `type_dispatch` enforces encapsulation for typed values — only fields listed on the type are accessible. Types use `__getMember` for controlled field access; module types restrict to exported fields only.
- **System library**: `lib/` directory alongside `src/` provides standard library modules. Module resolution: local `lib/` first, then system `lib/` fallback. Modules are parsed with the standard parser and have full access to the type system (Float, Int, etc.).
- **Standard library modules**: `math` (sqrt, pow, sin, cos, etc. + constants PI, E), `functional` (compose, pipe, identity, etc.), `collections` (range, zip, flatten, reverse, sum, etc.)

## Partial Evaluation

Partial evaluation follows two rules:
1. **Rule 1**: If an expression results in an undefined value to be passed to a primitive, the partially evaluated expression is returned (with unbound symbols visible). If the args have type components, the result type is propagated to the residual expression.
2. **Rule 2**: If `eval_if` (or any lazy primitive) has an undefined condition, all branches are partially evaluated non-lazily, propagating type information through both paths.

After partial evaluation, an expression's type is its `"type"` MultiValue component — which may be fully resolved or itself a partially evaluated expression. No separate `typeOf` function is needed.

### Forward-Chaining Reactive Evaluation
- `DepCollector` tracks incomplete symbol references during evaluation
- `DependencyRegistry` maps incomplete bindings to their dependents
- C2.3b resolution unification: an unresolved binding IS a future cell — `Binding` carries `value` (undefined while pending) + `incompleteDeps` + `isComplete`; the registry tracks the SAME objects the eval scope's source layer holds (no `currentValue` mirror, no dual writes). Declared-but-unresolved names (unprovided imports) get pending cells on the source layer — distinguishable from absent names, which have no binding on any layer
- `propagateCompletions` re-evaluates dependent residuals when bindings complete (cascading)
- `applyPhase` resolves pending cells IN PLACE (or adds new bindings) and triggers re-evaluation — used for imports, REPL, multi-phase builds
- Residuals are replaced (not mutated) on re-evaluation — no stale state
- `ctx_resolve` (reflective op) never throws: absent name → Error-typed value; pending cell → residual Symbol (design §4, D11)
- Memoization disabled — forward-chaining replaces it for incomplete expressions

### Implicit Async via Futures
- `FutureManager` (`src/futures.ts`) bridges JavaScript Promises to forward-chaining
- Async primitives (e.g., `delay(ms)`, `fetch(url)`) create synthetic pending future cells (`__future_N`, `value: undefined`) shared by the eval scope and the registry
- The evaluator treats them as unresolved Symbols — produces residuals naturally
- When the Promise resolves, `applyPhase` provides the value and cascades re-evaluation
- `print` defers on unresolved args — returns a residual that fires when the value resolves
- No `await` keyword — async is implicit through forward-chaining
- Bare expressions with futures are tracked via synthetic `__bare_N` bindings
- **`fetch(url)`** — HTTP GET, returns a future that resolves to the response body (String). Errors become error values. Works in both Node (18+) and browsers via `globalThis.fetch`.
- **Web sandboxes** use `evalAllegroAsync` with streaming output — print output appears incrementally as futures resolve

### Compile-Time Type Inference
- `precompileFunctions` pass in `evalSource` partially evaluates typed function bodies at definition time
- Typed params get placeholder MultiValues (unresolved primary + resolved type component)
- `type_check` proceeds when the type component is known, even if the primary is unresolved
- `applyPrimitive` propagates type components through residual Expressions
- Return type inferred from the partially evaluated body's type component
- `CompilationReport` returned from `evalSource`: inferred return types, type errors, unresolved bindings

### Full-Program Type Inference
- The evaluation loop IS the compilation pass — types propagate through all bindings naturally
- `CompilationReport.bindingTypes` records the inferred type for every binding
- Untyped functions infer types at each call site — typed args flow in via substituteParams, type-directed dispatch produces typed results
- Polymorphic: same function at different call sites produces different types (each specializes independently)
- Recursive functions: return type inferred through execution (eval_if Rule 2 propagates common branch types)
- No separate type inference algorithm — partial evaluation IS type inference

## Build/Execution Context

Each build phase is a successive partial evaluation where phase-specific resources become available:
- **Invocation**: build tool selection
- **Configuration**: CLI args, env vars, config files, folder structure
- **Compilation**: extensions, type system, module system, source files bound; type checking via partial evaluation
- **Emitting**: target configuration, debug symbols, target-specific optimization
- **Packaging**: third-party dependency implementations bound; tree shaking
- **Deployment**: environment resources, datastores, config bound
- **Execution**: runtime I/O, process, filesystem bound; final evaluation

Phases are not strictly defined — a scripting environment may have only one phase where all bindings are available at once. Phase gate checks (postconditions) scan the expression graph for unresolved elements.

Anonymous extensions are pre-loaded into the compilation context. Extension modules may consume bindings internally (e.g., module system uses a filesystem).

## Current Implementation State

### Files

- **`src/types.ts`** — Value types, constructors, utilities, Extension interface, string↔bits, float↔bits. C4.1: `makeMultiValue`/`makeContext` are shims over the unified Structure class — construct structures ONLY through them (a stray object literal fails the W4 boundary invariant)
- **`src/structure.ts`** — The unified host representation (structures Phase 4): one class behind both MultiValue and Context, role fixed at construction, single declared hidden class, D22 immutable bit. Physical layout changes happen inside this module
- **`src/evaluator.ts`** — Recursive tree-walk evaluator, memoization, partial evaluation (Rule 1 + Rule 2 with type propagation through residuals), type-directed dispatch via `PRIM_TO_METHOD`, closure support, type variable unification at call sites, tail call optimization, `precompileFunction` for compile-time type inference
- **`src/primitives.ts`** — All primitives: bits ops, expression/context/multi-value ops, type system (type_dispatch, type_check, type_apply, typed_int/string/float/bool/array/object, typed_function, typed operators, logical ops, unification), grammar primitives, print (lazy for type preservation)
- **`src/types-std.ts`** — Eight core types as Context values with method bindings, generic type support (buildGenericType, memoized type constructors), type helpers (getType, getTypeName, withType), FunctionType, UntypedFunction, AnyType, makeArray, makeObject, createTypeSystem extension
- **`src/parser-helpers.ts`** — Shared value-construction helpers (makeInt, makeExpr, makeParam, buildFn, substName, etc.) used by the grammar2 tree builder and Earley fallback primitives
- **`src/parser.ts`** — Earley parser (retained for standalone user-defined grammars via `grammar_*` primitives, not for parsing Allegro source). Exports Grammar classes, `parseGrammar`
- **`src/grammar-ext.ts`** — GrammarBuilder for Earley extensions, handle registry for the `grammar_*` combinator primitives. `parseExtended` is the Earley entry point (standalone DSL grammars only)
- **`src/grammar2/`** — The grammar and parser for Allegro source per `docs/grammar-formalism.md`. Replaced the former Pratt+Earley hybrid in Phase 2c-7.
  - **`src/grammar2/types.ts`** — Rule union (Terminal/NonTerm/Seq/Alt/Rep/Opt/Guarded), RuleAttrs, Grammar, Production, GrammarDelta + Operation union, constructor helpers (`lit`, `cls`, `regex`, `seq`, `alt`, `rep`, `opt`, `nonterm`, `guarded`, `notFollowedBy`, `followedBy`, `reserved`), ParseTree output type.
  - **`src/grammar2/engine.ts`** — Recursive scannerless parser with memoization, Warth-style left recursion, stateful indent terminals (NEWLINE/INDENT/DEDENT/CONT_NL), farthest-advance error reporting. Exports `parse(grammar, input)` → `ParseResult`.
  - **`src/grammar2/builder.ts`** — Allegro primitive wrappers (`grammar2_*`) for building standalone grammars at runtime (separate from Allegro source parsing).
  - **`src/grammar2/base-grammar.ts`** — The Allegro grammar as a `Grammar` value. Stratified precedence via layered productions (pipe → or → and → eq → cmp → add → mul → of → unary → post → atom). Covers base + standard Allegro: typed literals, collections, string interpolation, typed params/returns, when/is/then pattern matching, refinement types, structural wrap, import/export, blocks-as-values, multi-line continuation via CONT_NL indent terminal.
  - **`src/grammar2/tree-builder.ts`** — Converts grammar2 ParseTrees into Allegro Value trees (Expression, ComposedFunction, Symbol, Param, Bits). Dispatches by tree-tag through builder cases.
  - **`src/grammar2/fragments.ts`** — Merges `GrammarFragment`s (from `use_grammar` / `register_infix` / `register_prefix` / `register_postfix` / `register_expr_prefix`) into extended grammar2 grammars. User-registered operators get unique tags whose associated substitution templates are looked up by the tree builder via `getUserOp(tag)`.
  - **`src/grammar2/analyzer.ts`** — Static grammar analyzer (Phase 3 per `docs/grammar-formalism.md` §7). Checks: reachability, defined-ness, nullability, FIRST sets, left recursion classification, infinite-Rep detection, reserved-set consistency. Alt-disjointness analysis machinery is in place but not enabled by default — our stratified grammar intentionally uses ordered-alt semantics in several places that would false-positive; opt-in via `analyzeWithDisjointnessCheck`. The analyzer runs once per unique Grammar identity (cached by WeakMap) and its `assertClean` hook is called from `evalSource` before parsing, so grammar extensions that break structural invariants (undefined nonterm, undefined reserved set, etc.) fail with clear diagnostics rather than opaque parse errors.
  - **`src/grammar2/to-allegro.ts`** — TS Grammar → Allegro Value bridge used by Phase 5's Allegro-native analyzer. Produces nested typed Objects mirroring the TS Rule/Production/Grammar shapes, so Allegro code can walk them with when/is/then pattern matching.
- **`lib/grammar-analyzer.alg`** — Phase 5: Allegro-native port of the static grammar analyzer (~320 LOC). Exports `check_defined`, `check_reachable`, `compute_nullability` (fixed-point), `check_infinite_rep`, `check_reservations`, `check_left_recursion`, and a top-level `analyze(grammar) → {errors, warnings, nullable, leftRec}`. Consumes the TS-built Grammar converted via `to-allegro.ts`, returns arrays and records matching the TS analyzer's output one-for-one (verified by 11 parity tests in `src/test.ts`). FIRST-set computation is the only check not ported — it depends on finer-grained character-class analysis and is deferred. Parse+eval is ~3.7s on the current interpreter (down from ~40s before the memo-bucketing fix); amortized via module-level caching at test harness load.
- **`src/runtime.ts`** — `evalSource` (hybrid parse → typeLiterals → resolveSymbols → markTailCalls → precompileFunctions → buildEvalCtx → evaluate), symbol resolution with lexical scoping, compile-time type inference via `precompileFunctions`, `CompilationReport`, UntypedFunction wrapping in standard mode. C2.3b: `buildEvalCtx` builds a scope CHAIN (primitives ← extensions ← base ← source) and returns the source layer; `DependencyRegistry` tracks the same `Binding` objects the source layer holds
- **`src/scope.ts`** — Scope protocol (structures Phase 2): `scopeNew`/`scopeExtend` (O(1) layering), `scopeLookup` (chain walk), facts plane (`scopeAssume`/`scopeFactsFor`/`scopeOwnFacts`), future cells (`makeCell`/`isPendingCell`/`resolveCell`), `scopeAllBindings` chain flatten, `scopeHostRead` chain-aware host-field read, scope/structure plane rejection guards
- **`src/modules.ts`** — ModuleLoader for .alg files with dependency resolution, caching, circular dependency detection. `buildModuleObject` for typed module exports with encapsulation
- **`src/futures.ts`** — FutureManager: bridges JavaScript Promises to forward-chaining evaluation. Creates pending `__future_N` future cells (shared by eval scope + registry), attaches `.then()` handlers that call `applyPhase`
- **`src/index.ts`** — Entry point: file runner + REPL. Allegro Standard by default, `--base` flag for base mode. On-demand module loading from `lib/` directory
- **`src/test.ts`** — 600+ tests: core evaluator, extensions, modules, grammar, standalone grammars, type system, generics, function types, unification, partial evaluation, union types, structural types, binding annotations, pattern matching, destructuring, multivalue access, error propagation, none type, instanceof, subtypeof, constructors, type construction API, guard clauses, nested patterns, member descriptors, interfaces, typed types, refinement types, preserveOps, file-based .alg tests

### Test Files (tests/)
- `types.alg` — typed literals, arithmetic, comparisons
- `dot-access.alg` — string methods, toString, getters
- `arrays.alg` — literals, bracket access, map/filter/reduce, chaining
- `objects.alg` — literals, dot access, nesting, keys
- `logical.alg` — &&, ||, !, with comparisons and if-then-else
- `functions.alg` — closures, composition, higher-order, recursion
- `modules.alg` — import + dot access on module
- `type-annotations.alg` — typed params, return types, typed recursion
- `generics.alg` — Array[Int], generic type annotations, type_apply
- `function-types.alg` — function type signatures, type variable unification
- `pattern-match.alg` — when/is/then pattern matching, multivalue access
- `interfaces.alg` — Interface.define, declared conformance, drawn bundles
- `typed-types.alg` — types as typed values, Int instanceof Type, meta-type checks
- `refinements.alg` — refinement types via `&`, compound predicates, preserveOps operator lifting
- `mixins.alg` — method-valued define entries, field access via self, reusable bundles, multi-arg methods
- `grammar-runtime.alg` — `use_grammar pow` header plus `**`/`neg` from `lib/pow.alg`

## Base Parser Syntax

```
// Bindings
x = 42
name = "hello"

// Function declarations
f(x, y) => x + y
factorial(n) => if n == 0 then 1 else n * factorial(n - 1)

// Anonymous functions (lambdas) and closures
x => x * 2
(x, y) => x + y
make_adder(n) => x => x + n

// If-then-else (branches auto-wrapped in thunks)
result = if x > 0 then x else 0 - x

// Operators: + - * / % == != < > <= >=
// Standard precedence, left-associative

// Function calls
print(42)
f(3, 4)

// Indentation blocks (offside rule)
result =
    x = 3
    y = x + 1
    y

// Pattern matching (when/is/then)
result = when x is 42 then "found" else "other"
result = when x
    is 1 then "one"
    is 2 then "two"
    is y then "other: " + y.toString()

// Type destructuring
when shape
    is Object(x, y) then x + y          // nominal: check type, extract fields
    is Object(x: a, y: b) then a + b    // with rename

// Structural destructuring
when point
    is {x, y} then x + y                // match any value with fields x, y
    is {x: a, y: b} then a + b          // with rename

// Nested destructuring (colon introduces sub-pattern)
when shape
    is {center: {x, y}, radius} then x + y + radius

// Guard clauses (and)
when x
    is n and n > 0 then "positive"
    is n and n < 0 then "negative"
    is _ then "zero"

// MultiValue component access (Y of x)
t = type of someValue        // access "type" component
e = error of someValue       // access "error" component (returns none if absent)

// Error values (propagate automatically through operations)
result = error "something went wrong"
result = error "bad" + 5     // error propagates — result is still an error

// Type operators
42 instanceof Int              // → true
"hello" instanceof String      // → true
Refinement subtypeof Type        // → true (kind-hood is conformance to Type)
// C3.3 (D36): instanceof on a refinement is a PURE PREDICATE RE-CHECK from
// data (congruent — `5 instanceof PositiveInt` → true, tagged or not);
// preserveOps types are shapes and stay nominal. The provenance question
// ("was it CONSTRUCTED as T?") is `certificate_peek(v, T)` — channel-aware,
// tagged with the "observe" effect label; `effects pure` + peek fails.

// Type constructors (calls __construct)
Int(42)                        // wraps value with Int type
String("hello")                // wraps value with String type

// C-style comments
// line comment
/* block comment */
```

## Allegro Standard Syntax (extensions)

```
// Dot access (type-directed dispatch)
"hello".length          // getter → 5
"hello".slice(0, 3)     // bound method → "hel"
42.toString()            // → "42"

// Float literals
pi = 3.14

// Bool literals
flag = true

// Array literals and methods
nums = [1, 2, 3, 4, 5]
nums[0]                  // bracket access → 1
nums.map(x => x * 2)    // → [2, 4, 6, 8, 10]
nums.filter(x => x > 3) // → [4, 5]
nums.reduce((a, x) => a + x, 0) // → 15

// Object literals
point = {x: 10, y: 20}
point.x                  // → 10
nested = {a: {b: 42}}
nested.a.b               // → 42

// Logical operators (short-circuiting)
true && false            // → false
false || true            // → true
!true                    // → false
x > 0 && x < 10         // comparisons with logical

// Import
import math
math.pi

// Export (module public interface)
export square = x => x * x
export pi = 3.14159

// String concatenation
"hello" + " " + "world" // → "hello world"

// String interpolation
name = "world"
"hello {name}"           // → "hello world"
"2 + 2 = {2 + 2}"       // → "2 + 2 = 4"
"\{escaped\}"            // → "{escaped}"

// Type annotations on functions
add(x: Int, y: Int): Int => x + y
greet(name: String): String => "Hello, " + name

// Generic type annotations
head(arr: Array[Int]): Int => arr[0]

// Lambdas with type annotations
nums.map(x: Int => x * 2)
(x: Int, y: Int): Int => x + y

// Interfaces (DECLARED conformance — C5.2c/D30)
Printable = Interface.define({toString: Function})
42 instanceof Printable           // false — Int never DREW Printable's symbols
HasXY = Interface.define({x: Int, y: Int})
Point = Type.define({x: Int, y: Int}, HasXY)  // drawing the interface binds its symbols
Point(1, 2) instanceof HasXY      // true — declared conformance
is_printable(v: ~Printable) => true      // ~T is the loose duck-typing path
is_printable(42)                  // true — matches by base name

// Refinement types (Int & predicate, _ is the value)
PositiveInt = Int & _ > 0
PositiveInt(5)                    // → 5
PositiveInt(0 - 1)                // → error(refinement check failed)

// Compound predicates
SmallPos = Int & _ > 0 && _ < 100
SmallPos(50)                      // → 50
SmallPos(150)                     // → error

// Refinement in function annotation
double(x: PositiveInt): Int => x * 2
double(5)                         // → 10 (bare Int passes predicate check)

// preserveOps — lift operators to preserve the refinement
PI = Refinement.define({refines: Int, where: p => p > 0, preserve: "all"})
x = PI(5)
y = x + 3                         // y: PositiveInt, re-checked after +
y instanceof PI                   // → true
x - 10                            // → error (predicate fails after subtraction)

// Grammar extension — add new operators from a module (Phase 6)
// lib/pow.alg:
pow_grammar = grammar {
  infix "**" prec(pow) above(mul) below(unary) right => (l, r) => pow_int(l, r)
  expr_prefix "neg" => x => 0 - x
}

// Consumer file activates the grammar via `use`:
use pow
print(2 ** 10)        // → 1024
print(2 * 3 ** 2)     // → 18 (** binds tighter than *)
print(neg (2 ** 3))   // → -8

// Multi-token forms (Phase 6b)
// lib/match_expr.alg:
match_grammar = grammar {
  rule match_case = p:expr "=>" e:expr       => (p, e) => {p: p, e: e}
  rule match_list = c:match_case ** "|"      => c => c

  expr_form "match" s:expr "with" cs:match_list
    => (s, cs) => match_dispatch(s, cs)
}

// Consumer:
use match_expr
describe(n) =>
  match n with
    1 => "one"
  | 2 => "two"
  | 3 => "three"
```

## What's Next

See `BACKLOG.md` for full roadmap. Key completed items:
- ✅ Symbol resolution / lexical scoping (compile-time, not runtime)
- ✅ eval_if Rule 2 (partial eval both branches)
- ✅ Tail call optimization (O(1) stack for tail-recursive functions)
- ✅ Parser reimplementation (hybrid Pratt + recursive descent)
- ✅ Keyword support (export, true/false properly disambiguated)
- ✅ Dynamic lexer config (extensions add operators/keywords)
- ✅ Pattern matching (when/is/then with resolve-first semantics, type/structural destructuring)
- ✅ MultiValue component access (Y of x syntax)
- ✅ Error propagation (error values as MultiValue components, automatic propagation)
- ✅ None type (singleton `none` keyword, returned for absent components)
- ✅ `instanceof` and `subtypeof` infix operators
- ✅ Type constructors via `__construct` (Int, Float, String, Bool)
- ✅ Fluent type API: `extend`, `where`, `distinct`, `constructor` methods on Type/NominalType
- ✅ Meta-type dispatch for type-level methods (e.g., `Int.where(...)`)
- ✅ Auto-naming: types bound to symbols get named automatically
- ✅ Guard clauses (`and` keyword in patterns)
- ✅ Nested destructuring (colon introduces sub-pattern, recursive matching)
- ✅ Member descriptors (`__members`): unified Method/Field types, structural checking via member comparison, meta-type methods in `__members`
- ✅ Interfaces: `Interface.define({...})` — structural type matching, no `implements` keyword needed
- ✅ Types as typed values: `Int instanceof NominalType`, `type of Int` → NominalType, all type bindings wrapped as MultiValues
- ✅ Array map/filter/reduce as Allegro ComposedFunctions (recursive AST construction, not imperative TypeScript loops)
- ✅ Refinement types: `Type & _ > 0` syntax, predicate checking at construction/annotation/call sites, `preserveOps` operator lifting for refinement preservation through operators (`&&` was the original operator; migrated to `&` in Slice 2 Stage 0 to free `&&` for purely logical AND)
- ✅ Mixins: `.mixin({method: fn, ...})` adds method implementations to types, ComposedFunction method dispatch with self binding
- ✅ Runtime grammar extension Phase 1: module-scoped `register_infix`/`register_prefix`/`register_postfix`/`register_expr_prefix` primitives; `use_grammar NAME` top-of-file header activated a module's `GrammarFragment` before parsing (superseded by Phase 6)
- ✅ Runtime grammar extension Phase 6: `grammar { infix/prefix/postfix/expr_prefix … }` block syntax with named precedence (`prec(pow)`, `at(X)`, `above(X)`, `below(Y)`, combined forms), operator-symbol lookup (`at("*")`), anonymous levels, and data-driven stratified-stack level insertion. `use X` pre-scanner (replaces `use_grammar`; accepts `use NAME` and `use import NAME`, extensible to full expressions later). Conflict detection: `E_OPERATOR_CONFLICT`, `E_KEYWORD_CONFLICT`, `E_PRECEDENCE_CYCLE` surface at `use` time with aggregated messages.
- ✅ Runtime grammar extension Phase 6b: EBNF mini-grammar for rule bodies (`"lit"`, `/regex/`, ident refs, `s:rule` labels, `a*`/`a+`/`a?` postfix, `a ** sep` sep-rep, `(a | b)` groups). Multi-token `expr_form parts => template` (e.g. `match x with p => e | …`) and `stmt_form parts => template` for statement-level forms. User sub-rules via `rule NAME = body => template` (new production) and `rule NAME += body => template` (append alternative). Template params are positional matching the order of EBNF labels; `substituteParams` injects the matched sub-ASTs at parse time. Demo: `lib/match_expr.alg` implements a `match … with …` expression in 3 lines.
- ✅ Runtime grammar extension Phase 7: `new grammar { … }` for fresh grammars (baseChain=[empty]) and `grammar extends X { … }` for composition; `use grammar { … }` hosting-file literal grammars (no separate module needed); `use NAME.MEMBER` selects one Grammar binding from a multi-grammar module. Analyzer gains `W_PRODUCTION_REPLACED` (silent shadowing of base productions) and `E_INCOMPATIBLE_GRAMMARS` (fragment base-chain mismatches) checks. Hygienic template substitution: free Symbols in grammar templates resolve against the module's evalCtx at definition time, so consumer rebindings can't hijack the extension. Selector-based rule surgery: `rule foo -= alt_name` removes a named alternative, `rule foo[alt_name] = body => template` replaces one. Deferred to Phase 8 (needs parser/evaluator reentry): per-scope activation (`use X in { block }`), single-pass `use X` with arbitrary mid-parse expressions, parse-time builder lambdas.
- ✅ Provability arc — Phase A (introspection surface): `src/introspect.ts` walks an evaluated Value tree and produces a `ValueSummary` (kind, typeName, resolved status, node count, depth, external symbols referenced, primitives called, short description) and a `ModuleSummary` with a `SafetyGrade` classification (`proven-safe` | `partial` | `has-warnings` | `has-errors`). New CLI subcommand `allegro inspect <file>` emits the rendered summary. Web sandbox gets an Inspect button on every demo that shows the same summary with a coloured grade badge. This is Layer 0 of the "code is the wrong reviewable artifact" arc (see `docs/plans/archive/crystal-proving-curry.md`).
- ✅ Provability arc — Phase B (refinements as a proof substrate): `src/refinements.ts` adds an `AbstractDomain` representation (interval, equality, inequality, opaque) alongside the existing runtime predicate. `domainFromPredicate` recognises common shapes (`_ > k`, `_ >= k`, `_ < k`, `_ <= k`, `_ == k`, `_ != k`, conjunctions via `&&`) and lattice operations (`intersectDomains`, `joinDomains`, `impliesDomain`) reason at compile time. `propagateAdd` / `propagateSub` / `propagateMul` derive output domains for arithmetic on refined operands. The evaluator's `applyPrimitive` propagates a domain onto results when at least one operand carries one — pure-literal arithmetic stays uninstrumented so untyped Allegretto and unrefined Standard code see no behaviour change. Subtyping check: `type_check_impl` and `checkRefinementPredicate` now try abstract-domain implication BEFORE the runtime predicate, so a value with domain `≥ 4` passed to a function expecting `_ > 0` discharges the refinement statically. Counterexamples: a failing refinement check now reports both the violated constraint and the actual value (`refinement check failed: expected ≥ 1 (got -5)`). Pilot: `lib/math.alg` adds `PositiveInt`, `NonNeg`, and a `double_pos(x: PositiveInt): PositiveInt` whose return-type check is discharged purely by domain implication. Demos: `tests/refinement-propagation-demo.alg`, `tests/refinement-subtype-demo.alg`, `tests/math-pilot-demo.alg`.
- ✅ Provability arc — Phase C Chunks 1+2 (predicate sets + branch refinement + `assert`): `src/refinements.ts` `PredicateSet` carries a list of `Predicate` (shape + source attribution: `refinement-type` / `type-invariant` / `assert` / `branch-then` / `branch-else` / `match-case` / `requires` / `ensures` / `propagation` / `literal`) on each binding's MultiValue. `applyPrimitive` propagates predicate sets through arithmetic. `eval_if` derives branch predicates via `deriveBranchPredicates` (recognises `x op k` / `k op x` / conjunctions; both `bits_*` and `typed_*` comparison shapes), pushes them onto a scope-local `scopePredicates: Map<string, PredicateSet>` carried on `ContextValue`, and pops on branch exit. `assert P` is a stmt_form (in `lib/invariants.alg`) lowering to `assert_stmt(P)`: tries static discharge from accumulated predicates; on success or runtime-pass updates the scope-local predicates so the rest of the scope inherits the proven facts; on failure throws `AllegroError` with a counterexample message (build safety in — no silent error values). The introspection summary renders single predicates compactly and multi-predicate sets with per-source attribution.
- ✅ Provability arc — Phase C Chunk 4 (`Type.invariant`): `src/types-std.ts` adds `Type.invariant(self => P)` (and `NominalType.invariant`) that returns a new type with `__invariantsList: Value[]` and a wrapped `__construct` checking each invariant on creation. Multi-clause chaining (`Int.invariant(self > 0).invariant(self < 100)`) reports per-clause failures (`invariant 1 failed`, `invariant 2 failed`). Multi-field record invariants reference fields via `self.field` (`Range = Type.define({lo, hi}).invariant(self => self.lo <= self.hi)`). `extend` carries `__invariantsList` forward so derived types inherit. Pilot: `lib/math.alg` `Range`. Introspection: types with invariants render `[N invariants]`; `safetyGradeForSummary` flags Error-typed bindings as `has-errors`. Demos: `tests/invariant-demo.alg`, `tests/predicate-set-demo.alg`.
- ✅ Provability arc — Phase D1 (effect types): function bodies declare the categories of side effects they can produce via an `effects` body-form clause; the analyzer infers the actual set from the primitives transitively called and verifies the declaration is a superset (under-promising halts compilation).
  ```
  use effects
  square(x) =>
    effects pure
    x * x
  greet(name) =>
    effects io
    print("Hello, " + name)
  ```
  Effect labels are EXTENSIBLE, not a fixed enum. `src/types.ts` `PrimitiveFunctionValue` gains an optional `effects: string[]`; `makePrimitive(name, fn, lazy?, effects?)` accepts the labels. Core declares no labels; the standard library tags `print` with `io`, `fetch` with `net`, `delay` with `time`. Domain-specific extensions register their own labels (`build-io`, `funds-mutation`) by attaching them to their primitives. `src/effects.ts` provides `EffectSet` (plain `Set<string>`), set ops (`effectUnion`, `effectSubset`, `effectDifference`), bottom-up inference (`inferFunctionEffects` walks ComposedFunction bodies, recurses into transitively called functions with cycle detection), and the `effects_attach` wrapper unwrap helpers. Surface syntax via `lib/effects.alg` grammar (stmt_form `effects` parsing comma-separated identifiers); the block-expression preprocessor recognises `effects_decl_marker(labels)` markers, extracts them, and wraps the body's result with `effects_attach(result, labels)` (a runtime passthrough that's metadata for the analyzer). `evalSource` runs `checkEffectsDeclarations` after `precompileFunctions`; mismatches throw an `Error` listing every binding's declared/inferred/missing sets. Introspection: `ValueSummary.inferredEffects` and `.declaredEffects` populate for any function value; the renderer surfaces three formats — `effects: pure (inferred)`, `effects: io (declared, verified)`, `effects: io (declared) ⊇ pure (inferred) ✓`. Pilot: `lib/math.alg` adds `effects pure` to `sqrt`, `pow`, `abs`, `double_pos`. Demo: `tests/effects-demo.alg`. Phase D2 will refine flat labels into parametric capabilities (`net[example.com:443]`) and per-module capability budgets — D1 is the substrate.
- ✅ Provability arc — Phase D1 sub-chunk 1.1 (Effect meta-type substrate): `src/types-std.ts` adds the `Effect` meta-type (`__type = Type`, lattice members in `__members`) and the two core absolutes — `pureEffect` (lattice bottom, kind `"pure"`) and `opaqueEffect` (lattice top, kind `"opaque"`) — built via `buildEffect(name, kind?)` which sets `__extends = Effect` and copies the lattice methods into the new type's `__members`. TS lattice helpers `effectSubsetOf`, `effectImplies`, `effectIntersect`, `effectUnion` operate on Context values; subset/implies walk the `__extends` chain by identity; intersect/union return `pureEffect` (no overlap) or `opaqueEffect` (sound over-approximation pending Slice 2's anonymous conjunctions). Standard extension binds `Effect`, `pure`, `opaque` so Allegro source sees them as values. `pure subtypeof Effect` and `opaque subtypeof Effect` discharge through the existing nominal subtype check via `__extends`; sibling subtypes (`pure subtypeof opaque`) correctly return false. Anonymous conjunction creation (`io & time`) and `&` operator surface deferred to Slice 2.
- ✅ Provability arc — Phase D1 sub-chunk 1.2 (effects in PredicateSet): `src/refinements.ts` `AbstractDomain` gains an `EffectsDomain` variant (`{ kind: "effects", labels: Set<string> }`) carrying the chunk-1 flat-label representation. Lattice ops generalised: `intersectDomains` does set intersection on effect-effect, opaque on mixed-kind; `joinDomains` does set union; `impliesDomain` returns `b.labels ⊆ a.labels` (wider implies narrower) for effect-effect, false on mixed-kind. `PredicateSet` gains `effectiveEffects()` (unions all effects-source predicates) alongside the existing `effectiveDomain()` (which now skips effects predicates). `PredicateSource` adds `"effects-declared"` and `"effects-inferred"`. `src/effects.ts` adds `effectPredicatesForFunction(fn): PredicateSet` and `effectPredicatesForValue(v)` — derive a uniform predicate-set view from the chunk-1 storage (`effects_attach` body wrap + `inferFunctionEffects` walker), one predicate per source. Underlying chunk-1 storage unchanged; this layer is on-demand derivation. Storage migration (replacing `effects_attach` with direct predicate attachment on the function MultiValue) deferred to Slice 2 where it interacts with HOF param-effect bounds. All chunk-1 tests pass under their existing API; 13 new tests verify the EffectsDomain machinery and helper extraction.
- ✅ Tail-call forwarding through typed-return wrappers (`type_check` / `ensures_check`): pre-existing latent bug. When a typed function has a tail-position recursive call (e.g. `countdown(n: Int): Int => if n == 0 then 0 else countdown(n - 1)`), the body's shape is `type_check(eval_if(…), Int)`. The inner recursive call is marked `_tailPosition` (markTailCallsInValue eagerly marks every ComposedFunction body's top expression — including eval_if's 0-param thunks). At runtime the TailCall sentinel propagates up through eval_if's return into `type_check_impl`'s `evalFn(args[0])` call, but type_check tried to read `.kind` on the sentinel and produced an unresolved residual instead of looping back to applyComposed's tco_loop. Fix: `isTailCall` is now exported from `src/evaluator.ts`; `type_check_impl` and `ensures_check_impl` detect TailCalls and forward them unchanged. Soundness preserved — the intermediate type / ensures check is skipped on TailCalls but the eventual base-case value still passes through the same wrapper (the return type is fixed; intermediate recursive results are already typed). Performance preserved — TCO works through typed returns, verified with 100k-deep recursion. The transparent passthroughs (`effects_attach` / `partial_attach` / `decreases_attach` / `param_effects_attach` / `seq`) were already correct since they `return evalFn(args[0], ctx)` directly. 2 new regression tests; 828/828 green.
- ✅ Provability arc — Phase H4a (PCP LLM worker — `allegro prove`): closes the central thesis bet end-to-end. **`allegro prove <file> [--max-attempts N] [--model MODEL] [--output FILE.alg] [--json]`** takes an Allegro source file, extracts pending obligations, asks Claude to propose proof terms via `@anthropic-ai/sdk` (now a dependency), splices each into the source's theorem declaration, verifies via the kernel in `softFail` mode, iterates on failure up to `--max-attempts` (default 5). On success, records authorship as `{prover: <model-id>, attemptsUsed: N, role: "primary"}` using H1's Authorship schema. Layered architecture in `pcp/llm-worker.ts`: **pure helpers** (no SDK / no API key — tested in isolation): `extractCodeBlocks` parses ` ```allegro` fenced blocks (with fallback to any fenced); `spliceProof(source, theoremName, term)` regex-based single-line splice that appends `by <term>` to a bare theorem or replaces an existing `by` clause; `buildIterationMessage(...)` constructs the user message including proposition (fenced), lemmas, prior-failure reason + counterexample, hints with suggestedConstruct, strategies-already-tried list; `classifyStrategy(term)` regex-tags the term with which combinators/tactics appear (`proof_trans`, `tactics.chain`, `prove_for_all_bool`, etc.) so the next attempt's strategiesTried is populated. **Anthropic client shim** lazily imports the SDK so tests for pure helpers don't pull it in; missing `ANTHROPIC_API_KEY` reports a clear error pointing at `allegro propose` (the human-interactive worker) as a fallback rather than hanging. **Orchestrator** `runLlmWorker(opts)` ties them together: enumerate pending obligations, per-obligation loop with attempt cap, build message → send → extract block → splice → verify → record. Prompt caching via `cache_control: {type: "ephemeral"}` on the system primer (participant-neutral doc at `docs/proving-in-allegro.md` — same text humans read in the F-arc primer). PriorAttempt records track candidate text + strategiesUsed for H3 hint generation across rounds. Out of scope for H4a-minimum: solving `proven` body-form clauses (need impl changes, not just proof terms), multi-strategy parallel exploration (H6), token budgets (H7). Output: human summary by default (✓/✗ per obligation + final proof terms + attempt counts); `--output FILE.alg` writes the proved source; `--json` emits a machine-readable result. Exit 0 if all discharged, 1 if any pending. 13 new tests cover the pure helpers + 3 mock-client async tests exercising the full orchestrator + 1 CLI smoke (missing-key path); 971/971 green. Plan in `docs/plans/archive/phase-h-plan.md`. H5 (proof catalog), H6 (multi-strategy), H7 (effort budgets + reproducibility) remain.
- ✅ Provability arc — Phase H benchmark suite (`bench/`): the falsifiable validation the phase-H plan pairs with H4 ("without this we don't *know* the thesis is validated"). A 10-obligation graded corpus under `bench/corpus/*.alg` (solved form — each verifies as-is) measured across baselines through the SAME kernel `allegro verify` / `prove` use. Per entry the harness (`bench/harness.ts`, `runBenchmark(opts) → BenchReport`) derives three forms and verifies each in `softFail` mode via `evalSource` + `buildVerdict`: **reference** (file as-is — corpus validity), **auto-PE** (goal's `by` term stripped by `stripProof`, a mirror of `spliceProof` — the kernel's free coverage), **gate** (`by` term replaced by `WRONG_SENTINEL_TERM = proof_refl(987654321)` — `proof_check` must reject a term proving a different fact, turning the goal pending), and optionally **LLM** (the gated/pending form written to a temp file and handed to `runLlmWorker` — convergence + attempts; needs `ANTHROPIC_API_KEY`, degrades gracefully without). Loading uses `createTypeSystem()` only — the corpus relies on standard-env proof primitives (`proof_refl`/`proof_sym`/`proof_trans`/`proof_cong`/`proof_refines`/`prove_for_all_bool`), no `import tactics`, so no module resolver is needed. `bench/manifest.ts` carries per-entry metadata (`id`, `category`, `goalTheorem` = `goal`, `referenceProof` — null for the two auto-PE-only entries). Categories mirror the plan: refl-trivial (t01-03), combinator sym/trans/cong/rewrite (t04-08), type-bound `proof_refines`/`prove_for_all_bool` (t09-10, Proof-valued props with no `by` slot). `bench/run.ts` (`npm run bench`) renders a table or `--json`; flags `--llm` / `--model` / `--max-attempts` / `--only`; exit 0 iff the corpus is healthy (every reference discharges + every gate holds) — LLM convergence never gates exit (a prover failing is a measurement, not a corpus fault). **Headline finding the benchmark surfaces**: PE-as-discharge is total over closed propositions — auto-PE discharges 10/10 with no prover at all; the prover's measurable work is therefore not "discharge the proposition" but "supply a `by` term the soundness gate accepts" (the 8 gated obligations), which is exactly the `allegro prove` loop's surface. `bench/` sits outside `tsconfig`'s `rootDir: ./src` (same convention as `pcp/`) — run via `tsx`, validated by the test suite rather than `tsc`. Deterministic baselines pinned by 4 tests in `src/test.ts` (`runBenchmarkTests`: corpus shape, `stripProof`, all-baselines-pass, a mock-client LLM run converging on t01/t05/t08). `bench/README.md` documents the design + the headline finding. 978/978 green.
- ✅ Lib loader pipeline unification (nested-`use` pre-scan + delegation to `evalSource`): libs and top-level files now go through the SAME entry point. The `use NAME` / `use import NAME` / `use NAME.MEMBER` pre-scan logic was extracted from `src/index.ts` into a shared `src/use-scanner.ts` (`scanUses` + helpers); both the top-level file runner and `ModuleLoader.loadModule` consume it. Inside `loadModule`: after reading a lib's source, scan the header → recursively load each referenced module through `this.loadModule` (so transitive `use` chains resolve through the same path resolver and cache) → strip the header → hand the body to `evalSource` with `typed=true` and the union of std + dep + nested-use extensions. `evalSource` already collects grammar fragments from extension bindings via `asGrammarValue`, so the body parses with the extended grammar; it also already runs `typeLiterals`, `precompileFunctions`, `checkEffectsDeclarations`, `checkExhaustiveness`, `checkTermination`, the proof-finding eval loop, and `checkProvenClauses`. The lib loader removes its own parallel parse + resolve + eval loop entirely (~80 LOC down). Source-binding extraction now reads from `evalCtx.bindings`, filtering out primitives + extension-supplied names + `__bare_*`/`__future_*` markers. Net behaviour: a buggy lib (false `proven` clause, undeclared effect, non-exhaustive `when/is/then` on a finite type) halts compilation with the same diagnostic it would in user code — no silent broken bindings. The `proven`, `assert`, `requires`/`ensures`, `effects`, `decreases`, `partial` body-forms now all work inside lib files. `use grammar { … }` literal blocks inside libs are explicitly rejected with a clear error (deferred — needs a bootstrap `evalSource` recursion, not needed for the planning lib). 3 new module-loader regression tests (resolves through loader, reports failed `proven`, rejects literal `use grammar`); 974/974 green. This unblocks `lib/planning.alg` (and any future body-form-using lib) from being the next chunk.
- ✅ Provability arc — Phase H4b (PCP human-interactive worker — `allegro propose`): the first reference worker exercising the H1+H2+H3 substrate. Pragmatic shape: rather than scratch files in a directory (per the plan), ship a single subcommand that emits a Markdown TODO of pending obligations + hints — the developer reads it, edits the source in their own editor, re-runs `allegro verify` to iterate. **`allegro propose <file> [--output FILE.md] [--all]`** loads the file (`softFail` mode), builds a Verdict (so hints are generated), enumerates obligations, joins them with hints + failure context per theorem, and emits via `formatTodo`. Default scope: pending-only; `--all` includes discharged theorems too. Output: stdout (default) or written to a `.md` file when `--output PATH` supplied. New helper `formatTodo({filename, totalObligations, sections})` in `src/pcp.ts` produces the Markdown: file-level summary ("**2 pending** of 5 obligation(s)"), per-theorem `##` sections with the proposition in a fenced `allegro` code block, `**Function:**`/`**Last failure:**`/`**Hints:**`/`**Lemmas in scope:**` annotations, prior-attempts count, suggested constructs rendered as italic-code asides (`*(try \`proof_trans\`)*`), lemma list truncated at 8 with `+N more`, and a footer reminding to run `allegro verify`. Zero new external dependencies — H4b proves the protocol is genuinely participant-neutral. Authorship recording for user-proved theorems (`verify --author`) deferred to H4b.1 — it touches authorship semantics that overlap with H7's effort budgets, and shipping it together makes a coherent unit. 5 new unit tests + 2 CLI smoke tests via `spawnSync`; 957/957 green. Plan in `docs/plans/archive/phase-h-plan.md`.
- ✅ Provability arc — Phase H3 (PCP iteration hints): gives the verification loop **memory and direction**. `Verdict` gains an `iterationHints` field; `PriorAttempt` gains a `strategiesUsed` round-tripped field. New `generateHints(theorems, report, obligation?)` produces transparent, limited compiler-side suggestions from common failure patterns: PE-residual failure → "try a combinator (refl/sym/trans/cong) or `prove_for_all_bool` for finite-domain quantification" with `suggestedConstruct: "proof_trans"`; `proposition is false` → "revise the theorem or the function"; `proof_trans middle terms differ` → "RHS of p1 must value-match LHS of p2 — consider `tactics.chain`" with `suggestedConstruct: "tactics.chain"`; wrong proof term ("different equality") → "match the propositions exactly"; F7 `proven-failed` with `at <param> = <value>` counterexample → names the violating input concretely; F7 `proven-skipped` shapes (multi-param, no type annotation) → restructure suggestions. **Global lemma reminder** — when an obligation supplies lemmas, one `theoremName: "<global>"` suggestion lists the top 5 with a "consider `proof_trans`/`tactics.chain`" nudge. **strategiesTried** aggregates + dedupes across all `priorAttempts.strategiesUsed`, sorted — workers consult it to skip already-attempted approaches. `buildVerdict` gains an optional `obligation` parameter that threads lemma context + prior attempts into hint generation. The CLI's `allegro verify --obligation O.json` now feeds the obligation through so hints reflect the full prior-attempt history. `formatVerdict` renders a `hints:` block with per-theorem `[name]` lines + a flat `already tried:` summary. Sample evolution (newly-passing vs. still-failing across attempts) deferred to H3.1 — needs parsed counterexample shapes. 9 new unit tests; 952/952 green. Plan in `docs/plans/archive/phase-h-plan.md`.
- ✅ Provability arc — Phase H2 (PCP `verify` / `obligations` CLI): wires the H1 schemas into two new `allegro` subcommands so any external tool (IDE, LLM agent, human-interactive worker) can run the verification loop from the command line. **`allegro verify <file> [--obligation O.json] [--json]`** — loads the file (mirrors `inspect`'s grammar/module pipeline), evaluates with the new `softFail` mode (proof failures push notifications without throwing), builds a Verdict via `buildVerdict`, optionally cross-checks against an obligation file (`checkObligationSatisfied` matches names + propositionHash to prevent trivial-pass attacks where the candidate proves `1==1` instead of the actual obligation), and emits as plain text (default) or JSON. Exit code: 0 if verified, 1 if not. **`allegro obligations <file> [--pending] [--json]`** — emits one Obligation per theorem (or only pending ones with `--pending`). JSON mode produces newline-delimited objects for easy streaming. **`softFail` parameter** added to `evalSource` as a 7th optional arg (default false — kernel halts on failure as before; CLI commands set true to inspect failures structurally). New helpers in `src/pcp.ts`: `buildVerdict(evalCtx, report)` walks bindings for Proof values + pulls totality/effects/proof-failure notifications; `extractObligations(evalCtx, report, opts)` enumerates theorems with lemma-list context (auto-includes other discharged theorems as available citations, self-excluded); `checkObligationSatisfied(obligation, verdict)` performs the hash-match check. Anonymous `verify` failures surface as `<verify>` theorems via the proof-failure notification path (anonymous successes pass silently — consistent with the existing kernel). 11 new unit tests + 2 CLI smoke tests via `spawnSync`; 943/943 green. Plan in `docs/plans/archive/phase-h-plan.md`. H3 (iteration hints) and H4 (LLM + human-interactive workers) build on the verify/obligations surface.
- ✅ Provability arc — Phase H1 (Proof Collaboration Protocol — schemas): the participant-neutral protocol for closing the loop between a PROVER (LLM, human, SMT, hybrid) and the Allegro verification kernel. `src/pcp.ts` defines three canonical JSON schemas at version `"pcp/1"`: **Obligation** (theorem statement + function signature + context + prior attempts), **Verdict** (per-theorem pass/fail with counterexamples + totality findings + effect mismatches), **Authorship** (ordered list of provers — `{prover, proverVersion?, attemptsUsed?, effortBudgetUsed?, role?}` — supports multi-prover proofs like LLM-proposed + human-reviewed from day one). JSON is canonical; `formatObligation`/`formatVerdict`/`formatAuthorship` provide basic plain-text renderers for direct CLI use (IDEs/external tools consume JSON). `hashProposition` (djb2, whitespace-canonicalised) gives stable theorem-identity across attempts. Builders: `makeObligation`, `makeAuthorship`, `AUTO_PE_AUTHORSHIP()` for kernel-discharged proofs. Round-trip stability validated (byte-identical re-serialisation); validators reject wrong version + missing fields + malformed status. 14 new unit tests; 931/931 green; plan in `docs/plans/archive/phase-h-plan.md`. H1 is the substrate; H2 (verify/obligations CLI), H3 (iteration hints), H4 (LLM + human workers), H5 (catalog), H6 (multi-strategy), H7 (effort budgets + reproducibility) build on it.
- ✅ Provability arc — Phase G (provable stdlib pilot): `lib/provable.alg` — the first library that walks the talk of the provability arc. Ships utility functions (`abs`, `sign`, `square`, `min2`, `max2`, `negate`) WITH 23 named theorems about their correctness, all checked at module load time. Discharge strategies mixed by appropriateness: F1 PE-as-discharge for concrete-input facts (`abs(0) == 0`, `square(0 - 4) == 16`); F3 combinators for reflexive equalities (`abs_idem_13`, `square_refl by proof_refl(square(3))`); F5 universal-Bool quantification for the involution law (`prove_for_all_bool(b => negate(negate(b)) == b)`). Structural constraints navigated: the lib loader uses plain `runtimeEval` (no nested `use` pre-scan), so the lib can't use the `proven` body-form clause — but `theorem`/`verify` are base-grammar and proof PRIMITIVES (`proof_refl` / `prove_for_all_bool` / etc.) are in the standard env, no import needed. The lib loads via the modules.alg pattern (`extensionToContext` over its non-prim/non-type bindings, exposed as `import provable`). Downstream consumers can state their own theorems about the lib's functions (`theorem t: provable.abs(0 - 100) == 100`) — they discharge via PE on the imported function values. 5 new unit tests + demo (`tests/provable-demo.alg`); 918/918 green. Phase G demonstrates that the F-arc handles real lib code under real load — no panics, no slowdowns, no soundness compromises. The next pilot would extend `lib/math.alg` itself with theorems once the lib loader gains nested-`use` pre-scanning (~10-line change deferred until needed).
- ✅ Provability arc — Phase F7 (`proven` clause on function declarations — [impl, proof] pair surface): the user-visible contract that AI agents target in Phase H. `proven <prop>` body-form clause attaches a theorem to the function being defined; the compiler verifies it at definition time by BOUNDED SAMPLING (Stage F7 minimum, K=4): invoke the function at sample inputs of the param's type, evaluate the predicate, require all true. Failure halts compilation with a concrete counterexample input ("build safety in"). Surface: `lib/proven.alg` adds a `proven cond:expr` stmt_form lowering to `proven_decl_marker(cond)`; `buildBlockExpr` (`src/grammar2/tree-builder.ts`) extracts the marker (multiple `proven` clauses accumulate as independent theorems) and wraps the body with `proven_attach(body, pred1, …, predN)`. Runtime passthrough; the analyzer (`checkProvenClauses` in `src/proven.ts`) peels it. Sampling: `pickSamples(typeCtx)` reads the param type's `__name` + `__abstractDomain` — `Bool` enumerates `[true, false]`; refined `Int` with interval domain (lo, hi) samples `[lo, lo+1, lo+2, lo+3]` clamped to hi (so `NonNeg` → `[0,1,2,3]`, `PositiveInt` → `[1,2,3,4]`); plain `Int` samples `[0, 1, 5, -3]`. Samples wrapped as typed `MultiValue(Bits, type=Int)` so the function's call-site type_check accepts them. Substitution: `substParams` walks the predicate AST replacing Param values whose owner is the function's cfn with the sample; reuses the standard evaluator on the substituted predicate. **Key infrastructure fix**: `isPrimitiveCall` in tree-builder now peels MultiValue-wrapped fn references (the lib's `proven_decl_marker` resolves to a typed UntypedFunction MultiValue when the grammar template evaluates in a typed env) — without this, none of the body-form markers from lib modules would be extracted. `unwrapProvenAttach` lives in `src/totality.ts` alongside the other body-form peelers (added to `_WRAPPER_NAMES` so all peelers can walk through it). Multi-param or non-sampleable types emit a `proven-skipped` info notification, not an error — degenerate but documented. `proven-failed` notifications halt with the same throw shape as effects-mismatch / proof-failure. 8 new unit tests + demo (`tests/proofs-proven-demo.alg`); 912/912 green. With F7 the F-arc is feature-complete for AI collaboration; F6 (Lean export) remains as the long-term trust-chain piece.
- ✅ Provability arc — Phase F5 (universal quantification + bounded induction): two new proof constructors in `src/primitives.ts`, both lazy + composing with F1-F4. **`prove_for_all_bool(predicate)`** discharges `∀b: Bool, predicate(b)` by enumerating the two-value domain: evaluate `predicate(true)` and `predicate(false)` via `evalFn(makeExpr(pred, [fromBool(true|false)]))`; if both fold to `Bits(1)` return a discharged Proof, else a failed Proof naming the missing case(s). **`prove_induction(predicate, base_proof, step_fn)`** discharges `∀n: NonNeg, predicate(n)` by **bounded sample verification** (Stage F5 minimum, documented as such): verify `base_proof` is discharged + `predicate(0)` folds true; for `n = 0..K-1` (K=4) invoke `step_fn(n, ih)` threading the previous step's result as the induction hypothesis, requiring each return to be a discharged Proof AND `predicate(n+1)` to fold true. Full symbolic induction over an unbounded n is a follow-on (would likely need symbolic-n reasoning beyond PE-as-discharge). The induction-step contract is `(n, ih_proof) => proof_of_P(n+1)`; the user owns step correctness across all n. Counterexamples on failure name the specific n + reason: `predicate(1) does not hold` / `step proof failed at n=2` / `base case is not a discharged proof`. Both primitives registered lazy so Proof arguments (the base_proof; the step_fn's outputs) flow through as full MultiValues, not `primaryOf`'d. `lib/tactics.alg` adds two pure-Allegro re-exports (`by_cases_bool`, `by_induction`) for readability. Composition: `theorem t: prove_for_all_bool(...)` works via the F2 `proof_by_eval` passthrough; `verify prove_induction(...)` likewise. 10 new unit tests + demo (`tests/proofs-induction-demo.alg`); 903/903 green. F6 (Lean export) and F7 (`proven` clause — [impl, proof] surface for Phase H) remain.
- ✅ Provability arc — Phase F4 (tactic library — pure Allegro): `lib/tactics.alg` composes the F1–F3 proof primitives into a small library of reusable proof strategies. No new host primitives — F4 is the demonstration that the combinator core is expressive enough to build reusable proof strategies *in the language itself*. Exports: `same(x)` (refl), `flip(p)` (sym), `under(f, p)` (cong), `step(p1, p2)` (binary trans, readable), `chain(ps)` (fold trans over an Array of equality proofs — `[a==b, b==c, c==d] ⊢ a==d`, implemented as `ps.slice(1, ps.length).reduce((acc, p) => proof_trans(acc, p), ps[0])`), `rewrite(eqAB, f, eqFAC)` (substitute a by b inside f, given f(a)==c ⊢ f(b)==c, implemented as `proof_trans(proof_cong(f, proof_sym(eqAB)), eqFAC)`). Tactics flow Proof values through Allegro Params; combinators were already lazy so the full MultiValue (with `__eq_lhs`/`__eq_rhs` + type) reaches them unchanged. The module is loaded via the modules.alg pattern: read source → `evalSource` → collect bindings → `extensionToContext` → `fileTest([{ name: "tactics", bindings: { tactics: ctx } }])`. Failed tactic outputs (e.g. `tactics.chain([e1, e2])` where e1's RHS ≠ e2's LHS) surface through `checkProofs` with the inner reason propagated through `proof_check`. 7 new unit tests + demo (`tests/proofs-tactics-demo.alg`); 891/891 green. F5 (universal quantification + inductive proofs) next.
- ✅ Provability arc — Phase F3 (proof combinators + `theorem … by <proofterm>`): equality proofs gain structure — a discharged proof of `L == R` now carries `__eq_lhs` / `__eq_rhs` (evaluated operands), stashed by an extended `proof_by_eval` when the proposition is structurally `Expression(bits_eq|typed_eq, [L,R])`. Four combinator primitives in `src/primitives.ts`: `proof_refl(x)` (x == x), `proof_sym(p)` (a==b ⊢ b==a), `proof_trans(p1,p2)` (a==b, b==c ⊢ a==c, requires `proofValEqual(p1.rhs, p2.lhs)`), `proof_cong(f,p)` (a==b ⊢ f(a)==f(b), applies f to both sides via `evalFn(makeExpr(f,[side]))`). The `theorem NAME: P by <proofterm>` grammar slot (base-grammar `theorem_decl` gained `opt(seq([ws_req, lit("by"), ws_req, expr]))` — `by` not `=>` to avoid the `a == (b => term)` lambda ambiguity; `by` non-reserved). `proof_check(propSrc, propExpr, proofExpr)` (lazy) enforces SOUNDNESS: the proof term must establish exactly the stated proposition — for equality props it value-matches the proof's `__eq_lhs/__eq_rhs` against the proposition's evaluated sides (so `theorem bad: 1 == 2 by proof_refl(5)` is rejected: "proof term establishes a different equality"); a failed `by` term propagates its inner reason/counterexample ("`by` proof failed: transitivity middle terms differ"); non-equality props fall back to eval-consistency, also accepting a proposition that itself evaluates to a discharged Proof (F2 composition). **Critical fix**: eager primitives receive `primaryOf`'d args (line 358 of evaluator.ts), which strips a Proof MultiValue's `type` component AND structured operands — so all proof combinators + `proof_check` are registered LAZY (they get full MultiValues via their own `evalFn`). Proof recognition is now structural (`proofCtx(v)` checks for the `__discharged` binding) rather than type-component-based, robust to any residual stripping. `theorem_decl` tree-builder rewritten to key off the `:` / `by` delimiters (the earlier forward-`c.find(EXPRESSION_TAGS)` grabbed the theorem-name `ident` — itself an expression tag — as the "proposition", causing `proof_by_eval(src, Symbol(self))` infinite recursion; F1/F2 masked it with `.reverse()`). Named theorems are ordinary referenceable bindings, so combinators nest (`proof_trans(e1, proof_trans(e2, e3))`) and a bare `bad = proof_trans(proof_refl(1), proof_refl(2))` is still surfaced by `checkProofs`. 11 new unit tests + demo (`tests/proofs-combinators-demo.alg`); 883/883 green. F4 (Allegro-side tactic library) next.
- ✅ Provability arc — Phase F2 (proof by refinement-domain entailment): `proof_refines(value, refinedType)` — the second proof constructor (F1 = `proof_by_eval`). Discharges through the SAME abstract-domain lattice as Phase B/C refinement checks (`impliesDomain`) — no parallel proof infrastructure, satisfying the thesis's falsifiable constraint (`docs/VISION.md` §2). Mechanism (`proof_refines_impl` in `src/primitives.ts`, eager): read the refined type's expected domain (`__abstractDomain` set by `buildRefinedType`, or `domainFromPredicate(__predicate)`); read the value's actual domain via the newly-exported `domainOrFromValue` (predicate set → propagated domain → bare-literal `eq(k)`); `impliesDomain(actual, expected)` → discharged Proof, else failed Proof. Counterexamples reuse Phase B's `counterexampleFor` (e.g. `-3 satisfies the value's domain (== -3) but violates \`PositiveInt\` (≥ 1)`). The refined type's own `__name` is rendered (not its meta-type); negative literals render as signed ints (fixed a `bitsToString`-on-int garble). Composition: `proof_by_eval` now passes Proof values through unchanged (an `_isProof(result)` check before the Bits-fold), so `theorem t: proof_refines(5, PositiveInt)` and `verify proof_refines(…)` work — a discharged inner Proof flows out, a failed one propagates its reason. Predicate-set entailment composes: `x = SmallPos(50)` (domain `[1,99]`) discharges `proof_refines(x, NonNeg)` since `[1,99] ⊆ [0,∞)`. Base types with no refinement domain (`proof_refines(5, Int)`) are rejected with guidance to use `proof_by_eval`. `proof_refines` registered eager (both operands are ordinary values, unlike `proof_by_eval`'s lazy proposition). 8 new unit tests + demo (`tests/proofs-refines-demo.alg`); 872/872 green. F3 (proof combinators refl/sym/trans/cong + `=> proofterm` slot) next.
- ✅ Provability arc — Phase F1 (proof terms as first-class values — substrate): proofs become first-class Values discharged by partial evaluation, per the thesis (`docs/VISION.md` §2: PE-as-discharge primary). New `Proof` meta-type in `src/types-std.ts` (`__type = Type`, mirrors the `Effect` meta-type) bound into the standard extension. `makeProof(propSrc)` builds a discharged witness (Context with `__proposition`, `__discharged = 1`); failed proofs are the same shape with `__discharged = 0` plus `__reason` / `__counterexample`. New lazy primitive `proof_by_eval(propSrc, propExpr)` (in `src/primitives.ts`): evaluates the proposition; folds to `true` → discharged Proof; `false` → failed Proof (counterexample `\`P\` evaluates to false`); unresolved → failed Proof (`could not be discharged by evaluation` — F1's contract is provable-BY-EVALUATION, so a residual is a failure of *this* strategy; F2/F3 add others). Surface syntax is **base-grammar** (not an opt-in lib extension — provability is Allegro's defining feature): two new `stmt` alternatives in `src/grammar2/base-grammar.ts` tried before binding/fn_decl/expr — `theorem NAME: <prop>` (a named, referenceable Proof binding) and `verify <prop>` (anonymous one-shot). Neither is a reserved word; `theorem = 42` / `verify = 7` still parse as ordinary bindings via backtracking (same approach as the `grammar` atom). `src/grammar2/tree-builder.ts buildStmt` handles both tags: the proposition's source text is captured via `textOf` (label only, never re-parsed — used for counterexamples / future Lean export) and passed as `proof_by_eval`'s first arg, the proposition AST as the second (lazy, so `proof_by_eval` controls PE). `src/proofs.ts` adds `checkProofs` / `isFailedProof` / `isDischargedProof` / `describeFailedProof` / `formatProofFinding`; the `evalSource` evaluation loop collects failed proofs (named theorem bindings + anonymous verify bare-exprs both evaluate to a Proof) and, post-loop, pushes `proof-failure` error-severity notifications and throws — a failed proof is unsound by construction, same "build safety in" treatment as a failed effects declaration. PE-as-discharge in action: `verify f(2) == 3` discharges because PE evaluates `f(2)` → 3 → `3 == 3` → true, no runtime check survives. Named theorems are ordinary referenceable bindings (combinators that consume them arrive in F3); F1 doesn't yet support the `=> <proofterm>` slot (deferred to F3 where combinators exist). 12 new unit tests + demo (`tests/proofs-demo.alg`); 863/863 green. F2 (refinement-domain discharge via `impliesDomain`) and F3 (proof combinators refl/sym/trans/cong) build on this substrate.
- ✅ Provability arc — Phase E Stage 6 (counterexample rendering): totality notifications now carry an optional `counterexample` field — a concrete trace or sample input illustrating the failure shape. Storage: `Notification.counterexample?: string` (in `src/runtime.ts`); each kind populates it where it can produce a witness. Shapes per kind: (1) **Exhaustiveness over Bool** — `\`f(false)\` is unmatched` (or `true`); `analyzeChain` returns `{ message, missingLiteral? }` so the emission site can build the witness using the binding's name. (2) **Self-recursion no decrease** — `bad(n) → bad(n) [same input passes back]`. (3) **Mutual recursion** — `a(n) → b(n) → a(n) [cycle, no decrease]`, built from the SCC's outgoing edges (caller + every distinct callee in the cycle). (4) **HOF non-decrease** — `recursive_map(arr) calls arr.map(recursive_map) — receiver is not smaller, recursion loops`, using the receiver param's name. (5) **Failing `decreases` clause** — `\`decreases n\` does not decrease on bad(…) → bad(…) at call site`, with the metric rendered (bare Param → name; `typed_array` → `[a, b]`). Helpers: `renderTerminationCounterexample(bindingName, cycleCalls, cfn, scc)` and `renderMetricCounterexample(bindingName, metric, cycleCalls)`. Propagation: `checkExhaustiveness` / `checkTermination` return `{ counterexample? }` on each finding; `runtime.ts` copies it onto the `Notification`. Rendering: `BindingSummary` gets `totalityNotices?: Notification[]`; `summarizeModule` pre-groups totality notifications by `binding` (a single Map walk over `report.notifications`); `renderModuleSummary` surfaces a `totality:` block per binding with each message and indented `counterexample:` line. The introspection `allegro inspect` CLI and web sandbox Inspect button now show concrete witnesses, not just message text. Programmatic consumers read `note.counterexample` directly. 7 new unit tests covering each shape + rendered-summary visibility; 851/851 green; phase E complete (all six stages 0-6 landed).
- ✅ Provability arc — Phase E Stage 5 (HOF-mediated recursion through stdlib `map`/`filter`/`reduce`): the call-graph + cycle-detection machinery from Stages 2-4 sees only `Expression(Symbol(name), …)` direct calls, so a function passed as a callback (e.g. `arr.map(self)`) was invisible to the analyzer. Stage 5 adds a second edge kind: when the body contains `Expression(Expression(type_dispatch, [receiver, Bits("map"|"filter"|"reduce")]), [cb, …])` and any callback is a `Symbol(name)` where `name ∈ cycle`, that's an HOF cycle edge. New `CallSite` discriminated union (`{kind: "direct", …} | {kind: "hof", method, receiver, …}`) flows through `findCallsToCycle` and the verification loop. Verification differs by edge kind: direct calls run `whyNotDecreasing` against the callee's param types (Stages 2-4 path); HOF edges run `whyHofCallNotDecreasing` which checks that the receiver is structurally smaller than a caller parameter. Stage 5 minimum recognises one structural-decrease shape: `param.field` access (i.e. `Expression(type_dispatch, [Param(p), Bits(field)])`) — the field value is a sub-component of the record, so iterating it terminates by structural induction. Bare-Param receivers (`arr.map(self)` on the function's own array param) fail the check and fire. `decreases` clauses skip the HOF check (the metric is the user's contract; we still verify direct calls' positional decrease against the metric, ignoring HOF edges). `partial` opt-out skips everything. New helpers: `matchStdlibHof(e)` recognises the dispatch wrapper; `isHofReceiverStructurallySmaller(recv)` is the param.field test; `whyHofCallNotDecreasing(site)` produces the explanatory message. `collectCalleeNames` was updated in parallel so HOF callbacks contribute to the call graph (otherwise the SCC computation wouldn't see the indirect edge). Composes with Stages 2-4: mutual recursion through HOFs (`a→b via map, b→a via map`) is detected as a size-2 SCC with both edges being HOF kinds; the per-binding message includes the mutual-cycle suffix. Stage 5 minimum doesn't yet verify the field's static type is an Array (the structural-induction argument requires it; non-array fields might violate finiteness in pathological cases). Also doesn't handle `arr.slice(…).map(self)` (receiver is a computed sub-array, not a direct field access) — those fall through to the not-structurally-smaller path. 8 new unit tests + demo (`tests/totality-hof-demo.alg`); 844/844 green. Stage 6 (counterexample rendering) pending.
- ✅ Provability arc — Phase E Stage 4 (mutual recursion via SCC): `checkTermination` in `src/totality.ts` now groups bindings into strongly-connected components of the call graph (Tarjan's algorithm) and treats every cycle uniformly. Self-recursion (SCC size 1 with self-edge) keeps Stage 2's wording; mutual recursion (SCC size ≥ 2) adds a `(mutual recursion cycle: a ↔ b)` suffix and prefixes each cycle-edge reason with `call to \`callee\`:`. Each cycle call is verified against the CALLEE's `paramTypeAsts` — so `a(n: NonNeg): Int => if n == 0 then 0 else b(n - 1)` proves termination through `b`'s NonNeg bound, not `a`'s. Edges to non-cycle members are ignored (the helper `id` alongside an `a↔b` cycle stays silent). New helpers: `collectCalleeNames` walks an Expression DAG collecting Symbol-referenced callee names; `findCallsToCycle` collects every `Expression(Symbol(name), …)` where `name ∈ cycle` in one pass (replaces the self-only `findRecursiveCalls`); `tarjanSCCs` computes the SCC map, skipping graph entries that aren't bindings (top-level value references that happen to share a name with no function). `partial` opt-out is checked per-binding inside the cycle — a partial member of an SCC doesn't auto-discharge the whole cycle; mutual partners still need to prove their own decrease (or be marked partial themselves). The `decreases` clause path uses the caller's own paramTypeAsts (same as Stage 3) since the metric is user-attested. Bindings are materialised once up-front (`bindingList`) because the SCC build needs the full set before the per-binding analysis loop. 6 new unit tests + demo (`tests/totality-mutual-demo.alg`); 834/834 green. Stages 5-6 pending: higher-order propagation through stdlib HOFs, counterexample rendering.
- ✅ Provability arc — Phase E Stage 3 (`decreases <metric>` body-form): new `stmt_form` in `lib/totality.alg` lowers `decreases <expr>` to `decreases_decl_marker(expr)`; the block preprocessor extracts the marker and wraps the function body with `decreases_attach(body, metric)`. `unwrapDecreasesAttach` peels via a shared `findAttachWrapper` helper that handles any combination of `type_check` / `partial_attach` / `decreases_attach` / `effects_attach` / `param_effects_attach` decorators on the head — `unwrapPartialAttach` now uses the same helper so `partial` + `decreases` (or any combination) coexist without order dependence. Analyzer semantics: `decreases` is a user commitment. Stage 3 verifies recognised shapes — (1) bare `Param`: positional decrease via `recognizeParamMinusK`, NO type-bound check (the explicit clause IS the commitment, looser than Stage 2's policy which requires `: NonNeg`); (2) `typed_array(p1, p2, …)` (i.e. array-literal `decreases [a, b]`): lexicographic decrease via `findLexDecreasePosition` — earlier components must pass through unchanged, then some component strictly decreases. Anything else: silent (trust the user). When `decreases` is present, Stage 2's auto-detection is skipped entirely. `partial` opt-out overrides everything. Stage 3 minimum doesn't yet handle `arr.length`, `expr.field`, or general expression metrics — those are recognised as unverified user commitments. 9 new unit tests + demo (`tests/totality-decreases-demo.alg`); 826/826 green.
- ✅ Provability arc — Phase E Stage 2 (structural termination check): `checkTermination` in `src/totality.ts` walks every function binding's body, collects `Expression(Symbol(fnName), …)` recursive calls, and tries to find a position `i` whose arg is `bits_sub(Param(pos=i), Bits k)` with `k > 0` where the param's type's `__abstractDomain` has `lo >= 0` (interval) or `value >= 0` (equal). When found, the call is provably decreasing on a well-founded order. Confidence policy: emit `totality-nontermination` (severity `info` default) only when (a) recursion exists AND no parameter decreases, OR (b) decrease detected but the param's static type is unbounded below — message names the param and suggests `NonNeg` / similar. Silent on non-recursive functions and on untyped recursion (existing Allegro code stays clean). Symbol-typed annotations (`n: NonNeg` where `NonNeg = Int & _ >= 0` is a top-level binding) resolve via a `totalityCompileCtx` mirroring `precompileFunctions`' setup (primitives + extensions + source bindings), so user-defined refinement types evaluate on demand and yield Contexts carrying `__abstractDomain`. `lib/totality.alg`'s `partial` opt-out skips the termination check too. Stage 2 minimum recognises the `param - K` arithmetic pattern only; Stage 3 adds user-supplied `decreases` metrics for non-structural recursion, Stage 4 handles mutual recursion via call-graph analysis with lexicographic measures, Stage 5 propagates totality through stdlib HOFs. 7 new unit tests + demo (`tests/totality-termination-demo.alg`); 817/817 green.
- ✅ Provability arc — Phase E Stage 0+1 (totality substrate + exhaustiveness for `when/is/then`): `partial` body-form (via `lib/totality.alg`) opts a function out of the totality analyzer; lowers to a `partial_attach(body)` wrapper that `isFunctionPartial` / `unwrapPartialAttach` in `src/totality.ts` peel. Three notification kinds reserved (`totality-exhaustiveness`, `totality-nontermination`, `totality-needs-annotation`), all default to `info` so adoption is non-breaking. Stage 1: `checkExhaustiveness` walks every function binding's `eval_when` chains; for each chain without an explicit `else` or wildcard / bind-to-name catch-all, resolves the subject's static type (Param via the typed_function signature's paramType ASTs + Symbol lookup against extensions) and emits a notification when the type is finite-domain Bool with missing literals (e.g. `is true` without `is false`), or uncountable (Int/Float/String) with no fallback. Confidence policy: stay silent when the subject type can't be determined — false positives erode trust. Prerequisite fix: `eval_when` now returns a residual when its subject is unresolved (Rule 2 analogue) — previously fell through to `when_no_match` which threw, producing spurious precompile errors that masked the totality issue. 9 new unit tests + 2 demos (`tests/totality-partial-demo.alg`, `tests/totality-exhaustiveness-demo.alg`); 809/809 green. Stages 2-6 pending: structural termination, `decreases` body-form, mutual recursion, higher-order propagation, counterexample rendering.
- ✅ Provability arc — Phase D1 Slice 2 F1-F3 cleanup (walker removal + notification migration + universalize precompile): the walker is now deleted — `inferFunctionEffects`, `walkValueEffects`, `effectsOfFunctionArg`, `effectsOfWithFallback`, `effectPredicatesForFunction`, `effectPredicatesForValue` (~290 LOC) all removed from `src/effects.ts`. Effects flow purely through PE: `applyPrimitive` propagation (F1), Param-call residual effects reading `Param.effectBound` (F2), and compile-time deferral of effectful primitives (F3a) cover every shape the walker handled. To get there cleanly: (1) `precompileFunctions` driver now precompiles untyped top-level functions and bare ComposedFunction bindings too (passes empty paramTypes → bare-Param placeholders; effect inference works, return-type inference is weaker without typed args); (2) `effectsOf` reads `__inferredEffects` from ComposedFunction primaries as a fallback to the MultiValue component, so bare ComposedFunctions surface their stashed effects through the same canonical accessor; (3) `precompileFunction` consumes TailCalls in its own loop — untyped tail-recursive bodies like `forwarder(g, y) => apply(g, y)` previously returned an unconsumed TailCall sentinel and dropped the inferred effects. `CompilationReport` migration: `errors[]` collapsed into `notifications[]` where each entry carries a stable `kind` tag and `severity: "error" | "warning" | "info"`; helpers `notificationsBySeverity` / `reportErrors` / `reportHasErrors` filter by tier. Push sites tag with `effects-mismatch` / `return-type-mismatch` / `precompile-eval` / `precompile-type-error` (error) and `effects-opaque-from-stdlib-hof` (info). Per-project severity remap by `kind` is the next step; substrate is ready. `Param.predicates` slot stays reserved for future refinement bounds (F2 moved effect bounds to `Param.effectBound`). Stage C3's auto-promotion test reframed: PE now resolves inline lambdas precisely on BOTH annotated and auto-promoted sides — the explicit `[e: Effect]` declaration still matters when the cb is a forwarded param (the case PE alone can't resolve). 9 files touched, 254 added / 420 removed; 793/793 green; demos pass.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3b (stdlib HOF migration): with F1 PE-driven effects + F2 polymorphic Param-call propagation + F3a compile-time deferral all in place, the Slice-1.3 `opaque` placeholders on Array.map/filter/reduce + the walker's `type_dispatch(obj, "map" | "filter" | "reduce")` heuristic become unnecessary. Both removed. `arr.map(io_cb)` now propagates the cb's io effect to the caller's inferred set instead of conservatively marking opaque. Mechanism: `arr.map(cb)` evaluates the bound primitive (no effects tag now), which delegates to the Allegro-built `mapAllegro` whose body's `fn(arr[i])` is a Param-call. PE's F2c Param-call branch reads `Param.effectBound` (or, for unannotated Params, defaults to opaque) — but mapAllegro's `fn` Param has no annotation, so it'd be opaque without one more piece. The new piece (F3b): `typed_function_impl` precompiles inline typed lambdas on first evaluation via a precompile-on-evaluate hook, so the cb's body PE'd effects component populates and the `applyPrimitive` arg-effects loop sees `{io}`. A `_precompileInProgress` WeakSet guards against infinite recursion on self-referential bodies (`factorial(n) => factorial(n-1)`). Pre-existing tests that explicitly verified the opaque-tag behavior (`Phase D1.3: function calling Array.map gets opaque in inferred set`, `Phase D1.3: opaque-from-stdlib-hof emits a notification`) updated to verify the new precise propagation. 6 new tests + end-to-end demo (`tests/hof-effect-propagation-demo.alg`); 793/793 green; basics.alg unchanged.
- ✅ Provability arc — Phase D1 Slice 2 Stage F3a (compile-time deferral of effectful primitives): when PE evaluates a primitive's args inside a function body being precompiled (`ctx.__compileMode = true`) and the primitive carries a non-empty `.effects` tag, `applyPrimitive` returns a residual `makeExpr(fn, evalArgs)` instead of executing the impl. The residual still carries the effects component so the inferred set surfaces upward via PE; the side effect fires when the function is invoked at runtime where ctx isn't compile-mode. Fixes a long-standing latent issue where `print("trace")` inside a function body fired during precompile (precompile evaluates the body for type/effect inference; lazy primitives like print bypassed any deferral check). `precompileFunction` sets/restores `__compileMode` on its ctx around the body evaluation; `applyComposed`'s `enrichedCtx` and `augmentScopePredicates` propagate the flag through ctx-creation points so deferral applies in transitively-called function bodies and inside if-branches during precompile. Both eager and lazy primitive paths in `applyPrimitive` honor the flag — the lazy path was the actual culprit since print/fetch/delay are all lazy. Pure primitives still fold eagerly (deferral keys off `.effects` length); only effectful ones defer. Top-level bare expressions execute as before (they're not under precompile, so no flag is set). Declaration check still works because effects propagate through the residual via the effects component. 6 new tests covering capture-stdout verification of compile-time non-firing, runtime fire-on-call, top-level immediate fire, pure-primitive folding, deferred-residual effects component, and declaration-check still firing under deferral.
- ✅ Provability arc — Phase D1 Slice 2 Stage F2 (consumer migration to effects component + Param.effectBound + PE polymorphic propagation): Param storage migrates from `predicates: PredicateSet` (carrying effect bounds as effects-bound predicates) to a dedicated `effectBound: EffectSet` slot — refinement bounds stay reserved on `predicates` for future use, effects describe computations and live separately. `typed_function_impl` now writes effect bounds (Stage A `f: pure`, Stage C2 `__effectvar:NAME` markers, Stage D `param_effects` peel-and-stamp) directly to `Param.effectBound`. The walker (`walkValueEffects`) and PE Param-call handling read from `effectBound` directly. `subst`/`remapParams` clones preserve `effectBound` across substitution. PE Param-call propagation: when `evaluateExpr` reaches a residual `Expression(fn=unresolvedParam, args)` (typical inside polymorphic function bodies after precompile placeholder substitution), the residual carries the param's `effectBound` labels via the effects component — without this, polymorphic forwarders like `apply[e](g: e, x): Int => g(x)` would lose their effect-variable markers and `caller(x): Int => apply(printer, x)` would not infer io. Unannotated function-typed Params default to `opaque` in this path, matching the walker's conservative semantics. `precompileFunction` now copies `effectBound` onto the placeholder Params it creates so the substituted body reads the right metadata. Consumer migration: `checkEffectsDeclarations` reads `cFn.__inferredEffects` (PE-stashed) before falling back to the walker; introspection (`summarizeValue`) does the same. `checkArgType` (Stage A bound) and `type_check_impl` read effects via `effectsOfWithFallback(arg)` — direct component first, walker fallback for legacy untyped functions. The Stage D Surface C call-site enforcement skips Stage C2 marker bounds (labels starting with `__effectvar:`) since those are placeholders the walker resolves at call sites, not concrete bounds. Walker stays alive as the legacy fallback path; F3 will add compile-time deferral and remove the parallel infrastructure.
- ✅ Provability arc — Phase D1 Slice 2 Stage F1 (effects-as-component substrate, PE-driven): effects move from a parallel walker pass into a first-class MultiValue component named `"effects"`, alongside `type` and `error`. `src/effects.ts` adds `EFFECTS_COMPONENT_KEY`, `withEffects(v, eff)`, `effectsOf(v): EffectSet | null`, and `unionEffectSets(...)`; storage mirrors `withPredicates` (Context with JS-side `__effectSet`). `applyPrimitive` in `src/evaluator.ts` propagates effects via PE: eager primitives union the primitive's static `.effects` tags + each evaluated arg's `effects` component + the result's own component (set when method dispatch attaches it directly); lazy primitives accumulate via a tracking `evalFn` wrapper so `seq`, `eval_if` (Rule 2 unions both branches naturally), `effects_attach`, `type_check` all flow without per-primitive bookkeeping. Function values get their inferred effect set stamped at precompile time: `precompileFunction` now returns `inferredEffects: EffectSet | null` and stashes the body-result's effects on `cFn.__inferredEffects`; `typed_function_impl` reads the stash and attaches the `effects` component to the returned MultiValue, so `effectsOf(fn)` returns the PE-derived set directly. The existing predicate-set / walker machinery stays alive in parallel during the F1→F2 migration; consumers (`checkEffectsDeclarations`, introspection) still use the walker today and migrate in the next slice. Pure-literal arithmetic stays uninstrumented (no effects component appears unless something fires). Architectural payoff: effects describe COMPUTATIONS (function values, deferred residuals) — refinements describe DATA — the component split makes the distinction structural, prevents the lattice cross-contamination from earlier inversions (1.2 / Stage A), and sets up compile-time deferral as a one-component-lookup decision in F3. Two design memos to consult before F2: (1) the orthogonality argument — types and effects share infrastructure today but have no productive reasoning interplay; (2) effects naturally live on function values, not on data values.
- ✅ Provability arc — Phase D1 Slice 2 Stage E (function-type-expression syntax): `(A) => B` is now parseable in any type-expression position. Lowers to `type_function(paramType1, …, paramTypeN, returnType)`, which evaluates to a concrete `Function[ParamTypes, ReturnType]` identical to what `makeFunctionType` produces in TypeScript. Multi-param `(A, B) => C`, zero-param `() => A`, and curried `(A) => (B) => C` (right-recursive on return type) all work. Composes with generics: `Array[(Int) => Int]` is an array of `Int → Int` functions. Grammar lives in `type_expr_atom` (tried before `type_generic` so the `(` opener is unambiguous); lambda parsing only fires in expression position so there's no clash. Tree-builder finds nested `type_function` branches via the existing `findTypeExpr` helper (extended to recognise the new tag) and lowers them via `buildTypeExpr`. New `type_function` primitive evaluates each arg, takes the last as the return type, and builds the FunctionType. Type compatibility falls out of the existing FunctionType machinery — type_check, unification, and call-site enforcement work unchanged. Limit: `instanceof (Int) => Int` doesn't work since `instanceof`'s right side parses as an expression, where `(Int) => Int` is read as a lambda; use `instanceof Function[…]` for that case once generic args resolve cleanly. Stage E does NOT yet improve Array.map/filter/reduce effect propagation (still tagged `opaque` per Slice 1.3); that's the follow-on slice that uses this syntax to express polymorphic stdlib HOF types.
- ✅ Provability arc — Phase D1 Slice 2 Stage D (Surface C `param_effects` body-form): the effect-bound declaration alternative to Surface A's param-type slot. Useful when the param has a non-trivial type and you don't want to fold the effect into the type expression. `lib/effects.alg` adds a stmt_form `param_effects n:ident ":" e:ident` (paired with the existing `effects` clause; multi-param via repeated declarations). Block-expr preprocessor (`src/grammar2/tree-builder.ts buildBlockExpr`) extracts `param_effects_decl_marker(paramRef, effSym)` calls and wraps the body's result with `param_effects_attach(body, paramRef1, effSym1, …)` (lazy passthrough at runtime, metadata for the analyzer). `typed_function_impl` peels one `type_check` layer (matching `unwrapEffectsAttach`'s peel from C3) then peels `param_effects_attach`, evaluates each effect Symbol against the call ctx so `pure`/`io`/etc. resolve via extensions, and stamps the matching Param's predicates from the Effect type's `__effectBound` — by-name match against `cFn.params[i]._name` survives `remapParams` clones since names are preserved. Call-site enforcement: `evaluator.applyComposed` checks Param.predicates as a fallback when the param-type slot lacks `__effectBound`, running the same `impliesDomain` discharge with attribution `(from param_effects)` in error messages so users can tell which surface produced the bound. Walker propagation works automatically — the existing Stage B `Expression(Param(p), …)` branch reads `p.predicates.effectiveEffects()` regardless of which surface stamped it. Surface A and C can coexist on the same param (both stamp; C runs last so it wins on identical declarations; conflict detection is future polish). Demo: `tests/effects-surface-c-demo.alg`.
- ✅ Provability arc — Phase D1 Slice 2 Stage C3 (multi-variable polymorphism + effect-conjunction at value level + declaration-check repair): multi-variable cases (`apply2[e1: Effect, e2: Effect](g1: e1, g2: e2, …)`) and idempotence (`twice[e: Effect](f: e, x): f(f(x))`) fall out of Stage C2's walker for free — per-marker positional resolution and Set-based dedup handle them without new code. Effect-conjunction at the value level: `typed_amp_impl` detects Effect-extending operands (via `__extends` chain identity check `isEffectExtending`), evaluates the right-side thunk, and dispatches to `effectUnion` (lattice join: `pure & pure = pure`, `io & opaque = opaque`, anonymous compounds coerce to `opaque` until anonymous-conjunction representation lands). Two declaration-check repairs surfaced while validating: (1) `asFunction` in `src/effects.ts` peels unevaluated `typed_function(ComposedFunction(…), …)` Expressions so `checkEffectsDeclarations` reaches typed function bodies pre-evaluation — previously the check silently skipped any function with a return-type annotation; (2) `unwrapEffectsAttach` peels one layer of `type_check(…, returnType)` (the wrapper `maybeTyped` adds for typed-return functions). `__effectvar:NAME` markers in the inferred set are normalised to bare names against the declared set so polymorphic `effects e` declarations verify at definition time without false-positive mismatch. Auto-promotion: an unannotated function-typed param produces `opaque` honestly (no silent zero) — the explicit `[e: Effect]` declaration is what enables precise propagation, validating the falsifiable hypothesis that explicit declaration is the contract surface, not the auto-promoted form.
- ✅ Provability arc — Phase D1 Slice 2 Stage C2 (effect-variable unification at call sites): when a paramType is a Symbol matching an Effect-kinded entry in the function's `__genericParams`, `typed_function_impl` stamps the Param's predicates with a variable marker (`{labels: ["__effectvar:NAME"]}`) and records `__effectVarParams: Map<string, number[]>` on the ComposedFunction. The walker (`walkValueEffects`) detects ComposedFunction calls whose callee carries `__effectVarParams`, and at each call site replaces variable-marker labels in the recursed inferred set with the actual effects of the corresponding arg via `effectsOfFunctionArg`. Cross-binding Symbol references (e.g. `forwarder` calling `apply`) resolve through an optional `EffectsLookup` callback (`(name) => evalCtx.bindings.get(name)?.value`) threaded through `inferFunctionEffects` / `walkValueEffects` / `effectsOfFunctionArg`. `effectsOfFunctionArg` also peers into `typed_function(fn, …)` call expressions so inline annotated lambdas (`(y: Int): Int => y * 2`) resolve precisely. Critical correctness fix: `typeLiterals`, `resolveSymbols`, `subst`, and `remapParams` now preserve `__genericParams` and `__effectVarParams` across ComposedFunction clones — without this, the metadata was being stripped during pre-evaluation passes and polymorphic resolution silently fell back to opaque. Result: `apply((y) => y * 2, 7)` infers pure; `apply((y) => print(y), 7)` infers `io`; forwarding an unbounded param infers opaque (conservative); forwarding a `f: pure` param infers pure precisely.
- ✅ Provability arc — Phase D1 Slice 2 Stage C1 (generic param list grammar): function declarations now accept an optional `[generic_decl]` between the function name and the parameter parens — `id[T](x: T): T => x`, `apply[e: Effect](g: e, x: Int): Int => g(x)`, `pair[T, U](x: T, y: U): T => x`. Each generic param is `id` (kind defaults to `Type`) or `id : type_expr` (explicit kind). Grammar (`base-grammar.ts`) adds `generic_param`, `generic_param_list`, `generic_decl` productions and threads `opt(generic_decl)` into `fn_decl` and `export_fn_decl`. Tree-builder (`tree-builder.ts`) collects the params via `collectGenericParams` and stamps the underlying `ComposedFunction` with a `__genericParams: { name, kind? }[]` array — survives `typed_function` envelope wrapping since the ComposedFunction identity persists. Behaviour change is minimal: existing auto-promotion (unannotated identifiers in type positions = type variables) continues to work as before; the explicit declaration is documentation today and the substrate Stage C2 consumes for effect-variable unification dispatch. The `f[T]` parsing ambiguity at expression position is moot — declaration position has the unambiguous `name [generic_decl] (` shape.
- ✅ Provability arc — Phase D1 Slice 2 Stage B (HOF inference walker): when the static walker encounters `Expression(Param(p), …)` (a function-typed parameter being called), it pulls `p.predicates.effectiveEffects()` and adds those labels to the inferred set. With no bound declared, the param is treated as `opaque` — honest about the unknown rather than silently zero-effect. `typed_function_impl` stamps `Param.predicates` from each paramType's `__effectBound` at definition time, so `f: pure` flows from annotation through to walker visibility. New `PredicateSource` value `"effects-bound"` distinguishes param annotations from `"effects-declared"` (function-body clause) and `"effects-inferred"` (computed). The 1.3 `type_dispatch(obj, "map" | …)` heuristic stays — it handles a different case (stdlib HOFs called on dynamic receivers) and gets cleaner only when stdlib HOFs land in `lib/collections.alg` with full polymorphic types (Stage E). Alias tracking (`g = f; arr.map(g)`) falls out of normal predicate propagation — no new code. Functions with `effects pure` declarations on unbounded param calls emit the existing `effects-opaque-from-stdlib-hof` notification; with `f: pure` bounds the inferred set is precise and no notification fires.
- ✅ Provability arc — Phase D1 Slice 2 Stage A (effect bounds via `type_check`): `f: pure` and binding annotations `x: pure = …` now discharge through the same `type_check_impl` / `checkArgType` path numeric refinements use — no parallel infrastructure. `buildEffect` attaches an `__effectBound: EffectsDomain` to each Effect-extending type at construction (`pure` → `{labels: ∅}`; `opaque` → no bound, universal pass; named effects → `{labels: {name}}`). The discharge pulls the arg's effect predicate set via `effectPredicatesForFunction` (the on-demand derivation from D1.2), takes its `effectiveEffects()`, and runs `impliesDomain(actual, bound)` — predicate-implication semantics: actual ⊆ bound. The 1.2 inversion in `impliesDomain` for effects (which had used capability semantics, opposite of numerics) is fixed; the user-facing `effectImplies` in `types-std.ts` keeps capability semantics as the value-side `Effect.implies` operator. `ParamValue` gains an optional `predicates: PredicateSet` field — initialised to undefined at `makeParam`, carried through `subst()`'s `remapParams` clone — so the HOF walker (Stage B) can read param-level effect bounds directly without a side-table on `ComposedFunctionValue`.
- ✅ Provability arc — Phase D1 Slice 2 Stage 0 (`&` for type/effect conjunction): added `&` as a distinct infix operator at a new precedence level (`amp`, between `or` and `and`) so refinements and effect conjunctions read on a separate axis from logical AND. `typed_amp_impl` handles the type-side cases (refinement creation now; type intersection and effect conjunction in later stages). `typed_and_impl` simplified to purely logical AND. All existing refinement uses (`Int && _ > 0`) migrated to `&` (`Int & _ > 0`) across `lib/math.alg`, `lib/contracts.alg` (comment), and the `tests/refinements.alg` / `tests/contracts-demo.alg` / `tests/refinement-propagation-demo.alg` / `tests/refinement-subtype-demo.alg` / `tests/predicate-set-demo.alg` / `tests/math-pilot-demo.alg` / `tests/invariant-demo.alg` files plus inline test-suite assertions. Compound predicates (`Int & _ > 0 && _ < 100`) now build a *single* refinement with a compound predicate body — `domainFromPredicate` recognises the conjunction as one interval `[1, 99]`, more precise than the previous chained-refinement form's per-clause domain.
- ✅ Provability arc — Phase D1 sub-chunk 1.3 (Notification category + opaque marking on stdlib HOFs): `CompilationReport` gains a `notifications: Notification[]` collection (`Notification = { kind, message, binding? }`) for informational diagnostics that don't halt compilation. `buildType` / `buildGenericType` accept `methodEffects: Record<string, string[]>`; `Array.map` / `Array.filter` / `Array.reduce` are tagged `effects: ["opaque"]` so callers' inferred sets reflect the soundness limit until Slice 2's effect polymorphism resolves precisely. Bound primitives produced by `type_dispatch` propagate the underlying primitive's effects (previously stripped). Static walker in `src/effects.ts` recognises `type_dispatch(obj, "map" | "filter" | "reduce")` patterns and adds `opaque` (necessary because the static walk can't follow runtime dot-dispatch through `type_dispatch`). `checkEffectsDeclarations` filters `opaque` out of mismatch computation so `effects pure` functions calling stdlib HOFs don't halt; `opaqueEffectNotices` emits a separate `effects-opaque-from-stdlib-hof` notification for visibility. Per-project notification severity (notification → error/warning/ignore) tracked separately on the backlog.
- ✅ Provability arc — Phase C Chunk 3 (`requires` / `ensures` body-form contracts): function bodies can declare contracts at the head:
  ```
  divide(a, b) =>
    requires b != 0
    ensures _ != 0 || a == 0
    a / b
  ```
  Surface syntax via `use contracts` activates `lib/contracts.alg` grammar (stmt_forms `requires`, `ensures` lowering to `requires_stmt(P)` / `ensures_decl(P)` markers). The block-expression tree-builder (`src/grammar2/tree-builder.ts buildBlockExpr`) preprocesses contract markers at parse time: `requires_stmt(P)` calls are hoisted to the front of the body so preconditions check before any body statement runs; `ensures_decl(P)` calls are extracted, their predicate is compiled via `buildFn(["_"], P)` into a one-param lambda, and the body's result expression is wrapped with `ensures_check(result, lambda)`. `seq` primitive sequences the requires checks, body statements, and ensures-wrapped result so side effects fire in source order. `requires_stmt` mirrors `assert_stmt` but tags discharged predicates with `source: "requires"` and reports failures as "precondition failed". `ensures_check` runs the lambda against the result; on success attaches the predicate domain to the result's set with `source: "ensures"` so callers see the post-condition; on failure throws `AllegroError("postcondition failed")`. Static discharge via predicate-set entailment short-circuits both runtime checks. Introspection: `ValueSummary` gains `requires` / `ensures` / `promotionSuggestions` arrays; the rendered summary lists each contract; in-body asserts that reference only function parameters get flagged as candidates for promotion to `requires`. Pilot: `lib/math.alg` adds `divide`. Demo: `tests/contracts-demo.alg`. Phases D–J build on this: effect types, totality, proofs, provable stdlib, AI collaboration protocol, codegen, review UX.

## Design Philosophy

- The base language is a **specification**, not a user-facing language
- **Extensions are where the language lives** — everything beyond the seven kinds and their primitives is an extension
- **Partial evaluation is the compilation model** — each build phase binds more symbols
- **Types as values** — type checking happens during evaluation via type components, not a separate pass
- **Immutable grammar extension** — new grammars share structure with the base, never mutate it
- **Browser-compatible** — core uses `TextEncoder`/`TextDecoder`, not `Buffer`
- **No implicit fallback** in typed operators — missing type method is an error
- **Immutable bindings and values** (for now) — mutation semantics to be explored later (linear types, transient mutation)
- **Every value in Standard mode has a type** — base primitives wrapped as UntypedFunction
- **Generic types are type constructors** — functions from type parameters to concrete types, memoized
