// planning.alg — the planning DSL, library core (B-151 stage A1).
//
// The first Vivace pilot: a plan is a graph of OUTCOMES, not a list of
// tasks. Design truth: docs/book/vivace/planning-dsl.md (the model §2, the
// conventions §3, the checks §7); work plan: docs/plans/planning-pilot.md.
//
// Stage A1 is the primitive version: the types as plain records, the
// constructors a plan is built through, the queries and the one-line
// renderings a demo pins. Stage A2 adds wiring derivation and the graph
// checks (§7). Stage A3 types the measures (duration from the units DSL,
// planning-local effort and money), rolls estimates up with retry upper
// bounds and checks budgets. No surface syntax (stage B). Everything here
// is ordinary Allegro, loaded with `use planning`.
//
// Every walk over the node tree is `assume terminates`: a plan is a finite
// tree, but no `decreases` metric the analyzer verifies describes a walk
// into `n.nodes`, and the invariant-totality gate (D32/CE-R7) refuses a
// refinement predicate whose callees may diverge. The admissions are
// recorded in the ledger, as every `assume` is.
use totality
use units

// --- List helpers (Array has map / filter / reduce / concat / slice) ------

contains(xs, v) => xs.reduce((acc, x) => acc || x == v, false)

join(parts, sep) =>
  parts.reduce((acc, s) => if acc == "" then s else acc + sep + s, "")

count_where(xs, pred) => xs.reduce((acc, x) => if pred(x) then acc + 1 else acc, 0)

// --- Ports: an input or an outcome is a TYPE name plus an optional fixture --
//
// Convention 5: wiring is by type, so a port carries the type's name. The
// optional fixture is convention 11's snake_case predicate: a readable name
// backed by a predicate function, e.g. `fixture("valid_semver", v => ...)`.

Fixture = Type.define({ name: String, holds: Any })

fixture(name, holds) => Fixture(name, holds)

Port = Type.define({ type: String, fixture: Any })

port(t) => Port(t, none)
port_where(t, fx) => Port(t, fx)

port_constrained(p) => when p.fixture is none then false is _ then true

port_show(p) =>
  if port_constrained(p) then "{p.type} [{p.fixture.name}]" else p.type

ports_show(ps) => join(ps.map(port_show), ", ")

// --- Measures (stage A3; rulings R1 and R2) -----------------------------------
//
// A wall-clock duration is the units DSL's `Duration` (R2): `30 min` with
// `use units` in scope, or `qty(30, min)`. Effort (person-hours) and money
// are not SI dimensions, so they are planning-local types (R1), built in
// the manner of the units DSL's `Quantity`: a record with its own
// arithmetic, so that `+` and `*` dispatch to it and a mismatch is an error
// in planning vocabulary rather than a number quietly added to a number.

to_float(v) => when v is n and n instanceof Int then n.toFloat() is n then n

measure_name(v) =>
  when v
    is x and x instanceof Effort then "effort"
    is x and x instanceof Money then "money"
    is x and x instanceof Quantity then "a {dim_name(x.dim)} quantity ({x.toString()})"
    is x and x instanceof Int then "a bare number"
    is x and x instanceof Float then "a bare number"
    is _ then "that value"

effort_add(self, other) =>
  if other instanceof Effort
    then Effort(self.hours + other.hours)
    else error "cannot add {measure_name(other)} to effort: effort is measured in person-hours"

effort_mul(self, k) =>
  when k
    is n and n instanceof Int then Effort(self.hours * n.toFloat())
    is n and n instanceof Float then Effort(self.hours * n)
    is _ then error "effort can only be scaled by a number"

effort_lt(self, other) =>
  if other instanceof Effort then self.hours < other.hours
  else error "cannot compare effort with {measure_name(other)}"

effort_gt(self, other) =>
  if other instanceof Effort then self.hours > other.hours
  else error "cannot compare effort with {measure_name(other)}"

effort_show(self) => "{self.hours} person-hours"

Effort = Type.define({
  hours: Float,
  add: effort_add,
  mul: effort_mul,
  lt: effort_lt,
  gt: effort_gt,
  toString: effort_show
})

person_hours(n) => Effort(to_float(n))

money_add(self, other) =>
  if !(other instanceof Money)
    then error "cannot add {measure_name(other)} to money"
    else if self.currency == other.currency
      then Money(self.amount + other.amount, self.currency)
      else error "cannot add {other.currency} to {self.currency}: one currency per plan"

money_mul(self, k) =>
  when k
    is n and n instanceof Int then Money(self.amount * n.toFloat(), self.currency)
    is n and n instanceof Float then Money(self.amount * n, self.currency)
    is _ then error "money can only be scaled by a number"

money_lt(self, other) =>
  if other instanceof Money && other.currency == self.currency then self.amount < other.amount
  else error "cannot compare {self.currency} with {measure_name(other)}"

money_gt(self, other) =>
  if other instanceof Money && other.currency == self.currency then self.amount > other.amount
  else error "cannot compare {self.currency} with {measure_name(other)}"

money_show(self) => "{self.amount} {self.currency}"

Money = Type.define({
  amount: Float,
  currency: String,
  add: money_add,
  mul: money_mul,
  lt: money_lt,
  gt: money_gt,
  toString: money_show
})

money(n, currency) => Money(to_float(n), currency)

// Each measure of an estimate or a budget is optional (`none`); a present
// one must be of its type. `est(30 m, …)` (metres) is refused in the units
// DSL's own vocabulary: the dimensional error the rung-2 bridge exists for.
as_duration(d) =>
  when d
    is none then d
    is x and x instanceof Duration then d
    is _ then error "a duration is a time quantity such as 30 min, not {measure_name(d)}"

as_effort(e) =>
  when e
    is none then e
    is x and x instanceof Effort then e
    is _ then error "effort is measured in person-hours (person_hours(n)), not {measure_name(e)}"

as_money(m) =>
  when m
    is none then m
    is x and x instanceof Money then m
    is _ then error "money is built with money(n, currency), not {measure_name(m)}"

measure_show(v) => when v is none then "none" is _ then v.toString()

// --- Estimates, budgets and retry -------------------------------------------------
//
// Convention 8: estimates roll up from leaves, budgets are verified at
// composites and at the plan. Convention 12: retry is explicit, and the
// rollup takes estimate × max_attempts as the node's upper bound. An
// estimate and a budget have the same three measures; a measure an
// estimate leaves out contributes nothing to the rollup, and a measure a
// budget leaves out is unconstrained.

Estimate = Type.define({ duration: Any, effort: Any, money: Any })

// (The guarded measures pass through a plain function on their way to the
// constructor: an error value among a CALL's arguments propagates as the
// call's result, while a constructor would store it in the field.)
est(duration, effort, money) => make_estimate(as_duration(duration), as_effort(effort), as_money(money))
make_estimate(d, e, m) => Estimate(d, e, m)

no_estimate = Estimate(none, none, none)

Budget = Type.define({ duration: Any, effort: Any, money: Any })

budget(duration, effort, money) => make_budget(as_duration(duration), as_effort(effort), as_money(money))
make_budget(d, e, m) => Budget(d, e, m)

duration_budget(d) => budget(d, none, none)
effort_budget(e) => budget(none, e, none)
money_budget(m) => budget(none, none, m)

Retry = Type.define({ max_attempts: Int, backoff: Any })

retry(max_attempts) => Retry(max_attempts, none)
retry_backoff(max_attempts, backoff) => Retry(max_attempts, backoff)

// --- Failure handlers (convention 9) -----------------------------------------
//
// An alternate graph, declared inside a composite, that produces the
// composite's outcome when a node beneath it fails with `failure`.

Handler = Type.define({ failure: String, retry: Any, nodes: Array })

handler(failure, nodes) => Handler(failure, none, nodes)
handler_retry(h, r) => Handler(h.failure, r, h.nodes)

// --- Plan nodes (§2.2): a leaf, a composite, or a `uses` reference ------------
//
// One record for all three, told apart by what it carries: a leaf has an
// estimate and instructions and no inner graph; a composite has inner
// nodes; a `uses` node borrows another plan's graph (convention 10).

PlanNode = Type.define({
  name: String,
  inputs: Array,
  outcomes: Array,
  estimate: Any,
  instructions: Any,
  retry: Any,
  nodes: Array,
  handlers: Array,
  graph: Any,
  budget: Any
})

leaf(name, inputs, outcomes) =>
  PlanNode(name, inputs, outcomes, none, none, none, [], [], none, none)

composite(name, inputs, outcomes, nodes) =>
  PlanNode(name, inputs, outcomes, none, none, none, nodes, [], none, none)

// `Build: uses BuildPipeline` — the node's ports are the plan's.
uses(name, p) =>
  PlanNode(name, p.inputs, p.outcomes, none, none, none, [], [], p, none)

// Builders: records are immutable, so each returns a copy with one field set.
with_estimate(n, e) => set_estimate(n, as_estimate(e))
set_estimate(n, e) =>
  PlanNode(n.name, n.inputs, n.outcomes, e, n.instructions, n.retry, n.nodes, n.handlers, n.graph, n.budget)
with_instructions(n, text) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, text, n.retry, n.nodes, n.handlers, n.graph, n.budget)
with_retry(n, r) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, r, n.nodes, n.handlers, n.graph, n.budget)
with_handler(n, h) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, n.retry, n.nodes, n.handlers.concat([h]), n.graph, n.budget)

as_estimate(e) =>
  if e instanceof Estimate then e
  else error "an estimate is built with est(duration, effort, money), not {measure_name(e)}"

as_budget(b) =>
  if b instanceof Budget then b
  else error "a budget is built with budget(duration, effort, money), not {measure_name(b)}"

is_uses(n) => when n.graph is none then false is _ then true
is_composite(n) => n.nodes.length > 0
is_leaf(n) => !is_composite(n) && !is_uses(n)

node_kind(n) =>
  if is_uses(n) then "uses" else if is_composite(n) then "composite" else "leaf"

// --- Plans (§2.1) ---------------------------------------------------------------

Plan = Type.define({
  name: String,
  inputs: Array,
  outcomes: Array,
  nodes: Array,
  budget: Any,
  handlers: Array
})

plan(name, inputs, outcomes, nodes) => Plan(name, inputs, outcomes, nodes, none, [])

// A budget sits on the plan or on a composite (convention 8), so one
// builder serves both.
with_budget(x, b) => set_budget(x, as_budget(b))
set_budget(x, b) =>
  if x instanceof Plan
    then Plan(x.name, x.inputs, x.outcomes, x.nodes, b, x.handlers)
    else PlanNode(x.name, x.inputs, x.outcomes, x.estimate, x.instructions, x.retry, x.nodes, x.handlers, x.graph, b)

plan_with_handler(p, h) => Plan(p.name, p.inputs, p.outcomes, p.nodes, p.budget, p.handlers.concat([h]))

// --- Queries over the graph ----------------------------------------------------
//
// The main graph only: handlers are alternate graphs and are counted by
// their own queries. A `uses` node counts as one node of this plan; the
// borrowed plan's nodes are its own.

node_count_in(nodes) =>
  assume terminates
  nodes.reduce((acc, n) => acc + 1 + node_count_in(n.nodes), 0)

node_count(p) => node_count_in(p.nodes)

leaf_count_in(nodes) =>
  assume terminates
  nodes.reduce((acc, n) => acc + (if is_leaf(n) then 1 else 0) + leaf_count_in(n.nodes), 0)

leaf_count(p) => leaf_count_in(p.nodes)

node_names_in(nodes) =>
  assume terminates
  nodes.reduce((acc, n) => acc.concat([n.name]).concat(node_names_in(n.nodes)), [])

node_names(p) => node_names_in(p.nodes)

find_node_in(nodes, name) =>
  assume terminates
  nodes.reduce((acc, n) =>
    when acc
      is none then (if n.name == name then n else find_node_in(n.nodes, name))
      is _ then acc,
    none)

find_node(p, name) => find_node_in(p.nodes, name)

handler_count(p) =>
  p.handlers.length + p.nodes.reduce((acc, n) => acc + node_handler_count(n), 0)

node_handler_count(n) =>
  assume terminates
  n.handlers.length + n.nodes.reduce((acc, k) => acc + node_handler_count(k), 0)

// --- Wiring (§2.3) and the graph checks (§7) — stage A2 ------------------------
//
// Within a scope (the plan, or a composite), an outcome of type T flows into
// every input of type T among the sibling nodes; the scope's own inputs are
// sources too. Edges are derived from that, never written. A finding names
// the scope, the node and what is wrong, in planning vocabulary. Handlers
// are alternate graphs and are checked at stage A4.

Finding = Type.define({ check: String, scope: String, node: String, message: String })

finding(check, scope, node, message) => Finding(check, scope, node, message)

ports_have(ps, t) => ps.reduce((acc, q) => acc || q.type == t, false)

port_of_type(ps, t) =>
  ps.reduce((acc, q) =>
    when acc
      is none then (if q.type == t then q else none)
      is _ then acc,
    none)

fixture_name(p) => if port_constrained(p) then p.fixture.name else ""

// The producers of input `p` for `consumer` in a scope: "inputs" when the
// scope's own inputs carry the type, then every sibling whose outcomes do.
producers_of(avail, nodes, consumer, p) =>
  from_inputs = if ports_have(avail, p.type) then ["inputs"] else []
  from_nodes = nodes.filter(n => n.name != consumer.name && ports_have(n.outcomes, p.type)).map(n => n.name)
  from_inputs.concat(from_nodes)

// The producing port, for the fixture comparison: the scope input or the
// named sibling's outcome.
producer_port(avail, nodes, producer, t) =>
  if producer == "inputs"
    then port_of_type(avail, t)
    else port_of_type(find_node_in(nodes, producer).outcomes, t)

// 1. Wiring completeness and ambiguity, per input of each node. (A lambda
//    body is one expression, so each per-input judgement is a named
//    function and the folds only concatenate.)
wiring_for(scope, avail, nodes, n, p) =>
  prods = producers_of(avail, nodes, n, p)
  if prods.length == 0
    then [finding("wiring", scope, n.name, "input {p.type} of {n.name} is not produced by any node of {scope} or by its inputs")]
    else if prods.length > 1
      then [finding("wiring", scope, n.name, "input {p.type} of {n.name} is ambiguous: produced by {join(prods, " and ")}")]
      else []

check_wiring(scope, avail, nodes) =>
  nodes.reduce((acc, n) => acc.concat(n.inputs.reduce((a2, p) => a2.concat(wiring_for(scope, avail, nodes, n, p)), [])), [])

// 2. Type compatibility along each wired edge: the names already match;
//    a constrained input needs its producer to carry the same fixture.
provided_as(src) =>
  if port_constrained(src) then "[" + fixture_name(src) + "]" else "unconstrained"

compatibility_for(scope, avail, nodes, n, p) =>
  prods = producers_of(avail, nodes, n, p)
  if prods.length != 1 || !port_constrained(p)
    then []
    else compatibility_with(scope, avail, nodes, n, p, prods[0])

// (`producer` is bound once rather than written twice: a call carrying the
// same indexed subexpression in two arguments, one of them under a field
// read of an array, hits a kernel fault — B-152, reproducer in the item.)
compatibility_with(scope, avail, nodes, n, p, producer) =>
  compatibility_against(scope, n, p, producer, producer_port(avail, nodes, producer, p.type))

compatibility_against(scope, n, p, producer, src) =>
  if fixture_name(src) == fixture_name(p)
    then []
    else [finding("compatibility", scope, n.name, "input {p.type} [{fixture_name(p)}] of {n.name} requires {fixture_name(p)}, but {producer} provides {p.type} {provided_as(src)}")]

check_compatibility(scope, avail, nodes) =>
  nodes.reduce((acc, n) => acc.concat(n.inputs.reduce((a2, p) => a2.concat(compatibility_for(scope, avail, nodes, n, p)), [])), [])

// 3. Acyclicity: derive the edges between nodes, then eliminate nodes with
//    no remaining producer until none can be; what is left is a cycle.
scope_edges(avail, nodes) =>
  nodes.reduce((acc, n) => acc.concat(n.inputs.reduce((a2, p) =>
    a2.concat(producers_of(avail, nodes, n, p).filter(src => src != "inputs").map(src => {from: src, to: n.name})),
    [])), [])

has_incoming(name, edges, remaining) =>
  edges.reduce((acc, e) => acc || (e.to == name && contains(remaining, e.from)), false)

eliminate(remaining, edges) =>
  assume terminates
  ready = remaining.filter(nm => !has_incoming(nm, edges, remaining))
  if ready.length == 0
    then remaining
    else eliminate(remaining.filter(nm => !contains(ready, nm)), edges)

check_acyclic(scope, avail, nodes) =>
  stuck = eliminate(nodes.map(n => n.name), scope_edges(avail, nodes))
  if stuck.length == 0
    then []
    else [finding("acyclicity", scope, "", "cycle through {join(stuck, ", ")} in {scope}")]

// 4. Outcomes: each declared outcome of the scope is produced by exactly
//    one node, and every node outcome is either consumed by a sibling or
//    declared by the scope (convention 6). A fixture on a DECLARED outcome
//    is the scope's promise about what it produces, established when the
//    outcome is produced (Shape 2), not a structural requirement on the
//    producing node: the worked example declares
//    `BuildArtifacts [signed_and_version_stamped]` over a `Sign` node that
//    promises nothing, and that is the convention, not an error.
// (`names_producing` is a named function rather than an inline
// filter-then-map chain for the same reason `declared_with` exists: the
// inline chain bound locally and then indexed as a call argument hits the
// B-152 kernel fault.)
names_producing(nodes, t) => nodes.filter(n => ports_have(n.outcomes, t)).map(n => n.name)

declared_for(scope, nodes, o) =>
  prods = names_producing(nodes, o.type)
  if prods.length == 0
    then [finding("outcomes", scope, "", "outcome {o.type} of {scope} is declared but no node produces it")]
    else if prods.length > 1
      then [finding("outcomes", scope, "", "outcome {o.type} of {scope} is produced by {join(prods, " and ")}; one producer is expected")]
      else []

consumed_in(nodes, n, o) =>
  nodes.reduce((c, m) => c || (m.name != n.name && ports_have(m.inputs, o.type)), false)

dangling_for(scope, nodes, declared, n, o) =>
  if consumed_in(nodes, n, o) || ports_have(declared, o.type)
    then []
    else [finding("outcomes", scope, n.name, "outcome {o.type} of {n.name} is neither consumed by a node of {scope} nor declared as its outcome")]

check_outcomes(scope, avail, nodes, declared) =>
  missing = declared.reduce((acc, o) => acc.concat(declared_for(scope, nodes, o)), [])
  dangling = nodes.reduce((acc, n) => acc.concat(n.outcomes.reduce((a2, o) => a2.concat(dangling_for(scope, nodes, declared, n, o)), [])), [])
  missing.concat(dangling)

// --- The rollup (convention 8) and the budget check (§7) — stage A3 --------------
//
// A leaf contributes its estimate; a composite the rollup of its inner
// graph; a `uses` node the rollup of the borrowed plan. A node with a retry
// policy contributes max_attempts times that (convention 12): the rollup is
// an UPPER BOUND, not an expectation. Durations add serially, so the bound
// assumes no two nodes run at once. Handlers are alternate graphs; what
// they add to the bound is settled with handler validity at stage A4.

measure_add(a, b) =>
  when a
    is none then b
    is _ then (when b is none then a is _ then a + b)

measure_scale(a, k) => when a is none then none is _ then a * k

est_add(a, b) =>
  Estimate(measure_add(a.duration, b.duration), measure_add(a.effort, b.effort), measure_add(a.money, b.money))

est_scale(e, k) =>
  Estimate(measure_scale(e.duration, k), measure_scale(e.effort, k), measure_scale(e.money, k))

attempts(n) => when n.retry is none then 1 is r then r.max_attempts

node_estimate(n) => when n.estimate is none then no_estimate is e then e

// (`own_rollup` was split out of `node_rollup` when a local binding of this
// `if` held a pending call instead of a value — a tail-call sentinel leak
// fixed at stage A3 in the evaluator, pinned in tests/functions.alg. The
// split stays because the node's own contribution is worth a name.)
own_rollup(n) =>
  assume terminates
  if is_uses(n)
    then rollup_of(n.graph.nodes)
    else if is_composite(n)
      then rollup_of(n.nodes)
      else node_estimate(n)

node_rollup(n) =>
  assume terminates
  est_scale(own_rollup(n), attempts(n))

rollup_of(nodes) =>
  assume terminates
  nodes.reduce((acc, n) => est_add(acc, node_rollup(n)), no_estimate)

rollup(p) => rollup_of(p.nodes)

// A budget measure left `none` is unconstrained; a rollup measure that is
// `none` (nothing beneath estimates it) is within any budget.
exceeds(used, limit) => when used is none then false is _ then used.gt(limit)

measure_check(scope, label, used, limit) =>
  when limit
    is none then []
    is _ then (if exceeds(used, limit)
                 then [finding("budget", scope, "", "budget of {scope}: {label} {measure_show(used)} exceeds {measure_show(limit)}")]
                 else [])

budget_findings(scope, r, b) =>
  measure_check(scope, "duration", r.duration, b.duration)
    .concat(measure_check(scope, "effort", r.effort, b.effort))
    .concat(measure_check(scope, "money", r.money, b.money))

check_budget(scope, nodes, bgt) =>
  when bgt is none then [] is b then budget_findings(scope, rollup_of(nodes), b)

// A scope's findings, then each composite's internal graph (convention 6
// applies the same checks inside) and each borrowed plan's own.
check_scope(scope, avail, nodes, declared, bgt) =>
  assume terminates
  own = check_wiring(scope, avail, nodes)
    .concat(check_compatibility(scope, avail, nodes))
    .concat(check_acyclic(scope, avail, nodes))
    .concat(check_outcomes(scope, avail, nodes, declared))
    .concat(check_budget(scope, nodes, bgt))
  nodes.reduce((acc, n) =>
    if is_composite(n)
      then acc.concat(check_scope(n.name, n.inputs, n.nodes, n.outcomes, n.budget))
      else if is_uses(n) then acc.concat(check_plan(n.graph)) else acc,
    own)

check_plan(p) =>
  assume terminates
  check_scope(p.name, p.inputs, p.nodes, p.outcomes, p.budget)

plan_errors(p) => check_plan(p).map(f => f.message)

well_formed(p) => check_plan(p).length == 0

// Construction-path enforcement (chapter §7): the plan, or an error value
// carrying the first finding in planning vocabulary.
validate(p) =>
  errs = plan_errors(p)
  if errs.length == 0 then p else error "{p.name} is not well-formed: {errs[0]}"

// Annotation-path enforcement: a binding or parameter annotated with this
// type halts compilation when the plan is not well-formed.
WellFormedPlan = Plan & well_formed(_)

// --- One-line renderings, for demos and for people ------------------------------

node_show(n) =>
  "{n.name} ({node_kind(n)}): {ports_show(n.inputs)} -> {ports_show(n.outcomes)}"

plan_show(p) =>
  "plan {p.name}: {ports_show(p.inputs)} -> {ports_show(p.outcomes)}; {node_count(p)} nodes, {leaf_count(p)} leaves, {handler_count(p)} handlers"

estimate_show(e) =>
  when e
    is none then "no estimate"
    is _ then "duration {measure_show(e.duration)}, effort {measure_show(e.effort)}, money {measure_show(e.money)}"

budget_show(b) =>
  when b
    is none then "no budget"
    is _ then "budget duration {measure_show(b.duration)}, effort {measure_show(b.effort)}, money {measure_show(b.money)}"
