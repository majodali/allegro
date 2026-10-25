// planning.alg — the planning DSL, library core (B-151 stage A1).
//
// The first Vivace pilot: a plan is a graph of OUTCOMES, not a list of
// tasks. Design truth: docs/book/vivace/planning-dsl.md (the model §2, the
// conventions §3, the checks §7); work plan: docs/plans/planning-pilot.md.
//
// Stage A1 is the primitive version: the types as plain records, the
// constructors a plan is built through, the queries and the one-line
// renderings a demo pins. No surface syntax (stage B), no graph checks
// (stage A2), no typed estimates (stage A3). Everything here is ordinary
// Allegro, loaded with `use planning`.

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

// --- Estimates and retry (shapes only; stage A3 types the measures) --------
//
// Convention 8: estimates roll up from leaves, budgets are verified at
// composites and at the plan. Convention 12: retry is explicit, and the
// rollup takes estimate × max_attempts as the node's upper bound.

Estimate = Type.define({ duration: Any, effort: Any, money: Any })

est(duration, effort, money) => Estimate(duration, effort, money)

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
  graph: Any
})

leaf(name, inputs, outcomes) =>
  PlanNode(name, inputs, outcomes, none, none, none, [], [], none)

composite(name, inputs, outcomes, nodes) =>
  PlanNode(name, inputs, outcomes, none, none, none, nodes, [], none)

// `Build: uses BuildPipeline` — the node's ports are the plan's.
uses(name, p) =>
  PlanNode(name, p.inputs, p.outcomes, none, none, none, [], [], p)

// Builders: records are immutable, so each returns a copy with one field set.
with_estimate(n, e) =>
  PlanNode(n.name, n.inputs, n.outcomes, e, n.instructions, n.retry, n.nodes, n.handlers, n.graph)
with_instructions(n, text) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, text, n.retry, n.nodes, n.handlers, n.graph)
with_retry(n, r) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, r, n.nodes, n.handlers, n.graph)
with_handler(n, h) =>
  PlanNode(n.name, n.inputs, n.outcomes, n.estimate, n.instructions, n.retry, n.nodes, n.handlers.concat([h]), n.graph)

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

with_budget(p, b) => Plan(p.name, p.inputs, p.outcomes, p.nodes, b, p.handlers)
plan_with_handler(p, h) => Plan(p.name, p.inputs, p.outcomes, p.nodes, p.budget, p.handlers.concat([h]))

// --- Queries over the graph ----------------------------------------------------
//
// The main graph only: handlers are alternate graphs and are counted by
// their own queries. A `uses` node counts as one node of this plan; the
// borrowed plan's nodes are its own.

node_count_in(nodes) =>
  nodes.reduce((acc, n) => acc + 1 + node_count_in(n.nodes), 0)

node_count(p) => node_count_in(p.nodes)

leaf_count_in(nodes) =>
  nodes.reduce((acc, n) => acc + (if is_leaf(n) then 1 else 0) + leaf_count_in(n.nodes), 0)

leaf_count(p) => leaf_count_in(p.nodes)

node_names_in(nodes) =>
  nodes.reduce((acc, n) => acc.concat([n.name]).concat(node_names_in(n.nodes)), [])

node_names(p) => node_names_in(p.nodes)

find_node_in(nodes, name) =>
  nodes.reduce((acc, n) =>
    when acc
      is none then (if n.name == name then n else find_node_in(n.nodes, name))
      is _ then acc,
    none)

find_node(p, name) => find_node_in(p.nodes, name)

handler_count(p) =>
  p.handlers.length + p.nodes.reduce((acc, n) => acc + node_handler_count(n), 0)

node_handler_count(n) =>
  n.handlers.length + n.nodes.reduce((acc, k) => acc + node_handler_count(k), 0)

// --- One-line renderings, for demos and for people ------------------------------

node_show(n) =>
  "{n.name} ({node_kind(n)}): {ports_show(n.inputs)} -> {ports_show(n.outcomes)}"

plan_show(p) =>
  "plan {p.name}: {ports_show(p.inputs)} -> {ports_show(p.outcomes)}; {node_count(p)} nodes, {leaf_count(p)} leaves, {handler_count(p)} handlers"

estimate_show(e) =>
  when e
    is none then "no estimate"
    is _ then "duration {e.duration}, effort {e.effort}, money {e.money}"
