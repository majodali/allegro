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

None yet.
