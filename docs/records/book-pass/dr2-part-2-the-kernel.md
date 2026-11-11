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

Nothing yet: this record opens the review.

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

(Further rulings are recorded as they are taken.)
