use units
use planning
use planning_loop

// Rung 4, scene 1 — the planning loop.
//
// An operations lead has a plan with a hole in it: an order is packed, and
// nothing in the plan gets it delivered. The plan is declared OPEN, with the
// catalog it is to be completed from, so the hole is an obligation the
// kernel names in planning words, not a halt. A proposer answers it with one
// more catalog entry: a person editing this file, a script, or a language
// model. The kernel checks the plan with the entry added, by the same checks
// and the same search as rung 3, and either refuses it, saying why, or
// solves the plan. The proposer is never trusted; the kernel is the only
// thing that says yes.
//
// This scene runs no loop and makes no network call. The loop is the CLI's
// (`allegro prove`), shown in 01-loop.md over this same file.

// The promise the plan makes and nothing in Shape 1 checks: a packed order
// is sealed. A fixture is a promise; the ledger lists it as admitted.
sealed = fixture("sealed", p => true)

catalog yard:
  Depot:
    inputs: Shipped
    outcomes: Sorted
    estimate: 30 min, 0.25 person-hours
  Van:
    inputs: Sorted
    outcomes: Delivered
    estimate: 60 min, 0.5 person-hours

plan Fulfil from yard:
  inputs: Order
  outcomes: Delivered
  budget: 160 min
  Pack:
    inputs: Order
    outcomes: Packed [ sealed ]
    estimate: 20 min, 0.5 person-hours

// --- The hole, in planning words ---------------------------------------------
// The catalog fills Delivered (Van), then Sorted (Depot), and stops at
// Shipped: nothing in it ships an order. That dead end is the obligation.
// (A list, so the file still evaluates once the loop has closed it.)
print(open_state(Fulfil))
// expect: open
print(open_obligations(Fulfil).map(obligation_gap_show))
// expect: [Shipped, which Depot needs]
print(open_obligations(Fulfil).map(obligation_show))
// expect: [nothing in the catalog produces Shipped, which Depot needs]
print(open_obligations(Fulfil).map(obligation_steps_show))
// expect: [Delivered from Van, Sorted from Depot]
// What a proposal must leave as written: the plan's declared surface.
print(Fulfil.surface)
// expect: plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none

// --- Three proposals, each one node block ------------------------------------
// Written here as a catalog of their own, so each is a node block as a
// proposer sends it. `with_entry` adds one to the open plan's catalog; the
// kernel's answer is the open plan's state and the planning words for it,
// both shown by `says`.
says = op => "{open_state(op)}: {open_answer(op)}"

catalog proposals:
  Courier:
    inputs: Labelled
    outcomes: Shipped
    estimate: 40 min, 0.25 person-hours
  Freight:
    inputs: Packed
    outcomes: Shipped
    estimate: 90 min, 0.25 person-hours
  Express:
    inputs: Packed
    outcomes: Shipped
    estimate: 45 min, 0.25 person-hours

// Refused: the entry ships, but needs a label nothing makes. The kernel
// names the next dead end.
print(says(with_entry(Fulfil, proposals[0])))
// expect: open: nothing in the catalog produces Labelled, which Courier needs

// Refused: every gap is filled, and the completed plan breaks the budget.
// The kernel names the cheapest completion and the measure it misses.
print(says(with_entry(Fulfil, proposals[1])))
// expect: unsolved: no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from Freight, is duration 200 min against 160 min

// Accepted: the gap closes within the budget. The solution names each
// step and the bound, and the solved plan passes the `WellFormedPlan`
// check.
express = with_entry(Fulfil, proposals[2])
print(says(express))
// expect: solved: Delivered from Van, Sorted from Depot, Shipped from Express; bound effort 1.5 person-hours, duration 155 min
solved: WellFormedPlan = solve_open(express).plan
print(plan_show(solved))
// expect: plan Fulfil: Order -> Delivered; 4 nodes, 4 leaves, 0 handlers

// The plan as written is unchanged by every proposal.
print(proposals.map(entry => with_entry(Fulfil, entry).surface == Fulfil.surface))
// expect: [true, true, true]

// --- What the solved plan rests on --------------------------------------------
// The ledger's record of the solved plan: well-formed, its bound and
// decisions, each catalog entry it uses and who proposed it, and the
// promises it rests on. Here every entry is the file's; `allegro verify
// --transcript` names the loop's proposer instead (01-loop.md).
print(plan_ledger("express", express, [], walk_levels).line)
// expect: express: open plan Fulfil, solved, well-formed; bound effort 1.5 person-hours, duration 155 min, money none; decisions no choices; catalog entries Van for Delivered, by the file; Depot for Sorted, by the file; Express for Shipped, by the file; rests on 1 admitted promise: sealed

// An open plan is what lets the hole be an obligation. Break it — declare
// the plan with the strict form, without its catalog:
//
//   plan Fulfil:
//
//   → Type error: refinement predicate failed for WellFormedPlan: Fulfil
//     is not well-formed: outcome Delivered of Fulfil is declared but no
//     node produces it; outcome Packed of Pack is neither consumed by a
//     node of Fulfil nor declared as its outcome
//
// See transcripts/01-halt.txt for the captured output.
