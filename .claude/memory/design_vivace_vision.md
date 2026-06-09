---
name: vivace-usability-vision-and-open-gaps
description: Allegro Vivace usability hypothesis — model-driven, AI-collaborative, opt-in formal methods — with seven open gaps tagged work-in-progress
type: project
originSessionId: 5836184c-ea1b-474c-97be-8f52409678fd
---
**Allegro Vivace** (top tier; renamed from "Allegro High") is the user-facing language for app developers. Allegretto → Allegro Standard → Allegro Vivace. Vivace's design hypothesis is below; **most claims here are work-in-progress, not settled answers.**

## Posture

- **Focus on extensibility.** Vivace ships with a range of domain-specific models and language extensions: software systems modeling, workflow/process, automatic reasoning, UI, data/analytics, etc. Model-driven engineering: platform-independent models + platform-dependent implementation models. Users can extend or build their own; extensions can extend correctness/effect predicates so they're expressed naturally in the domain.
- **Highest-abstraction-first.** Developers focus on the highest-abstraction model that fully expresses the problem/solution space. They *can* go full-stack with safety/correctness annotations, but the likely default is collaboration with AI agents handling lower-level work.
- **Predicates and proofs are opt-in.** Comfortable users author them; everyone else collaborates with AI. Domain DSLs ship with proof primitives. **The high-level models including their constraints are the key review artifacts.** A release is only valid when constraints/effects are right AND proofs support them.
- **Failures are build errors with counterexamples.** All stakeholders should be able to read them.
- **Domain models are themselves careful artifacts.** Authoring is specialized. Ideal end-state: open-source library of widely-reviewed, maturing third-party models. Constraints/effects/built-in proofs provide **transitive assurance** — importing a library imports its assurance, not just its license/CVEs.

## Open gaps (work-in-progress)

These are known-unsolved. Partial answers below; concrete progress tracked in BACKLOG.md "Vivace usability research" section.

1. **Counterexample legibility (foundational).** PE produces residual-expression counterexamples — the wrong artifact for a non-expert. Needs domain-specific rendering layer. Places constraints on domain-model authors. Coupled to gap #3 — same rendering layer serves humans and AI agents.

2. **Model composition.** Real systems compose multiple domain models. Composition patterns aren't designed yet. Multi-domain [impl, proof] generation risks combinatorial explosion. Open Allegro goal, not yet documented in design docs.

3. **AI iteration loop.** Agents will hit "can't solve" cases. Must surface usable failure: counterexamples (cross-domain), agent-suggested problem restructuring, time-boxing. Should feel like positive learning, not a frustrating maze. Coupled to gap #1.

4. **Proof as portable trust artifact.** Proofs should be exportable to other tools (Lean / Coq / similar) for re-checking. Real challenge isn't the proof, it's which base implementation components ship with the proof to make it concrete. Pairs with transitive assurance — downstream auditors can re-check without trusting Allegro's checker.

5. **Org process for constraint-set completeness (longest critical path).** "Release when constraints are the right ones" — who decides? Under-specified lets bugs through; over-specified blocks legitimate code. Probably AI-assisted recursive review. The deeper question is organizational: what process do orgs need? How different from current? Translation must be comprehensible AND valuable. Needs external research / customer interviews, not internal design.

6. **Bootstrap economics.** Vivace's value depends on rich domain models. Until those exist, it's Allegro Standard with extra ceremony. Depends on user engagement; v1 models won't be mature; need to start somewhere. Roadmap, not design.

7. **Escape-hatch discoverability — resolved by inversion.** The user's principle (#7 finding): **business rules define the domain, not vice versa.** If the language doesn't exist to express a rule, extend the language; don't contort the rule. Lack of expertise to define domain terms soundly is the same situation as today's developer who can't write a GraphQL query — solved by collaboration / time-boxing / improving over time, not by escaping to a lower tier.

## How to apply

- When designing Vivace features, check: does this rely on counterexample rendering or model composition? If yes, the feature is bottlenecked on those open gaps — surface that.
- When AI [impl, proof] generation comes up, remember the loop is undefined. Don't assume AI converges; design for graceful "can't solve" with structured help.
- For new domain models, lead with: what constraints/effects do they declare, and how do they render counterexamples in their domain?
- "We're not close enough to the bridge to decide whether we cross it or bungee off it." Solid examples (v1 domain models) will test the hypothesis. Don't over-design ahead of evidence.
