# Rung 1, scene 1: claims stated in the code and decided

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/01-discharge.alg` | 1 | 5 | Provability, positive and negative; compilation is evaluation you can trust |

## Who and why

A developer, or an agent writing code, states facts about a program in
the program's own syntax: a refinement, a contract and four theorems.
They want each claim decided while the program is checked. They want
the run to carry nothing of the checks.

## Steps

1. **Does.** Declares `PositiveInt = Int & _ > 0` and constructs
   `PositiveInt(5)`. **Must find.** The construction claims `5 > 0`. The
   claim holds, decided by evaluation. The value carries the knowledge
   that it is at least 1. The run prints 5.
2. **Does.** Declares `double_pos(x: PositiveInt): PositiveInt` with
   `requires x > 0` and `ensures _ > 0`, and calls it on
   `PositiveInt(7)`. **Must find.** The body holds four claims: the
   parameter type on entry, `requires`, `ensures` and the return type on
   exit. With `x` unknown and known to be at least 1, `requires` holds
   from that knowledge. The sum is known to be at least 2, so `ensures`
   and the return type hold. Each is decided with the value unknown, so
   none stays in the residual. `requires` and `ensures` are part of the
   standard language, with no `use contracts` (ruling A of 2026-11-15,
   round 2). The run prints 14.
3. **Does.** States `theorem four: 2 + 2 == 4` and
   `theorem half_of_eight: 4 == 8 / 2`. **Must find.** Each holds,
   decided by evaluation. No proposal is involved.
4. **Does.** States `four_flipped` by `proof_sym(four)` and `chained` by
   `proof_trans(four, half_of_eight)`. **Must find.** Each `by` term is a
   proposal. The kernel checks that it establishes exactly the stated
   equation. Each holds, decided, since evaluation decides it: a true
   claim whose term uses an assumed law reads assumed only when the term
   is what establishes it (ruling N of 2026-11-15, round 3). Each
   result names the standard extension, whose symmetry and
   transitivity rules it used, and the Int equality law the rule used,
   assumed (ruling 5). The proposer of both terms is the file.
5. **Does.** Runs `inspect` and `verify`. **Must find.** Each claim of
   steps 1 to 4 is listed with its strength and what it rests on. The
   twelve equality laws of the standard types are listed with theirs:
   Bool's three are decided by enumeration; the nine of Int, Float and
   String are assumed, each named with the platform as the author of
   the assumption, until proved against the primitives' reference
   definitions (ruling 5 of 2026-11-15). The two Int-to-Float coercion
   claims are assumed and named in the same way (ruling M). The claims
   decided by evaluation do not rest on the laws: `2 + 2 == 4` uses the
   primitive and not the law. This follows: every claim the file makes
   is decided, so the module's summary is decided.
6. **Does.** Runs the program. **Must find.** It prints 5, 14 and 4. The
   theorems and the contract leave nothing to evaluate in the run.

## Break it

The scene has no break-it block. The failure cases of these claims are
scene 2's (`rung1-02-counterexamples.md`).

## What changes by ruling

- "A module's summary is the weakest strength among its claims": the
  grade `proven-safe` becomes one word, the weakest strength among the
  module's claims: decided (ruling N).
- "Four strengths, one vocabulary": `inspect`'s "rests on: proven
  backing only" and `verify`'s "discharged" counts give way to the four
  strengths.
- "Every result says how strongly it holds": the verdict's heading
  "verified" and the ledger's "all proofs rest on proven backing" give
  the strengths the claims earned. The results of `four_flipped` and
  `chained` name the standard extension ("A proof term is a proposal")
  and the Int law each rule used, assumed.
- Ruling 5 of 2026-11-15: the verdict lists the twelve equality laws as
  discharged at the tier `kernel`. Bool's three are decided by
  enumeration; the nine of Int, Float and String are assumed, with the
  platform named. The two coercion claims are assumed and named too
  (ruling M, round 3).
- "Anyone may propose, and the record shows who": the verdict credits
  all four theorems to `auto-PE`. Two of them carry terms the file
  proposed; the result names the file for those. The other two are
  decided by evaluation and name no proposer.
- "Open obligations are listed for any proposer": `obligations` without
  `--pending` lists all eighteen claims as obligations, decided ones
  included. The list holds only claims that wait for a value; here it is
  empty.

## Open questions

None. Settled: the strength of the twelve equality laws (ruling 5 of
2026-11-15). Question 2 of the draft, whether `use contracts` survives
(ruling A of round 2: `requires` and `ensures` are part of the standard
language with no `use`, a separate extension inside it that a
configuration can drop). The two questions new with the rulings, ruled
2026-11-15, round 3: the coercion claims' strength (ruling M: assumed
and named with the platform, a proof against the reference definitions
the goal), and the strength of a true claim whose term uses an assumed
law (ruling N: decided when evaluation decides it).

## Present pins

Three pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 11 | `5` | 1 |
| 23 | `14` | 2 |
| 36 | `4` | 6 |
