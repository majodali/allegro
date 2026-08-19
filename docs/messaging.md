# Allegro — messaging skeleton

> **This is the canonical source for all public copy** (website, demos,
> README, public docs). It derives from `docs/VISION.md` (§1a, §5
> principle 17) and `.claude/plans/release-track.md` (claims register).
> Nothing appears in public material that is not in this document, and
> nothing appears here that is not `delivered` or `demoable` in the
> claims register. Audience: formal-methods-literate skeptics first —
> under-claiming with receipts is the strategy, not a compromise.

## The one-liner

**Verified code at AI velocity.**

Supporting line (hero subtitle):

> Allegro is a programmable language platform where every claim about
> your code resolves to a proof strength you can see — and where humans
> and AI agents ship through the same verifying kernel.

## The three moves (public phrasing)

Everything Allegro does differently is a composition of three moves:

1. **Everything is a value under one engine.** Code, types, grammars,
   proofs, and effects are ordinary values; partial evaluation is the
   only engine. Type checking, proof discharge, and optimization are
   not separate passes over your program — they are the same
   evaluation, run as far as the available facts allow.

2. **Every claim carries a visible strength.** There is no boolean
   "verified" anywhere in the system. A claim — a refinement, a
   contract, a law, an effect declaration — resolves to a tier:
   *proven*, *enumerated*, *sampled*, *witnessed*, *admitted*, or
   *pending*. The escape hatches are legal and loud: you may assume a
   law you can't prove, and everything resting on the assumption says
   so in its verdict.

3. **Every participant goes through the same kernel.** A human, an LLM,
   a tool — all get the same obligations, propose through the same
   protocol, and are verified by the same kernel, with authorship
   recorded per discharged proof. Trust attaches to the kernel's
   verdict, not to who wrote the code.

## The rung-1 story (what the demos show)

1. **State facts in the code.** A refinement type (`PositiveInt = Int &
   _ > 0`), a contract (`requires` / `ensures`), a `theorem`, an
   `effects` clause. These are part of the program, in the program's
   own syntax.

2. **Watch the compiler discharge them.** Partial evaluation folds what
   it can: the contract check disappears, the theorem discharges, the
   inferred effect set verifies against the declaration. No separate
   proof language, no annotation burden beyond the claim itself.

3. **Break one.** The build halts with a concrete counterexample —
   `refinement check failed: expected ≥ 1 (got -5)`, `` `f(false)` is
   unmatched`` — not a type-error hieroglyph. Failures name inputs.

4. **Hand the failure to an AI.** `allegro prove` extracts the pending
   obligations, an LLM proposes proof terms, the kernel verifies each
   proposal, iteration hints steer the next attempt, and authorship is
   recorded on success. The same loop works for a human via `allegro
   propose` — same obligations, same verdicts. **Marquee moment: the
   same failing law, fixed by a human and by an AI, through the same
   protocol.**

5. **Try to cheat.** An undeclared side effect halts compilation. A
   proof chain using unproven transitivity is refused, with the two
   legal outs named: witness a proof (`Law.witness`) or admit the
   assumption (`Law.assume`). Admit it, and every downstream proof
   renders `[resting on admitted 'trans' of 'Equatable']`. The system
   never upgrades your evidence for free.

## Claims we make publicly (with receipts)

Each claim is stated at its evidence strength. Receipts are runnable.

| Claim | Receipt |
|---|---|
| Refinements, contracts, and invariants are discharged by partial evaluation; failures carry concrete counterexamples | sandbox demos; `tests/refinements.alg`, `tests/contracts-demo.alg` |
| Effect declarations are verified against inference; under-promising halts the build | `tests/effects-demo.alg`; sandbox |
| Totality analysis: exhaustiveness, termination, `decreases` metrics, HOF-mediated recursion — with witnesses | `tests/totality-*.alg` |
| Type-class laws carry discharge tiers; `Law.assume` is verdict-visible; proofs carry their transitive backing, and the verdict's assumption ledger maps every assumption in force to the proofs resting on it | E3/E4 + D2 roll-up test batteries; `allegro verify demos/rung1/04-laws.alg` |
| The prover loop is participant-neutral and closes end-to-end: obligations → proposal → kernel verdict → authorship | `allegro obligations` / `verify` / `prove` / `propose`; PCP schemas |
| Benchmark, honestly framed: PE alone discharges all 10 closed propositions in the corpus; the soundness gate rejects wrong proof terms — the prover's measured work is satisfying the gate, not discharging closed props | `npm run bench`; `bench/README.md` |
| A module's behavioral envelope is inspectable: safety grade, contracts, effects, predicates per binding | `allegro inspect`; sandbox Inspect button |
| The grammar is extensible at runtime — operators, rules, multi-token forms — with conflict detection at `use` time; extensions in `.alg` libraries get the entire kernel (proofs, effects, totality) | `lib/pow.alg`, `lib/match_expr.alg`, `lib/provable.alg` |
| A flagship provable DSL exists: units-of-measure physics as a pure Allegro library — dimensional soundness is refinement discharge, failures speak physics, theorems PE-discharge in literal syntax (`theorem: 1 km == 1000 m`), and the gate/ledger work over quantities | `lib/units.alg`; `demos/rung2/`; `allegro verify demos/rung2/03-laws.alg` |

## What we do not claim (and say so)

Public material states these plainly where relevant; the skeptic finds
them before we do or we lose them.

- Allegro is a research-stage platform: one implementation, an
  interpreter, not production-hardened, APIs still moving.
- Static discharge is best-effort by design: what PE cannot fold
  becomes a runtime check or a pending obligation — visibly, never
  silently.
- Effect labels are module-granular today (no parametric capabilities
  like `net[host]`); termination checking recognizes stated structural
  patterns and `decreases` metrics, not arbitrary recursion.
- `prove_induction` verifies a bounded prefix plus the user-owned step
  contract; the tier system says exactly this — that's what *sampled*
  means.
- No performance claims. No ecosystem claims.

## Voice rules

- Never a bare "verified" — always name the tier or the mechanism.
- Demonstrate, then state: every public claim links a runnable receipt.
- Ambition (domain models, mixed-model optimization, semantic review at
  scale) stays out of public copy entirely until delivered. The
  sequencing tells the story; the copy does not.
- Failures are content: counterexamples, refusals, and loud escape
  hatches are the product's voice. Show them breaking.

## Derived surfaces (checklist)

- `website/index.html` — hero + intro rebuilt on this skeleton; laws +
  prover-loop sections added; refinement syntax updated to `&`.
- `demos/` — rung-1 runnable scripts + transcripts (this package).
- `docs/proving-in-allegro.md` — audited as the public primer.
- README / getting-started — next slice (B-091 step 4–5).
