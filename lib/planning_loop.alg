// planning_loop.alg — the planning loop's library (B-187, the planning-loop
// stream, chunks L1, L2 and L5).
//
// The loop of docs/plans/planning-loop.md asks a proposer to answer what a
// plan cannot yet do, and has the kernel check the answer. This library
// holds the model side of it, on top of `use planning` (ruling R10 (a):
// `lib/planning.alg` stays as rung 3 left it). Chunk L1 built the first two
// of these four things, chunk L2 the third, chunk L5 the fourth:
//
//   - the PLAN OBLIGATION (ruling R1 (a)): a gap that completion from the
//     plan's catalog cannot fill, at the dead end. It is built from the
//     records `completions` already answers (`Completion`, `Gap`), with no
//     new search, and rendered in planning vocabulary;
//   - the OPEN PLAN (ruling R9 (a)): the statement form `plan NAME from
//     CATALOG:`, which binds a plan and its catalog without the
//     `WellFormedPlan` annotation, so a plan with a gap does not halt the
//     file. The plan is checked by `WellFormedPlan` once a catalog entry
//     closes it (chunk L2);
//   - the CATALOG's surface form, `catalog NAME:` (ruling R2 (a)), and the
//     kernel's answer to a catalog entry, stored in the open plan;
//   - the LEDGER RECORD (ruling R4 (a)): what a plan, a solution or a
//     solved open plan rests on (its fixtures, each an admitted promise),
//     its well-formedness check, and the catalog entries a solution uses.
//
// The prover protocol (`src/pcp.ts`) reads the obligations and the answer
// an open plan carries, and the ledger records `plan_ledger` answers; it
// computes nothing about plans itself.
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

// The plan's declared surface, the first part of the identity: what the
// author wrote and a proposal must leave as it is (chunk L2 compares it).
plan_surface(p) =>
  "plan {p.name}; inputs {ports_show(p.inputs)}; outcomes {ports_show(p.outcomes)}; {budget_show(p.budget)}"

plan_identity(p, g) => "{plan_surface(p)}; gap {port_show(g.port)} by {g.by}"

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
//
// Chunk L2 adds the kernel's answer, also computed when the open plan is
// built and stored, so the protocol reads it as data:
//
//   - `surface`: `plan_surface` of the plan, which the protocol hashes
//     with the obligation's gap to refuse a proposal that edits the plan;
//   - `state`: "open" while an obligation remains, "unsolved" when every
//     gap closes but no completion solves (a budget missed, or a finding
//     the completed plan fails), "solved" when one does;
//   - `answer`: the planning words for that state: the first obligation's
//     message (the next dead end), the counterexample `solve_from`
//     answers, or the solution as `solution_show` renders it.

OpenPlan = Type.define({ plan: Any, catalog: Array, obligations: Array, surface: String, state: String, answer: String })

open_plan(p, cat) =>
  obs = plan_obligations(p, cat)
  a = open_answer_of(p, cat, obs)
  OpenPlan(p, cat, obs, plan_surface(p), a.state, a.answer)

open_answer_of(p, cat, obs) =>
  if obs.length > 0
    then {state: "open", answer: obs[0].message}
    else solved_answer(p, cat)

// The completed plan must pass what the `WellFormedPlan` annotation checks
// (`plan_errors`, the predicate of `well_formed`), so "solved" never names
// a plan the annotation would refuse.
solved_answer(p, cat) =>
  s = solve_from(p, cat)
  if s instanceof Error
    then {state: "unsolved", answer: error of s}
    else solution_answer(s, plan_errors(s.plan))

solution_answer(s, errs) =>
  if errs.length == 0
    then {state: "solved", answer: solution_show(s)}
    else {state: "unsolved", answer: "{s.plan.name} is not well-formed: {join(errs, "; ")}"}

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

// The kernel's answer, as the open plan stores it.
open_state(op) => op.state
open_answer(op) => op.answer

// --- The ledger record (chunk L5, ruling R4 (a)) -------------------------------------
//
// What a plan value bound at the top level rests on, for the verdict's
// assumption ledger and for `inspect`. The protocol calls `plan_ledger`
// only when `verify` or `inspect` asks (`src/index.ts`), so a run of the
// file never pays for it. Three kinds of value answer a record:
//
//   - a PLAN (the `plan NAME:` form, or one built through the API): its
//     well-formedness is `plan_errors` (the `WellFormedPlan` predicate's
//     findings) with none. A `plan NAME:` binding is annotated
//     `WellFormedPlan`, so one with a finding has already halted; a plan
//     built without the annotation can carry findings, and its record
//     says the file does not claim it well-formed;
//   - a SOLUTION: its plan checked the same way, and the record adds the
//     bound, the decisions and the catalog entries the solution used;
//   - an OPEN PLAN whose state is "solved": as its solution.
//
// Each fixture on any port of the value (declared inputs and outcomes, the
// nodes' ports at every depth, options, handlers and borrowed plans) is a
// PROMISE: in Shape 1 no value exists to check it against (chapter §7), so
// its tier is admitted, never discharged. Whether a predicate is the
// trivial `v => true` cannot be told without reading its code, which the
// language does not offer, so every fixture is reported the same way.
//
// A catalog entry's author is "the file" unless the caller names one: the
// protocol passes the authors the loop recorded (`authors`, a list of
// `{node, author}` records), since an accepted proposal is spliced into
// the file and the file alone cannot say who wrote it.

PlanEntryUse = Type.define({ node: String, port: String, author: String, message: String })

PlanLedger = Type.define({
  binding: String,
  kind: String,
  plan: String,
  well_formed: String,
  well_formed_message: String,
  promises: Array,
  bound: String,
  decisions: String,
  entries: Array,
  line: String,
  lines: Array
})

// Every port of a plan, level by level: the declared inputs and outcomes,
// then each node's ports and a borrowed plan's declared ports, then the
// next level, which is the nodes' inner nodes, options and handlers' nodes
// and a borrowed plan's nodes and handlers' nodes.
//
// The walk is a fold over a list of levels, not a recursion, and the list
// is the caller's (`walk_levels`, 32 levels): three engine findings of
// chunk L5 (plan §7) rule out the other forms here. A binding on a
// recursion cycle in this library, beside the functions that call
// `check_plan`, keeps the library's precompile from finishing (a program
// holding `cnt(n) => if n == 0 then 0 else cnt(n - 1)` and
// `f(p) => check_plan(p)` does not finish in 60 s). A function handed to
// itself and called from a lambda in its body exhausts the host's stack
// three levels down. And a fold over a list the library itself names is
// unrolled by the precompile, which then does not finish either; a list
// the caller passes is not known to the precompile, so the fold stays a
// fold. A plan nested deeper than the levels reach says so in its record,
// so a promise below them is never dropped in silence.
handler_nodes(hs) => hs.reduce((acc, h) => acc.concat(h.nodes), [])

borrowed_ports(n) => if is_uses(n) then n.graph.inputs.concat(n.graph.outcomes) else []

borrowed_nodes(n) => if is_uses(n) then n.graph.nodes.concat(handler_nodes(n.graph.handlers)) else []

node_children(n) => n.nodes.concat(n.options).concat(handler_nodes(n.handlers)).concat(borrowed_nodes(n))

walk_step(st) =>
  {ports: st.frontier.reduce((acc, n) => acc.concat(n.inputs).concat(n.outcomes).concat(borrowed_ports(n)), st.ports),
   frontier: st.frontier.reduce((acc, n) => acc.concat(node_children(n)), [])}

walk_eight = [0, 0, 0, 0, 0, 0, 0, 0]
walk_levels = walk_eight.concat(walk_eight).concat(walk_eight).concat(walk_eight)

plan_walk(p, levels) =>
  start = {ports: p.inputs.concat(p.outcomes), frontier: p.nodes.concat(handler_nodes(p.handlers))}
  levels.reduce((st, level) => walk_step(st), start)

// The fixtures' names, first occurrence first.
walk_promises(w) => dedupe(w.ports.filter(port_constrained).map(q => q.fixture.name))

plan_promises(p, levels) => walk_promises(plan_walk(p, levels))

promises_show(ps) =>
  if ps.length == 0
    then "no promises"
    else "{ps.length} admitted {if ps.length == 1 then "promise" else "promises"}: {join(ps, ", ")}"

// The promises, and a note when the plan nests deeper than the walk went.
rests_on_show(w, levels) =>
  if w.frontier.length == 0
    then promises_show(walk_promises(w))
    else "{promises_show(walk_promises(w))}, and the nodes below level {levels.length} not walked"

author_of(authors, name) =>
  found = authors.filter(a => a.node == name)
  if found.length == 0 then "the file" else found[0].author

entry_use(added, authors, name) =>
  step = added.filter(a => a.node == name)[0]
  author = author_of(authors, name)
  PlanEntryUse(name, step.gap.port.type, author, "{name} for {step.gap.port.type}, by {author}")

entries_used(s, authors) =>
  dedupe(s.added.map(a => a.node)).map(n => entry_use(s.added, authors, n))

entries_show(es) =>
  if es.length == 0 then "none" else join(es.map(e => e.message), "; ")

bound_line(b) =>
  "effort {measure_show(b.effort)}, duration {measure_show(b.duration)}, money {measure_show(b.money)}"

decisions_line(ds) => if ds.length == 0 then "no choices" else decisions_show(ds)

well_formed_line(state, msg) =>
  if state == "discharged" then "discharged (no findings)" else msg

// A plan's record. `errs` are `plan_errors` of the plan.
plan_record(name, p, errs, levels) =>
  w = plan_walk(p, levels)
  rests = rests_on_show(w, levels)
  state = if errs.length == 0 then "discharged" else "unclaimed"
  msg = if errs.length == 0
    then "well-formed"
    else "not claimed well-formed (bound without the `plan` form's check): {errs[0]}"
  PlanLedger(name, "plan", p.name, state, msg, walk_promises(w), "", "", [],
    "{name}: plan {p.name}, {msg}; rests on {rests}",
    ["well-formed: {well_formed_line(state, msg)}", "rests on: {rests}"])

kind_show(kind, plan_name) =>
  if kind == "solution" then "solution of {plan_name}" else "open plan {plan_name}, solved"

// A solution's record; `kind` is "solution" or "open plan".
solution_record(name, kind, s, authors, levels) =>
  errs = plan_errors(s.plan)
  w = plan_walk(s.plan, levels)
  rests = rests_on_show(w, levels)
  state = if errs.length == 0 then "discharged" else "unclaimed"
  msg = if errs.length == 0 then "well-formed" else "not well-formed: {errs[0]}"
  es = entries_used(s, authors)
  b = bound_line(s.bound)
  d = decisions_line(s.decisions)
  PlanLedger(name, kind, s.plan.name, state, msg, walk_promises(w), b, d, es,
    "{name}: {kind_show(kind, s.plan.name)}, {msg}; bound {b}; decisions {d}; catalog entries {entries_show(es)}; rests on {rests}",
    ["well-formed: {well_formed_line(state, msg)}", "bound: {b}", "decisions: {d}",
     "catalog entries: {entries_show(es)}", "rests on: {rests}"])

// The query: a record for a plan, a solution or a solved open plan, and
// `none` for anything else (an open plan not yet solved is the plan
// obligation's, which the verdict's `plans:` line already reports).
// `levels` is `walk_levels`, passed by the caller (see the walk above).
plan_ledger(name, x, authors, levels) =>
  if x instanceof Solution
    then solution_record(name, "solution", x, authors, levels)
    else if x instanceof OpenPlan
      then (if x.state == "solved" then solution_record(name, "open plan", solve_open(x), authors, levels) else none)
      else if x instanceof Plan then plan_record(name, x, plan_errors(x), levels) else none

// --- The surface: `catalog NAME:` and `plan NAME from CATALOG:` ---------------------
//
// `catalog NAME:` (R2 (a), the pilot's D3 row "a surface form for
// catalogs", chunk L2) is a statement form in the register of `plan`: an
// indented block of node blocks, each written as in a plan's body, bound
// to `NAME` as the list of nodes `plan NAME from CATALOG:` expects. A node
// block is a leaf or a composite (`Name:` and its items), a choice (a node
// with `options:`) or a borrowed plan (`Name: uses target`); the entries
// are parsed by the two node alternatives of `planning_grammar`'s
// `node_item`, rewritten here so that only node blocks parse: an `inputs:`
// or `budget:` line directly under `catalog` is a parse error, not an
// item silently dropped. A list expression of nodes (`yard = [depot, van]`)
// is a catalog too; the form is the readable spelling of the same list.
//
// `plan NAME from CATALOG:` takes the `plan` form's body items
// (`node_items`), with `from` and the catalog's binding after the name.
// The expansion is `binding_decl` without the type, so the binding is not
// annotated with `WellFormedPlan` and a gap does not halt compilation.
planning_loop_grammar = grammar {
  rule cname = txt:/[a-z_][A-Za-z0-9_]*/ => txt => txt
  rule cat_node = un:pname hws ":" hws "uses" hws target:expr => (un, target) => uses(un, target)
  rule cat_node += nn:pname hws ":" hws INDENT nitems:node_items DEDENT => (nn, nitems) => build_node(nn, nitems)
  rule cat_nodes = n:cat_node hws NEWLINE rest:cat_nodes => (n, rest) => [n].concat(rest)
  rule cat_nodes += n:cat_node => n => [n]

  stmt_form "catalog" hws cn:cname hws ":" hws INDENT ns:cat_nodes DEDENT
    => (cn, ns) => binding_decl(cn, ns)

  stmt_form "plan" hws pn:pname hws "from" hws cn:ident hws ":" hws INDENT pitems:node_items DEDENT
    => (pn, cn, pitems) => binding_decl(pn, open_plan(build_plan(pn, pitems), cn))
}
