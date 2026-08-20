# Units-of-measure DSL — the rung-2 seriousness proof (B-092)

> Track R, rung 2 of the demo ladder (`release-track.md` §5). Domain
> ratified at R-R4: units-of-measure physics, chosen for the rung-3
> bridge (Vivace domain models need dimensional quantities) and the
> mixed-model trajectory. This plan is the design brief + chunk
> sequence. §5's decision points U-R1–U-R5 RATIFIED 2026-08
> (maintainer, as recommended); U1 underway.

## 1. What this proves (and what it must not become)

The claim under test is D4: **a narrow surface built as an extension
inherits the entire kernel** — types, refinements, laws with tiers,
counterexamples, effects, the prover loop — so it is exactly as
serious as the general-purpose language. The deliverable is a small
dimensional-analysis language for physics calculations where:

- dimensional soundness is checked by the SAME machinery as
  `PositiveInt` (refinements + PE discharge), not a parallel checker
  bolted on — the VISION falsifiable constraint applied to a domain;
- failures speak the DOMAIN's vocabulary: `cannot add m and s`
  with the offending expression rendered, never a host type error;
- the DSL's own laws (conversion round-trips, scale facts, algebraic
  properties) carry honest D34 tiers in the verdict, and `theorem`s
  about physics facts discharge through PE;
- the whole thing is an `.alg` library + grammar block activated by
  `use units` — zero host TypeScript in the language definition.

Anti-goal: a units LIBRARY with good ergonomics but kernel-bypassing
checks. If dimensional soundness ends up implemented as ad-hoc host
logic rather than refinement/predicate discharge, the seriousness
claim fails and we should know it — that is the falsifiable shape of
this rung.

## 2. Semantic model

- **Dimension** — an exponent vector over the 7 SI base dimensions
  (L, M, T, I, Θ, N, J), represented as plain DATA (a record or
  7-array of Ints). Dimensions form an abelian group under
  multiplication (vector addition of exponents). Dimension equality
  is E1 structural equality — no identity/memoization machinery
  needed.
- **Unit** — a named record: `{name, dim, scale}` — scale relative to
  the coherent SI unit of its dimension (`m` scale 1, `km` scale
  1000, `min` scale 60). Derived units are computed: `N = kg·m/s²`.
- **Quantity** — ONE record type `{mag: Float, dim, unit}` holding
  magnitude in the unit's terms; normalization (`mag * scale`) is the
  comparison/arithmetic basis.
- **Named dimensions are REFINEMENTS of Quantity**, minted with the
  ordinary `&` surface:
  `Velocity = Quantity & _.dim == dim_div(length_dim, time_dim)`
  (spelled via lib helpers). `f(v: Velocity)` then type-checks
  through the standard refinement path, and PE discharges the check
  whenever the dimension is statically known — dimensional soundness
  IS refinement discharge. This is the crux choice; see U-R1.

Arithmetic: `*` / `/` combine dims (group op) and scales; `+` / `-`
require dim equality and yield the left operand's unit (right operand
converted); mismatch is a typed domain ERROR value carrying both
units' names and the rendered source where available. `to(unit)`
converts within a dimension; cross-dimension `to` is the same domain
error shape. Comparison and `==` compare normalized magnitudes within
a dimension (Equatable conformance with a custom eq → law obligations
recorded honestly).

## 3. Syntax (grammar chunk — sugar over an algebra that works bare)

Load-bearing principle: the DSL must be fully usable with ZERO
grammar — `qty(9.8, m.per(s.sq()))` or `9.8 * m / (s*s)` via typed
operators — so the grammar chunk is sugar, separately shippable, and
the seriousness proof never hostages on parser work.

`use units` then adds, via a Phase 6b/7 `grammar { … }` block:

- **Literal quantities**: `3 m`, `9.8 m/s^2`, `1.5 km` — a rule
  anchored on a NUMBER literal followed by a unit expression
  (`unit_expr`: unit idents, `*` or `·`, `/`, `^` int — `^` lives
  only inside `unit_expr`, no global operator). Number-anchored means
  no bare-identifier juxtaposition ambiguity: computed values use the
  ordinary algebra (`x * m`).
- **Conversion sugar** (candidate, may defer): `5 km in m` — infix
  `in` lowering to `.to(...)`. `in` as a keyword risks collisions
  (future `use X in {…}` per-scope activation is on the syntax
  track); see U-R4.

Hygiene: unit names in templates resolve against the units module's
own bindings at definition time (Phase 7 hygienic substitution), so a
consumer rebinding `m` cannot hijack the literal sugar.

## 4. Laws, theorems, and the honest ledger

- **Equatable**: Quantity draws Equatable with a custom normalized
  eq. The refl/sym/trans obligations are recorded; `trans` must be
  witnessed or admitted before `proof_trans` chains over quantities —
  the E4 gate demonstrated in domain terms. Plan: witness what
  `prove_for_all_bool`-style finite checks can reach, `Law.assume`
  the rest LOUDLY in the demo — the verdict's assumption ledger
  showing `! admitted 'trans' of 'Quantity'` is itself rung-2
  content (the tier system saying "sampled/admitted" is the product,
  not a blemish).
- **Concrete scale facts discharge at kernel/PE tier**:
  `theorem km_scale: 1 km == 1000 m`, `theorem f_ma: N == kg * m / (s*s)`
  (unit-level identity), `verify (9.8 * m/(s*s)) * (2*s) == 19.6 * m/s`.
- **Algebraic laws at sampled tier**: `law_mul_comm`,
  `law_conv_roundtrip` (`q.to(u).to(q.unit) == q`) via `for_all` —
  sampled honestly.
- **Purity**: the whole lib declares `effects pure` where applicable;
  a quantity function reading `source of` pays the observe tag — the
  effect calculus applies to the domain surface unchanged.

## 5. Decision points for ratification

- **U-R1 — representation**: dimensions as structural DATA + named
  dimensions as REFINEMENTS over one Quantity record (recommended),
  vs. dynamically minted nominal dimension types. Recommendation
  rationale: refinements reuse the existing discharge path exactly
  (the falsifiable-constraint story), E1 structural equality gives
  dimension comparison for free, and no memoization/identity
  machinery is needed (immutable bindings make an .alg-level memo
  table awkward; nominal minting would push toward host code —
  the anti-goal). Cost: `type of q` answers Quantity, not Velocity —
  the dimension NAME appears in rendering/errors via the dim data,
  and `q instanceof Velocity` still answers through the predicate
  re-check (C3.3). Nominal dimension types can be revisited at the
  deferred user-generics surface (C7.2 R1) without breaking this.
- **U-R2 — literal syntax scope**: number-anchored `3 m/s^2` only;
  all computed values through the ordinary operator algebra.
- **U-R3 — law honesty**: accept sampled/admitted tiers for the
  quantity laws, displayed loudly in the demo (recommended), vs.
  restricting the demo to kernel-dischargeable laws only.
- **U-R4 — `in` conversion sugar**: defer to a later slice
  (recommended — `.to(m)` reads fine; `in` keyword interacts with the
  syntax track) vs. include in U2.
- **U-R5 — base dimension set**: full 7-vector representation from
  day one (cheap — it's data), with the SHIPPED unit set
  mechanics-focused: m, km, cm, s, min, h, kg, g, N, J, W, Pa, m/s,
  m/s² (recommended).

## 6. Chunks

- **U1 — core algebra (no grammar).** `lib/units.alg`: dim vector
  helpers (mul/div/pow/eq), Unit + Quantity records, typed operators
  (mul/div/add/sub/eq/lt), `to` conversion, dimension-mismatch domain
  errors (unit names + rendered source where available), named
  dimension refinements (Length, Time, Mass, Velocity, Acceleration,
  Force, Energy), SI unit set per U-R5. ENTRY TEST (run first —
  de-risks U-R1): a refinement over a record field holding an array
  compares via `==` in the predicate and PE-discharges when known.
  Suite tests + a bare-syntax demo file.
- **U2 — grammar sugar.** The `grammar { … }` block: quantity
  literals per U-R2; hygiene + conflict validation exercised; demo
  migrates to sugared syntax. (Fallback recorded: if the
  number-anchored rule fights the base grammar, ship U1's algebra
  syntax and record the grammar gap as a Phase-8 item — the rung does
  not hostage on sugar.)
- **U3 — laws + physics theorems.** Equatable conformance +
  obligations handled per U-R3; scale-fact theorems (PE tier);
  algebraic laws (sampled); an `allegro verify` transcript whose
  laws/ledger blocks speak domain vocabulary. F = ma worked example.
- **U4 — rung-2 release packaging.** `demos/rung2/` scenes +
  break-it transcripts (marquee: the dimension-mismatch
  counterexample and the admitted-law ledger); landing-page section +
  sandbox preset; claims-register re-grade (D4 flagship row →
  demoable/delivered); messaging + CHANGELOG/BACKLOG sync.

Each chunk lands with the full checklist (suite green, docs, commit);
U1 does not start until §5 is ratified.

## 7. Status log

- 2026-08: brief drafted post-B-094 (source channel available for
  error rendering; `explain` is the rendering pattern U1 reuses).
  **U-R1 entry test already run and PASSING** on the existing
  substrate (no code changes): `Quantity = Type.define({mag: Float,
  dim: Array})`, `Velocity = Quantity & _.dim == [1, 0-1]` —
  construction check refuses wrong dims, `f(x: Velocity)` annotation
  checks, `instanceof` answers through the predicate re-check, all
  via structural `==` over the array field. The representation
  recommendation is validated, not speculative. Awaiting U-R1–U-R5
  ratification.
- 2026-08: U-R1–U-R5 ratified as recommended; **U1 LANDED**.
  `lib/units.alg` (~180 LOC pure Allegro): dim vectors + group ops,
  Unit/Quantity records with operator methods, conversions, normalized
  comparison, domain-vocabulary mismatch errors, 7 named-dimension
  refinements, mechanics SI set (m..mm, s/min/h, kg/g, N/J/W/Pa).
  KERNEL FIX surfaced by the entry work: the PRIM_TO_METHOD operator
  dispatch path handled only host-primitive methods — user-defined
  record types' ComposedFunction methods (Type.define specs) fell
  through to raw bits ops. Extended to dispatch ComposedFunction
  members, giving every user type operator overloading (`q1 + q2`).
  tests/units-core.alg suite-registered (F = m·a worked end-to-end;
  refinement refusal halts at call site pinned in TS tests).
  U2 (grammar sugar) next.
- 2026-08: **U2 LANDED**. Quantity literals (`3 m`, `9.8 m/s^2`,
  `1.5 km`, `2 kg·m/s^2`) via a `grammar { }` block: unit_pow/prod/quot
  rules + two number-anchored expr_forms with explicit `hws` (same-line
  only, U-R2). TWO KERNEL REFINEMENTS surfaced: (1) user-EBNF
  auto-interleave now respects an explicit ws production between items
  (hws = horizontal-only — without this, ws_any's raw newlines glued
  `x = 3` onto the next line's identifier); (2) expr_form alternatives
  splice at the FRONT of expr_atom (PEG-committed choice made
  number-led forms dead code at the old before-ident position). Both
  recorded in docs/design/extension/grammar.md §4. Hazard battery
  green: cross-line non-glue, keywords after numbers, calls/arrays/
  parens untouched, sugar composes with algebra + refinements + the
  domain error. Fallback never needed. U3 (laws + physics theorems)
  next.
- 2026-08: **U3 LANDED**. Quantity draws Equatable — refl/sym/trans +
  the algebraic laws (mul_comm, conv_roundtrip) recorded, ALL honestly
  pending (record-domain quantifiers have no sample construction —
  B-089 residue; the `?` rows are the product per U-R3). Physics
  theorems discharge at PE tier in literal syntax (`theorem km_scale:
  1 km == 1000 m`, `1 N == 1 kg·m/s^2`, F = ma through refinement-
  typed force_of). The E4 gate REFUSES proof_trans over quantities
  naming 'Quantity' + both escape hatches; Law.assume opens it and the
  verdict renders `[resting on admitted 'trans' of 'Quantity']` + the
  ledger line with backers. `min`/`h` unit aliases added (the kernel
  caught the missing `h` as a false theorem — the demo debugging
  experience working as designed). tests/units-laws.alg registered +
  4 TS tests. U4 (rung-2 release packaging) next.
- 2026-08: **U4 LANDED — B-092 CLOSED.** demos/rung2 (3 scenes +
  transcripts, suite-registered), landing-page section + nav + sandbox
  preset (both copies), web lib registry generated from disk libs by
  scripts/sync-web-libs.ts (drift ended; also fixed the sandbox pages'
  MISSING registrations that would have broken the rung-1 presets on
  deploy), release-track D4 row → delivered, messaging claims row
  added, 37-example site sweep clean. Residue: B-081 refinement-
  failure domain detail; B-089 record-domain sampling (flips the
  pending laws automatically).
