# Scene 1 — the planning loop: a plan with a hole, closed by a proposer the kernel checks

An operations lead has a plan with a hole in it: an order is packed, and
nothing in the plan gets it delivered. The scene, `01-loop.alg`, declares
the plan **open**, with the catalog it is to be completed from, so the
hole is an obligation rather than a halt. This walkthrough runs the loop
over that file in four steps: the obligation listed, the obligation
rendered as a TODO, a scripted proposer answering it, and a language
model answering it. In every step the proposer only proposes; the kernel
checks the plan with the proposal added, and the kernel is the only
thing that says yes.

The scene itself runs no loop (`npx tsx src/index.ts demos/rung4/01-loop.alg`
prints its eleven pinned lines). Every command below is run from the
repository's root; `allegro` is `npx tsx src/index.ts`.

## 1. The obligation

`allegro obligations` lists what the file leaves open. The last entry is
the plan's: the catalog fills `Delivered` (Van) and `Sorted` (Depot), and
stops at `Shipped`, which nothing in it produces. The five above it are
the units library's laws, pending as in every file that uses `units`.

```
$ allegro obligations demos/rung4/01-loop.alg --pending
Obligation: theorem `Quantity.law_mul_comm`
  proposition: for_all over Quantity: law 'mul_comm' holds
  hash:        5514d15e
----------------------------------------
Obligation: theorem `Quantity.law_conv_roundtrip`
  proposition: for_all over Quantity: law 'conv_roundtrip' holds
  hash:        adaa70c1
----------------------------------------
Obligation: theorem `Quantity.law_refl`
  proposition: for_all over Quantity: law 'refl' holds
  hash:        02045bce
----------------------------------------
Obligation: theorem `Quantity.law_sym`
  proposition: for_all over Quantity: law 'sym' holds
  hash:        2dcd441e
----------------------------------------
Obligation: theorem `Quantity.law_trans`
  proposition: for_all over Quantity: law 'trans' holds
  hash:        d4e259ed
----------------------------------------
Obligation: plan `Fulfil`: Shipped, which Depot needs
  stop:        nothing in the catalog produces Shipped, which Depot needs
  steps:       Delivered from Van, Sorted from Depot
  catalog:     yard
  hash:        5444505e
----------------------------------------
```

The `hash` is the obligation's identity: the plan's name, declared
inputs, outcomes and budget, and the gap. A proposal that edits the plan
instead of answering it moves the hash and is refused.

## 2. The TODO

`allegro propose` renders the same obligations as a Markdown TODO, the
form a person editing the file reads, and the form the loop's request
repeats.

````
$ allegro propose demos/rung4/01-loop.alg
# Proof TODO — `demos/rung4/01-loop.alg`

**6 pending** of 20 obligation(s).

## `Quantity.law_mul_comm`

**Proposition:**

```allegro
for_all over Quantity: law 'mul_comm' holds
```

---

## `Quantity.law_conv_roundtrip`

**Proposition:**

```allegro
for_all over Quantity: law 'conv_roundtrip' holds
```

---

## `Quantity.law_refl`

**Proposition:**

```allegro
for_all over Quantity: law 'refl' holds
```

---

## `Quantity.law_sym`

**Proposition:**

```allegro
for_all over Quantity: law 'sym' holds
```

---

## `Quantity.law_trans`

**Proposition:**

```allegro
for_all over Quantity: law 'trans' holds
```

---

## `Fulfil: Shipped, which Depot needs`

**Gap:** nothing in the catalog produces Shipped, which Depot needs

**Search so far:** Delivered from Van, Sorted from Depot

**Catalog to extend:** `yard`: add one node block that produces `Shipped`; leave the plan `Fulfil` as written.

**Hash:** `5444505e` (over: plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none; gap Shipped by Depot)

---

_When done, run `allegro verify` on the source file to confirm._
````

A person answers it by adding one node block to `catalog yard:` and
running `allegro verify` again, as rung 1 scene 5 does for a proof.

## 3. The loop, scripted

`allegro prove` runs the loop: for each obligation, a request, a reply,
the reply spliced into the catalog, the plan checked and solved again,
and on a refusal the next request carrying the refusal's text. With
`--proposals` the proposer is a script that answers from a file of
prepared proposals, `transcripts/01-loop-proposals.md`, so the loop runs
without a key and without the network. Its first answer, `Messenger`,
ships only a labelled order, and nothing labels one; its second,
`Dispatch`, closes the gap within the budget.

```
$ allegro prove demos/rung4/01-loop.alg --proposals demos/rung4/transcripts/01-loop-proposals.md --transcript demos/rung4/transcripts/01-loop-scripted.md --json
{"filename":"demos/rung4/01-loop.alg","allDischarged":true,"summary":{"discharged":1,"pending":0,"skipped":5},"perObligation":[{"name":"Fulfil: Shipped, which Depot needs","kind":"plan","discharged":true,"attempts":2,"finalTerm":"Dispatch:\n  inputs: Packed\n  outcomes: Shipped\n  estimate: 45 min, 0.25 person-hours","authorship":{"provers":[{"prover":"scripted:01-loop-proposals.md","attemptsUsed":2,"effortBudgetUsed":{"attempts":2},"role":"primary"}],"verifiedAt":"2026-11-12T18:08:05.087Z"},"history":[{"proofTerm":"Messenger:\n  inputs: Labelled\n  outcomes: Shipped\n  estimate: 40 min, 0.25 person-hours","verified":false,"reason":"refused (open): nothing in the catalog produces Labelled, which Messenger needs"},{"proofTerm":"Dispatch:\n  inputs: Packed\n  outcomes: Shipped\n  estimate: 45 min, 0.25 person-hours","verified":true,"answer":"accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Dispatch; bound effort 1.5 person-hours, duration 155 min"}]}],"skipped":["Quantity.law_mul_comm","Quantity.law_conv_roundtrip","Quantity.law_refl","Quantity.law_sym","Quantity.law_trans"]}
```

The run wrote `transcripts/01-loop-scripted.md`, turn by turn (each
request, reply, kernel answer and the time each took), and its JSON twin
`01-loop-scripted.json`. The laws are skipped: the script has no answer
for them, and the file holds no `theorem` line to splice one into.

The file itself still holds the hole: `prove` does not rewrite it unless
`--output FILE` asks. `allegro verify` on the file as written lists the
obligation pending and the scene's own solved proposal, every entry by
the file:

```
$ allegro verify demos/rung4/01-loop.alg
Verdict (verified): 0/0 discharged
  laws: 12/17 discharged, 5 pending
    ? Quantity.mul_comm
    ? Quantity.conv_roundtrip
    ? Quantity.refl
    ? Quantity.sym
    ? Quantity.trans
  coercions: 2/2 obligations discharged
  plans: 1/2 discharged, 1 pending
    ? Fulfil: Shipped, which Depot needs — nothing in the catalog produces Shipped, which Depot needs
    ✓ express: every gap closed — Delivered from Van, Sorted from Depot, Shipped from Express; bound effort 1.5 person-hours, duration 155 min
  assumption ledger: rests on 1 admitted, 0 sampled; 5 obligation(s) pending
    ! admitted promise 'sealed' — backs: express, solved
  plan ledger: 2/2 well-formed (discharged); 1 promise(s) admitted
    ✓ express: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Express for Shipped, by the file; rests on 1 admitted promise: sealed
    ✓ solved: plan Fulfil, well-formed; rests on 1 admitted promise: sealed
```

With `--transcript`, `verify` puts the transcript's accepted entry back
into the catalog with the loop's own splice, after matching the
obligation's name and hash, checks the file again, and the plan ledger
names who proposed the entry and in how many attempts:

```
$ allegro verify demos/rung4/01-loop.alg --transcript demos/rung4/transcripts/01-loop-scripted.json
  plan ledger: 3/3 well-formed (discharged); 1 promise(s) admitted
    ✓ Fulfil: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Dispatch for Shipped, by scripted:01-loop-proposals.md; rests on 1 admitted promise: sealed
    ✓ express: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Dispatch for Shipped, by scripted:01-loop-proposals.md; rests on 1 admitted promise: sealed
    ✓ solved: plan Fulfil, well-formed; rests on 1 admitted promise: sealed
  transcript: demos/rung4/transcripts/01-loop-scripted.json: 1 accepted entry applied
    + Dispatch in `yard` for `Fulfil: Shipped, which Depot needs`, by scripted:01-loop-proposals.md in 2 attempt(s)
```

(The lines above the plan ledger are as in the plain `verify`, with the
plan obligation now discharged.) Nothing in the transcript is trusted but
the entry's text and the proposer's name: the kernel judges the file
again, and an entry that no longer closes its obligation fails the
verdict.

## 4. The loop, with a language model

The same loop with a language model as the proposer:
`transcripts/llm-planning-loop-proposals.md` and its JSON twin, the
maintainer's run of

```
$ allegro prove tests/planning-loop-proposals.alg --proposer claude-code --transcript demos/rung4/transcripts/llm-planning-loop-proposals.md --json
```

on the maintainer's Claude subscription, through Claude Code's scripted
mode (`claude -p`, one run per request). The run was on
`tests/planning-loop-proposals.alg`, which holds the same plan and the
same catalog as this scene, so the obligation, its hash (`5444505e`) and
the kernel's answers are the same. The model read the request of step 2
and answered:

```allegro
ShipOrder:
  inputs: Order
  outcomes: Shipped
  estimate: 30 min, 0.25 person-hours
```

The kernel refused it, in planning words:

```
refused (unsolved): no completion of Fulfil from the catalog is well-formed for Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from ShipOrder, fails: outcome Packed of Pack is neither consumed by a node of Fulfil nor declared as its outcome
```

`ShipOrder` ships the order straight from `Order`, so `Pack`'s `Packed`
is left over, and a well-formed plan consumes every outcome it does not
declare. The model read that refusal in the second request and answered:

```allegro
Ship:
  inputs: Packed
  outcomes: Shipped
  estimate: 30 min
```

```
accepted: the gap is closed and the plan solved: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.25 person-hours, duration 140 min
```

The authorship the kernel recorded:

```json
{
  "provers": [
    {
      "prover": "claude-code:default",
      "attemptsUsed": 2,
      "effortBudgetUsed": {
        "attempts": 2
      },
      "role": "primary"
    }
  ],
  "verifiedAt": "2026-11-12T06:32:51.351Z"
}
```

`allegro verify --transcript` carries that author onto this scene:

```
$ allegro verify demos/rung4/01-loop.alg --transcript demos/rung4/transcripts/llm-planning-loop-proposals.json
  plan ledger: 3/3 well-formed (discharged); 1 promise(s) admitted
    ✓ Fulfil: open plan Fulfil, solved, well-formed; bound effort 1.25 person-hours, duration 140 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by claude-code:default; rests on 1 admitted promise: sealed
    ✓ express: open plan Fulfil, solved, well-formed; bound effort 1.25 person-hours, duration 140 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Ship for Shipped, by claude-code:default; rests on 1 admitted promise: sealed
    ✓ solved: plan Fulfil, well-formed; rests on 1 admitted promise: sealed
  transcript: demos/rung4/transcripts/llm-planning-loop-proposals.json: 1 accepted entry applied
    + Ship in `yard` for `Fulfil: Shipped, which Depot needs`, by claude-code:default in 2 attempt(s)
```

The keyed run predates the skip of chunk L7: it also asked the model
about the five units-library laws, each refused at its splice because
the file declares no such theorem, and about `courier`, an open plan the
file builds from `Fulfil` without a catalog binding of its own. Today's
`prove` skips the laws before any request ("no splice site in the
file"). The transcript stays as the record of that run.

## What the kernel checked, and what it did not

Each answer above is the kernel's: the splice adds one entry to the
catalog and never touches the plan; the plan is checked and solved by
the same checks and the same search as rung 3; a refusal is the
library's own sentence. What the solved plan still rests on is in the
ledger: `rests on 1 admitted promise: sealed`. A fixture is a promise
the plan makes about a value, and in Shape 1 no value exists to check it
against, so it is admitted, never discharged.
