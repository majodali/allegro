// =============================================================================
// Phase D1 — Effect types (DESIGN PREVIEW, NOT RUNNABLE YET)
//
// This file is a design artifact. None of the syntax below works today.
// The point is to look at it, decide whether the surface reads well, and
// only THEN implement against the agreed shape.
//
// Phase D as a whole is the *negative* aspect of provability — what the
// code DOESN'T do. D1 starts the arc with extensible flat effect labels.
// D2 will add parametric capabilities (`net[api.example.com:443]`) on top
// of D1's substrate.
//
// Reference: .claude/plans/crystal-proving-curry.md §"Phase D arc"
// =============================================================================


// -----------------------------------------------------------------------------
// THE THESIS
// -----------------------------------------------------------------------------
//
// Every function has an *effect set* — the categories of side effects it can
// produce. Functions that produce a value with no observable side effects
// have the empty effect set, conventionally written `pure`.
//
// Effects are inferred bottom-up from the primitives a function transitively
// calls. The user can also DECLARE the effect set; the analyzer checks that
// the inferred set is contained in the declared one. This mirrors `requires`
// / `ensures` exactly: declarations are reviewable contracts; inference is
// the proof.
//
// In the safety summary, every function gets one more line: `effects: …`,
// alongside `requires:` and `ensures:`.


// -----------------------------------------------------------------------------
// EFFECT LABELS ARE EXTENSIBLE — NOT A FIXED ENUM
// -----------------------------------------------------------------------------
//
// The CORE language ships with one label only: `pure` (the empty set / bottom
// of the lattice). Every other label is registered by an extension, alongside
// the primitives that produce that effect.
//
// Standard library extensions ship the conventional ones:
//
//     stdlib/print     →  registers label `io`,    tags `print`
//     stdlib/fetch     →  registers label `net`,   tags `fetch`
//     stdlib/time      →  registers label `time`,  tags `delay`
//     stdlib/random    →  registers label `rand`,  tags `random`  (future)
//
// Domain-specific extensions register their own labels:
//
//     build/fs         →  registers label `build-io`, tags build-time fs ops
//     server/env       →  registers label `env`,      tags getEnv / setEnv
//     server/uuid      →  registers label `uuid`,     tags uuid_v4()
//     banking/ledger   →  registers label `funds-mutation`, tags transfer/...
//
// `build-io` is categorically different from `io` — they're different labels.
// A function with `effects build-io` can run during build but not at runtime;
// a function with `effects io` is the opposite. The type system separates
// them mechanically.
//
// Lattice for D1: every effect set is a flat set of labels. `pure` is the
// empty set, contained in everything. Otherwise labels are unordered:
// `{io}` and `{net}` are independent; `{io, net}` is their union.
//
// PARAMETRIC LABELS — `net[api.example.com:443]`, scope-restricted I/O,
// per-domain capabilities — are explicitly DEFERRED to Phase D2 (capability
// types). D1's flat labels are the substrate D2 will refine.


// -----------------------------------------------------------------------------
// SURFACE SYNTAX (decided: Option A — body-form clause)
// -----------------------------------------------------------------------------

use contracts

// Inferred-only: no declaration. Summary shows `effects: pure (inferred)`.
greet(name) => "Hello, " + name

// Inferred-only with io.
shout(msg) =>
  print(msg)
  msg
// Summary: `effects: io (inferred from print)`.

// Declared, matches inferred: `effects: pure (declared, verified)`.
square(x) =>
  effects pure
  x * x

// Multi-label declaration: a function that does both io and net.
fetch_and_log(url) =>
  effects io, net
  result = fetch(url)
  print("got: " + result)
  result
// Summary: `effects: io, net (declared, verified)`.

// Declared SUPERSET of inferred — fine. The function over-promises about
// what it might do; that's safe (caller plans for io, gets pure).
maybe_log(msg) =>
  effects io
  msg.length
// Summary: `effects: io (declared) ⊇ pure (inferred) ✓`.

// Declared SUBSET of inferred — ERROR. Function under-promises; caller
// thinks it's pure but the implementation prints. Compilation halts.
silent_print(msg) =>
  effects pure
  print(msg)        // ✗ print is io, function declared pure
  msg
// Error: effects mismatch in silent_print: declared `pure`,
//        inferred `io` (from print at preview line ...)

// Combined with Phase C contracts. All three clauses live at the head.
deposit(balance, amount) =>
  requires amount > 0
  ensures _ > balance
  effects pure
  balance + amount

// Domain-specific labels work the same way once the relevant extension is
// loaded. Imagining a `banking` extension that registers `funds-mutation`:
//
//     use banking
//
//     transfer(from, to, amount) =>
//       requires amount > 0
//       effects funds-mutation
//       ledger_debit(from, amount)
//       ledger_credit(to, amount)


// -----------------------------------------------------------------------------
// HIGHER-ORDER USE — DEFERRED TO D1 CHUNK 2
// -----------------------------------------------------------------------------
//
// Higher-order effect annotations (constraining a function parameter's
// effect set) are a separate grammar / type-system extension. D1 chunk 1
// covers monomorphic effect declarations + inference. Chunk 2 adds:
//
//     map_pure(arr, f: (a) => b effects pure) =>
//       effects pure
//       arr.map(f)
//
// (Final syntax TBD when we get to it.)


// -----------------------------------------------------------------------------
// SAMPLE INSPECT OUTPUT (target)
// -----------------------------------------------------------------------------
//
// $ allegro inspect file.alg
// safety grade:    proven-safe
// bindings:        ...
//
//   greet
//       Function(name)
//       effects: pure (inferred)
//
//   shout
//       Function(msg)
//       effects: io (inferred from print)
//
//   square
//       Function(x)
//       effects: pure (declared, verified)
//
//   fetch_and_log
//       Function(url)
//       effects: io, net (declared, verified)
//
//   silent_print     [ERROR]
//       effects mismatch: declared `pure`, inferred `io`
//                         (from print at line 81)
//
//   deposit
//       Function(balance, amount)
//       requires:
//         amount ≥ 1
//       ensures:
//         _ <predicate>
//       effects: pure (declared, verified)


// =============================================================================
// DESIGN DECISIONS — locked in.
// =============================================================================
//
// Q1. SURFACE SYNTAX → Option A (body-form clause `effects E1, E2`). Reuses
//     Chunk 3 contract-preprocessor machinery; small extension. Option B
//     (return-type adornment) deferred — can be sugar that lowers to A.
//
// Q2. DEFAULT EFFECT → No default declaration. Every function gets an
//     INFERRED effect set; `effects E` is an optional check that adds a
//     declared set. Both surface in the introspection summary.
//
// Q3. CHECK DIRECTION → Inferred ⊆ Declared. Declared can be a superset
//     (over-promising is safe); subset is an error.
//
// Q4. HIGHER-ORDER ANNOTATIONS → Deferred to D1 chunk 2.
//
// Q5. PRIMITIVE CATEGORISATION → labels are extension-provided metadata,
//     not a fixed enum. Each primitive registration accepts an optional
//     `effects` field listing its label(s). Core ships only `pure`. Stdlib
//     and other extensions register additional labels alongside their
//     primitives. Halting / error-value construction is `pure`.
//
//     Implementation: `makePrimitive(name, fn, lazy?, effects?)` gains an
//     optional `effects: string[]` parameter. The label registry is the
//     union of every label seen across registered primitives — no separate
//     `register_effect_label` call needed (any unknown label string in an
//     `effects` clause is just an unknown effect, treated as opaque).
//
// Q6. SCOPE OF D1 CHUNK 1 → ships:
//       - `src/effects.ts`: effect-set representation, set ops (union,
//         subset), inference walker.
//       - Bottom-up inference walking ComposedFunction bodies (called
//         from the existing precompile pass).
//       - `makePrimitive` extended with optional `effects: string[]`.
//         Primitives in `src/primitives.ts` annotated where appropriate
//         (initially: `print` → io, `fetch` → net, `delay` → time).
//       - `effects E1, E2, ...` body-form clause via `lib/effects.alg`
//         grammar module (mirrors `lib/contracts.alg`).
//       - Declared-vs-inferred check: error on inferred ⊄ declared.
//       - `ValueSummary` gains `effects: Set<string>` and
//         `declaredEffects: Set<string> | null`; renderer surfaces both.
//       - `lib/math.alg` pilot: a few functions get `effects pure`.
//       - `tests/effects-demo.alg`.
//       - 5–8 unit tests in `src/test.ts`.
//
//     Deferred to D1 chunk 2 / later:
//       - Higher-order effect annotations.
//       - Effect-polymorphic functions.
//       - `mutation` label (needs mutable references first).
//
// Q7. WEBSITE PILOT → after D1 chunk 1 lands, add an "Effects" subsection
//     under Provability with two sandboxes: inferred effects + declared
//     effects with a deliberate mismatch demo.
//
// Q8. D1 / D2 BOUNDARY → D1 ships flat extensible labels. D2 adds
//     parametric capabilities (`net[api.example.com:443]`), per-module
//     capability budgets (`capabilities { net: ["api.example.com"] }`),
//     and the third-party-connection-detection use case. D1's substrate
//     is the prerequisite for D2.
//
// =============================================================================
