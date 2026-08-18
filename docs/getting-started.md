# Getting started with Allegro

Allegro is a research-stage language platform where every claim about
your code resolves to a proof strength you can see. This guide gets
you from clone to your first verified program in a few minutes.

## Prerequisites

Node.js 18+ (the interpreter runs on `tsx`; no build step).

```bash
git clone https://github.com/majodali/allegro
cd allegro
npm install
```

## Run something

```bash
npx tsx src/index.ts                  # REPL (Allegro Standard)
npx tsx src/index.ts basics.alg       # run a file
npx tsx src/test.ts                   # run the full test suite
```

Hello world, in a file or at the REPL:

```allegro
print("Hello, Allegro!")

factorial(n) => if n == 0 then 1 else n * factorial(n - 1)
print(factorial(5))                   // 120
```

## Your first verified program

Claims are part of the program, written in the program's own syntax.
Save this as `first.alg` and run it:

```allegro
use contracts

// A refinement type: an Int that must be positive. `_` is the value.
PositiveInt = Int & _ > 0

// A contract: `requires` binds the caller, `ensures` binds the
// implementer (`_` is the return value). With x ≥ 1 the result
// propagates ≥ 2, so both checks discharge at compile time.
double_pos(x: PositiveInt): PositiveInt =>
  requires x > 0
  ensures _ > 0
  x + x

print(double_pos(PositiveInt(7)))     // 14

// A theorem, discharged by evaluation during compilation.
theorem doubles: double_pos(PositiveInt(3)) == 6
```

Now break it — change the theorem to claim `== 7` and run again. The
build halts with the failure and a counterexample; a failed proof
never becomes a running program.

## See what the compiler knows

```bash
npx tsx src/index.ts inspect first.alg   # per-binding summary: types,
                                         # predicates, contracts, effects,
                                         # safety grade
npx tsx src/index.ts verify first.alg    # verdict: theorems, law
                                         # obligations with their tiers,
                                         # the assumption ledger
```

The verdict never says a bare "verified" — every claim carries a tier
(proven / enumerated / sampled / witnessed / admitted / pending), and
the assumption ledger lists exactly what the module's verification
rests on.

## The prover loop

`allegro obligations` emits pending proof obligations as JSON or text;
`allegro propose` renders them as a TODO with iteration hints for a
human; `allegro prove` runs the same loop with an LLM proposing proof
terms (requires `ANTHROPIC_API_KEY`). Every participant goes through
the same kernel check; authorship is recorded per discharged theorem.
See `docs/proving-in-allegro.md` for the full proving guide.

## Guided tour

- `demos/rung1/` — five runnable scenes: discharge, counterexamples,
  effects, laws + the escape hatch, and the prover loop, each with a
  "break it" block and captured transcripts.
- [allegrolang.org](https://allegrolang.org) — the live sandbox: edit
  and run every example in the browser, with an Inspect button showing
  the semantic summary.
- `docs/messaging.md` — what Allegro claims today, with receipts, and
  what it doesn't claim yet.

## Status, honestly

Allegro is one interpreter, research-stage, APIs still moving. Static
discharge is best-effort by design: what partial evaluation cannot
fold becomes a runtime check or a pending obligation — visibly, never
silently. Effect labels are module-granular; termination checking
recognizes structural patterns and declared `decreases` metrics. No
performance claims.
