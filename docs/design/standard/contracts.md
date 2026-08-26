# Contracts & invariants — design

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Implementation: `src/refinements.ts` (abstract domains, predicates,
> predicate sets, the knowledge carrier), `src/primitives.ts`
> (`assert_stmt`, `requires_stmt`, `ensures_decl`/`ensures_check`,
> `assert_invariant`/`assume_invariant`), `src/grammar2/tree-builder.ts`
> (the contract preprocessor), `src/types-std.ts` (the refinement mint and
> its construction guard), `src/introspect.ts` (the safety summary),
> `lib/invariants.alg` + `lib/contracts.alg` (surface forms).
> Architectural ground in `docs/design/allegretto/structures.md`: the
> facts plane (§4), shape/knowledge (§6, D36), D11/D32/D34 (§10),
> D44/D45 (§8–§9).
>
> This document is the B-014 revalidation of the v1 Phase-C contract
> design (`docs/plans/archive/lucid-discharging-lambek.md` and
> `docs/plans/archive/crystal-proving-curry.md` §Phase C) against the
> shipped post-B-028 system. §10's decision points **CT-R1–CT-R6 are
> maintainer-ratified as recommended (2026-08)** and are binding design
> truth for the contracts area. B-014 is closed — the follow-on
> implementation work the rulings name is carried in `docs/backlog.md`
> (B-057, B-099, B-101), not here.

## 1. Settled architectural commitments

1. **A contract is a predicate that becomes knowledge** [implemented] —
   the unifying claim of the v1 design survives intact. `assert`,
   `requires` and `ensures` do not merely *test*; on the success path
   each attaches its predicate to the value's set, so downstream code
   inherits the fact and a second check of the same property is free.
   Checking and knowing are the same act viewed from the two ends of
   discharge.
2. **Partial evaluation is the discharge engine** [implemented] — there
   is no separate contract checker. `entailsPredicate` runs against the
   knowledge available at the point of the check; when it succeeds the
   runtime check does not exist, and when it fails the check is an
   ordinary residual. "Compile-time" versus "runtime" is a statement
   about when the inputs landed, not about two mechanisms (§6 of
   structures.md).
3. **Predicates are knowledge, not identity** [implemented] — everything
   a contract establishes lands in the D36 knowledge lattice, which is
   excluded from equality and dispatch. Two values equal in shape and
   data stay equal however differently their facts accumulated (§7 of
   structures.md; the congruence property B-017 pinned).
4. **Knowledge has two carriers and they meet** [implemented] —
   INTRINSIC facts ride the value (the refinement certificate on
   `PositiveInt(5)`, predicates attached by a passing check); OCCURRENCE
   facts live in the scope facts plane and are flow-derived (branch
   entry, an earlier `assert` in the same scope). Effective knowledge at
   a check is the meet of the two (§3).
5. **Fact payloads are opaque to the base** [implemented] — L0 stores and
   layers facts (`scope_assume`, D26); interpreting them — predicate
   lattices, entailment, implication — is Standard-layer work. This
   document owns the interpretation; structures.md §4 owns the layering.
6. **Invariants are refinements** [implemented] — a lifecycle invariant
   is not a distinct mechanism. `T & pred` is the mint, chained per
   clause, and it covers scalars and records alike (D45/C6.1b; §5).
7. **Nothing is checked that construction already proved** [implemented]
   — the refinement constructor IS the validator. A value of a refined
   type carries its certificate, so contracts downstream of it discharge
   statically rather than re-testing (§8's guidance rests on this).
8. **Contracts are visible** [partial] — the safety summary renders every
   binding's predicate set with per-fact source attribution, lists a
   function's `requires`/`ensures` distinctly, and suggests promoting an
   in-body `assert` over parameters to a `requires`. The verdict and the
   assumption ledger, however, do not see contracts at all — the gap
   CT-R6 records, with the work routed to B-057 (§7).

## 2. Surface forms and lowering

| Form | Home | Lowers to | Status |
|---|---|---|---|
| `assert P` | `lib/invariants.alg` (`stmt_form`) | `assert_stmt(P)` — lazy; takes `P` unevaluated | [implemented] |
| `requires P` | `lib/contracts.alg` (`stmt_form`) | `requires_stmt(P)` marker, hoisted to function entry | [implemented] |
| `ensures P` | `lib/contracts.alg` (`stmt_form`) | `ensures_decl(P)` marker → `ensures_check(result, λ_)` | [implemented] |
| `T & pred` | the refinement mint (`src/types-std.ts`) | predicate + abstract domain on the type; `__construct` wraps the parent's | [implemented] |
| `assert_invariant(v, pred)` | primitive only — no grammar sugar | direct call | [implemented] |
| `assume_invariant(v, pred)` | primitive only — no grammar sugar, **no caller in the tree** | direct call | see CT-R3 |
| `assumes P` (trust boundary) | — | — | [designed] — B-057, CT-R3 |

**The contract preprocessor** (`src/grammar2/tree-builder.ts`). Body-form
clauses are recognised at parse time, not at runtime. The block builder
walks the function's leading statements and rewrites the block:

- every `requires_stmt(P)` is lifted ahead of the body proper and
  sequenced through `seq` (a lazy primitive, so each statement's scope
  effects fire left-to-right and the body's result keeps its full
  channel wrapping);
- every `ensures_decl(P)` is extracted, its predicate compiled into a
  one-parameter lambda over `_`, and the body's result expression wrapped
  as `ensures_check(result, λ_)` — one wrapper per clause, so a
  multi-clause `ensures` checks each against a single result evaluation.

This is the sanctioned lowering chain — marker primitive → tree-builder
attach → function-body rewrite — the same shape `effects` and the
totality forms use. `ensures_check` forwards TailCall sentinels: a
tail-recursive body returns through the wrapper on each pass and the
post-condition fires against the eventual base-case value.

`ensures_decl` evaluated outside a function-body block is a deliberate
no-op rather than an error — a declarative clause in an unexpected
position should not break the program (the `effects_decl_marker`
precedent).

## 3. The predicate model

**Abstract domains** are the recognised algebraic shapes: `interval`,
`eq`, `ne`, `opaque`, and `effects` (the effect calculus rides the same
carrier — see `effects.md`). `domainFromPredicate` recognises a
predicate's shape by interpreting its expression against the parameter;
anything unrecognised is `opaque` and retains the original predicate
value so a runtime check is still possible.

**A predicate** is `{ shape, source?, originalExpr? }`. The `source`
attribution is what makes the summary legible; the roster is closed:

`refinement-type` · `assert` · `branch-then` · `branch-else` ·
`match-case` · `requires` · `ensures` · `propagation` · `literal` ·
`effects-declared` · `effects-inferred` · `effects-bound` ·
`type-invariant` *(reserved; no producer since invariants became
refinements — CT-R5)*.

**A predicate set** is an insertion-ordered list with structural-equality
dedup and linear lookup. Sets stay small in practice — one to three
predicates per binding, growing slightly through branches and asserts —
so a set that grows past roughly twenty entries is a signal to
investigate rather than a case for a faster backing structure. Four
operations carry the model: `addPredicate` (dedup insert),
`mergePredicateSets` (union with dedup), `simplifyPredicateSet` (fold
intervals into the tightest single fact, leaving opaque predicates
alone), and `entailsPredicate` (does this set imply the target?).

`effectiveDomain()` intersects every non-opaque, non-effects predicate
into the single tightest algebraic fact — the bridge for callers that
want one domain rather than a set. Effects predicates are deliberately
excluded: they describe an orthogonal axis with its own accessor.

**The two carriers** (D36). `knowledgeOf(v)` returns the intrinsic
carrier — `{ bound, predicates, occurrenceBound }` — where `bound` is
the refinement certificate read off the stored type when it carries
member-transparent layers, `predicates` is the on-value set, and
`occurrenceBound` is the C3.2 annotation upper-bound. `knowledgeDomain`
meets all three. The occurrence carrier is the scope facts plane
(`scopeFactsFor`), and a check consults the merge of both: a fact
established by an earlier `assert` in the same scope discharges a later
`requires` exactly as a construction certificate does.

**Storage** [partial]. The set lives in a `predicates` component. The
pre-Phase-C single-domain `domain` component is still read — `domainOf`
prefers the set and falls back, and `predicatesOf` lifts a lone `domain`
into a singleton set tagged `refinement-type`. This dual read is
migration residue, not design: the v1 plan's own cleanup task never
landed, and the physical move under the `knowledge` channel is still
pending from C4. See CT-R5.

**No deeper reasoning online.** Sets are kept available rather than
canonical — dedup and trivial interval folding, nothing more. The
principle is deliberate and stands: carry the facts, let the prover
(or the PCP worker) use what it needs at proof-search time.

## 4. Branch refinement and the facts plane

Entering a branch narrows knowledge for that branch only.
`deriveBranchPredicates` reads a condition and derives, per referenced
binding, the predicates implied by the condition holding (then-arm) or
failing (else-arm); `when/is/then` arms lift the matched pattern the
same way, tagged `match-case`.

Recognised shapes are conservative by design: a binding compared against
a literal, and conjunctions thereof, which split and recurse. A
**relational** condition joining two bindings (`a < b`) still
runtime-checks correctly but narrows neither binding — the shipped
recogniser has no relational domain. That limit is v1's "Phase D"
boundary and remains [designed] (B-057).

The facts derived this way are layered onto scope, not written into
values: `eval_if` evaluates the taken arm under a child-augmented
context, and the layer is discarded on exit, so a fact never escapes the
region that justified it. `assert P` and `requires P` narrow for the
*rest of the enclosing scope* rather than a nested region — the same
machinery with a different extent.

Architecturally this is structures.md §4's facts plane, whose stated
target is `scope_assume` layering over immutable child scopes; the
current implementation still narrows via in-place scope facts, which is
observationally equivalent for the shipped extents but is the C2-era
representation rather than the designed one.

## 5. Invariants are refinements

The v1 design proposed a fluent `Type.invariant(pred)` with an
`__invariantsList` slot, constructor wrapping, and inheritance through
`extend`. All three premises are gone:

- **The fluent API is deleted** (D45/C6.1b). `buildInvariantedType` no
  longer exists, `__invariantsList` has no writer, and `where` /
  `invariant` are both the refinement mint. `T & pred` is the whole
  story, chained left-associatively so each clause is its own layer and
  a failure names the clause that tripped.
- **Records need no separate mechanism**. A refinement predicate reaches
  fields through `_` — `Type.define({lo: Int, hi: Int}) & _.lo <= _.hi`
  — so the multi-field case the v1 plan treated as the hard part falls
  out of the same mint.
- **Inheritance is refinement layering, not an is-a edge** (D44). The
  declared subtype chain retired; conformance is symbol-identity
  membership and `Type.refines` is the refinement structure. An
  invariant is "inherited" because the refinement layer is still on the
  chain, which is a structural fact rather than a policy about
  inheritance. See CT-R4.

**The construction guard** [implemented] (D32, B-028 F1/F4). The
refinement constructor wraps the parent's and checks the predicate
against the built value. Three behaviours matter to contracts:

- an **unresolved** check residualizes *construction itself* — the
  instance must not exist tagged as valid until the invariant has
  actually been checked, and the residual re-fires when the inspected
  fields resolve;
- a construction that already carries an **error** propagates it
  untouched rather than re-tagging it with this layer's message;
- a **value-inspecting** predicate must be div-free (CE-R7): an
  undischarged-divergent predicate could hang the guard, so it is
  refused. Only opaque predicates pay this gate — a recognised scalar
  domain is discharged without running the predicate at all.

## 6. Discharge, and where the check lands

Every contract check follows one path: derive the target domain, meet
the intrinsic and occurrence carriers, and ask `entailsPredicate`. On
entailment there is no runtime call and the fact is attached with its
source tag. Otherwise the predicate evaluates; an unresolved result
becomes a residual, a false result fails (§7), and a true result
attaches the fact — the success branch of the implicit check.

**Where the residual check sits** is the open question the v1 design
answered differently from the shipped system.

- v1's principle: *don't check at every internal operation; check at the
  last possible point — the call site or boundary that demands the
  property.* The analyzer would relocate an undischarged `requires` to
  each call site.
- What shipped: `requires` checks at **function entry**, `ensures` at
  **function return**. Relocation to call sites was never built.

The principle's substance did ship, in a different place. Discharge
already varies per call site, because PE evaluates the check against the
knowledge the actual arguments carry: `abs_pos(PositiveInt(7))` discharges its
`requires x > 0` from the argument's certificate and emits nothing,
while the same function over an unknown argument keeps a check. What did
not ship is *relocating the residual* — a codegen question about where a
check that must exist should be emitted, not a question about what is
proved. CT-R1 proposes ratifying that split.

**Promotion suggestions** [implemented]. An in-body `assert` whose
predicate references only the function's parameters is flagged in the
safety summary as an implicit precondition, with the suggested
`requires` spelled out. Deliberately a suggestion: a function's contract
stays explicit, and refactoring a body never silently changes the
published interface.

**`--strict` was never built.** The v1 design had a global CLI flag
turning unresolved-assert warnings into errors. Nothing in `src/`
implements it, and the surface it was reaching for now belongs to the
per-project severity configuration (T-R2 / B-099) rather than to a
process-wide flag. CT-R2 folds it there.

## 7. Failure semantics, severity, and visibility

Contract failure is **not uniform**, and the split is worth stating
plainly because it is easy to read as an inconsistency:

| Failure | Outcome | Since |
|---|---|---|
| `assert P` false | **halt** — `assertion failed: expected x ≥ 1 (got x=0)` | Phase C |
| `requires P` false | **halt** — `precondition failed: …` | Phase C |
| `ensures P` false | **halt** — `postcondition failed: …` | Phase C |
| Refinement / invariant check false at construction | **error VALUE** in the error channel | CE-R8 record |
| `assert_invariant(v, pred)` false | **error VALUE** | Phase C |

The two halves are not arbitrary. A statement-form contract is a
verification act with no value to produce, so halting is the only honest
outcome. A constructor produces a value, and D11 says an operation on an
incomplete or invalid input yields a residual or an error value rather
than a throw — the error channel is viral, so the failure propagates and
surfaces without unwinding. CE-R8 recorded exactly this weak spot and
ruled that promoting the construction path to a halt is a maintainer
decision to be exercised through the project severity surface, never by
code drift. CT-R2 keeps that ruling and names contracts as its second
consumer.

**Counterexamples** [implemented]. Every failure renders the violated
constraint from its abstract domain and, when the value is a 64-bit Int,
the actual value — `expected ≥ 1 (got x=0)`, `refinement check failed:
expected ≤ 99 (got 200)`. The v1 design also wanted the call-site origin
and the binding's known facts in the message; neither ships. Since
relocation to call sites is what would supply the origin, the two are
the same follow-on (B-057).

**The visibility gap** [gap — CT-R6]. Contracts appear in `inspect`,
and nowhere else. `verify` and `obligations` and the assumption ledger
are built from theorems, law obligations, coercion obligations, div
obligations and liveness axioms — contracts contribute no rows. An
undischarged `requires` is, in D34's own terms, a pending obligation:
something the system needs and has not proved. Every other provability
surface in the language reports one; this one does not. CT-R6 proposes
recording that as a gap to close rather than a deliberate silence.

## 8. Choosing the mechanism

Four mechanisms can express "this holds." They are not interchangeable,
and the v1 sources never wrote the guidance down.

| Use | When | Discharge |
|---|---|---|
| **Refinement type** (`T & pred`) | The property is part of what the value *is*, and every instance must satisfy it | At construction, once; the certificate then rides the value and discharges downstream checks for free |
| **Contract** (`requires` / `ensures`) | The property is part of a function's *interface* — an obligation on callers or a guarantee to them | Per call, statically when the caller's knowledge suffices; residual check otherwise |
| **`assert P`** | A fact true *here*, worth establishing for the code that follows | Statically when entailed; otherwise a checked narrowing of the rest of the scope |
| **`proven` / laws** | A property quantified over *inputs*, not asserted about one value | Bounded sampling (`proven`, K=4) or the D34 discharge spectrum with ledger visibility (laws) |

The ordering is a real preference, not a menu. Prefer a refinement when
the property is intrinsic: it is checked once at the boundary where the
value is minted, and every later contract mentioning it discharges
statically. Reach for a contract when the property concerns the
*relationship* between a function and its callers — something no single
value can carry. Use `assert` for local knowledge that is neither. And
when the claim is universally quantified — "reversing twice is the
identity" — it is a theorem, not a contract, and belongs to the proof
surfaces where its assumptions are ledger-visible.

The v1 design principle behind this stands: formal work concentrates in
libraries. A caller of a well-refined library inherits its guarantees
without writing `requires` anywhere.

## 9. Revalidation record (archive disposition)

Per-chunk disposition of `docs/plans/archive/lucid-discharging-lambek.md`
(the tactical plan) and `crystal-proving-curry.md` §Phase C (the
strategy), against the shipped system:

| v1 chunk / element | Disposition |
|---|---|
| Chunk 1 — predicate sets per binding | **shipped**, then absorbed: `Predicate`/`PredicateSet` are live with the full source roster, but they became one arm of the D36 knowledge lattice rather than a standalone component. The plan's own task 6 (drop the legacy `domain` component) never landed — CT-R5 |
| Chunk 2 — branch-sensitive refinement | **shipped** as designed, with `when/is/then` arms included; conjunction-splitting and literal-comparison recognition as specified; relational conditions still don't narrow (B-057) |
| Chunk 2 — `assert` as statement | **shipped**, strengthened: failure HALTS with a counterexample where the plan proposed a warning tier; the plan's `--strict` flag was never built (CT-R2) |
| Chunk 3 — `requires`/`ensures` lowering | **shipped reshaped**: not `assert`-at-entry plus a let-binding wrapper, but marker primitives consumed by the tree-builder's contract preprocessor — `requires` sequenced ahead of the body, `ensures` wrapping the result through a parse-built one-param lambda over `_` |
| Chunk 3 — sink-based check generation | **NOT shipped** as relocation; the *discharge* half is call-site-sensitive through PE, the *residual check* stays at the function boundary — CT-R1, B-057 |
| Chunk 3 — promotion suggestion | **shipped** as specified (params-and-constants-only filter, rendered in the safety summary) |
| Chunk 4 — `Type.invariant` fluent API | **discarded** (D45/C6.1b): invariants ARE refinements; `buildInvariantedType` deleted, `__invariantsList` writerless — CT-R4 |
| Chunk 4 — constructor checking | **shipped**, strengthened well past the plan: the D32 tri-state guard residualizes construction under a pending predicate, propagates prior errors without re-tagging, and gates value-inspecting predicates on div-freedom (CE-R7) |
| Chunk 4 — invariant inheritance via `extend` | **restated** (D44): the declared is-a edge retired; inheritance is refinement-layer composition over the `Type.refines` chain — CT-R4 |
| Chunk 4 — transformation re-checking | **not shipped**, and no longer needed in the planned form: a transformation producing a value of the type goes through the type's constructor, which is the guard |
| `assume P` deferred; constructor pattern as the answer | **superseded in fact** — `assume_invariant` exists as a primitive (unsurfaced, uncalled), and `assume` ships elsewhere as the ledger-visible admitted tier (`Law.assume` E-R4, `assume terminates` CE-R3). The constructor pattern remains the right DEFAULT, not a prohibition — CT-R3 |
| Open decision: predicate-set encoding (opaque vs. user-visible) | **resolved as opaque**, as the plan predicted it would be; user-level introspection arrives through the safety summary, not through Allegro-level values |
| Open decision: relational predicates | **deferred as planned** → B-057 |
| Open decision: `_` substitution in `ensures` | **resolved**: parse-time rewrite into a one-param lambda, not an eval-time magic name |
| Open decision: when to suggest promotion | **resolved conservatively**, as the plan recommended |
| Counterexample content (call-site origin, known facts) | **partial**: constraint + actual value ship; origin and fact-set do not, and follow relocation (B-057) |

## 10. Decisions (CT-R1 … CT-R6 — ratified 2026-08)

All six were maintainer-ratified as recommended. "Recommended" below is
kept as the record of what was put to the gate; each is now binding
design truth for the contracts area.

- **CT-R1 — "Sink-based" splits into discharge and relocation; only
  relocation remains open.** Ratify function-entry/return checking as
  the shipped and correct default. The v1 principle's substance —
  check where the property is actually demanded — is already delivered
  by PE, which discharges a `requires` against the caller's knowledge at
  every call site. What remains is emitting an *undischarged* check at
  the call site rather than the boundary, which is a codegen and
  diagnostics improvement (it is also what would supply the missing
  call-site origin in counterexamples), not a change to what is proved.
  **Recommended**: keep as [designed], owner B-057.
- **CT-R2 — Contract failure halts; construction failure is an error
  value; `--strict` is discarded in favour of project config.** The
  split is CE-R8's, not a contracts-specific inconsistency, and it is
  principled: a statement-form contract has no value to produce, a
  constructor does, and D11 governs the latter. The v1 `--strict` flag
  is superseded by the per-project severity surface (T-R2, owner B-099),
  which should carry the contract knobs alongside the totality ones.
  **Recommended**: record as-is; no promotion by drift.
- **CT-R3 — `assume` is not rejected; it is the admitted tier — and
  `assume_invariant` should be retired rather than surfaced as-is.**
  v1 deferred `assume` on the grounds that trust boundaries are served
  by the constructor pattern. That reasoning holds as a *default*, but
  the prohibition did not survive: `Law.assume` and `assume terminates`
  both ship as recorded, ledger-visible admissions under D34. The
  outlier is `assume_invariant`: registered and therefore callable by
  name, but given no grammar sugar and called from nowhere in `src/`,
  `lib/`, `tests/` or the web bundle — and it attaches a fact *without
  recording anything*. That is the one path in the system that trusts
  silently, which is precisely what D34 forbids.
  **Recommended**: retire the primitive (a `src/`
  change — lane D, not this lane), and mint B-057's `assumes`
  trust-boundary form later against the admitted tier with mandatory
  ledger visibility.
- **CT-R4 — Invariant inheritance is refinement layering; v1's
  `extend`-inherits language is discarded.** Ratify the shipped reading:
  the fluent API is deleted, invariants are refinements, and an
  invariant persists down a chain because the refinement layer is still
  structurally present — not because an inheritance policy carries it.
  **Recommended**: ratify as describing shipped behaviour (D44/D45).
- **CT-R5 — Contracts are knowledge: one lattice, two carriers; the
  legacy `domain` component is residue with no design status.** Ratify
  the knowledge framing as the contracts model, superseding the v1
  plan's standalone `predicates` component. Two cleanups follow and are
  code, not doc: the dual `domain`/`predicates` read (v1's own unlanded
  cleanup task), and the `type-invariant` predicate source, reserved
  with no producer since invariants became refinements.
  **Recommended**: ratify; cleanups filed as B-101.
- **CT-R6 — Contracts' absence from the verdict and the assumption
  ledger is a gap, not a design choice.** An undischarged `requires` is
  a pending obligation in D34's sense. Theorems, law obligations,
  coercion obligations, div obligations and liveness axioms all reach
  the ledger; contracts reach only `inspect`. A project can therefore
  read a clean verdict while carrying unproven preconditions, which
  contradicts "nothing is silently trusted". **Recommended**: record the
  gap and fold the work into B-057's scope rather than minting a
  separate item, since it shares that item's machinery.

## 11. Deferred and open

- **Sink-based relocation, relational predicates, `assumes`, and
  ledger visibility** — all four are B-057, whose scope this document
  settled at the ratification (CT-R1, CT-R3, CT-R6, §4).
- **Contract knobs in the project severity config** — T-R2 / B-099
  (CT-R2).
- **Legacy `domain` retirement and the writerless `type-invariant`
  source** — B-101 (CT-R5).
- **The facts plane's designed representation** — `scope_assume` layering
  over immutable child scopes (structures.md §4) rather than the C2-era
  in-place narrowing; observationally equivalent today, so no behavioural
  item is filed.
- **Function-context and loop invariants** — v1 deferred both; nothing
  since has demanded them, and `assert` continues to cover the cases.
  Unchanged.
- **Inline-signature contracts** (`f(x) requires P =>`) — deferred by v1
  pending concrete demand; still no demand.
- **Paranoid runtime mode** — run every check regardless of discharge,
  for fuzz and soak testing. Still unbuilt, still sensible, still
  waiting on soak infrastructure.
