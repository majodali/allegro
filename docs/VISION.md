# Allegro — Vision & Principles

> **Tier 0 — Constitution.** This document changes rarely, only with explicit
> maintainer sign-off, and always in a dedicated PR — never bundled with
> feature work. See `docs/PROCESS.md` §2 for the change policy.

## 1. What Allegro is

Allegro is a **programmable language platform**: a minimal formal core that
serves as a substrate for building higher-level languages and DSLs, with
**provable correctness and safety** as its defining feature.

Three tiers (names locked — no further Italian musical terms):

- **Allegretto** — the primitive base language: a small fixed set of value
  kinds, expression DAGs, a recursive evaluator. A specification, not a
  user-facing language.
- **Allegro Standard** — the standard language: a curated stack of extensions
  providing types, modules, collections, contracts, effects, and proofs. In
  normal use, "Allegro" means this tier.
- **Allegro Vivace** — (future) the app-developer tier: rich domain models,
  opt-in formality, AI-collaborative workflows. See §4.

**Substrate and surfaces.** Allegretto is the **substrate**; every language
built on it is a **surface** — Allegro Standard is the standard surface, a
DSL is a narrow surface, a team's custom language is their surface.
General-purpose vs. domain-specific is a **breadth axis on one concept**,
not a hierarchy and not two species of thing. The historical reason DSLs
read as "not serious" is that they were toys cut off from their host's
guarantees and tooling; an Allegro surface **inherits the entire kernel** —
types, proofs, effects, laws, counterexamples, the prover protocol — so a
narrow surface is exactly as serious as a general-purpose one. Changing
that perception is a stated goal.

Two commitments shape everything else:

- **Extensions are where the language lives.** Everything beyond the value
  kinds and their primitives is an extension: syntax (grammar extensions),
  semantics (evaluation-context configuration), the type system, the module
  system. New constructs are importable modules, not compiler forks.
- **Partial evaluation is the compilation model.** Each build phase is a
  partial evaluation step in which phase-specific resources become available.
  Type checking, effect inference, totality analysis, and proof discharge are
  all the same engine: evaluation over partially-resolved programs.

**Human–AI collaboration is a core design goal**, not an afterthought: humans
and AI agents negotiate domain abstractions, codify them as DSLs and type
extensions, then both work within the shared formalisms — with the compiler
as the trust boundary between them.

### 1a. Why it is one thing — the three moves

Allegro's differentiators are not a feature list; they are one
architecture seen from different angles. Everything reduces to three
moves:

1. **Everything is a value under one engine.** Code, types, grammars,
   models, proofs, effects — all values; partial evaluation is the only
   engine. Type checking, proof discharge, DSL compilation, and model
   solving are the same computation at different stages of binding.
2. **Every claim is a predicate with a visible discharge strength.**
   Positive claims (what code does) and negative claims (what it doesn't)
   run through the same machinery, and the answer is never a bare
   checkmark — it is a tier (proven / enumerated / sampled / admitted /
   pending), always visible, carried transitively by results.
3. **Every participant goes through the same kernel.** Humans, AI agents,
   tools, and hybrids propose through one protocol; the kernel verifies
   independently; authorship is recorded. Trust attaches to the kernel,
   not the author.

Then: provability is what claims *mean*; collaboration is *who*
discharges them; configurable grammar is what *vocabulary* they are
stated in; DSLs and models are what they are *about*; solution finding
is *search* through the space the claims constrain. New capabilities
must present as compositions of these moves — a differentiator that
needs a fourth move is a thesis-level concern, the positioning analog
of §2's falsifiable design constraint.

## 2. The thesis: provable correctness + safety

Allegro's defining feature is provable **correctness + safety** — formally a
conjunction of two predicate families over function behavior; poetically the
yin and yang of what code should and shouldn't do.

- **Correctness** (positive): code does what it should — refinement types,
  predicate sets, contracts, invariants.
- **Safety** (negative): code does NOT do what it shouldn't — effects,
  capabilities, information flow, behavioral budgets.

"Safety" is the user-facing term; "negative" is formal vocabulary only. Many
properties (termination, determinism, resource bounds) have a foot in both
streams — positive/negative is a perspective on a property, not a strict
partition.

**Why both, why now.** AI code generation breaks checklist-based security
review: you can't read every line for "did it do something I didn't ask
for", but you CAN check that a function didn't escape its declared
capability set. Safety machinery goes from niche-academic to practically
necessary precisely because read-the-diff review doesn't scale to AI
velocity. This is also the public framing: lead with provability + safety
together, motivated by AI velocity.

### The unifying machinery — types as predicates

Every provability feature is a predicate over a different surface of "what
the function does":

| Feature | Predicate over |
|---|---|
| refinement types | a value |
| contracts (requires/ensures) | input/output relations |
| invariants | an instance's lifecycle |
| effects | what's invoked |
| capabilities | what resources are reachable |
| information flow | what data influences what output |

All are discharged by the SAME machinery: predicate sets + abstract domains +
entailment + PE reduction.

> **Falsifiable design constraint:** if a new safety or correctness feature
> ends up needing parallel infrastructure rather than reusing predicate-set
> entailment and PE discharge, the thesis has failed in implementation.
> Surface that as a thesis-level concern — do not quietly build the parallel
> system.

### The proof strategy — three legs

1. **PE-as-discharge (primary).** Predicates are Allegro lambdas; PE reduces
   them against residuals; a predicate that reduces to `true` is discharged.
   The interpreter and the proof checker are the same artifact because
   predicates are first-class values. Existing systems each pick a different
   discharge mechanism (SMT, structural type checking, symbolic execution);
   using *evaluation itself* is the underexplored position Allegro's
   evaluator was designed for.

2. **[implementation, proof] pairs (primary).** Instead of "write code,
   derive proofs later", a **prover** produces implementation and proof
   together, and the compiler verifies the pair independently. The protocol
   is **participant-neutral**: AI agents are expected to be the
   highest-volume provers (they are the search muscle the thesis bets on),
   but humans, hybrid human+AI workflows, and tool-assisted provers are
   first-class participants in the same protocol. The verification kernel is
   the single trust boundary regardless of who proposes. Goal: a growing
   library of abstract, reusable [impl, proof] pairs that compose.

3. **SMT (selective fallback).** Explored where PE isn't strong enough
   (arithmetic-heavy obligations, theory combination) and where
   prover-generated proofs aren't economical. Use-case-driven, not
   foundational. Combines with the other legs — e.g. a proof skeleton that
   delegates a Presburger obligation to SMT.

### Build, don't derive

Compile-time first: specs are discharged during partial evaluation; the
executable carries only residuals. Runtime checks are the fallback, not the
spec. The proof obligation isn't "every runtime trace satisfies P" — it's
"this expression, partially evaluated, reduces to one whose result satisfies
P." Futamura territory pointed at verification rather than specialization:
the same machinery proves correctness and compiles the code in one pass.

**Build safety IN** — don't bolt proofs onto arbitrary code; design code to
be inherently provable. Failed proofs and false declarations halt the build
visibly; they never silently degrade into warnings or error values.

### Trust beyond Allegro — portable proofs

Proofs should be **exportable to external checkers** (Lean, Coq, or similar)
so a downstream auditor can re-check without trusting Allegro's checker.
This pairs with **transitive assurance through dependencies**: importing a
library imports its proofs, re-checkable in a kernel of the auditor's
choice. The hard engineering question is which base implementation
components ship alongside a proof to make it concrete enough to check
externally — plan for a verified-substrate library in the target checker.
Long-term goal, surfaced whenever foundational representation choices are
made (those are where the cost of *not* designing for exportability
accumulates).

## 3. The reviewability claim

**Bottom-up disjointed code review is the wrong approach.** The artifact a
reviewer sees is still code — but presented through a cohesive, trustworthy,
top-down view that surfaces inferred types, effects, discharged invariants,
predicate sets, semantic diffs, and behavioral boundaries. The code is the
substrate; the layered semantic view is the lens. Allegro is uniquely
positioned for this because code IS a traversable expression graph, types
ARE values computed by partial evaluation, grammars ARE user-extensible, and
proofs CAN be structural.

The user experience stays simple: a developer writes what looks like plain
Allegro. The formal machinery lives in libraries and the analyzer. The
developer sees a **safety grade** — "proven safe; behavioral surface: pure"
— backed by a drill-down view, not a theorem-prover transcript.

## 4. The Vivace hypothesis

Allegro Vivace is the user-facing tier for application developers. Its
design hypothesis (work-in-progress, not settled):

- **Model-driven and extensible.** Vivace ships with domain models and
  language extensions (systems modeling, workflow, UI, data/analytics, …).
  Users extend them or build their own; extensions extend correctness and
  effect predicates so rules are expressed in domain vocabulary.
- **Highest-abstraction-first.** Developers work in the highest-abstraction
  model that fully expresses the problem; AI agents typically handle
  lower-level work.
- **Predicates and proofs are opt-in.** Comfortable users author them;
  everyone else collaborates with AI. Domain DSLs ship with proof
  primitives. **The high-level models and their constraints are the key
  review artifacts.**
- **Failures are build errors with counterexamples** that all stakeholders
  can read.
- **Domain models are careful artifacts** authored by specialists; the ideal
  end-state is an open-source library of widely-reviewed models providing
  **transitive assurance** — importing a library imports its assurance, not
  just its license and CVE list.

Seven known-unsolved gaps (counterexample legibility, model composition, the
AI iteration loop, proof portability, organizational constraint-completeness
process, bootstrap economics, escape-hatch discoverability) are tracked in
`docs/backlog.md` (the L3 — Vivace band, B-081…B-086). *"We're not close enough to the
bridge to decide whether we cross it or bungee off it"* — v1 domain pilots
test the hypothesis; don't over-design ahead of evidence.

## 5. Design principles

Checked against every design decision. Grouped; numbering is stable for
reference.

**Language design**

1. **Minimal core; extensions are the language.** The base is a
   specification. Every feature beyond the value kinds is an extension, and
   user extensions use the same mechanisms the standard library uses.
2. **Types as values; one engine.** Type checking, refinement discharge,
   effect inference, totality, and proofs all run on partial evaluation —
   never a parallel analyzer (the falsifiable constraint, §2).
3. **Immutable grammar extension.** New grammars share structure with the
   base and never mutate it; conflicts are detected and reported at
   activation time.
4. **Business rules define the domain, not vice versa.** When a rule has no
   expressible form, extend the language/model so the rule expresses
   naturally — don't contort the rule or escape to a lower tier. The rule is
   authoritative; the model is a tool to express it precisely.

**Verification**

5. **Formal work concentrates in libraries and DSLs.** A developer writing
   an app should not be typing `requires`/`ensures`; library functions carry
   the contracts and user code inherits and composes them.
6. **Inferences visible, annotations optional.** What the compiler proved is
   always displayable; what the user must write stays minimal.
7. **Safety grade, not proof transcript.** The default surface is "proven
   safe" / "N warnings about M unproven sub-expressions"; theorem-level
   detail is opt-in drill-down.
8. **Escape hatches are loud.** Unprovable code is tagged
   (`partial` / `unsafe` / `unproven`); the gradient fully-proven →
   partially-proven → explicitly-unsafe is always visible.
9. **Verification claims state their strength.** A claim discharged by
   exhaustive PE, a claim checked on K sampled inputs, and a claim gated by
   a checked proof term are different strengths of evidence — surfaces,
   summaries, and protocols must say which one they're reporting, never
   letting a weaker check borrow a stronger check's vocabulary.
10. **Performance never traded for safety.** If a check is expensive, the
    answer is a better proof or a better algorithm — not dropping the check.
11. **Analyzer findings must be trustworthy.** When an analysis can't
    determine the facts, it stays silent rather than guessing — false
    positives erode the trust the whole system depends on.
12. **Positive and negative are one property.** Correctness contracts and
    effect surfaces are two faces of the same provability: same machinery,
    same summary, same review workflow. The system never separates them.

**Collaboration**

13. **Provers are collaborators; the kernel is the trust boundary.** Humans,
    AI agents, and hybrid workflows propose [impl, proof] pairs through the
    same participant-neutral protocol; the compiler verifies independently;
    the human reviews semantic summaries. All three roles are first-class.
14. **Progressive disclosure.** Beginners write normal code and everything
    is inferred; intermediates add targeted invariants; experts write proof
    tactics. Every level is stable on its own.

**Evolution**

15. **Corpus-driven review-and-redo.** Every feature and syntax element gets
    reviewed — and possibly redefined from scratch — once a corpus of real
    use exists. This is an expected lifecycle step, not a contingency. Ship
    the version that lets us learn the most; treat surface syntax as
    provisional; build deprecation paths so redos don't strand dependents.
16. **Proofs are portable** (§2, trust beyond Allegro). Prefer
    representations that translate to standard proof-assistant primitives;
    avoid evaluation-only constructs that can't be reified externally.

**Communication**

17. **Claims are private until delivered.** Ambition should be as big as we
    can usefully imagine — it prioritizes and motivates the work — but it
    lives in internal plans and roadmap sequencing, never in public copy,
    until convincingly delivered. Public claims state their evidence
    strength (principle 9 applied to messaging), and the primary external
    audience is assumed to be formal-methods-literate skeptics:
    under-claiming with receipts is itself positioning. The claims register
    (release-track plan) is the gate — public material draws only from its
    `delivered`/`demoable` tiers.

## 6. What success looks like

> Define `divide(a, b) => requires b != 0; a / b`. Call `divide(x, 5)`: no
> runtime check — the requires discharged at compile time. Call
> `divide(x, get_user_input())`: a runtime check at the call site, with a
> counterexample message if it fails.

> This module declares effects `[pure]`; the analyzer infers `[pure]` ✓.
> Another declares `[net]` but the analyzer infers `[net, files]`: build
> fails — the developer updates the declaration (now visible to consumers)
> or fixes the unintended access.

> An agent generates a function. Declared intent: "validate an email
> address." Inferred behavior: regex-match, no I/O, O(n). Match. Reviewed in
> seconds.

> Pull-request review: semantic diff shows one tightened refinement and one
> implicit precondition promoted to an explicit `requires`. All proofs still
> discharge. Behavioral surface unchanged: still `[pure]`. Review time:
> seconds, with confidence that line-by-line reading could never provide.

---

*Sources: consolidated from `design_provability_thesis`,
`design_vivace_vision`, `design_business_rules_define_domain`,
`design_proof_exportability`, `feedback_review_and_redo` (memory), and the
design-principles section of the provability-arc strategic plan. Principle 9
is new (2026-06 project review); principle 13 generalizes the earlier
AI-centric framing to participant-neutral per maintainer direction.
§1a (the three moves), the substrate/surfaces terminology, and principle 17
were added 2026-08 (release-track positioning session, maintainer-directed);
the volatile companion material — differentiator map, claims register, demo
ladder — lives in `docs/plans/release-track.md`, deliberately outside
this Tier-0 document.*
