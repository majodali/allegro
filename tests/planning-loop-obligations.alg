use units
use planning
use planning_loop

// The planning loop's obligation surface (B-187, chunk L1;
// docs/plans/planning-loop.md). An order is packed, and nothing in the
// plan gets it delivered. The plan is declared OPEN, with the catalog it
// is to be completed from: `plan NAME from CATALOG:` binds the plan
// without the `WellFormedPlan` annotation, so the gap does not halt the
// file. What completion from the catalog cannot fill is the plan's
// obligation, named in planning words.

depot = with_estimate(leaf("Depot", [port("Shipped")], [port("Sorted")]), est(30 min, person_hours(0.25), none))
van   = with_estimate(leaf("Van", [port("Sorted")], [port("Delivered")]), est(60 min, person_hours(0.5), none))
yard  = [depot, van]

plan Fulfil from yard:
  inputs: Order
  outcomes: Delivered
  Pack:
    inputs: Order
    outcomes: Packed
    estimate: 20 min, 0.5 person-hours

// --- The open plan ------------------------------------------------------------
print(Fulfil instanceof OpenPlan)
// expect: true
print(plan_show(Fulfil.plan))
// expect: plan Fulfil: Order -> Delivered; 1 nodes, 1 leaves, 0 handlers
print(Fulfil.catalog.length)
// expect: 2

// The checks still run: their findings are reachable through the library.
print(open_findings(Fulfil).map(f => f.message))
// expect: [outcome Delivered of Fulfil is declared but no node produces it, outcome Packed of Pack is neither consumed by a node of Fulfil nor declared as its outcome]

// --- The obligation -----------------------------------------------------------
// The catalog fills Delivered (Van), then Sorted (Depot), and stops at
// Shipped: nothing in it produces a shipment.
print(open_obligations(Fulfil).length)
// expect: 1
o = open_obligations(Fulfil)[0]
print(obligation_gap_show(o))
// expect: Shipped, which Depot needs
print(obligation_show(o))
// expect: nothing in the catalog produces Shipped, which Depot needs
print(obligation_steps_show(o))
// expect: Delivered from Van, Sorted from Depot
print("{o.plan} {o.port} {o.stop} {o.depth}")
// expect: Fulfil Shipped catalog 2
print(o.identity)
// expect: plan Fulfil; inputs Order; outcomes Delivered; no budget; gap Shipped by Depot
// The record carries its own renderings, so the protocol reads them as data.
print(o.gap == obligation_gap_show(o) && o.message == obligation_show(o))
// expect: true

// The depth is the other stop: with one step allowed, the search fills
// Delivered and stops at Sorted, though the catalog holds its producer.
ship = with_estimate(leaf("Ship", [port("Packed")], [port("Shipped")]), est(45 min, person_hours(0.25), none))
shallow = plan_obligations_within(Fulfil.plan, [van, depot, ship], 1)
print(shallow.map(obligation_show))
// expect: [no completion within 1 step: the search stopped at Sorted, which Van needs]
print(shallow[0].stop)
// expect: depth

// --- Closed by hand -----------------------------------------------------------
// A hand-written catalog entry answers the obligation (chunk L2 splices a
// proposer's the same way): the plan is solved from the larger catalog,
// and the solved plan passes the `WellFormedPlan` check.
closed = with_entry(Fulfil, ship)
print(open_obligations(closed).length)
// expect: 0
print(solution_show(solve_open(closed)))
// expect: Delivered from Van, Sorted from Depot, Shipped from Ship; bound effort 1.5 person-hours, duration 155 min
solved: WellFormedPlan = solve_open(closed).plan
print(plan_show(solved))
// expect: plan Fulfil: Order -> Delivered; 4 nodes, 4 leaves, 0 handlers

// The `plan NAME:` form is unchanged beside the open one: a plan written
// without `from` is still declared a WellFormedPlan.
plan Courier:
  inputs: Packed
  outcomes: Delivered
  Drive:
    inputs: Packed
    outcomes: Delivered
print(plan_show(Courier))
// expect: plan Courier: Packed -> Delivered; 1 nodes, 1 leaves, 0 handlers
