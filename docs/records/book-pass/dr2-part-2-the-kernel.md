# Decision review: Part II, the kernel (DR2)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk DR2 of
> `docs/plans/book-pass.md`, phase 1 (the decision review), the 74
> decisions of Part II in `docs/plans/book-pass-inventory.md`, read on
> `origin/main` at `fe60abd`, 2026-11-11, against the 23 decisions of
> Part I as ruled in DR1. Author: the review session, which read every
> entry itself and brings the conflicts to the maintainer before any
> decision is reworded. Method: R38 (the purpose of the decision
> review) of the plan. Rulings are recorded here as they are taken.

## Asks

The first reading found fifteen points where Part II, as the inventory
states it, conflicts with Part I or is left open by it. They are put to
the maintainer in the review session, structural ones first.

1. **The extension interface.** Chapter 10 ("Installing a layer into
   the base") types every install as a host-level implementation
   decision: "no Allegro program installs into the base". Part I makes
   the extension interface the one way to extend, written in Allegro
   and transparent to partial evaluation. Question: does the evaluator
   keep hook points that extensions fill (check, dispatch, projection,
   analysis), or does the kernel offer only fields with rules, and
   everything else is ordinary functions an extension defines?
2. **Capability, one idea or two.** The writer of a metadata field and
   a capability a phase's environment supplies are both unforgeable
   function values whose possession is the authority. Proposed: one
   decision, authority is a value you hold.
3. **Primitives are pure.** "Host functions as values with declared
   evaluation control" lets a primitive declare the effects it
   produces. Part I: every primitive is pure; an effect is a capability
   call.
4. **Refutation, error and abort.** Part II has an error as a viral
   metadata field, and aborts; Part I has a refuted claim that halts
   its phase while independent evaluation continues, and effects that
   consume only decided values. Proposed: refutation is carried on the
   value like an error, in a field only the kernel writes; effect
   gating and the phase's result follow from it; aborts are kept for
   kernel invariants and capability denial.
5. **Speculation and unfolding.** PE Rule 2 speculates in a scope
   "marked as compile mode"; PE Rule 1 unfolds except "during a typed
   compilation" and "inside a speculated `when` arm". Both name
   concepts Part I removed. Proposed: speculation is evaluation with no
   capabilities supplied; the unfolding policy needs a principled
   statement.
6. **Absent names.** "A genuinely absent source-level name is a
   compile-time error." Under phases as configuration, a declared
   capability that a phase does not supply must residualise; only an
   undeclared name is an error.
7. **Determinism and confluence** is listed open. Part I needs it
   settled: order of definition carries no meaning, and a decided claim
   is replayed for translation.
8. **The propagation vocabulary.** A fixed set of five rules, against
   a rule that is a function the field's owner supplies.
9. **Which decisions are decisions.** Chapters 9 and 10 hold migration
   states and housekeeping (renamed slots, accessors, lints, a depth
   constant). Proposed test: an implementation decision stays only if
   a reader could choose otherwise and the choice shapes the code.
10. **The seven kinds against the kernel's own criterion.** Whether
    each kind is something no extension could supply.
11. **Bits and its encodings.** If Bits is uninterpreted, the 64-bit
    integer, the float and the string encodings belong to the
    extension that defines those types, unless kernel primitives
    compute on them.
12. **The source expression.** Part I says every value carries its
    expression as metadata; the inventory attaches it on demand.
13. **Field and channel.** Whether "channel" survives as a term.
14. **Wording that names layers, `--base` or L2.** Mechanical, after
    the above.
15. **Scopes and phases.** How a phase's information and capabilities
    relate to the scope the evaluator threads.

## What is already covered

Part I's 23 decisions (DR1, 2026-11-11). The pilot's review of chapter 7
(`p2-allegretto-metadata-and-capability.md`), made before R34 (recommend
the right decision), is re-read under it here. The held findings
already recorded on Part II's entries.

## What changed

Part II of `docs/plans/book-pass-inventory.md`, from 74 decisions in
nine chapters to 49 in seven, as "Rulings taken" records. One Part I
decision is amended ("The kernel trusts only what it has evaluated").
New held findings are on the entries that name them; the largest is
that the evaluator calls installed host functions at fixed points.

## Terms introduced

No terms introduced.

## Rulings taken

**Ask 1, ruled 2026-11-11: no hooks.** The maintainer took option (b):
"I always had concerns about how hooks would be handled by PE." The
kernel offers an extension ordinary functions and metadata fields, each
field with a rule its owner supplies; the evaluator never calls into an
extension at a fixed point of its own. Chapter 10 is rebuilt on that.
The decisions "Carrying needs a handle; deciding needs a hook" and
"Knowledge propagation inside the evaluator" dissolve.

**Four kernel decisions, ruled 2026-11-11**, written into the inventory:

1. "An extension is made of functions and metadata fields." The ruling
   on ask 1, reworded: the maintainer pointed out that "no hooks" means
   something only against history, since the book never introduces
   hooks. What the decision settles is the closed set of building
   blocks.
2. "A field's rule is a pure, bounded function." The maintainer: such
   rules are "pure, self-contained and tightly timebound", not
   callbacks that take part in the evaluator's own work; whether to
   allow more general callbacks was the question ("a vampire is at the
   door asking to come in"). Ruled: no. A rule sees only field values,
   performs no effect and always finishes; for now it may not recurse.
   This settles ask 8: a rule is a function its owner supplies.
3. "Only the kernel records the outcome of a claim." No alternative
   was seen: a claim function in an extension only moves the trusted
   operation there.
4. "Authority is an unforgeable value." It settles ask 2 and covers
   field writers, supplied capabilities and private access.

Also agreed: privacy by possession of an unforgeable key stays open,
as the working answer, to be analysed with "Who can see a member";
knowledge inside a branch needs nothing beyond pure, bounded functions
and the kernel's ordinary rebinding of names.

**Ask 4, refutation, error and abort, ruled 2026-11-11.** Three
decisions, in the inventory:

1. "A refutation marks everything computed from it." Every way a
   program can be wrong is a refutation recorded by the kernel: a false
   claim, a call on a non-function, conflicting definitions. It is
   carried to everything computed from the value and cannot be
   removed, tested for or forged.
2. "A failure a program can handle is supplied by an extension." The
   `error` field and `make_error` leave the kernel. The maintainer:
   "exception" probably fits better than "error"; the choice is each
   extension's.
3. "Evaluation stops early for two reasons only": a broken kernel
   invariant, or a resource limit. A limit leaves claims undecided,
   never refuted. Capability denial as an abort, the five abort
   classes and the depth bound dissolve into it.

**Ask 5, the partial-evaluation rules, ruled 2026-11-11.** Four
decisions, in the inventory, replacing PE Rule 1 and PE Rule 2:

1. "A call is evaluated by evaluating the function's body", with no
   exceptions.
2. "A recursive call is evaluated once for each state of knowledge"
   (open, a design to prove). The maintainer: "The recursion case will
   be where we deliver a lot of Allegro's potential - we'll likely need
   a whole section on it."
3. "A branch that may not be taken is evaluated without capabilities."
   One conditional in the kernel; `eval_when`, `&&` and `||` are built
   on it by extensions.
4. "A refutation on a path that may be taken refutes the program."

**Asks 6, 7, 9 and 15, ruled 2026-11-11.**

- Ask 7: "The same program and the same information give the same
  result." Determinism is built in.
- Ask 15: "The environment is not a value", merging the two scope
  entries. Tabled, for want of a solid use case and of an analysis of
  their effect on unforgeability: introspection of an environment, and
  a tool translating one environment into another for a program that
  requires a specific one.
- "A missing value is a cell that is filled once" and "When information
  arrives, what waited on it is evaluated again", reworded.
- Ask 6: not a decision of its own. The maintainer doubted that a name
  without a value arises apart from futures and values not yet
  defined. A capability a phase is not given and an input not yet
  supplied are cells; a name nothing declares is a refutation.
- Ask 9: the test stands (an implementation decision stays only if a
  reader could choose otherwise and the choice shapes the code). Eight
  housekeeping entries are removed as decisions and tabled as work
  owed. The four-plane model is extraneous: its chapter is dropped.

**Asks 3, 10, 11, 12 and 13, ruled 2026-11-11.**

- "A function may take an argument unevaluated" (open). The maintainer
  asked how unevaluated: the argument is the expression as written,
  with its context; the function reads what it needs and hands some or
  all of it, or a transformed version, to the kernel to evaluate. The
  function cannot know which other extensions are loaded, so that
  information is carried in the expression. Use cases are to be worked
  through.
- Ask 10: the seven kinds stand; kind is not a type.
- Ask 11: not as first drafted. The maintainer: specific scalar
  representations and operations could, and some should, belong in
  extensions; the argument from "assumed" results is weak, since some
  operations will always be defined in extensions. Two questions
  decide it, and both are answered by new decisions: "A capability is
  granted, never acquired" and "What code may do is bounded by the
  capabilities it is given, and that bound is a claim" (trust); "A
  capability is supplied per target" (export). So "The kernel's plain
  data is a sequence of bits, and it computes nothing on them" and
  "Machine arithmetic is a capability that ships with the platform".
- **A Part I decision amended, with the maintainer's approval**: "The
  kernel trusts only what it has evaluated" no longer calls a
  capability's return "assumed". A claim decided with the help of a
  capability is decided, and names the capability.
- "The kernel's primitives are pure and few": six things, no count.
- Ask 12: "Every value keeps its origin." Attached always; partial
  evaluation drops what nothing reads; `observe` goes. The maintainer:
  each residual keeps a reference to its immediately preceding
  expression, so every change can be traced back to the original
  source; there is scope for a utility extension for querying origins.
  The cost assumptions are to be verified.
- Ask 13: "channel" goes. "Metadata fields are independent"; "An
  extension registers its own fields; the kernel has two".

**Leftovers and regrouping, ruled 2026-11-11.** Seven entries fold into
ruled decisions (writes gated and reads free; writers as closures;
one-shot registration; how propagation is applied; primitives
receiving full values; untyped structures; empty array and record);
the serialisation rule for symbols moves to the privacy decision of
Part IV; "Trust in a value needs no seal" is reworded and kept. Part II
is regrouped into seven chapters in dependency order, with provisional
titles: Values; Programs as values; Authority; Metadata; Evaluation;
What an extension is built from; When a program is wrong. 49
decisions, every dependency pointing to an earlier decision. Ask 14 is
done with the regrouping.

Every ask is ruled.
