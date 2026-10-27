# Rung 3 — a domain model the kernel checks and searches

The hypothesis test (see `docs/messaging.md` and
`docs/plans/planning-pilot.md`): one domain model with rich structural
constraints, solution finding over it, and failures a stakeholder can
read. The model is a project plan as a graph of **outcomes**; the
planning DSL is a pure Allegro library — `lib/planning.alg`, **zero
host code** — with an offside-rule grammar block, so `plan NAME:`
declares a value the kernel checks like any other, and a plan that does
not check does not build.

```bash
npx tsx src/index.ts demos/rung3/01-model.alg
npx tsx src/index.ts demos/rung3/02-solve.alg
```

| Scene | Shows |
|---|---|
| `01-model.alg` | The model is the artifact: the worked example (a software release with a borrowed build pipeline, nested composites, estimates, a budget, declared failures and recovery graphs) built through the `plan` form; wiring derived, not written; the rollup and the worst-case bound; escalation as a graph property; refusals in planning vocabulary — an unwired input, a budget the bound exceeds, a handler nothing raises |
| `02-solve.alg` | Solution finding: choices with options make a template, `solve` picks the resolution that passes every check and is cheapest by effort then duration, a deadline moves the answer and brings an option's own recovery graph with it, and the counterexample names the cheapest resolution and the measure it misses; a gap in a plan is filled from a catalog, chained backward, and solved the same way |

Each scene has a commented **break it** block with the captured halt in
`transcripts/`: the `plan` statement refusing a plan whose input nothing
produces, and refusing a template no resolution can bring within its
deadline. Both files are validated by the test suite via their
`// expect:` comments — the demos cannot silently rot.

What was built for planning specifically: the plan and node records,
the wiring derivation and the graph checks, the measures (effort and
money; durations come from the units DSL), the rollup, the handler
rules, the two searches, and the grammar block. What was inherited
free: the type checker, refinement discharge (a `WellFormedPlan` is a
refinement, and its predicate explains its own refusals), the module
system (`uses` across files rides `import`), totality checking inside
the library, and the error channel that carries every refusal.

What this rung does **not** show, and says so: one model, at pilot
scale, as specification and checking only (Shape 1) — nothing executes
a plan; no second model composed with this one; no AI agent in the loop
over the model. Those are the next rungs' questions, not this one's
claims.
