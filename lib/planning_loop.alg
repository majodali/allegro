// planning_loop.alg — the planning loop's library (B-187, the planning-loop
// stream, chunk L1).
//
// The loop of docs/plans/planning-loop.md asks a proposer to answer what a
// plan cannot yet do, and has the kernel check the answer. This library
// holds the model side of it, on top of `use planning` (ruling R10 (a):
// `lib/planning.alg` stays as rung 3 left it). Chunk L1 builds two things:
//
//   - the PLAN OBLIGATION (ruling R1 (a)): a gap that completion from the
//     plan's catalog cannot fill, at the dead end. It is built from the
//     records `completions` already answers (`Completion`, `Gap`), with no
//     new search, and rendered in planning vocabulary;
//   - the OPEN PLAN (ruling R9 (a)): the statement form `plan NAME from
//     CATALOG:`, which binds a plan and its catalog without the
//     `WellFormedPlan` annotation, so a plan with a gap does not halt the
//     file. The plan is checked by `WellFormedPlan` once a catalog entry
//     closes it (chunk L2).
//
// The prover protocol (`src/pcp.ts`) reads the obligations an open plan
// carries; it computes nothing about plans itself.
use units
use planning

// --- Plan obligations ----------------------------------------------------------
//
// One obligation per DISTINCT gap across the dead ends of a plan that no
// completion closes: two dead ends that stop at the same port for the same
// consumer ask the proposer the same question, and one answer (a catalog
// entry producing the port) serves both. The first dead end's steps are the
// witness: how the search reached the gap.
//
// `stop` says which of the two stops happened, derived here from the
// catalog: "catalog" when no catalog node the plan does not already hold
// produces the port (a deeper search cannot help), "depth" when one does
// and the search ran out of steps first. (`dead_end_message` in
// `lib/planning.alg` says "within N steps" in some catalog cases too; its
// fix waits for the load baseline, plan §7.)
//
// `identity` is the text the protocol hashes: the plan's name, declared
// inputs, outcomes and budget, and the gap. A proposal that edits the plan
// instead of answering the obligation changes it; a catalog entry that
// does not touch the gap does not.

PlanObligation = Type.define({
  plan: String,
  port: String,
  fixture: String,
  by: String,
  stop: String,
  depth: Int,
  steps: Array,
  identity: String,
  gap: String,
  message: String
})

gap_key(g) => "{g.port.type}|{fixture_name(g.port)}|{g.by}"

stop_of(p, cat, g) =>
  if fillers(catalog(cat), p, g).length == 0 then "catalog" else "depth"

step_line(a) => "{a.gap.port.type} from {a.node}"

plan_identity(p, g) =>
  "plan {p.name}; inputs {ports_show(p.inputs)}; outcomes {ports_show(p.outcomes)}; {budget_show(p.budget)}; gap {port_show(g.port)} by {g.by}"

// The renderings below read the fields by name, so the record carries its
// own: built once from a plain record of the same fields, then stored, so
// that the protocol reads the planning words as data.
obligation_of(p, cat, depth, d) =>
  facts = {port: d.gap.port.type, fixture: fixture_name(d.gap.port), by: d.gap.by, stop: stop_of(d.plan, cat, d.gap), depth: depth}
  PlanObligation(p.name, facts.port, facts.fixture, facts.by, facts.stop, depth,
    d.steps.map(step_line), plan_identity(p, d.gap), obligation_gap_show(facts), obligation_show(facts))

// The dead ends, first of each distinct gap, in search order.
distinct_dead_ends(cs) =>
  cs.reduce((acc, c) =>
    if contains(acc.map(d => gap_key(d.gap)), gap_key(c.gap)) then acc else acc.concat([c]),
    [])

// No obligation when some completion closes every gap: what is left then
// (a budget, a finding of the completed plan) is not a gap (R1 (a)).
// At the default depth (the catalog's size, as `completions` takes it)
// the stop is always "catalog": each step adds a node the plan did not
// hold, so a search that used every step holds every entry. A caller who
// bounds the depth can meet the other stop.
plan_obligations_within(p, cat, depth) =>
  cs = completions_within(p, cat, depth)
  if cs.filter(is_complete).length > 0
    then []
    else distinct_dead_ends(cs).map(d => obligation_of(p, cat, depth, d))

plan_obligations(p, cat) => plan_obligations_within(p, cat, cat.length)

// --- Renderings ------------------------------------------------------------------

obligation_port_show(o) =>
  if o.fixture == "" then o.port else "{o.port} [{o.fixture}]"

// "Shipped, which Depot needs": the gap, as the proposer reads it.
obligation_gap_show(o) =>
  if o.by == ""
    then "{obligation_port_show(o)}, which the plan declares"
    else "{obligation_port_show(o)}, which {o.by} needs"

// The obligation with its stop: which of the two it is.
obligation_show(o) =>
  if o.stop == "catalog"
    then "nothing in the catalog produces {obligation_gap_show(o)}"
    else "no completion within {o.depth} {if o.depth == 1 then "step" else "steps"}: the search stopped at {obligation_gap_show(o)}"

obligation_steps_show(o) => join(o.steps, ", ")

// --- The open plan (R9 (a)) --------------------------------------------------------
//
// A plan the file declares open, with the catalog it is to be completed
// from. The obligations are computed when the open plan is built, so the
// protocol reads them as data. `catalog` is the list as the file wrote it
// (`solve_from` takes it so); the catalog's binding name is not in the
// record: the statement form receives the catalog's value from its `ident`
// capture, and the engine hands a label its value or its matched text, not
// both (chapter §2.8). The protocol names the binding (`src/pcp.ts`).

OpenPlan = Type.define({ plan: Any, catalog: Array, obligations: Array })

open_plan(p, cat) => OpenPlan(p, cat, plan_obligations(p, cat))

// The library's queries over an open plan.
open_obligations(op) => op.obligations
open_findings(op) => check_plan(op.plan)
open_obligations_show(op) => op.obligations.map(obligation_show)

// A catalog entry added by hand (chunk L2 splices a proposer's the same
// way): the plan as written, one more entry in its catalog.
with_entry(op, n) => open_plan(op.plan, op.catalog.concat([n]))

// The open plan solved from its catalog: a `Solution`, or the error value
// `solve_from` answers.
solve_open(op) => solve_from(op.plan, op.catalog)

// --- The surface: `plan NAME from CATALOG:` ---------------------------------------
//
// The `plan` form's body items (`node_items`, from `planning_grammar`),
// with `from` and the catalog's binding after the name. The expansion is
// `binding_decl` without the type, so the binding is not annotated with
// `WellFormedPlan` and a gap does not halt compilation.
planning_loop_grammar = grammar {
  stmt_form "plan" hws pn:pname hws "from" hws cn:ident hws ":" hws INDENT pitems:node_items DEDENT
    => (pn, cn, pitems) => binding_decl(pn, open_plan(build_plan(pn, pitems), cn))
}
