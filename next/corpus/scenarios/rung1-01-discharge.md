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
   none stays in the residual. The run prints 14.
3. **Does.** States `theorem four: 2 + 2 == 4` and
   `theorem half_of_eight: 4 == 8 / 2`. **Must find.** Each holds,
   decided by evaluation. No proposal is involved.
4. **Does.** States `four_flipped` by `proof_sym(four)` and `chained` by
   `proof_trans(four, half_of_eight)`. **Must find.** Each `by` term is a
   proposal. The kernel checks that it establishes exactly the stated
   equation. Each holds, decided. Each result names the standard
   extension, whose symmetry and transitivity rules it used, and the
   strength of Int equality's transitivity law. The proposer of both
   terms is the file.
5. **Does.** Runs `inspect` and `verify`. **Must find.** The module's
   summary is one word: decided. Each claim of steps 1 to 4 is listed
   with its strength and what it rests on. The standard types' equality
   laws and the Int-to-Float coercion claims are listed with theirs.
6. **Does.** Runs the program. **Must find.** It prints 5, 14 and 4. The
   theorems and the contract leave nothing to evaluate in the run.

## Break it

The scene has no break-it block. The failure cases of these claims are
scene 2's (`rung1-02-counterexamples.md`).

## What changes by ruling

- "A module's summary is the weakest strength among its claims": the
  grade `proven-safe` becomes the word decided.
- "Four strengths, one vocabulary": `inspect`'s "rests on: proven
  backing only" and `verify`'s "discharged" counts become decided.
- "Every result says how strongly it holds": the verdict's heading
  "verified" and the ledger's "all proofs rest on proven backing" give
  the strength decided. The results of `four_flipped` and `chained` name
  the standard extension ("A proof term is a proposal").
- "Anyone may propose, and the record shows who": the verdict credits
  all four theorems to `auto-PE`. Two of them carry terms the file
  proposed; the result names the file for those. The other two are
  decided by evaluation and name no proposer.
- "Open obligations are listed for any proposer": `obligations` without
  `--pending` lists all eighteen claims as obligations, decided ones
  included. The list holds only claims that wait for a value; here it is
  empty.

## Open questions

1. The verdict lists twelve equality laws of Int, Float, String and Bool
   and two coercion claims as discharged, at the law strength the code
   calls `kernel`. Are they decided by evaluation in the new tree, or
   assumed as laws the supplier of a primitive declares ("A law licenses
   a rewrite, and the rewritten program carries the law's strength")?
2. Does `use contracts` survive as a module, or are `requires` and
   `ensures` part of the standard language without it ("A body clause is
   a notation")?

## Present pins

Three pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 11 | `5` | 1 |
| 23 | `14` | 2 |
| 36 | `4` | 6 |
