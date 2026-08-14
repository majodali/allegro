# Release track — positioning, differentiators, demo ladder (B-090)

> Track R. This is the working plan for the public-release arc: the
> differentiator map with its claims register, the demo ladder, and the
> derivation order for website / demos / public docs. The DURABLE parts
> (the three-move cohesion frame, substrate/surfaces terminology, the
> claims discipline) live in `docs/VISION.md` §1a/§5 — this plan holds
> everything that changes as work lands. Maintainer ratifies §7's
> decision points before content derivation starts.
>
> **This document is internal.** Public messaging derives from it under
> the claims discipline (§4): only claims at status `delivered` or
> `demoable` may appear in public material, stated at their evidence
> strength. The primary external audience is formal-methods-literate
> skeptics — under-claiming with receipts is itself positioning.

## 1. Goal and scope

Work BACKWARDS from the highest-value use cases to a coherent public
story, then derive the website, demos, and public docs from one source
of truth. The release track runs alongside functional tranches (S3
visibility, B-028) — it does not preempt them; it tells us which
functional gaps actually matter to outsiders.

In scope: the differentiator map + claims register (§3), the demo
ladder (§5), website/docs derivation (§6). Out of scope: building
rung-3/4 functionality (those are functional-tranche work the ladder
motivates); community/launch mechanics beyond the first public cut.

## 2. The cohesion frame (summary — canonical text in VISION §1a)

Three moves; every differentiator is a composition of them:

1. **Everything is a value under one engine.** Code, types, grammars,
   models, proofs, effects — all values; partial evaluation is the only
   engine.
2. **Every claim is a predicate with a visible discharge strength.**
   Positive and negative claims, one machinery; the answer is a TIER
   (proven / enumerated / sampled / admitted / pending), never a bare ✓.
3. **Every participant goes through the same kernel.** Human, AI, tool,
   hybrid — one protocol, independent verification, recorded authorship.

Provability is what claims MEAN; collaboration is WHO discharges them;
configurable grammar is what VOCABULARY they are stated in; DSLs and
models are what they are ABOUT; mixed-model optimization is SEARCH
through the space the claims constrain. One architecture, six viewing
angles.

## 3. Differentiator map

Six differentiators + a capstone, ordered kernel-outward. Each carries
a claims register row set (§4 statuses). "Rests on" names the substrate
capabilities; "to advance" names the work that moves the weakest claim
up one status.

### D1 — Provability, positive and negative — one machinery

What a program provably does AND provably doesn't do, as one property
surface. Refinements, contracts, invariants, laws (positive); effects,
capabilities, budgets, information flow (negative). All predicates, all
discharged by the same PE + entailment engine (the VISION falsifiable
constraint). Sharpest consequence: **provable containment** — deps,
plugins, and AI-written code whose behavioral envelope the kernel
guarantees, so trust stops requiring reading.

Rests on: predicate sets + abstract domains, PE-as-discharge, effects
component, channel/capability substrate, totality analysis.

| Claim | Status |
|---|---|
| Refinements / contracts / invariants discharged by PE | delivered |
| Laws with D34 discharge tiers (Equatable instance #1) | delivered |
| Effects declared+inferred; under-promising halts build | delivered |
| Totality (exhaustiveness, termination, decreases) | delivered |
| Module-level containment demo (effects budget on imports) | demoable |
| Parametric capabilities (`net[host]`), per-module budgets | hypothesis (D2 phase) |
| Information flow | hypothesis |

To advance: a curated containment demo (rung 1); D2 capability design.

### D2 — The assumption ledger — every claim carries its strength

No boolean "verified". Every claim resolves to a visible tier, and
every result carries what it rests on, transitively — from a function's
verdict up through a mixed-model plan: "rests on 2 admitted assumptions
and 1 sampled law; here is what breaks if they're wrong." Epistemic
provenance end-to-end. No incumbent (formal or modeling) does this.

Rests on: D34 tier spectrum, E3/E4 law obligations + admitted tier,
E-R6 proof tier recording, Verdict schema, predicate-set sources.

| Claim | Status |
|---|---|
| Per-claim tiers on the Verdict (laws, coercions, proofs) | delivered |
| Proofs record which law tier backed them; admitted renders weaker | delivered |
| Predicate provenance per source (assert/branch/requires/…) | delivered |
| Result-level roll-up ("this OUTPUT rests on …", transitive) | in-progress (mechanism exists per-value; no roll-up UX) |
| Cross-model ledger over a composed solution | hypothesis (needs rung 3-4) |

To advance: a ledger view in `inspect`/Verdict that aggregates a
binding's transitive backing — small, high-leverage (rung 1 polish).

### D3 — Participant-neutral collaboration — the kernel is the trust boundary

One protocol for humans, AI agents, and hybrids, with recorded
authorship. Three facets: **AI velocity** — the loop is a search
environment with dense, sound, machine-readable feedback (verdicts,
counterexamples, hints, budgets): the compiler as the reward model;
**human review** — semantic summaries, safety grades, contract-surface
diffs instead of line-reading; **team collaboration** — interfaces,
laws, and NAMED assumptions as the negotiated artifacts, a visible
formality gradient per module, failures readable by every stakeholder.

Rests on: PCP (H1–H4), `allegro prove`/`verify`/`obligations`/
`propose`, iteration hints, authorship records, introspection +
SafetyGrade, laws + `Law.witness`/`Law.assume`, the loose→declared
negotiation gradient (C5.2c).

| Claim | Status |
|---|---|
| PCP schemas + CLI loop (obligations → prover → verdict) | delivered |
| LLM worker closes the loop end-to-end (`allegro prove`) | delivered |
| Benchmark: PE discharges 10/10 closed props; gate holds | delivered |
| Authorship recorded per discharged theorem | delivered |
| Safety grade + module summary (`allegro inspect`) | delivered |
| Semantic DIFFS (review a change, not a file) | hypothesis (B-068) |
| Multi-strategy / budgeted prover orchestration | hypothesis (H6/H7) |
| Counterexamples in domain vocabulary | in-progress (concrete inputs delivered; domain rendering B-081) |

To advance: rung-1 demo script of the full loop; B-068 scoping.

### D4 — One substrate, many surfaces — and every surface is serious

Grammar, semantics, and paradigm are configurable; general-purpose vs.
domain-specific is a BREADTH axis on one concept (VISION §1a). The
seriousness argument: DSLs were historically toys because they were cut
off from their host's guarantees and tooling. An Allegro surface
INHERITS THE ENTIRE KERNEL — types, proofs, effects, laws,
counterexamples, the prover loop — so a narrow surface is exactly as
serious as the general-purpose one.

Rests on: grammar2 + runtime grammar extension (Phases 6/6b/7),
immutable layering + conflict detection, extension-configured
semantics, lib loader through the full `evalSource` pipeline (body
forms work in libs).

| Claim | Status |
|---|---|
| Runtime grammar extension: operators, rules, expr/stmt forms | delivered |
| Conflict detection at `use` time; hygienic templates | delivered |
| DSL demos (regex, match-expr, pow) | delivered (toy scale) |
| Libs get the full kernel (proofs/effects/totality in .alg libs) | delivered |
| A FLAGSHIP serious DSL (laws + counterexamples in domain terms) | in-progress → rung 2 |
| Paradigm stacks beyond functional (logic, constraints, events) | hypothesis (B-048/B-080 band) |
| Custom general-purpose surfaces | hypothesis |

To advance: rung 2 — pick and build the flagship DSL.

### D5 — Compilation is evaluation you can trust and extend

Build phases are PE stages where resources bind progressively;
specialization, optimization, and verification are one pass (Futamura
territory pointed at verification). Discharged laws LICENSE rewrites —
the optimizer becomes user-extensible and can't be wrong. Config and
deployment are late-binding phases, so "this system, with this config,
in this environment, is coherent" is a compile-time theorem.

Rests on: phase model (`applyPhase`, forward chaining), precompile
passes, laws (E3), PE-as-discharge.

| Claim | Status |
|---|---|
| Phased PE: type/effect/proof analysis IS evaluation | delivered |
| Compile-time discharge removes runtime checks | delivered |
| Laws-licensed rewrite engine | hypothesis (laws exist; no rewrite consumer) |
| Deploy/config correctness surface (IaC-style gates) | hypothesis |
| Tree shaking via PE | hypothesis (B-063) |

To advance: nothing for rung 1 (the delivered rows already demo);
rewrite engine is a natural post-S3 functional candidate.

### D6 — Models are first-class, live values

Domain models — physics, electronics, logistics, finance, chemistry,
games — with rich constraints and operations, on the same substrate as
code: verified like code, queried for solutions (generative, heuristic,
constraint-based, numerical), run as simulations, and — because
evaluation is forward-chaining and reactive — kept LIVE as data
arrives, proofs and ledger updating. Design-time model and operational
digital twin are the same artifact.

Rests on: refinement domains + predicate sets (constraint substrate),
forward-chaining + futures (reactivity), Vivace hypothesis (VISION §4).

| Claim | Status |
|---|---|
| Constraint substrate (interval domains, entailment, propagation) | delivered (arithmetic scale) |
| Reactive re-derivation as bindings resolve (futures/applyPhase) | delivered (language scale) |
| Model authoring surface + solution finding | hypothesis (rung 3; B-079/B-080) |
| Simulation runtime; live-model operation | hypothesis |
| Units/dimensions as refinements | hypothesis (natural rung-2/3 bridge) |

To advance: rung-3 pilot design (after rung 2 informs the surface).

### D7 — Capstone: mixed-model solution finding with AI collaboration

The composition: heterogeneous models coupled into one solution space
(physics × electronics × control × manufacture; supply chain × market
× finance), AI agents proposing and searching, the kernel scoring, and
every candidate solution carrying its assumption ledger. Not a seventh
feature — the demonstration that the six are one architecture.

Status: hypothesis, deliberately. It is the summit the ladder climbs
toward and the private motivation for sequencing; it appears in public
material only as clearly-labeled direction, if at all, until rung 3
exists.

## 4. Claims discipline (the register's semantics)

- **delivered** — landed, tested, honest to state as fact.
- **demoable** — delivered pieces composed into a showable story; may
  be stated publicly WITH the demo.
- **in-progress** — designed/partially landed; internal only.
- **hypothesis** — motivates the work; PRIVATE until it moves up.

Rules: public messaging draws only from `delivered`/`demoable`; every
public claim states its evidence strength (principle 9 applied to
marketing); ambition lives in this document and in the roadmap's
sequencing, not in public copy. The map is re-graded at each rung
landing; grade changes are recorded in §8.

## 5. The demo ladder

Each rung is a marquee story composed of the three moves; lower rungs
are prerequisites for the credibility of higher ones.

**Rung 1 — Verified code at AI velocity (now; release vehicle).**
Story: write `theorem`/`proven`/`effects`; watch PE discharge; break
one — build halts with a concrete counterexample; run `allegro prove`
— an LLM proposes, the kernel verifies, authorship is recorded; try to
sneak an effect or an unproven transitivity past the kernel — refused,
with the escape hatches (`Law.witness`/`Law.assume`) rendered loudly in
the verdict. Marquee moment: the SAME failing law shown to a human and
an AI, both fixing it through the same protocol.
Exists: everything (E-arc, F/G/H-arc, effects, totality, bench).
Needed: curated demo scripts + sandbox walkthroughs, the D2 ledger
roll-up polish, getting-started, website refresh (§6).

**Rung 2 — A provable DSL (near; the seriousness proof).**
Story: a small domain language built as a grammar+library extension
whose users get laws, counterexamples, effects, and the prover loop IN
DOMAIN TERMS — free, from the substrate. Candidate domains (pick one at
ratification): units-of-measure physics calculations (bridges to rung
3; dimensional soundness as laws) or state machines (reachability /
deadlock obligations; event-driven paradigm preview).
Needed: the DSL itself (lib + grammar + laws), minimal domain-term
counterexample rendering (B-081 slice), demo script.

**Rung 3 — A Vivace domain-model pilot (the hypothesis test).**
Story: one domain model with rich constraints; solution finding over
it; failures readable by a non-programmer stakeholder. This is the
VISION §4 pilot — it tests counterexample legibility, model
composition, and the AI iteration loop on real ground.
Needed: model surface design (B-079/B-080 reval), solution-finding
primitives over the constraint substrate, the pilot itself.

**Rung 4 — Mixed-model optimization with the assumption ledger
(summit; direction, not commitment).**
Story: two+ coupled domain models, AI-proposed candidate solutions,
kernel-scored, ledger-carried. Public only as labeled direction.

## 6. Derivation order (website, demos, public docs)

All public content derives from this plan + VISION; nothing is authored
against a private mental model.

1. **Messaging skeleton** — one page: the three moves, the rung-1
   story, claims at delivered/demoable strength. Ratified before any
   site work.
2. **Website refresh** — `website/` (allegrolang.org): landing page
   rebuilt on the skeleton; sandbox gains the rung-1 walkthroughs
   (theorem → break → counterexample → prove-loop; effects refusal;
   laws + admitted tier).
3. **Demo assets** — the rung-1 scripts as runnable `.alg` files +
   recorded transcripts; bench results presented with their honest
   framing (PE-as-discharge totality finding).
4. **Public docs** — getting-started, tutorial, language tour written
   for outsiders (the internal design docs stay internal);
   `proving-in-allegro.md` audited as the public primer.
5. **Mechanics** — README, npm packaging, versioning, repo hygiene,
   CI badge. Keep the site updated per landed rung thereafter.

## 7. Decisions for ratification

- **R-R1 — terminology**: "substrate / surfaces" with general-purpose
  vs. domain as breadth (VISION §1a amendment). RATIFIED 2026-08
  (maintainer, this session), including the seriousness claim.
- **R-R2 — claims discipline** as stated in §4 (private until
  delivered; skeptics-first audience). RATIFIED 2026-08 (maintainer:
  "claims as big as we can usefully imagine … until convincingly
  delivered, they remain private").
- **R-R3 — differentiator map** (§3): the six + capstone, as merged.
  Proposed; awaiting sign-off.
- **R-R4 — ladder order** (§5) and the rung-2 domain choice
  (units-physics vs. state machines — recommendation: units-physics,
  for the rung-3 bridge and the mixed-model trajectory). Awaiting
  sign-off.
- **R-R5 — doc placement**: durable → VISION §1a/§5; volatile → this
  plan; items → BACKLOG Track R. Proposed per maintainer direction
  ("no competing primary docs"); awaiting sign-off on the VISION
  amendment text itself (Tier 0).

## 8. Status log

- 2026-08: plan drafted (differentiator map merged from maintainer's
  six sketches + session synthesis; claims register graded against the
  post-E4 codebase). VISION §1a/§5 amendment drafted in a dedicated
  commit for Tier-0 ratification. BACKLOG Track R items B-090–B-093
  registered.
