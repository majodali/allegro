# Proving in Allegro — F-arc surface primer

This document is the **participant-neutral primer** for the Allegro
proof surface. It describes how to state and discharge theorems —
suitable both for a human learning the F-arc and for an LLM prover
that needs to produce candidate proof terms the kernel will accept.

The primer is intentionally compact. For deeper background see
`docs/VISION.md` §2 (the bet behind the arc) and the
F1–F7 entries in `CLAUDE.md` (each feature's full implementation
contract).

## The proof model in one sentence

A proposition is an Allegro expression that reduces to a Bool; a proof
is a Value that the kernel accepts as a witness. The kernel verifies
proofs by partial evaluation (PE) — discharge is reduction, not search.

## Stating a theorem

```allegro
theorem add_zero_right: 3 + 0 == 3        // named, referenceable
verify 3 + 5 == 8                          // anonymous one-shot
```

Both lower to `proof_by_eval(<proposition>)`. The kernel evaluates the
proposition; if it folds to `true`, the proof is established. Theorem
bindings produce a `Proof` value referenceable by name; `verify`
produces an anonymous one-shot check.

A failed proof halts compilation with the counterexample. There is no
silent failure — "build safety in".

## The four discharge strategies

The kernel discharges proofs via four mechanisms, in order of
preference (fastest / most-precise first):

### 1. PE-as-discharge (F1) — `proof_by_eval`

For propositions whose values are concrete enough to evaluate:

```allegro
theorem t1: 3 + 4 == 7              // PE folds both sides; discharged
theorem t2: square(5) == 25         // PE evaluates square(5); discharged

square(x: Int): Int => x * x
```

If the proposition contains an unresolved symbol (`unknown_var > 0`)
or a non-constant comparison after PE, **proof_by_eval fails** with
`could not be discharged by evaluation`. That's the signal to use one
of the other strategies.

### 2. Refinement-domain entailment (F2) — `proof_refines`

When a value's abstract domain provably entails a refinement type:

```allegro
PositiveInt = Int & _ > 0
NonNeg      = Int & _ >= 0

theorem five_pos:   proof_refines(5, PositiveInt)      // 5's domain == 5 ⊆ ≥ 1
theorem zero_nn:    proof_refines(0, NonNeg)
theorem cast:       proof_refines(SmallPos(50), NonNeg)
                       // domain [1,99] ⊆ [0,∞)
```

The discharge runs through the same `impliesDomain` lattice that
ordinary refinement-type checks use. No SMT, no search — just
abstract-domain entailment.

### 3. Equational combinators (F3) — proof_refl / sym / trans / cong

For equality proofs that need composition:

```allegro
theorem ab: 3 + 1 == 4
theorem ba: 4 == 3 + 1   by proof_sym(ab)

theorem bc: 4 == 8 / 2
theorem ac: 3 + 1 == 8 / 2   by proof_trans(ab, bc)

triple(x: Int): Int => x * 3
theorem t1: 3 == 1 + 2
theorem t2: triple(3) == triple(1 + 2)   by proof_cong(triple, t1)
```

The `by <term>` clause supplies the proof. The kernel verifies the
term establishes EXACTLY the stated proposition (matching on
value-equal operands for equality props). A proof of the wrong fact
is rejected:

```allegro
theorem bad: 1 == 2   by proof_refl(5)
// rejected: "proof term establishes a different equality"
```

### 4. Universal quantification (F5) — `prove_for_all_bool` / `prove_induction`

For claims that hold over an entire domain:

```allegro
negate(b: Bool): Bool => if b then false else true

theorem involution:
  prove_for_all_bool(b => negate(negate(b)) == b)
// enumerates {true, false}; if both fold true, discharged
```

For Peano induction over `NonNeg`:

```allegro
theorem base: 0 + 0 == 0
theorem add_zero_right:
  prove_induction(
    n => n + 0 == n,                    // predicate
    base,                                // base proof of predicate(0)
    (n, ih) => proof_refl(n + 1))        // step: ih ⊢ predicate(n+1)
```

`prove_induction` does BOUNDED SAMPLE VERIFICATION (K=4 in the
current implementation): verify base, then invoke `step(n, ih)` for
`n = 0..3` threading the IH, requiring each return to be a discharged
Proof and `predicate(n+1)` to fold true. Documented as
Stage-F5-minimum; full symbolic induction is a follow-on.

## The tactics library (F4)

`lib/tactics.alg` composes F1-F3 into reusable strategies. All pure
Allegro — no new primitives. Available after `import tactics`:

```allegro
import tactics

theorem refl9: 9 == 9 by tactics.same(9)              // refl
theorem ba2:   4 == 3 + 1 by tactics.flip(ab)         // sym
theorem ac2:   3 + 1 == 8 / 2 by tactics.step(ab, bc) // binary trans

// Equational chain: [a==b, b==c, c==d] ⊢ a==d
theorem all3: 1 + 1 == 2 * 1 by tactics.chain([e1, e2, e3])

// Substitute a by b inside f, given f(a)==c ⊢ f(b)==c
theorem fbc: inc(1 + 2) == 4 by tactics.rewrite(eq_3_12, inc, fac)
```

`tactics.chain` is the workhorse for multi-step equational reasoning.
Prefer it over deeply-nested `proof_trans` calls.

## The `proven` clause on function declarations (F7)

A function can declare a theorem about itself:

```allegro
use proven

NonNeg = Int & _ >= 0

sq(x: NonNeg): Int =>
  proven sq(x) >= 0
  x * x
```

The compiler verifies by **bounded sampling**: invoke `sq` at K=4
inputs of the param's type (Bool enumerates both values; refined Int
uses the lower bound + 3 successors; plain Int samples [0, 1, 5, -3]),
evaluate the predicate, require all true.

Failure halts compilation with a concrete counterexample input
(`at x = -3: predicate did not reduce to true`). Multi-param or
non-sampleable types emit a `proven-skipped` info.

`proven` is F7-minimum scope: single Int / NonNeg / PositiveInt / Bool
typed param. Symbolic-input verification is a follow-on.

## Laws, discharge tiers, and the strict gate (E3/E4)

There is no boolean "verified" anywhere in the system. Every law
obligation — reflexivity / symmetry / transitivity of an equality,
plus any `law_*` propositions a type declares — resolves to a **tier**:

- `kernel` — backed by the kernel's structural equality (automatic for
  built-in scalars and default record equality).
- `enumerated` — discharged by exhausting a finite domain
  (`prove_for_all_bool`).
- `witnessed` — a real proof supplied via `Law.witness(T, "law", proof)`.
- `sampled` — survived bounded sampling; survival, not proof.
- `admitted` — assumed via `Law.assume(T, "law")`; legal and loud.
- `pending` — recorded, undischarged.

Equality proofs record their backing: `p.lawTier` / `p.lawName` /
`p.equality` dispatch on any combinator-built proof, and the proof
carries its **transitive** backing set (everything inherited through
nested combinators), which `allegro verify` rolls up into the
verdict's `assumption ledger` block.

**The strict gate**: `proof_trans` over values of a type with a CUSTOM
equality is **refused** while that equality's `trans` law is neither
proven nor admitted. The refusal names both legal outs:

```
transitivity of 'Cell' is neither proven nor admitted — witness it
(Law.witness(Cell, "trans", proof)) or admit it (Law.assume(Cell, "trans"))
```

A prover should prefer `Law.witness` with a real proof
(`prove_for_all_bool` for finite carriers) and fall back to
`Law.assume` only when instructed — an admitted law marks every
downstream proof `[resting on admitted 'trans' of 'Cell']` in the
verdict, and the assumption ledger lists it with the proofs that rest
on it. Kernel equalities (Int, String, records with default equality)
pass the gate automatically at tier `kernel`.

## Failure modes and how to respond

The compiler emits structured failures with counterexamples and
iteration hints. Common shapes:

| Failure | What it means | What to try |
|---|---|---|
| `evaluates to false` | The proposition is wrong on the supplied inputs | Revise the theorem statement or the function it references |
| `did not reduce to a constant Bool (PE left a residual)` | F1 can't discharge; needs a richer strategy | Use `by` with a combinator (`proof_refl` / `proof_trans` / `tactics.chain`) or `prove_for_all_bool` for finite domains |
| `transitivity middle terms differ` | In `proof_trans(p1, p2)`, p1's RHS doesn't value-match p2's LHS | Check intermediate term; consider `tactics.chain([…])` for a longer sequence |
| `proof term establishes a different equality` | The `by` term proves a different fact than the theorem claims | Match the proposition exactly — the proof's operands must equal the theorem's |
| `neither proven nor admitted` | The E4 strict gate: `proof_trans` over a custom equality with no discharged/sampled/admitted `trans` law | `Law.witness(T, "trans", proof)` with a real proof; `Law.assume(T, "trans")` only as a loud, verdict-visible last resort |
| `proven check failed: at <param> = <value>` | F7 sampling found a counterexample | Revise the impl or weaken the `proven` clause |
| `predicate(1) does not hold` (induction) | `prove_induction` step proof claims P(n+1) but PE doesn't fold it true | Check the step function; ensure it returns a discharged proof for each sample |

## Lemma reuse

Named theorems are ordinary referenceable bindings. Prefer **citing
existing lemmas** over reproving facts:

```allegro
// Bad: each theorem reproves the underlying chain
theorem r1: 1 + 2 + 3 == 6     by /* long chain of refls */

// Good: build a lemma library
theorem add_left_one:  1 + 2 == 3
theorem add_six:        3 + 3 == 6
theorem r2:             1 + 2 + 3 == 6  by tactics.chain([
                                            proof_cong(plus3, add_left_one),
                                            add_six])
```

When proposing a proof, scan the in-scope lemmas (the obligation lists
them) before reaching for tactics.

## Output contract for an LLM prover

Workers consuming this primer return proof terms as **fenced code
blocks** with the `allegro` language tag, containing ONLY the proof
term — no `theorem` declaration, no `by` keyword, no surrounding
context:

```allegro
proof_trans(ab, bc)
```

or for a tactic:

```allegro
tactics.chain([e1, e2, e3])
```

The worker splices the term into the source's theorem declaration as
the `by <term>` clause. Multiple proof terms (one per pending
obligation) appear in multiple fenced blocks, in the order matching
the obligation list.

If the kernel rejects the term, the next iteration receives the
counterexample + updated hints. Avoid repeating strategies listed in
`already tried`.

## When PE-as-discharge isn't enough

If a proposition can't be discharged by PE + combinators + tactics +
quantifiers + bounded induction:

1. **Restate the theorem more concretely**: a universal claim with a
   specific witness often discharges via PE that a quantified version
   doesn't.
2. **Decompose into lemmas**: prove smaller facts that chain via
   `tactics.chain` or `proof_trans`.
3. **Give up and mark the theorem `verify ___` with a TODO**: better
   to surface the gap than silently leave it unproven.

PE-as-discharge handles arithmetic, equality, refinement membership,
finite-domain enumeration, and bounded induction. It does NOT
currently handle: nonlinear arithmetic over symbolic n, theory
combination, or anything that genuinely needs SMT. Those are future
SMT-fallback territory (per the thesis).
