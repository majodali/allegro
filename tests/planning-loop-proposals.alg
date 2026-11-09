use units
use planning
use planning_loop

// The planning loop's proposals (B-187, chunk L2;
// docs/plans/planning-loop.md). An order is packed, and nothing in the
// plan gets it delivered within the budget. The catalog is written with
// its own surface form, `catalog NAME:`, holding node blocks as a plan's
// body does. A proposal is one more catalog entry; the plan the author
// wrote never changes. The kernel answers each proposal in planning
// words: the gap closed and the plan solved, or why not.

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
    outcomes: Packed
    estimate: 20 min, 0.5 person-hours

// --- The catalog form --------------------------------------------------------
// `catalog yard:` binds the list of nodes the open plan is completed from,
// the same list `yard = [depot, van]` would hold.
print(yard.length)
// expect: 2
print(yard.map(node_show))
// expect: [Depot (leaf): Shipped -> Sorted, Van (leaf): Sorted -> Delivered]
print(Fulfil.catalog == yard)
// expect: true

// --- The open plan and its answer ----------------------------------------------
// The kernel's answer is stored in the open plan: its state and the
// planning words for it. Here the obligation of chunk L1 is still open.
print(open_state(Fulfil))
// expect: open
print(open_answer(Fulfil))
// expect: nothing in the catalog produces Shipped, which Depot needs
// What a proposal must leave as written: the plan's declared surface.
print(Fulfil.surface)
// expect: plan Fulfil; inputs Order; outcomes Delivered; budget duration 160 min, effort none, money none

// --- Three proposals, each one node block ------------------------------------------
// Written here as a catalog of their own, so each is a node block as a
// proposer would send it; `with_entry` adds one to the open plan's catalog.
catalog proposals:
  Courier:
    inputs: Labelled
    outcomes: Shipped
    estimate: 40 min, 0.25 person-hours
  Freight:
    inputs: Packed
    outcomes: Shipped
    estimate: 90 min, 0.25 person-hours
  Ship:
    inputs: Packed
    outcomes: Shipped
    estimate: 45 min, 0.25 person-hours

// A proposal that does not close the gap: the kernel names the next dead
// end, the new obligation's message.
courier = with_entry(Fulfil, proposals[0])
print(open_state(courier))
// expect: open
print(open_answer(courier))
// expect: nothing in the catalog produces Labelled, which Courier needs

// A proposal that closes the gap and breaks the budget: every gap is
// filled, and no completion fits.
freight = with_entry(Fulfil, proposals[1])
print(open_obligations(freight).length)
// expect: 0
print(open_state(freight))
// expect: unsolved
print(open_answer(freight))
// expect: no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from Van, Sorted from Depot, Shipped from Freight, is duration 200 min against 160 min

// A proposal that closes the gap within the budget: the plan is solved,
// and the solved plan passes the `WellFormedPlan` check.
ship = with_entry(Fulfil, proposals[2])
print(open_state(ship))
// expect: solved
print(open_answer(ship))
// expect: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min
solved: WellFormedPlan = solve_open(ship).plan
print(plan_show(solved))
// expect: plan Fulfil: Order -> Delivered; 4 nodes, 4 leaves, 0 handlers

// The plan as written is unchanged by every proposal.
print([courier, freight, ship].map(op => op.surface == Fulfil.surface))
// expect: [true, true, true]
