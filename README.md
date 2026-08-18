# Allegro

**Verified code at AI velocity.**

Allegro is a programmable language platform where every claim about
your code resolves to a proof strength you can see — and where humans
and AI agents ship through the same verifying kernel.

Everything it does differently is a composition of three moves:

1. **Everything is a value under one engine.** Code, types, grammars,
   proofs, and effects are ordinary values; partial evaluation is the
   only engine. Type checking, proof discharge, and optimization are
   the same evaluation, run as far as the available facts allow.
2. **Every claim carries a visible strength.** No boolean "verified"
   anywhere: a refinement, contract, law, or effect declaration
   resolves to a tier — *proven, enumerated, sampled, witnessed,
   admitted, pending*. The escape hatches are legal and loud, and the
   verdict's assumption ledger shows exactly what every proof rests on.
3. **Every participant goes through the same kernel.** A human, an
   LLM, a tool — same obligations, same protocol, same verification,
   with authorship recorded per discharged proof.

## Quick start

Requires Node.js 18+.

```bash
git clone https://github.com/majodali/allegro
cd allegro
npm install

npx tsx src/index.ts              # REPL
npx tsx src/index.ts basics.alg   # run a file
npm test                          # full suite
```

A taste — claims are part of the program, and breaking one halts the
build with a concrete counterexample:

```allegro
use contracts

PositiveInt = Int & _ > 0

double_pos(x: PositiveInt): PositiveInt =>
  requires x > 0
  ensures _ > 0
  x + x                            // both checks discharge statically

theorem doubles: double_pos(PositiveInt(3)) == 6
```

```bash
npx tsx src/index.ts inspect first.alg   # types, predicates, contracts,
                                         # effects, safety grade
npx tsx src/index.ts verify first.alg    # theorems, law tiers, the
                                         # assumption ledger
```

## Guided tour

- **[Getting started](docs/getting-started.md)** — install to first
  verified program.
- **[`demos/rung1/`](demos/rung1/)** — five runnable scenes: proof
  discharge, counterexamples, effects refusal, laws + the admitted
  tier, and the participant-neutral prover loop
  (`allegro obligations` / `propose` / `prove`), each with a "break
  it" block and captured transcripts.
- **[allegrolang.org](https://allegrolang.org)** — live sandbox: every
  example editable and runnable in the browser.
- **[Proving in Allegro](docs/proving-in-allegro.md)** — the proving
  guide (also the LLM prover's system primer).
- **[Vision](docs/VISION.md)** and **[design docs](docs/design/)** —
  why it's built this way.

## Status, honestly

Allegro is a research-stage platform: one implementation, an
interpreter, APIs still moving. Static discharge is best-effort by
design — what partial evaluation cannot fold becomes a runtime check
or a pending obligation, visibly, never silently. Effect labels are
module-granular; termination checking recognizes structural patterns
and declared `decreases` metrics. No performance claims. What we do
claim, with runnable receipts, is in [docs/messaging.md](docs/messaging.md).

## License

[CC0 1.0 Universal](LICENSE) — public domain dedication.
