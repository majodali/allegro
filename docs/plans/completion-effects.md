# Completion effects & futures — the B-028 arc

Status: draft (decision points CE-R1–CE-R8 proposed with
recommendations; awaiting maintainer ratification — no chunk starts
before the gate, PROCESS §6)

> Tranche C successor per the sequenced head: after B-097 (S3
> visibility, closed). This plan is the RATIFICATION PASS for executing
> **D16 (reading-may-never-resolve is an effect), D31 (completion =
> totality ∧ liveness), D32 (triggered construction guard), D33
> (futures — remainder), D34 (discharge tiers for completion effects)**
> — maintainer-ratified 2026-07, design in
> `docs/design/allegretto/structures.md` §10. D35 (resource budgets)
> stays deferred by its own terms. It verifies the design against the
> post-B-097 codebase, sharpens what the record leaves open into
> decision points (§3), and sequences the chunks (§4).

## 1. Goal and scope

Completion becomes a first-class, verdict-visible property. At arc end:

- **`div` exists**: a computed effect whose inference IS the shipped
  termination analysis, propagated up the call graph, checked against
  effect declarations exactly like `io`/`net` — a function declared
  `effects pure` that may diverge HALTS compilation. Discharge follows
  D34's four tiers (auto-proven / witnessed `decreases` / admitted
  `assume terminates` / undischarged `partial`), every non-auto tier
  verdict-visible in the assumption ledger.
- **Futures are typed and honest**: `Future[T]` exists as a generic
  type (flattening, memoized), async results carry it, and every
  consumer of a future-typed value residualizes per D11 — including
  the call-site type checker, which today would throw.
- **Incompleteness detection is an effect**: `is_resolved` ships,
  effect-labeled, quarantining scheduling nondeterminism from the
  confluent core (D33); liveness for external sources is an admitted
  AXIOM, recorded and verdict-visible (D16/D34), not a silent hope.
- **The D32 guard is real**: construction through a value-inspecting
  invariant residualizes until the inspected fields resolve (closing a
  live soundness hole — see §2), guarded projection works, and
  invariant predicates are mechanically required `div`-free.
- The substrate is hardened to match the design's words: write-once
  cells are ENFORCED write-once, the forward-chaining cascade is
  cycle-guarded, and cross-pass future resolution (REPL/web) works.

Out of scope (riders named in §6): sync/async type modifiers (B-047),
algebraic effects (B-048), resource budgets / `ResourceExhausted`
(D35), select/cancellation/timeout surfaces, per-project severity
config and the `total`-by-default flip (B-018 reconciliation),
asymptotic-cost proofs.

## 2. Design verification (2026-08, against the shipped codebase)

**What already executed** — D33's cell half: the Binding IS the
write-once cell (`makeCell`/`isPendingCell`/`resolveCell`, C2.3b), the
`FutureManager`/`applyPhase` forward-chaining cascade is live base
machinery, rejection resolves to error VALUES (never a throw), and
equality on an unresolved future already residualizes (the
`protocolEquals` isResolved guard). D11 holds structurally for eager
primitives (the universal residual gate) and for `ctx_resolve`,
Rule 2 branches, and `type_check`.

**What the survey found broken or missing** (full maps in the session
record; the load-bearing findings):

- **Monotonicity is a convention, not an invariant**: `resolveCell`
  happily overwrites a resolved cell; no boundary test rejects double
  resolution.
- **Cross-pass future resolution is silently broken**: a future minted
  in REPL/web pass N that resolves during pass N+1 applies its phase
  into a registry that never tracked the cell — dependents never
  re-evaluate. Untested.
- **`checkArgType` throws** on type mismatch and is D11-safe today
  only because futures carry NO type. The moment `Future[T]` exists,
  passing a pending future where `T` is expected must residualize,
  not throw. This is the #1 seam.
- **`refined.__construct` silently accepts an unresolved predicate**:
  the annotation path (`type_check`) residualizes on an unresolved
  refinement check, but the CONSTRUCTION path falls through its
  `Bits && === 0` guard and tags the value as if the invariant held.
  D32's "plausibly emergent" guard is half-shipped, and the missing
  half is a soundness hole TODAY.
- **`div` has zero implementation** — no label, no inference wiring,
  no tiers. But the seams are unusually good: `checkTermination`
  already runs in `evalSource` on every typed compilation (info-only),
  already builds the call graph + SCCs (then discards them), and
  `checkEffectsDeclarations` reads `__inferredEffects` — so a
  post-analysis write of `"div"` into the stash, sequenced before the
  declaration check, rides the existing inferred-⊆-declared machinery
  and its existing HALT for free.
- **`decreases` is trusted, not verified, when unrecognized**: an
  unrecognized metric shape short-circuits analysis with no record —
  D34's witnessed tier requires distinguishing kernel-checked from
  trusted.
- **Two clauses of the CLAUDE.md halt invariant are aspirational**:
  non-exhaustive match is `info`-severity (no halt), and a failing
  invariant at CONSTRUCTION yields an error value (no halt). The
  session contract must be corrected to say what the code does — or
  the code moved; §3 decides.
- **Async is host-gated in surprising places**: modules load with no
  FutureManager (async primitives inside a module throw), and
  base-mode REPL has none.
- Smaller: `fetch`'s error path untested; `propagateCompletions` has
  no cycle guard; the assumption ledger renders in `verify` only;
  `NOTIF_TOTALITY_NEEDS_ANNOTATION` is a declared-but-never-emitted
  notification kind — the reserved slot for exactly the div
  caller-propagation rule; the B-087 totality perf hotspot
  (`exhTypeLookup` re-evaluates types with zero memoization) sits on
  the same lookup div inference will hammer.

## 3. Decisions for ratification (CE-R1 … CE-R8)

- **CE-R1 — `div` rides the effect calculus, verbatim.** Inference:
  `checkTermination` (+ a transitive closure over the call graph it
  already builds) writes `"div"` into each undischarged binding's
  `__inferredEffects` BEFORE `checkEffectsDeclarations` runs; the
  existing inferred-⊆-declared check and its existing halt then carry
  `div` with no new enforcement machinery. Strictness therefore lands
  exactly where the effect calculus already puts it: **a declaration
  is a contract** — `effects pure` (or any declared set without
  `div`) on a possibly-diverging function HALTS; an undeclared
  function carries `div` in its inferred, inspectable set without
  halting. `partial` remains the explicit undischarged marker (skips
  analysis, forces `div` into the inferred set). Kernel primitives
  are axiomatically total (the kernel tier — same amortization as
  Equatable's kernel certificate). Recommended.
- **CE-R2 — Discharge tiers recorded per binding, ledger-visible.**
  A div-obligation register keyed by binding FQN (the law-obligation
  register's shape, re-keyed: that registry keys on type identity,
  which functions don't have), statuses mirroring D34: `auto`
  (analyzer-proven; includes the trivial non-recursive case),
  `witnessed` (a `decreases` metric the kernel VERIFIED),
  `admitted` (`assume terminates`, or a `decreases` metric the
  analyzer could NOT verify — today's silent trust becomes a recorded
  admission), `undischarged` (`partial`, or analysis failure on an
  undeclared function). Verdict gains the div block in the assumption
  ledger; `obligations` exports pending/admitted div entries beside
  law obligations (additive `pcp/1` fields, the `restsOn` precedent).
  Recommended.
- **CE-R3 — Surface forms: `assume terminates` lands; `total` lands
  as the per-function strict opt-in.** Both as `stmt_form` body forms
  in `lib/totality.alg`, through the sanctioned lowering chain
  (marker prim → tree-builder attach → `collapseBodyMetadata`
  property — no new peeler). `assume terminates` = admitted tier.
  `total` = this function's undischarged-`div` is an ERROR even
  without an effects declaration (the reserved inverse opt-in,
  per-function; the PROJECT-level default flip and blanket axiom
  patterns stay with B-018's severity reconciliation, which this arc
  feeds but does not decide). Recommended.
- **CE-R4 — Incompleteness detection gets ONE new label: `sched`.**
  `is_resolved(x)` ships as a lazy primitive (it must see the
  unevaluated cell) tagged `sched` — the `certificate_peek`/`observe`
  precedent verbatim: scheduling-dependent answers break congruence,
  so pure code cannot ask. D31's "blocking-read" needs NO label of
  its own under PE semantics: reads of pending values are residuals
  (never blocking), so what remains of blocking-read is the LIVENESS
  question — may this residual never complete? — which is discharged
  by AXIOM per D34: each async source carries a liveness disposition
  (`delay`: live by construction — a timer fires; `fetch`: admitted
  axiom "endpoint responds", verdict-visible), recorded in the div/
  liveness ledger rather than inferred. `select` and richer detection
  stay riders. Recommended.
- **CE-R5 — `Future[T]` minted through `buildGenericType`.**
  Memoized parameterization (identity equality free), flattening
  (`Future[Future[T]]` = `Future[T]`) in the constructor callback.
  Async primitives stamp their futures (`delay` → `Future[Int]`,
  `fetch` → `Future[String]`); the future value remains the pending
  Symbol/residual under the type channel. The #1 seam closes in the
  same chunk: `checkArgType` (and its generic/instanceof siblings)
  RESIDUALIZES when the argument is unresolved or `Future[T]`-typed
  where `T` is expected — D11 at the call boundary. `Future[T]`
  conformance stays out of interfaces (a future satisfies nothing
  until read). Recommended.
- **CE-R6 — Modules get the session's FutureManager; base mode keeps
  the throw.** The loader threads the caller's FutureManager into
  module evaluation (async inside modules works, futures drain with
  the session); Allegretto/base mode without a manager keeps the
  explicit "requires async runtime" error — absent host capability is
  a real configuration error, not value incompleteness, so D11 does
  not apply to it. Recommended.
- **CE-R7 — The mechanical purity gates see `div` (conscious
  delta).** E-R5's gate demands an empty inferred set; once `div` is
  inferred, an `eq`/coercion implementation the analyzer cannot prove
  terminating fails the gate. Non-recursive implementations (the
  overwhelming case) are auto-total; recursive ones need `decreases`.
  D32 extends the same gate to value-inspecting invariant predicates
  ("total or the guard could hang" — §10). Differential sweep of the
  corpus before the flip; pre-declared in §5. Recommended.
- **CE-R8 — D32 lands in two moves, the soundness fix first.**
  Move 1 (substrate chunk, arguably a bug fix): `refined.__construct`
  adopts `checkRefinementPredicate`'s tri-state — an unresolved
  predicate residualizes CONSTRUCTION instead of silently tagging;
  the guard is thereby emergent exactly as §10 predicted. Move 2
  (the D32 chunk): guarded projection — fields untouched by a
  pending invariant project, guarded by construction success;
  invariant totality enforced per CE-R7. The value-inspecting
  discriminator is the shipped `opaque`-domain test (recognized
  scalar domains discharge without running the predicate).
  Recommended. Also ratified by adopting this plan: CLAUDE.md's halt
  invariant is CORRECTED to shipped reality (non-exhaustive match:
  info; construction-path invariant failure: error value) rather than
  silently strengthening behavior — promoting those two to real
  halts is a separate decision this arc does not smuggle in.

## 4. Chunks

House sizing: one landable unit per chunk, suite green, landing
checklist per PROCESS §5; the behavior FLIP lands last-but-one with
release after (S3 precedent). Each chunk on its own W-006 branch + PR.

**F1 — Substrate hardening (no policy change) [this PR].**
`resolveCell` enforces write-once (second resolution of a complete
cell throws; boundary test); cross-pass future resolution fixed (the
resolving closure targets the registry/ctx that tracked the cell —
REPL + web); `propagateCompletions` cycle guard; `fetch` error-path +
chained future tests; the CE-R8 move-1 construction tri-state
(soundness fix); the B-087 `exhTypeLookup` memo (one-line, pre-req:
div inference multiplies this lookup's call count). Conscious delta:
none — every change makes shipped words true.
*In-chunk refinements (recorded at landing): write-once enforcement
lives at the PHASE interface (`applyPhase`) — `resolveCell` itself
must keep serving legitimate same-pass rebinding, so the cell
invariant is enforced where cells are actually resolved. The
"cycle guard" became an ITERATIVE cascade: termination was already
structural (a binding completes at most once), so the real hazard was
recursion depth on long chains, and a seen-set would have wrongly
blocked legitimate multi-pass convergence. The construction guard
required a companion piece §2 didn't predict: RESOLVED-SLOT
SUBSTITUTION (copy-on-write) — a future in a data slot is a Symbol
the evaluator never revisits, so the re-fired check (and the finally
tagged instance) must substitute completed slots; shallow by design,
nested substitution rides F2. And the B-087 memo measured at ~2% on
the 65s demo — suspect refuted, item stays open with the finding.*

**F2 — Typed futures + detection (D33/D16 complete) [this PR].**
`Future[T]` via `buildGenericType` (flattening, memoization); async
primitives stamp their futures; `checkArgType` + siblings residualize
on unresolved/future-typed args (the #1 seam); `is_resolved` lands
lazy + `sched`-labeled; modules get the FutureManager (CE-R6);
liveness dispositions recorded for the two async sources. Conscious
delta 2 (typed futures change introspection output for pending
bindings).
*In-chunk refinements (recorded at landing): the boundary seam is
TWO sites, not one — `checkArgType` (call path: element-type check,
defer-by-skip since the arg flows into the body per PE Rule 1) and
`type_check_impl` (annotation/return path: element-type check,
defer-by-RESIDUAL — the check re-fires on resolution, so refinement
predicates run against the real value; without this branch the
"type known — check at compile time" path compared the nominal name
`Future` against the annotation and threw, a seam the survey's
line-number pointer missed because pre-F2 futures carried no type at
all). The Future annotation vanishes on resolution for free: carrier
re-evaluation lets the fresh value's own type shadow it — no
unwrapping machinery. The arg-path refinement predicate defers to the
annotation/construction machinery by design (recorded as an F2
limitation: a future passed to a refined param is shape-checked at
the call, predicate-checked wherever the value next crosses an
annotation or construction).*

**F3 — `div` (the flip) [this PR].** The inference seam: termination
analysis runs before effect-declaration checking, writes `div` into
`__inferredEffects` per CE-R1 with call-graph closure
(`NOTIF_TOTALITY_NEEDS_ANNOTATION` finally earns its keep for the
propagation notice); the div-obligation register with D34 tiers
(CE-R2), `decreases` verified-vs-trusted split, `assume terminates` +
`total` body forms (CE-R3); the purity gates see div (CE-R7);
Verdict/inspect/obligations wiring (inspect's hard-coded totality
kind filter extended; ledger div block; additive pcp fields).
Deltas 3–6 land here — the largest queue in the arc.
*In-chunk refinements (recorded at landing): `checkTermination` became
a thin wrapper over the unified `analyzeDivergence` (one pass computes
findings, tiers, and the closure — no drift, no double analysis);
`admitted` blocks inherited div (an axiom about the whole function)
while `witnessed` transmits it (a metric proves only the function's
own recursion); cross-module propagation reads leaf callees' effect
sets through the compile ctx. The corpus sweep found exactly ONE
customer: `dim_render_from` in lib/units.alg (unprovable count-up
recursion whose div cascaded through `dim_name` into the arithmetic
surface and tripped the E-R5 gate on the units `eq`) — discharged by
UNROLLING over the fixed 7-dimension domain (a typed-refinement
count-down was tried first and abandoned: the refined param sent
precompile's branch exploration exponential). Liveness ledger entries
list only sources the compilation actually uses, keeping clean
modules' verdicts byte-stable.*

**F4 — D32 guarded projection + release.** Guarded projection under
a pending invariant; invariant-predicate div gate; stages-of-arrival
confluence tests (folded vs late construction agree — the D41
harness pattern reused); docs sync (structures.md §10 status stamps,
effects.md label roster, totality doc pointer for B-018,
decisions.md D16/D31–D34 execution states, language-reference async
examples, CLAUDE.md halt-invariant correction per CE-R8);
CHANGELOG; backlog close-out with riders routed.

Gate per chunk: land, summarize, stop (PROCESS §3).

## 5. Conscious-delta inventory (pre-declared per the §6-item-3 ruling)

1. Write-once enforcement (F1): any code path double-resolving a cell
   now throws — believed none exist (boundary tests pin the single
   path); differential fixture if one surfaces.
2. Typed futures (F2): pending async bindings render with
   `Future[T]` in inspect/REPL output where they previously showed
   bare residual text; snapshot-sensitive tests updated in-chunk.
3. Declared-effects contract meets div (F3): a function that DECLARES
   an effect set and provably-may-diverge now halts. Corpus sweep
   before the flip: no lib/test function is expected to both declare
   effects and recurse unprovably; any found gets `decreases` or an
   explicit tier in the same chunk (pre-declared, never silent).
4. E-R5 purity gates see div (F3, CE-R7): existing `eq`/coercion
   impls must be auto-total; corpus-swept before the flip, same
   treatment.
5. Info-notification texts (F3): termination findings gain tier
   vocabulary; message-substring tests extended (never weakened).
6. `decreases` trusted→admitted (F3): an unrecognized metric now
   produces a verdict-visible admitted entry where it produced
   silence. `basicsOutput` snapshot untouched (basics.alg has no
   async/partial content — default: unchanged).
7. Construction tri-state (F1, CE-R8): constructing a refined value
   over unresolved fields now residualizes instead of mis-tagging;
   no existing test constructs over futures (none can — no surface),
   so the delta is latent, asserted by new tests.

## 6. Riders and out-of-scope (owners named)

Sync/async modifiers → B-047 (revisits on this substrate);
algebraic effects → B-048 (blocked on continuations, B-072/B-073);
resource budgets / `ResourceExhausted` → D35, deferred by its own
terms; per-project severity config, project-level axiom patterns, and
the `total`-by-default policy flip → B-018 severity reconciliation
(this arc builds the tier machinery B-018 will configure);
`select` / cancellation / timeout / timer surfaces → future backlog
mint at need; `Future` in interface conformance → S5/B-050 territory;
promoting the two aspirational CLAUDE.md halts to real halts →
maintainer decision, deliberately not smuggled (CE-R8).

## 7. Status log

- 2026-08: plan drafted (design corpus §10 + D-register rows; two
  parallel code-reality sweeps archived in the session record).
  Decision points CE-R1–CE-R8 proposed with recommendations.
  Awaiting maintainer ratification — no chunk starts before the gate
  (PROCESS §6).
