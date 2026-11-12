# Decision review: Part IV, the standard language (DR4)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR4 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the 83
> decisions of Part IV in `docs/plans/book-pass-inventory.md`, read on
> `origin/main` at `5ffbfee`, 2026-11-12, against the 96 decisions of
> Parts I to III as ruled in DR1, DR2 and DR3. Author: the review
> session, which read every entry itself and brings the conflicts to
> the maintainer before any decision is reworded. Method: R38 (the
> purpose of the decision review) of the plan. Rulings are recorded
> here as they are taken.

## Asks

The first reading found thirteen points where Part IV, as the
inventory states it, conflicts with Parts I to III or is left open by
them. They are put to the maintainer in the review session, structural
ones first.

1. **Reading inside a function.** Part II makes a function plain data
   that any code can read, lets every extension read a value's origin,
   and makes authority a value a function holds. Together these leak:
   code handed a narrowed capability can read the wrapper's body and
   take the full capability out of it. The same holds for a private
   key. Part II left this open as the first test of privacy. It has to
   be settled before effects or privacy can be.
2. **Privacy.** Part IV has a mediated lookup in four stages, a policy
   hook, a kernel-made capsule that answers whether a scope holds a
   name, and member symbols identified by guessable names. Under
   "Authority is an unforgeable value" a private member is one whose
   key not all code holds. The mediation, the capsule and the hook
   then dissolve. A module's privacy becomes simpler still: what it
   does not hand out cannot be reached.
3. **Effects.** Part IV has effect labels as values in a lattice,
   inference, effect variables, an `unsafe` hierarchy and `opaque`.
   Parts I and II say an effect is a capability call, a capability is
   granted and never acquired, and a bound on what code may do is a
   claim. A function then can do only what the capabilities it holds
   allow, and most of the chapter follows from Part II or dissolves.
4. **Divergence is not a capability call.** Part IV makes possible
   non-termination the effect `div` so that totality reuses the effect
   calculus. If an effect is the use of a capability, termination is
   instead a claim like any other, decided by a function evaluated
   over the program's expression.
5. **One kind of claim.** Type annotations, refinements, contracts,
   assertions, laws, theorems, effect bounds, termination and
   exhaustiveness each have their own machinery, and three severities
   (halt, error value, information) with a per-project configuration.
   Part I: one kind of claim, a refuted claim halts, and that is not
   configurable. Proposed: nothing is a claim until someone makes it;
   a finding about code that claimed nothing is a report, not a
   refutation; a project may make claims wholesale, and may not soften
   a refutation.
6. **A failed check at construction, and the failure a program
   handles.** Part IV yields an error value where a refinement check
   fails at construction. Part II moved handled failures to an
   extension and left the standard language's choice to this part.
7. **Proof rules and strength.** Part IV has proof values with a mark
   only the kernel writes, discharge mechanisms as kernel primitives,
   six law tiers and four termination tiers. The kernel now has one
   primitive, evaluating a claim, and results carry one of four
   strength words and the names of the extensions they rest on. To
   rule: the proof rules are extension code, a result decided with
   their help says so, and the tiers map onto the four words.
8. **Knowledge.** Part IV has two carriers, the value and a facts
   plane on the scope. Part II dissolved the facts plane: knowledge is
   a field on the value, and a region's extra knowledge is a rebinding
   of names. The sources disagree on whether the arms of a pattern
   match narrow knowledge.
9. **The standard language as a configuration.** "Standard mode", the
   flag for the bare kernel, "every Standard value has a type", a core
   roster with machine integers and floats, and a default equality
   called the kernel's. Under Parts I and II the standard language is
   a set of extensions, a value's type is a field its notation
   supplies, arithmetic is a capability, and the kernel has no
   equality beyond telling bits apart.
10. **Checks at calls.** Typed calls are checked in the evaluator
    before substitution, and body clauses are lowered through a chain
    of host steps. Part II: a check at a call is a claim at the top of
    the function's body, and a clause is a notation that stands for an
    expression.
11. **Entries that belong elsewhere or are not decisions.** The
    prover's primer and the proof-term contract for a language model
    are tooling. The default configuration is a platform decision. The
    choice of units of measure as a demonstration is a plan's choice.
    The ban on redefining core types is Part I's rule on replacing.
    The verdict entries are realised by Part I and become held
    findings.
12. **Truth.** A proposition "reduces to Bool", and Bool is an integer
    with a type. The kernel's conditional and its claim primitive need
    a notion of true that does not depend on an extension's type.
13. **Wording that names modes, compile time, runtime checks, the
    kernel where the standard extension is meant, and rungs.**
    Mechanical, after the above.

## What is already covered

Parts I to III as ruled. Items parked for this part by earlier
reviews: effects re-read as the capabilities code can reach; privacy
by possession of a key, with the rule on serialising symbols; the
failure a program handles; the strength vocabularies; pattern matching
built on the one conditional; the return-type check. The held findings
already recorded on Part IV's entries.

## What changed

Nothing yet. Part IV of `docs/plans/book-pass-inventory.md` is
rewritten as the asks are ruled, and "Rulings taken" records each.

## Terms introduced

No terms introduced.

## Rulings taken

**Asks 1 to 4, ruled 2026-11-12.** The maintainer agreed with the
recommendation on each.

- Ask 1: "Reading an expression never yields authority." Any code can
  read an expression's structure; where the expression holds an
  unforgeable value, the reader sees which one it is and cannot obtain
  it. Closing a function's body to readers was the alternative, set
  aside because analyses in extensions read expressions.
- Ask 2: "A private member is one whose key not all code holds." The
  mediated lookup, the policy hook and the kernel-made capsule
  dissolve; a module's privacy is what it does not hand out. The
  maintainer: "we need to determine if common access patterns such as
  protected fields (visible to a type's subtypes) can be implemented
  using this approach."
- Ask 3: the effects chapter shrinks to three decisions: an effect is
  the use of a capability; a capability can have named parts and
  narrowed forms; the notation for stating a bound. The lattice of
  effect values, inference as its own mechanism, effect variables,
  `opaque` and the `unsafe` hierarchy dissolve.
- Ask 4: termination is a claim like any other and leaves the effects.
