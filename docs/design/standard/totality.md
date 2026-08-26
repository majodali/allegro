# Totality & termination — design

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Implementation: `src/totality.ts` (exhaustiveness + the unified
> divergence analysis), `src/runtime.ts` (compile-pipeline wiring, div
> stamping, `total` enforcement), `lib/totality.alg` (surface forms),
> `src/pcp.ts` (verdict/ledger/obligations surfaces), `src/introspect.ts`
> (per-binding summary). Architectural ground: D31/D32/D34 in
> `docs/design/allegretto/structures.md` §10 (EXECUTED 2026-08, B-028).
>
> This document is the B-018 revalidation of the v1 totality design
> (`docs/plans/archive/phase-e-totality-plan.md`) against the shipped
> post-B-028 system. §8's decision points **T-R1–T-R6 are
> maintainer-ratified as recommended (2026-08)**; the severity
> reconciliation (T-R1) was the item's reason for existing. B-018 is
> closed — the follow-on implementation work T-R2 and T-R6 name is
> carried in `docs/backlog.md`, not here.

## 1. Settled architectural commitments

1. **Totality is an effect question** [implemented] — divergence is the
   computed effect `div` (D31, CE-R1): the termination analysis IS the
   inference, `div` rides the ordinary effect calculus (inferred sets,
   declaration checking, PE propagation), and there is no parallel
   totality machinery. Discharge-only: no runtime handler can exist.
2. **Two sub-properties** [implemented] — the v1 thesis stands:
   *termination* (every call returns) is the `div` half;
   *exhaustiveness* (every input has a defined output) is analyzed per
   `when` chain and reported at notification tier (§4, §5).
3. **Discharge is D34's four-tier spectrum, per binding,
   verdict-visible** [implemented] — `auto` / `witnessed` / `admitted` /
   `undischarged`, recorded in `compilationReport.divObligations`,
   rendered in the verdict's completion block, exported by
   `obligations`, and folded into the assumption ledger. Nothing is
   silently trusted: an unrecognized `decreases` metric is a RECORDED
   admission (CE-R2).
4. **A declaration is a contract** [implemented] — strictness lands
   exactly where the effect calculus puts it: `effects pure` (or any
   declared set without `div`) on a possibly-diverging function HALTS;
   an undeclared function carries `div` in its inferred, inspectable
   set at info severity. `total` is the per-function strict opt-in;
   `partial` the explicit undischarged marker.
5. **Refinement integration** [implemented] — the v1 design's Q4,
   executed: termination side-conditions discharge through abstract
   domains. A decreasing parameter needs a non-negative lower bound
   (`interval` with `lo >= 0`, or exact `eq >= 0`) read from the
   refined param type — `count(n: NonNeg) => … count(n - 1)` is
   auto-proven; the same recursion over bare `Int` is flagged with
   guidance to add the bound.
6. **The mechanical gates demand div-freedom** [implemented] —
   `eq`/coercion implementations (E-R5, CE-R7) and value-inspecting
   invariant predicates (D32: "total or the guard could hang") refuse
   undischarged `div`; the D34 spectrum discharges the gate like any
   other obligation.
7. **Liveness is the other half of completion** [implemented] —
   completion = totality ∧ liveness (D31). External sources discharge
   liveness by declared AXIOM (delay: live by construction; fetch:
   admitted, ledger-visible), never by inference. Owned by the effects
   design (`effects.md`, `sched`/`div` roster) and structures.md §10.
8. **Project-level severity configuration** [designed] — per-project
   promotion of the info-tier findings and blanket axiom patterns are
   the designed relief valve for the strict default D34 names; shape in
   §5, decision in T-R2.

## 2. Surface forms and the discharge spectrum

All forms are body-form clauses in `lib/totality.alg`, lowered through
the sanctioned chain (marker prim → tree-builder attach →
`collapseBodyMetadata` → function property).

| Form | Tier | Semantics | Status |
|---|---|---|---|
| *(none, non-recursive)* | `auto` | total by construction, callees permitting | [implemented] |
| *(none, provable recursion)* | `auto` | analyzer proves the decrease (§3) | [implemented] |
| `decreases m` | `witnessed` | kernel-checked: `m` strictly decreases on every direct recursive call | [implemented] |
| `decreases [m, n]` | `witnessed` | lexicographic: some component strictly decreases, all earlier ones stable | [implemented] |
| `decreases <other shape>` | `admitted` | unverifiable shape — trusted as declared, RECORDED in the ledger | [implemented] |
| `assume terminates` | `admitted` | declared liveness axiom for the WHOLE function | [implemented] |
| `partial` | `undischarged` | explicit opt-out; `div` inferred, analyzer findings suppressed | [implemented] |
| `total` | *(policy)* | strict opt-in: undischarged own or inherited `div` is a compile ERROR | [implemented] |
| `effects <set>` | *(policy)* | the contract: inferred ⊆ declared, `div` included — mismatch halts | [implemented] |

Tier semantics under propagation (the closure, CE-R1): `admitted`
blocks inherited `div` too — the axiom speaks for the whole function.
`witnessed` transmits it — a metric proves only the function's own
recursion, so a div-carrying callee still infects the caller (with the
`totality-needs-annotation` notice naming the callee).

## 3. The termination analyzer [implemented]

One pass (`analyzeDivergence`) computes findings, tiers, and the div
closure; `checkTermination` is a compatibility wrapper over it.

- **Call graph** — symbol-called bindings, plus stdlib-HOF callback
  edges (`arr.map(f)` contributes `f`; `map`/`filter`/`reduce`
  recognized). Tarjan SCCs classify: non-recursive / self-recursive /
  mutual cycle.
- **Decrease criterion** — a recursive call is decreasing when some
  argument is `param - K` (literal `K > 0`) for the same position AND
  the CALLEE's parameter type at that position has a non-negative lower
  bound (abstract domain). Self-recursion checks against the caller's
  own types; mutual edges against the called function's.
- **Mutual recursion** — the shipped criterion is **all edges
  decrease**: every in-cycle call must satisfy the decrease test
  individually (each step strictly shrinks a bounded measure, so the
  composite terminates). This replaces the archived "common
  lexicographic measure per cycle" design (T-R4); per-function
  `decreases` clauses cover cycles the structural test cannot.
- **HOF edges** — a callback cycle edge is well-founded when the
  receiver is structurally smaller than a caller parameter
  (`param.field` — record-structural induction); a bare-param receiver
  fires with guidance. General HOF totality is not a separate
  machinery: `div` rides the effect calculus, so callback divergence
  propagates through ordinary effect propagation and effect
  polymorphism (T-R5).
- **Silence policy on untyped code** — a detected decrease on an
  UNTYPED parameter stays silent (can't prove either way; the analyzer
  must not spray noise over untyped Allegro). No-decrease-anywhere
  fires regardless of typing. A typed decrease without a bound fires
  with the "add a non-negative bound" hint.
- **Counterexamples** (v1 Stage 6) — every finding carries a
  one-line executable witness: `spin(n) → spin(n) [same input passes
  back]`, cycle traces `a(x) → b(x) → a(x) [cycle]`, missing-input
  witnesses for exhaustiveness.
- **Cross-module seam** — leaf callees (imports, extension bindings)
  answer through their effect sets (`div` stamped by their own
  module's compilation); the closure treats them as div sources.
- **Surfaces** — `inspect` (per-binding totality summary), `verify`
  (verdict completion block + assumption ledger), `obligations`
  (undischarged div rows as propositions). All additive `pcp/1`
  fields.

## 4. Exhaustiveness [partial]

Analyzed per `when/is/then` chain in every non-`partial` function.

Shipped tier [implemented]:
- An explicit `else`, a wildcard `is _`, or a bind-anything pattern
  (`is n`) covers the chain — no finding.
- **Bool**: literal coverage checked; a missing case yields a finding
  with a concrete witness (`` `f(false)` is unmatched ``).
- A named subject type without `else` or wildcard yields a generic
  non-exhaustiveness note; unknown/unresolvable subject types stay
  silent (same noise discipline as §3).

Designed targets [designed]:
- **Closed sums**: a refinement family or union type whose variants are
  statically enumerable is a finite domain — case coverage checked per
  variant (the v1 plan's "extending types as a closed sum"; restated
  over the shipped refinement/union machinery, not `__extends`).
- **Record destructuring**: single-constructor, exhaustive by
  construction — dead-case and missing-field analysis.
- **Refinement-aware dead cases**: `n: PositiveInt` makes `is 0` dead
  — mark it (counterexample-free case pruning).
- **Uncountable domains** (`Int`, `String`, `Float`): require
  `else`/wildcard — today's generic note is the degenerate form.

Severity: `info` (see §5). CE-R8 recorded explicitly that
non-exhaustive match over a finite type does NOT halt today, and that
promoting it is a maintainer decision — not to be smuggled in.

## 5. Severity policy — the D34 reconciliation

What the two source designs said:
- **v1 (Phase E, design question 1)** chose *(c) notify-by-default*:
  the analyzer always runs, failures land as `info` notifications,
  project config can promote to `error`.
- **D34 (structures.md §10)** says discharge is *strict by default*,
  with project-level axiom patterns as the relief valve for
  low-assurance projects.

What shipped (B-028) — the reconciliation this document ratifies:

| Signal | Severity | Since |
|---|---|---|
| Declared effect set missing inferred `div` | **halt** (effects-mismatch) | F3 |
| `total` function with undischarged div (own or inherited) | **halt** (totality-total-violation) | F3 |
| eq/coercion/invariant-predicate gates on div | **halt** (E-R5/CE-R7/D32) | F3/F4 |
| Failed refinement/type ANNOTATION check | **halt** (pre-existing) | — |
| `totality-nontermination` on an undeclared binding | info | Phase E |
| `totality-needs-annotation` (inherited div) | info | F3 |
| `totality-exhaustiveness` | info | Phase E |
| Construction-path invariant failure | error VALUE (not a halt) | CE-R8 record |

The ruling (T-R1): **these are not in conflict — they bind at
different levels.** D34's "strict by default" is about *discharge
accounting*: nothing is silently trusted, every non-auto tier is a
recorded, verdict-visible obligation — and that IS unconditional in
the shipped system. Enforcement strictness binds at the *contract*: a
declaration (effect set, `total`, an annotation) is strict the moment
it exists. What remains info-tier is exactly the *undeclared* surface
— code that has made no commitment — and that is v1's (c) as the
migration-era default for it. The "flip": making undeclared code
strict is a PER-PROJECT promotion (T-R2's config), never a global
break.

Project severity config [designed] (T-R2): a per-project declaration
(shape open — likely a manifest read at session start, not a body
form) providing:
- per-notification-kind promotion (`totality-nontermination: error`,
  `totality-exhaustiveness: error`) — the v1 (c) promotion path;
- `total`-by-default (every binding treated as `total` unless marked
  `partial`) — D34's strict enforcement, opt-in per project;
- blanket axiom patterns (D34's text: trust `lib/legacy/` as total;
  `fetch <url-pattern>` liveness) — recorded admissions en masse,
  still ledger-visible per binding.
This work also owns B-018's rider: the severity of the two CE-R8
weak spots (construction-path invariant failure, non-exhaustive match
over a finite type) becomes configurable in the same pass.

## 6. Revalidation record (archive disposition)

Per-stage disposition of `docs/plans/archive/phase-e-totality-plan.md`
(the reval source), against the shipped system:

| v1 stage / question | Disposition |
|---|---|
| Stage 0 substrate (keywords, notification kinds) | **shipped**, then strengthened: `partial` real since Phase E; `total` became the REAL strict opt-in (F3) — no longer "reserved"; `assume terminates` added (D34, beyond the v1 plan); all three notification kinds live (needs-annotation fires since F3) |
| Stage 1 exhaustiveness | **shipped narrower** than planned: Bool + wildcard/else tier (§4); closed sums / records / dead-case remain [designed], restated over refinements and unions instead of the retired `__extends` chain |
| Stage 2 structural termination | **shipped** as planned, domain-integrated (Q4); plus the silence-on-untyped noise discipline the plan didn't specify |
| Stage 3 `decreases` | **shipped**, strengthened by CE-R2: bare-param + lexicographic array verified; unrecognized shapes are RECORDED admissions where the plan (and pre-F3 code) silently trusted |
| Stage 4 mutual recursion | **shipped reshaped** (T-R4): Tarjan SCCs + all-edges-decrease instead of a required common lexicographic measure; per-function `decreases` covers the remainder |
| Stage 5 HOF totality polymorphism | **discarded as separate machinery** (T-R5): `div` rides the effect calculus (CE-R1), so totality polymorphism IS effect polymorphism — the planned `[t: Totality]` markers will never exist. The analyzer keeps the narrow stdlib-HOF structural check (§3) as a precision aid |
| Stage 6 counterexamples | **shipped** (findings carry executable witnesses) |
| Q1 default policy | **reconciled** — §5 (T-R1): v1 (c) for undeclared code, strict at the contract, config for the flip |
| Q2 coverage policy | **absorbed** into §4's taxonomy: coverage-or-else, with statically-covered finite domains needing neither |
| Q5 HOF totality | → Stage 5 disposition |
| Q6 counterexample shape | **shipped** as specified |
| Non-goals (proof certificates, Coq/Lean export, effectful-loop termination, sized types) | unchanged: certificates are the proof kernel's (Phase F, shipped separately); effectful loops await algebraic effects (B-048); sized types stay rejected in favor of abstract domains |

## 7. Deferred and open

- **Project severity config + blanket axioms** — T-R2 [designed];
  owns the `total`-by-default flip and the CE-R8 severity knobs.
- **Closed-sum / record / dead-case exhaustiveness** — §4 [designed].
- **Recursion inlining cutoff** — EXECUTED 2026-08 (T-R6, broadened:
  cycle membership rather than discharge tier; see §8). Suite 1015s →
  324s sequential. **Soundness review pending — B-100**, covering the
  cutoff's reasoning and, separately, the fact that the checking
  algorithm could reach host stack overflow at all: PE's `MAX_DEPTH`
  can be outrun by recursion depth, and the failure surfaced as a
  user-facing `precompile-type-error` on correct code. The cutoff
  removes today's trigger; it does not give the analyzer a real
  termination discipline.
- **B-087 totality-analysis performance** — open, hypothesis refuted
  by measurement (memo ≈ 2%); needs a real profile.
- **Productive corecursion** — `div` is *unproductive* nontermination;
  the codata boundary is noted in structures.md §13.
- **Termination of effectful loops** driven by external state — awaits
  algebraic effects (B-048).
- **Mutual-recursion common measures** — if all-edges-decrease plus
  per-function `decreases` proves too weak in practice, the archived
  common-lexicographic design is the fallback; no evidence of need yet.

## 8. Decisions (T-R1 … T-R6 — ratified 2026-08)

All six were maintainer-ratified as recommended. "Recommended" below is
kept as the record of what was put to the gate; each is now binding
design truth for this layer.

- **T-R1 — Severity reconciliation ruling.** D34's strict-by-default
  binds at discharge ACCOUNTING (always on, nothing silent) and at the
  CONTRACT (declarations, `total`, annotations — strict since F3); v1's
  notify-by-default remains the migration-era default for UNDECLARED
  code. The two designs compose; neither is overturned. Recommended.
- **T-R2 — The flip is per-project config, deferred.** `total`-by-
  default, per-kind severity promotion, and blanket axiom patterns are
  ONE designed config surface (shape in §5), implemented when a
  project-config substrate exists — not before, and never as a global
  default change. Recommended.
- **T-R3 — Exhaustiveness stays info until T-R2 lands.** The CE-R8
  record stands: promoting non-exhaustive-over-finite-type (or
  construction-path invariant failure) to a halt is a maintainer
  decision exercised through the config surface, not by code drift.
  Recommended.
- **T-R4 — All-edges-decrease is the ratified cycle criterion.** The
  archived common-lexicographic-measure requirement is replaced; it
  remains the recorded fallback should practice demand it. Recommended.
- **T-R5 — Totality polymorphism is subsumed by the effect calculus.**
  The planned `[t: Totality]` marker system is discarded; `div` rides
  effect propagation and effect variables. The stdlib-HOF structural
  check stays as an analyzer precision aid, not a polymorphism
  mechanism. Recommended.
- **T-R6 — Inlining cutoff.** *Ratified as the divergence-aware form
  (undischarged/`partial` bindings are not PE-inlined); **amended and
  BROADENED 2026-08** on measured evidence — see below. EXECUTED.*
  The pathology is real but the original predicate was wrong.
  Termination discharge does not decide whether PE can usefully unfold
  a call: a recursive call with UNRESOLVED arguments cannot converge
  whatever its tier, because the base case is undecidable without a
  concrete argument. Unfolding it builds ever-larger expressions until
  `MAX_DEPTH` or the JS stack gives out, and the result is discarded.
  Restricting the cutoff to `undischarged` therefore exempted exactly
  the functions that had been PROVEN total: `factorial(n: NonNeg)`
  (tier `auto`) cost **71.1s** to compile and emitted a spurious
  `precompile-type-error: Maximum call stack size exceeded` on correct
  code, while the same function over bare `Int` (undischarged, hence
  cut) took **0.1s** — a ~700× penalty for discharging. The shipped
  cutoff keys on **cycle membership** (the SCCs the analyzer already
  computes, surfaced as `analyzeDivergence`'s `recursiveBindings`), and
  fires only when an argument is unresolved: a fully-applied call to a
  `partial` function still executes and may legitimately diverge.
  It is installed BEFORE precompile, which is where the speculation
  happens — a cutoff installed after it demonstrably changed nothing.
  **Caveat (maintainer, at ratification of the amendment): a deeper
  soundness review is PENDING — B-100.** It covers both the cutoff's
  reasoning (partially-applied calls, mutual cycles, HOF edges) and the
  fact that the checking algorithm could hit host stack overflow at
  all, which is a symptom the cutoff hides rather than cures.
