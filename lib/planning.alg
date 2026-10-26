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
// bounds and checks budgets. Stage A4 declares failures on nodes, computes
// escalation as a graph property, checks handlers as graphs and verifies
// budgets against the bound that includes them. Stage B1 adds the surface,
// `plan NAME:` as an offside-rule grammar fragment at the end of this file.
// Everything here is ordinary Allegro, loaded with `use planning`; `use
// units` alongside it gives the quantity literals the surface reads.
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
  budget: Any,
  fails: Array
})

leaf(name, inputs, outcomes) =>
  PlanNode(name, inputs, outcomes, none, none, none, [], [], none, none, [])

composite(name, inputs, outcomes, nodes) =>
  PlanNode(name, inputs, outcomes, none, none, none, nodes, [], none, none, [])

// `Build: uses BuildPipeline` — the node's ports are the plan's.
uses(name, p) =>
  PlanNode(name, p.inputs, p.outcomes, none, none, none, [], [], p, none, [])

// Builders: records are immutable, so each returns a copy with one field set.
with_estimate(n, e) => set_estimate(n, as_estimate(e))
set_estimate(n, e) =>
  PlanNode(n.name, n.inputs, n.outcomes, e, n.instructions, n.retry, n.nodes, n.handlers, n.graph, n.budget, n.fails)
with_instructions(n, text) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, text, n.retry, n.nodes, n.handlers, n.graph, n.budget, n.fails)
with_retry(n, r) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, r, n.nodes, n.handlers, n.graph, n.budget, n.fails)
with_handler(n, h) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, n.retry, n.nodes, n.handlers.concat([h]), n.graph, n.budget, n.fails)

// A node declares the failure types it can raise (stage A4): the failure
// is part of the leaf's contract, as its estimate is, and a handler is
// checked against what is declared beneath it.
with_failure(n, f) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, n.retry, n.nodes, n.handlers, n.graph, n.budget, n.fails.concat([f]))

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
    else PlanNode(x.name, x.inputs, x.outcomes, x.estimate, x.instructions, x.retry, x.nodes, x.handlers, x.graph, b, x.fails)

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
    else compatibility_against(scope, n, p, prods[0], producer_port(avail, nodes, prods[0], p.type))

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
declared_for(scope, nodes, o) =>
  prods = nodes.filter(n => ports_have(n.outcomes, o.type)).map(n => n.name)
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

// --- Failures, escalation and handler validity (§2.5, §7) — stage A4 ----------
//
// A failure raised by a node propagates to the nearest enclosing scope
// with a handler for its type; a handler is an alternate graph that runs
// in that scope with what the scope had when the failure occurred, and it
// must produce the scope's declared outcomes. Three readings:
//   - what a handler's graph may consume is the scope's inputs plus the
//     outcomes of the nodes upstream of every node that raises its failure
//     type (those had been produced when the failure occurred);
//   - a failure raised inside a handler's graph escalates past that scope
//     (a recovery does not recover itself);
//   - a failure that no scope handles escalates to the plan's caller; that
//     is not a finding, it is a property of the plan (`unhandled_failures`,
//     `escalations`), since a plan may fail by design.

dedupe(xs) => xs.reduce((acc, x) => if contains(acc, x) then acc else acc.concat([x]), [])

intersect(a, b) => a.filter(x => contains(b, x))

handler_names(hs) => hs.map(h => h.failure)

// The failure types a node raises to its scope: a leaf's own less those its
// handlers catch; for a composite, what escapes its inner graph; for a
// borrowed plan, that plan's unhandled failures.
raises_of(n) =>
  assume terminates
  if is_uses(n) then unhandled_failures(n.graph) else escaping(n.fails, n.nodes, n.handlers)

escaping(own, nodes, handlers) =>
  assume terminates
  raised = own.concat(nodes.reduce((acc, n) => acc.concat(raises_of(n)), []))
  caught = handler_names(handlers)
  from_handlers = handlers.reduce((acc, h) => acc.concat(h.nodes.reduce((a2, m) => a2.concat(raises_of(m)), [])), [])
  dedupe(raised.filter(f => !contains(caught, f)).concat(from_handlers))

unhandled_failures(p) =>
  assume terminates
  escaping([], p.nodes, p.handlers)

// Escalation as a graph property: for every declared failure, the scope
// that handles it or the plan's caller. A chain is the enclosing scopes,
// innermost first, each with the failure types it catches.
catcher(chain, f) =>
  chain.reduce((acc, s) =>
    when acc
      is none then (if contains(s.caught, f) then s.scope else none)
      is _ then acc,
    none)

// (The arm binds `handled_in`, not `s`: with `use units` in scope a bare
// `s` in a pattern is the unit second, matched as a literal.)
escalation_line(f, node, chain, root) =>
  when catcher(chain, f)
    is none then "{f} raised by {node} escalates to the caller of {root}"
    is handled_in then "{f} raised by {node} is handled in {handled_in}"

scope_link(name, handlers) => [{scope: name, caught: handler_names(handlers)}]

escalations_in(nodes, chain, root) =>
  assume terminates
  nodes.reduce((acc, n) => acc.concat(escalations_of(n, chain, root)), [])

escalations_of(n, chain, root) =>
  assume terminates
  inner = scope_link(n.name, n.handlers).concat(chain)
  own = n.fails.map(f => escalation_line(f, n.name, inner, root))
  beneath = if is_uses(n)
    then escalations_in(n.graph.nodes, scope_link(n.graph.name, n.graph.handlers).concat(inner), root)
    else escalations_in(n.nodes, inner, root)
  borrowed_recovery = if is_uses(n)
    then n.graph.handlers.reduce((acc, h) => acc.concat(escalations_in(h.nodes, inner, root)), [])
    else []
  recovery = n.handlers.reduce((acc, h) => acc.concat(escalations_in(h.nodes, chain, root)), [])
  own.concat(beneath).concat(borrowed_recovery).concat(recovery)

escalations(p) =>
  assume terminates
  link = scope_link(p.name, p.handlers)
  escalations_in(p.nodes, link, p.name)
    .concat(p.handlers.reduce((acc, h) => acc.concat(escalations_in(h.nodes, [], p.name)), []))

// The nodes of a scope that raise `f`, and what had been produced when one
// of them failed: the outcomes of the nodes upstream of every raiser.
raisers(nodes, f) => nodes.filter(n => contains(raises_of(n), f)).map(n => n.name)

grow(set, edges) =>
  assume terminates
  more = dedupe(edges.filter(e => contains(set, e.to) && !contains(set, e.from)).map(e => e.from))
  if more.length == 0 then set else grow(set.concat(more), edges)

upstream_of(name, edges) => grow([name], edges).filter(x => x != name)

common_upstream(rs, edges) =>
  if rs.length == 0
    then []
    else rs.slice(1).reduce((acc, r) => intersect(acc, upstream_of(r, edges)), upstream_of(rs[0], edges))

outcomes_of_named(nodes, names) =>
  nodes.filter(n => contains(names, n.name)).reduce((acc, n) => acc.concat(n.outcomes), [])

handler_avail(avail, nodes, f) =>
  avail.concat(outcomes_of_named(nodes, common_upstream(raisers(nodes, f), scope_edges(avail, nodes))))

// A handler is checked as a scope of its own: wired from what is available
// at the failure, acyclic, compatible, producing the enclosing scope's
// declared outcomes (re-escalation is what happens when it fails at run
// time, not a shape the check accepts), and only for a failure some node
// beneath the scope declares.
handler_scope_name(scope, h) => "{scope}/on {h.failure}"

check_handler(scope, avail, nodes, declared, h) =>
  assume terminates
  unreachable = if raisers(nodes, h.failure).length == 0
    then [finding("handlers", scope, "", "handler on {h.failure} in {scope}: no node beneath {scope} raises {h.failure}")]
    else []
  unreachable.concat(check_scope(handler_scope_name(scope, h), handler_avail(avail, nodes, h.failure), h.nodes, declared, none, []))

check_handlers(scope, avail, nodes, declared, handlers) =>
  assume terminates
  handlers.reduce((acc, h) => acc.concat(check_handler(scope, avail, nodes, declared, h)), [])

// --- The rollup (convention 8) and the budget check (§7) — stage A3 --------------
//
// A leaf contributes its estimate; a composite the rollup of its inner
// graph; a `uses` node the rollup of the borrowed plan. A node with a retry
// policy contributes max_attempts times that (convention 12): the rollup is
// an UPPER BOUND, not an expectation. Durations add serially, so the bound
// assumes no two nodes run at once. `rollup` is the main graph; the BOUND
// (`rollup_bound`, stage A4) adds every handler's graph at its own retry,
// since a budget is a promise about the worst case, and the budget check
// verifies the bound.

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

// The bound: the main graph plus each handler's graph at the handler's
// retry, at every scope.
handler_attempts(h) => when h.retry is none then 1 is r then r.max_attempts

own_bound(n) =>
  assume terminates
  if is_uses(n)
    then bound_of(n.graph.nodes, n.graph.handlers)
    else if is_composite(n)
      then bound_of(n.nodes, n.handlers)
      else est_add(node_estimate(n), handlers_bound(n.handlers))

node_bound(n) =>
  assume terminates
  est_scale(own_bound(n), attempts(n))

handlers_bound(handlers) =>
  assume terminates
  handlers.reduce((acc, h) => est_add(acc, est_scale(bound_of(h.nodes, []), handler_attempts(h))), no_estimate)

bound_of(nodes, handlers) =>
  assume terminates
  est_add(nodes.reduce((acc, n) => est_add(acc, node_bound(n)), no_estimate), handlers_bound(handlers))

rollup_bound(p) => bound_of(p.nodes, p.handlers)

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

check_budget(scope, nodes, handlers, bgt) =>
  when bgt is none then [] is b then budget_findings(scope, bound_of(nodes, handlers), b)

// A scope's findings, then its handlers' graphs, then each composite's
// internal graph (convention 6 applies the same checks inside) and each
// borrowed plan's own.
check_scope(scope, avail, nodes, declared, bgt, handlers) =>
  assume terminates
  own = check_wiring(scope, avail, nodes)
    .concat(check_compatibility(scope, avail, nodes))
    .concat(check_acyclic(scope, avail, nodes))
    .concat(check_outcomes(scope, avail, nodes, declared))
    .concat(check_budget(scope, nodes, handlers, bgt))
    .concat(check_handlers(scope, avail, nodes, declared, handlers))
  nodes.reduce((acc, n) =>
    if is_composite(n)
      then acc.concat(check_scope(n.name, n.inputs, n.nodes, n.outcomes, n.budget, n.handlers))
      else if is_uses(n) then acc.concat(check_plan(n.graph)) else acc,
    own)

check_plan(p) =>
  assume terminates
  check_scope(p.name, p.inputs, p.nodes, p.outcomes, p.budget, p.handlers)

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

// --- The surface (§3, stage B1): `plan NAME:` as an offside-rule fragment -----
//
// The first indentation-delimited grammar in `lib/`. Blocks open with
// INDENT after a `:` and close with DEDENT; items are NEWLINE-separated;
// `hws` sits wherever the next thing is a layout terminal, so the newline
// is left for it to match. Every lowercase key is convention 4's; a
// capitalised name is a node; `[ fixture ]` names a predicate in the
// consumer's scope; a `uses` target is a plan binding in the consumer's
// scope. Each item lowers to a tagged record and the builders below fold
// the records into the library's values, so the surface adds no second
// model. The statement form declares the binding through `binding_decl`
// with the `WellFormedPlan` type, so a plan that does not check does not
// build (chapter §7).

item(k, v) => {k: k, v: v}

items_of(items, k) => items.filter(i => i.k == k).map(i => i.v)

first_or(items, k, d) =>
  xs = items_of(items, k)
  if xs.length == 0 then d else xs[0]

measure_duration(d) => {m: "duration", v: d}
measure_effort(e) => {m: "effort", v: e}
measure_money(x) => {m: "money", v: x}

measure_or(ms, which) =>
  xs = ms.filter(x => x.m == which).map(x => x.v)
  if xs.length == 0 then none else xs[0]

est_of(ms) => est(measure_or(ms, "duration"), measure_or(ms, "effort"), measure_or(ms, "money"))
budget_of(ms) => budget(measure_or(ms, "duration"), measure_or(ms, "effort"), measure_or(ms, "money"))

apply_item(n, i) =>
  when i.k
    is "estimate" then with_estimate(n, est_of(i.v))
    is "retry" then with_retry(n, i.v)
    is "instructions" then with_instructions(n, join(i.v.map(l => l.trim()), " "))
    is "fails" then i.v.reduce((acc, f) => with_failure(acc, f), n)
    is "handler" then with_handler(n, i.v)
    is "budget" then with_budget(n, budget_of(i.v))
    is _ then n

build_node(name, items) =>
  kids = items_of(items, "node")
  base = if kids.length == 0
    then leaf(name, first_or(items, "inputs", []), first_or(items, "outcomes", []))
    else composite(name, first_or(items, "inputs", []), first_or(items, "outcomes", []), kids)
  items.reduce((acc, i) => apply_item(acc, i), base)

build_handler(failure, items) =>
  h = handler(failure, items_of(items, "node"))
  when first_or(items, "retry", none) is none then h is r then handler_retry(h, r)

build_plan(name, items) =>
  base = plan(name, first_or(items, "inputs", []), first_or(items, "outcomes", []), items_of(items, "node"))
  with_handlers = items_of(items, "handler").reduce((acc, h) => plan_with_handler(acc, h), base)
  when first_or(items, "budget", none) is none then with_handlers is b then with_budget(with_handlers, budget_of(b))

planning_grammar = grammar {
  rule pname = txt:/[A-Z][A-Za-z0-9_]*/ => txt => txt
  rule pname_list = names:pname ** "," => names => names

  rule port_item = t:pname hws "[" f:ident "]" => (t, f) => port_where(t, f)
  rule port_item += t:pname => t => port(t)
  rule port_lines = p:port_item hws NEWLINE rest:port_lines => (p, rest) => [p].concat(rest)
  rule port_lines += p:port_item => p => [p]
  rule port_inline = p:port_item ** "," => p => p
  rule ports = hws INDENT ps:port_lines DEDENT => ps => ps
  rule ports += ps:port_inline => ps => ps

  rule effort_lit = n:float hws "person-hours" => n => person_hours(n)
  rule effort_lit += n:number hws "person-hours" => n => person_hours(n)
  rule effort_lit += n:float hws "person-hour" => n => person_hours(n)
  rule effort_lit += n:number hws "person-hour" => n => person_hours(n)
  rule measure = e:effort_lit => e => measure_effort(e)
  rule measure += d:expr => d => measure_duration(d)
  rule measures = m:measure ** "," => m => m

  rule retry_spec = "max" n:number "attempts" "," b:expr "backoff" => (n, b) => retry_backoff(n, b)
  rule retry_spec += "max" n:number "attempts" => n => retry(n)

  rule text_lines = l:/[^\n]+/ hws NEWLINE rest:text_lines => (l, rest) => [l].concat(rest)
  rule text_lines += l:/[^\n]+/ => l => [l]

  rule node_item = "inputs:" hws ps:ports => ps => item("inputs", ps)
  rule node_item += "outcomes:" hws ps:ports => ps => item("outcomes", ps)
  rule node_item += "estimate:" hws ms:measures => ms => item("estimate", ms)
  rule node_item += "budget:" hws ms:measures => ms => item("budget", ms)
  rule node_item += "retry:" hws r:retry_spec => r => item("retry", r)
  rule node_item += "fails:" hws fs:pname_list => fs => item("fails", fs)
  rule node_item += "instructions:" hws INDENT ls:text_lines DEDENT => ls => item("instructions", ls)
  rule node_item += "on" hws hf:pname hws ":" hws INDENT hitems:node_items DEDENT => (hf, hitems) => item("handler", build_handler(hf, hitems))
  rule node_item += un:pname hws ":" hws "uses" hws target:expr => (un, target) => item("node", uses(un, target))
  rule node_item += nn:pname hws ":" hws INDENT nitems:node_items DEDENT => (nn, nitems) => item("node", build_node(nn, nitems))
  rule node_items = i:node_item hws NEWLINE rest:node_items => (i, rest) => [i].concat(rest)
  rule node_items += i:node_item => i => [i]

  stmt_form "plan" hws pn:pname hws ":" hws INDENT pitems:node_items DEDENT
    => (pn, pitems) => binding_decl(pn, build_plan(pn, pitems), WellFormedPlan)
}
