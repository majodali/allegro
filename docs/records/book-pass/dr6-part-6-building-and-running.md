# Decision review: Part VI, building and running programs (DR6)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR6 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the 31
> decisions of Part VI in `docs/plans/book-pass-inventory.md`, read on
> `origin/main` at `fadfc0a`, 2026-11-12, against the 168 ruled
> decisions of Parts I to V. Author: the review session, which read
> every entry itself and brings the conflicts to the maintainer before
> any decision is reworded. Method: R38 (the purpose of the decision
> review) of the plan. Rulings are recorded here as they are taken.

## Asks

The first reading found eleven points where Part VI, as the inventory
states it, conflicts with Parts I to V or is left open by them.

1. **The build pipeline chapter has no decision left in it.** Its
   eight entries describe the fixed pipeline: precompile, the stage
   order, post-passes, the precompile context's entries, the inline
   cutoff, effects deferred during precompile, soft failure, and
   diagnostic switches. Each is now a consequence of an earlier
   decision or a held finding against one. What the chapter should
   decide instead: which phases the platform ships, and what one phase
   hands to the next.
2. **A stored program.** A phase's residual is a program, and Part III
   ships the parser engine as expressions built ahead of time. Nothing
   says how far a program loaded from storage is trusted: its claims
   were decided by an evaluation the loading kernel did not perform,
   and Part IV says a key cannot be written out and read back into
   existence.
3. **Export.** "Code generation from the expression graph" names
   provability-informed optimisation, continuations and algebraic
   effects. Part II already rules that exporting is a phase in which
   capabilities are emitted. Part V makes a transformation a model.
   To rule: a backend is a declared mapping from expressions to a
   target's code, and how far emitted code is trusted.
4. **Laws licensing rewrites**, open here and deferred to this part by
   two earlier reviews: the strength a rewritten program carries, and
   whether laws a capability's supplier declares may license rewrites
   around its opaque body.
5. **Optimizable capability bodies**, deferred here by the Part I
   review.
6. **Tools.** Soft failure contradicts Part I: a phase already reports
   every refutation in its result. The five subcommands are
   configurations. The safety grade has its own vocabulary where
   Part IV ruled four strengths. The file runner and the prompt are
   ruled by Part III.
7. **The tools for proposing** (obligations, the primer, the
   proof-term contract) speak of proofs only. The planning-loop stream
   generalised the worker to kinds of obligation, and Part I now notes
   that an obligation is a claim waiting for a value.
8. **Hosts.** A stated host boundary is listed open; Part I decides
   it: host code reaches a program only as a capability. Capabilities
   carry effect labels that Part IV removed. A missing capability
   throws, where Part I leaves the call residual. A failed request
   fills a cell with an error value, where Part IV chose exceptions.
   Liveness and the loader's file reader repeat earlier decisions.
9. **Self-hosting** is listed as aspirational. Parts I and III now
   require it: extensions are written in Allegro and fully built
   before release.
10. **Tracing and debugging** is open and undesigned. Part II's origin
    record is what a trace would read.
11. **Wording**: layers, tracks, milestones, modes, effect labels,
    tiers.

## What is already covered

Parts I to V as ruled. Items earlier reviews sent here: laws licensing
rewrites; optimizable capability bodies; "A capability is supplied per
target"; the concrete half of reviewability, read with the safety
grade; the three entries moved from Part IV. The held findings already
recorded on Part VI's entries.

## What changed

Nothing yet. Part VI of `docs/plans/book-pass-inventory.md` is
rewritten as the asks are ruled, and "Rulings taken" records each.

## Terms introduced

No terms introduced.

## Rulings taken

**The shape of Part VI, 2026-11-12.** The maintainer's response to
the first recommendations:

- The pipeline chapter becomes "Phases": it gives a definition, the
  three phases the platform ships, and then how to define a new phase
  or extend an existing one.
- Something is missing, as it was in Part V: an introductory section
  on usage patterns and the roles host components and extensions
  play. "Most importantly we need to cover the host launcher and its
  role in loading configuration and capabilities and passing them to
  the kernel. We should define the invocation/startup process in
  detail (not in the introduction), so people understand how it all
  hangs together."
- Trust needs a chapter of its own, covering "specifics like host
  code, loaded capabilities, and stored programs", with the cases and
  risks defined so they can be countered. On stored programs: "I tend
  to agree that fully rechecking on load will likely be opt-in."
- Export: the terms are "target", "target platform" or "export
  target", not "backend". A target platform is a model, and exporting
  is a transformation from a residual expression to that model,
  "including target specific exported capabilities for post-export
  phases (deploy, load, run, invoke, etc)".
- Every decision needs example use cases, "which I suppose is true
  for every decision in the book, but is especially true for here
  where the rubber hits the road".

**A brainstorm on the kernel, the launcher, capabilities and
configuration, 2026-11-12 and 2026-11-13.** The maintainer laid out a
model of how they work and asked for critique, with neither side
committing until the conclusions were vetted. The conclusions, agreed
2026-11-13 ("I agree with all these conclusions, recommendations and
terms"; "My only requirement is we have a foundation we can build
on"):

- **The kernel is passive.** It acts only on calls of its interface
  and knows nothing of configuration or phases. Its interface lets a
  caller construct values, bind symbols in a scope, create scopes,
  including ones that are not children of the root, and evaluate
  expressions. The review added: filling a cell, reading a result and
  its metadata, obtaining the residual, setting limits, receiving
  faults, and a statement of what the interface never exposes.
- **Configuration** is all the information that determines how an
  execution is performed, read from sources with a priority. The
  maintainer blurred on purpose the line between what the launcher
  manages and what Allegro code manages: a launcher may be minimal,
  and the more is handed to Allegro, the more partial evaluation and
  claims can work on. The review's first split is withdrawn.
- **The launcher does only what cannot be done in Allegro.** Anything
  more it does is an earlier phase, run ahead of time and saved. Only
  the launcher can set the ceiling.
- **An execution's grant is a ceiling.** Code inside still has to be
  handed a capability, by value or by being evaluated in a scope that
  holds it. A module is a function of the capabilities it declares.
- **Four kinds of function.** A primitive function has a body of host
  code; a composed function is written in Allegro. Either is effectful
  or pure. A primitive's purity is declared and assumed; a composed
  function's is decided from what it holds. A kernel primitive is one
  of the six the kernel ships. A capability is a named set of
  effectful primitives, and is what gets granted.
- **Loading host code may be a capability**, controlled by the
  ceiling, by granting it only to trusted code, and by narrowing it to
  an allow list pinned by content hash. A configuration can claim that
  no host code is loaded after bootstrap.
- **Saved programs come in two forms**: data, a recorded sequence of
  interface calls, and host code, which can also contain primitive
  functions. A data-form program names the primitives it needs by
  content hash. The maintainer: this "is inviting dependency hell, but
  every modular programming platform that's successful goes to
  dependency hell as punishment. I think hash checks will work for
  now." Saving is export to a target whose model is the kernel's
  interface.
- **An exported program usually needs no kernel.** It needs one when
  it handles expressions at run time; then it carries a kernel, loads
  one as a library, or, once the platform hosts itself, carries a
  kernel specialised to it.
- **Trust.** The maintainer: "A big part of the issue is a user (or
  organization) determining what level of trust they need, and where
  Allegro reliably improves on what they would otherwise do."
  Recommendations accepted as a foundation to build on:
  - No interface call writes a bare claim outcome. Restore stamps an
    outcome with its builder's identity; the kernel computes the
    claim's key itself. Restore is allowed inside the kernel as a
    capability narrowed per builder, and that is configurable. The
    maintainer: the launcher being safer than Allegro code "means
    mostly we need to always analyze for vulnerabilities".
  - A builder is identified in stages: content hashes, a manifest, a
    signature. Determinism lets anyone rebuild and compare.
  - A primitive's purity: assumed and named by default; sampled;
    enforced where a target can run code with no access to the
    outside; and a reference definition as a composed function, which
    the maintainer holds a worthwhile goal.
  - A policy is a claim over what a result rests on, stated on a
    phase, on a capability or as a profile adopted whole. Policies
    only add requirements and combine by conjunction.
  - Limits are step budgets, which are deterministic; a wall-clock
    limit belongs to the launcher. One reference kernel is the root of
    trust; a variant is trusted as far as it agrees with it.
- The review suggested that checked mappings between versions of a
  model might one day replace version numbers as compatibility
  claims. The maintainer remains "skeptical on combinatorial
  complexity grounds".
