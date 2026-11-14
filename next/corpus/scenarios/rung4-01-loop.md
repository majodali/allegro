# Rung 4, scene 1: a plan with a hole, closed by a proposer the kernel checks

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung4/01-loop.alg`, its walkthrough `demos/rung4/01-loop.md`, `demos/rung4/transcripts/` | 4 | 7 | Participant-neutral collaboration over a domain model; the assumption ledger; a first piece of mixed-model solution finding |

## Who and why

An operations lead has a plan with a hole: an order is packed, and
nothing in the plan delivers it. They declare the plan open, with the
catalog it is to be completed from. A proposer answers the hole: a
person, a script or a language model. The kernel checks each answer and
alone accepts one.

The planning decisions are held, not ruled. This scene uses rung 3's
checks and searches, and scene 1's findings on them hold here.

## Steps

1. **Does.** Declares the fixture `sealed`, the catalog `yard` (Depot,
   Van) and `plan Fulfil from yard:` with one node, Pack. **Must find.**
   No `WellFormedPlan` claim is made on `Fulfil`. The hole is an
   obligation: a gap in a model waiting for a value ("Solving is
   proposing a value for an unknown, and the kernel checks it"). Its
   state is open. The gap is Shipped, which Depot needs. The catalog's
   search went Delivered from Van, then Sorted from Depot, and stopped.
   The plan's surface (inputs, outcomes, budget) is what a proposal must
   leave as written.
2. **Does.** Adds the proposal Courier, which ships a labelled order.
   **Must find.** Refused. The answer names the next dead end: nothing
   produces Labelled, which Courier needs. The obligation stays open.
3. **Does.** Adds the proposal Freight. **Must find.** Refused. Every
   gap is filled, and the completion breaks the budget. The answer names
   the cheapest completion and the measure it misses: 200 min against
   160 min.
4. **Does.** Adds the proposal Express. **Must find.** Accepted. The
   plan is solved: Van, Depot, Express; 1.5 person-hours, 155 min. The
   binding `solved: WellFormedPlan` claims the solved plan is
   well-formed. The claim holds and rests on the promise `sealed`, so its
   strength is assumed.
5. **Does.** Compares each proposal's surface with the plan's. **Must
   find.** No proposal changed the plan as written ("A proposer answers
   with only the missing value").
6. **Does.** Asks `plan_ledger` for the solved plan. **Must find.** The
   record names the plan as well-formed, its bound, its decisions, each
   catalog entry with who proposed it ("Anyone may propose, and the
   record shows who"), and the promise it rests on, with its strength.
7. **Does.** Runs `obligations --pending`. **Must find.** Every claim
   that waits for a value: the five Quantity laws and the plan's gap
   ("Open obligations are listed for any proposer"). The gap's identity
   covers the plan's surface and the gap, so a proposal that edits the
   plan no longer matches it.
8. **Does.** Runs `propose`. **Must find.** The form for people: the
   gap, the search so far, the catalog to extend, and the instruction to
   add one node block and leave the plan as written.
9. **Does.** Runs `prove` with the scripted proposer. **Must find.** Two
   attempts. Messenger is refused, naming Labelled. Dispatch is accepted
   and the plan solved. The result names the scripted proposer and two
   attempts. The laws are skipped, since the file holds no place for
   their answer.
10. **Does.** Runs `prove` with a language model, recorded once.
    **Must find.** ShipOrder is refused: Pack's outcome Packed is left
    unconsumed. Ship is accepted. The result names the model's proposer
    and two attempts.
11. **Does.** Runs `verify --transcript` with each transcript. **Must
    find.** The tool matches the accepted entry to the obligation by
    name and identity, places it, and has the file checked again. The
    ledger names the proposer. Nothing in the transcript is trusted but
    the entry's text and the proposer's name.

## Break it

**Does.** Declares the plan with the strict form, `plan Fulfil:`. **Must
find.** The claim that `Fulfil` is a `WellFormedPlan` is refuted. The
refutation carries the predicate's explanation: outcome Delivered is
declared and no node produces it; outcome Packed of Pack is consumed by
nothing. It is found before any effect. The present tree already halts
before output here.

## What changes by ruling

- "Four strengths, one vocabulary": pin 110 reads "rests on 1 admitted
  promise", which becomes assumed. `verify`'s "discharged", "pending"
  and "admitted" become the four strengths.
- "Every result says how strongly it holds": `verify` reports "2/2
  well-formed (discharged)" for plans that rest on an admitted promise.
  Their strength is assumed.
- "A module's summary is the weakest strength among its claims": the
  heading reads "Verdict (verified): 0/0 discharged" while five laws and
  the plan's gap wait. The summary is undecided.
- "Termination is a claim" and "An assumption is always on the record":
  the planning library's termination assumptions are on the record, as
  in rung 3, scene 1.
- "A refutation marks everything computed from it": the break-it's
  "Type error: refinement predicate failed for WellFormedPlan" becomes
  the refutation of the plan's claim.

## Open questions

1. Do the open plan's states open, unsolved and solved (pins 48, 83, 88
   and 95) map onto the four strengths, or stay planning words beside
   them?
2. The obligation list holds five Quantity laws that no proposer can
   answer in this file, and `prove` skips them. Where is a proposal for
   a library's law placed?
3. After the strict form's refutation, may the tools for proposing still
   list the result's other open obligations? Today every command stops.
4. The language-model run is recorded once, on the maintainer's
   subscription, and a test puts each recorded reply through the kernel
   again. Is that enough for milestone 7?
5. The rung's story is two coupled models; this scene has one. Does
   milestone 7 need a scene with a second model, or does it pass on
   this one?

## Present pins

Eleven pins. All are covered. Each pin is a `// expect:` line under the
line it checks. The walkthrough has no pins; a test of the present tree
runs its scripted loop again and compares the transcript.

| Line | Pinned output | Step |
|---|---|---|
| 48 | `open` | 1 |
| 50 | `[Shipped, which Depot needs]` | 1 |
| 52 | `[nothing in the catalog produces Shipped, which Depot needs]` | 1 |
| 54 | `[Delivered from Van, Sorted from Depot]` | 1 |
| 57 | `plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none` | 1 |
| 83 | `open: nothing in the catalog produces Labelled, which Courier needs` | 2 |
| 88 | `unsolved: no completion of Fulfil from the catalog fits the budget of Fulfil; …` | 3 |
| 95 | `solved: Delivered from Van, Sorted from Depot, Shipped from Express; …` | 4 |
| 98 | `plan Fulfil: Order -> Delivered; 4 nodes, 4 leaves, 0 handlers` | 4 |
| 102 | `[true, true, true]` | 5 |
| 110 | `express: open plan Fulfil, solved, well-formed; …; rests on 1 admitted promise: sealed` | 6 |
