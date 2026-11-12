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

Part IV of `docs/plans/book-pass-inventory.md`, from 83 decisions in
eleven chapters to 66 in eleven: Types as values; Refinement types;
Reaching a member; The surface language; Claims and proofs; Equality
and laws; Effects; Contracts; Termination
and completion; When a check fails; Units of measure. One decision is
added to Part II's "Authority" chapter ("Reading an expression never
yields authority") and a note on truth to "The kernel's primitives are
pure and few". Three entries move to Part VI. New held findings are on
the entries that name them and in the table at the inventory's top.
Every dependency of Parts I to IV points to an earlier decision, and
no capability decision depends on an implementation decision. The
inventory holds 217 decisions.

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

**Member access, ruled 2026-11-12.** The maintainer observed that
private, protected and the like "are not really privacy concerns",
but "about interface, encapsulation and design discipline", that the
same could be done by claims over an analysed program, and that
strict access control would likely need caller-based decisions. The
conclusion, agreed: two needs, two mechanisms already in Parts I and
II, and no third.

- Secrecy and power are kept by a key: "A private member is one whose
  key not all code holds", as ruled.
- A second decision beside it (open): "Who may use a member is a claim
  about where the access was written." Private, protected, read-only
  and caller-based rules are claims over the origins of accesses,
  which only the kernel writes; they are refuted like any claim,
  before any effect. For strict caller-based control the two combine:
  the type's module keeps the key and hands out an accessor whose body
  makes the claim.
- To prove: an accessor reading the origin of its call; the access
  patterns (private, shared within a group, read-only, protected)
  restated as claims; the cost of deciding such claims on real
  programs. Protected is a discipline unless the type also limits who
  may refine it. A trusted module can still be led to access on
  another's behalf, which is why keys stay the foundation.
- The chapter is renamed "Reaching a member".

**Asks 5 to 8, ruled 2026-11-12.** The maintainer agreed with the
recommendation on each.

- Ask 5: "Nothing is a claim until someone makes it." A refuted claim
  halts; a finding about code that claimed nothing is a report; a
  project may make claims wholesale and may not soften a refutation.
  The information severity and the severity configuration go. A
  pattern match where no arm matches is a refutation, so a match that
  can fall through refutes the program and exhaustiveness needs no
  analysis of its own. This promotes what an earlier ruling (CE-R8,
  the two consciously weaker paths) kept as information.
- Ask 6: "Constructing a refined value claims its predicate"; a failed
  construction is a refutation, where an error value is yielded today,
  the other path of the same earlier ruling. "The standard language's
  handled failure is an exception", raised and handled explicitly and
  carried in a field the standard extension owns.
- Ask 7: "A claim about every value is decided by evaluating it with
  the value unknown." "A proof term is a proposal": the proof rules
  are functions of the standard extension and a result decided with
  their help names it; a kernel primitive that rewrites by a decided
  equation was the alternative. "Four strengths, one vocabulary":
  kernel, enumerated, auto and witnessed become decided; sampled
  stays; admitted becomes assumed; pending and undischarged become
  undecided; induction checked at four steps is sampled.
- Ask 8: "What is known about a value travels with the value." One
  carrier; inside a branch the names tested are rebound; the arms of a
  pattern match narrow as the branches of `if` do.

**Asks 9 to 13, ruled 2026-11-12.** The maintainer agreed with the
recommendation on each.

- Ask 9: "In the standard language every value has a type"; "The core
  types are built over bits"; "Default equality belongs to the
  standard extension". A mode and a flag for the bare kernel stop
  being concepts; the default configuration moves to Part VI.
- Ask 10: "A typed function claims its parameter types on entry and
  its return type on exit"; "A body clause is a notation".
- Ask 11: the prover's primer and the proof-term contract move to
  Part VI, with the default configuration. These stop being
  decisions: the choice of units of measure as a demonstration; the
  ban on redefining core types (Part I's rule that replacing is
  explicit); the two verdict entries (held findings on "Every result
  says how strongly it holds"); the guidance on choosing among
  refinement, contract, assertion and law (kept as material for the
  chapter); the labels for observing knowledge and scheduling.
- `is_resolved` is removed from the language. The maintainer: "I
  don't have a good use case for `is_resolved`. Phase specific
  behavior can be provided through other mechanisms, if needed"; a
  use case found later reopens the decision, as with every decision.
- Ask 12: a note on Part II's "The kernel's primitives are pure and
  few": the kernel recognises two bit values as true and false, and a
  conditional or a claim on anything else is a refutation.
- Ask 13: the remaining entries stay, reworded.

**On PR #191, 2026-11-12.** The maintainer reviewed Part IV: it looks
good. The chapter "Contracts and the knowledge they give" is renamed
"Contracts". Confirmed: the place of "Reading an expression never
yields authority" in Part II's "Authority" chapter; the rename of
"Proofs as values" to "Claims and proofs"; the placement of "A match
where no arm matches is a refutation" in "Contracts" and of "The
standard language's handled failure is an exception" in "Types as
values".

Every ask is ruled.
