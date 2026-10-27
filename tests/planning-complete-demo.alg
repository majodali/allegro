// Allegro Standard — the planning DSL, completion from a catalog (B-151 stage D2)
// The second search. A gap is what the checks already name: an input
// nothing produces, or a declared outcome no node produces. A catalog is
// a list of nodes the plan may draw on. `solve_from` fills each gap with
// a catalog node that produces the missing port, chained backward when
// that node needs something too, then resolves the choices as `solve`
// does: the completed plan is a plan like any other, checked by the same
// checks, ranked by the same objective, and refused with a counterexample
// that names the dead end or the cheapest completion and why it fails.
use units
use planning

// --- An order to fulfil, with its last step missing ---------------------------
pack = with_estimate(leaf("Pack", [port("Order")], [port("Packed")]), est(20 min, person_hours(0.5), none))

fulfil = plan("Fulfil", [port("Order")], [port("Delivered")], [pack])

print(gaps_show(fulfil))
// expect: [Delivered, which the plan declares]

// As written, the plan is not well-formed: the gap, and the packing that
// nothing takes. The completion settles both.
print(plan_errors(fulfil))
// expect: [outcome Delivered of Fulfil is declared but no node produces it, outcome Packed of Pack is neither consumed by a node of Fulfil nor declared as its outcome]

// --- The catalog: leaves, a choice, and a whole plan --------------------------
// Shipping needs a label, which can be printed or written by hand; the
// last mile is a plan of its own, borrowed as `uses` borrows.
label = choice("Label", [
  with_estimate(leaf("PrintLabel", [port("Packed")], [port("Labelled")]), est(5 min, person_hours(0.25), none)),
  with_estimate(leaf("HandLabel", [port("Packed")], [port("Labelled")]), est(10 min, person_hours(0.5), none))])

ship = with_estimate(leaf("Ship", [port("Packed"), port("Labelled")], [port("Shipped")]), est(120 min, person_hours(0.25), none))

last_mile = plan("LastMile", [port("Shipped")], [port("Delivered")], [
  with_estimate(leaf("Depot", [port("Shipped")], [port("Sorted")]), est(30 min, person_hours(0.25), none)),
  with_estimate(leaf("Van", [port("Sorted")], [port("Delivered")]), est(60 min, person_hours(0.5), none))])

courier = with_estimate(leaf("Courier", [port("Packed")], [port("Delivered")]), est(180 min, person_hours(1.5), none))

parts = [label, ship, last_mile, courier]

// Two ways to close the gap: the courier in one step, or ship and deliver
// in three, the third opening the label choice.
print(completions(fulfil, parts).filter(is_complete).length)
// expect: 2

print(completions(fulfil, parts).filter(is_complete).map(c => steps_show(c.steps)))
// expect: [Delivered from LastMile, Shipped from Ship, Labelled from Label, Delivered from Courier]

// --- Solving: complete, then resolve ------------------------------------------
// The objective is the bound's effort, then its duration: the longer chain
// with a printed label is the cheaper in effort.
best = solve_from(fulfil, parts)
print(solution_show(best))
// expect: Delivered from LastMile, Shipped from Ship, Labelled from Label; Label via PrintLabel; bound effort 1.75 person-hours, duration 235 min

print(plan_show(best.plan))
// expect: plan Fulfil: Order -> Delivered; 4 nodes, 3 leaves, 0 handlers

print(node_names(best.plan))
// expect: [Pack, LastMile, Ship, Label]

print(node_kind(find_node(best.plan, "LastMile")))
// expect: uses

print(best.plan instanceof WellFormedPlan)
// expect: true

print(complete(fulfil, parts) == best.plan)
// expect: true

// A deadline changes the answer: the chain is too slow, so the search
// takes the courier and pays its effort.
print(solution_show(solve_from(with_budget(fulfil, budget(220 min, none, none)), parts)))
// expect: Delivered from Courier; bound effort 2 person-hours, duration 200 min

// --- Refused: a dead end ------------------------------------------------------
// Nothing in the catalog produces the outcome.
print(error of solve_from(fulfil, [ship, label]))
// expect: no completion of Fulfil from the catalog: nothing produces Delivered, which the plan declares

// The chain dead-ends: the last mile needs a shipment nothing produces.
print(error of solve_from(fulfil, [last_mile, label]))
// expect: no completion of Fulfil from the catalog: nothing produces Shipped, which LastMile needs

// The depth runs out before the chain closes.
print(error of solve_from_within(fulfil, [label, ship, last_mile], 2))
// expect: no completion of Fulfil from the catalog within 2 steps: nothing produces Labelled, which Ship needs

// --- Refused: no completion fits ----------------------------------------------
// The counterexample names the cheapest completion and the measure it misses.
print(error of solve_from(with_budget(fulfil, effort_budget(person_hours(1.5))), parts))
// expect: no completion of Fulfil from the catalog fits the budget of Fulfil; the cheapest, Delivered from LastMile, Shipped from Ship, Labelled from Label; Label via PrintLabel, is effort 1.75 person-hours against 1.5 person-hours

// A completion is checked as any plan is: a catalog node whose extra
// outcome nothing consumes is refused by the outcome check.
noisy = with_estimate(leaf("Courier", [port("Packed")], [port("Delivered"), port("Receipt")]), est(180 min, person_hours(1.5), none))
print(error of solve_from(fulfil, [noisy]))
// expect: no completion of Fulfil from the catalog is well-formed for Fulfil; the cheapest, Delivered from Courier, fails: outcome Receipt of Courier is neither consumed by a node of Fulfil nor declared as its outcome

// --- A gap on the input side ------------------------------------------------
// A node whose input nothing produces is a gap too, and the catalog fills
// it the same way: here the plan has the shipping but not the packing.
shipping = plan("Shipping", [port("Order"), port("Labelled")], [port("Shipped")], [ship])
print(gaps_show(shipping))
// expect: [Packed, which Ship needs]

print(solution_show(solve_from(shipping, [pack, courier])))
// expect: Packed from Pack; bound effort 0.75 person-hours, duration 140 min

// A plan with no gaps and no choices is its own completion.
print(solution_show(solve_from(best.plan, parts)))
// expect: ; bound effort 1.75 person-hours, duration 235 min
