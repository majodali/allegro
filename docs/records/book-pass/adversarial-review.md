# The book pass: an adversarial review of phase 1

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: an adversarial
> review of the decisions phase 1 ruled, in
> `docs/plans/book-pass-inventory.md` on `origin/main` at `e399222`,
> 2026-11-13. The maintainer asked for it after phase 1 closed. Author:
> the review session, which ran four independent reviewers and then
> checked each finding itself. Nothing here is ruled.

## Asks

1. **Decide how the findings are taken up.** They bear on the plan
   change the maintainer is weighing: five clusters below are design
   work, not writing.
2. **Rule, when ready, on the 31 issues**, each stated below with what
   a ruling must choose. The review session recommends taking the
   five clusters marked "blocks" first, in the order given.
3. No issue is fixed here. The inventory is unchanged except for a
   pointer to this record.

## What is already covered

The 216 ruled decisions of the inventory. The 15 held entries of the
planning pilot were left out.

## How the review was run

Four reviewers, each a fresh agent with one lens: consistency,
feasibility, security, and a reader who does not know the project.
Each read one file only: an extract of the ruled decisions holding
each decision's name, what it decides, its status and its
dependencies. They did not see the notes, the sources or the records
of the review sessions, so that they were not anchored on the
reasoning that produced the decisions. Each finding had to carry a
concrete scenario. The extract and the four reports are kept beside
this record, under `adversarial/`, as plain text; the reports cite
decisions by the extract's numbering.

The review session then checked every quotation against the inventory
(all are exact) and judged each finding. The three technical reviewers
returned 45 findings; they reduce to the 31 issues below. Three
reviewers reached the largest issues independently. A verdict of
"confirmed" means the decisions as written permit the scenario; it
does not mean the design cannot be repaired.

## What changed

This record; the reviewers' reports and the extract under
`adversarial/`; a pointer under "Open questions" in the inventory.

## The issues

### Cluster 1, blocks: an expression can be read and evaluated again

Functions are data, any code can read an expression, and the kernel
evaluates an expression with names rebound. Authority is a value held
inside expressions. Four issues follow from the combination.

1. **A guard can be cut away.** A narrowed capability is a function
   whose body tests its argument and then applies the wide capability.
   A holder reads the body, takes the application as a whole, and has
   it evaluated with the argument rebound. It never obtains the wide
   capability and still uses it. "Reading an expression never yields
   authority" protects the value, not the expression that applies it.
   The same replay satisfies a claim about where an access was
   written. Confirmed; found by all three reviewers (consistency 2,
   feasibility 3 and 10, security 5). A ruling must choose what a
   reader may do with an expression that holds an unforgeable value it
   does not hold: nothing but read it; evaluate it only whole and in
   its own function; or rebuild it under rules the kernel checks. Each
   choice limits optimisers, which Part I says are open to every
   extension.
2. **An unevaluated argument is a probe of the caller's scope.** "A
   function may take an argument unevaluated" lets the function hand
   back a transformed expression to be evaluated in the caller's
   context. It can build any name and have it resolved there, so it
   reaches every capability and key the caller can name. Nothing at
   the call shows that the parameter is unevaluated. Confirmed
   (consistency 1, security 2, feasibility 9). To choose: names the
   function adds resolve in its own scope; or the call site marks the
   argument; or both.
3. **Unevaluated parameters stop optimisation where the callee is
   unknown.** A function that may receive its argument as written can
   tell `a + 0` from `a`, so nothing passed to an unknown function may
   be reduced or rewritten. Confirmed; a known result (Wand 1998).
   To choose: the property is part of a function's type and must be
   known at the call.
4. **Origins disclose data, cost memory, and make optimisation
   visible.** Every value keeps the expression it came from and any
   code may read it. A public result computed from a private member
   carries the member's value in its origin; a digest carries what was
   digested. A loop over a hundred million elements keeps a chain of
   that length. Inlining, a rewrite by a law and a memo hit each
   change what an origin shows. Confirmed (security 6, feasibility 6,
   consistency 2). To choose: who may read an origin, and when a phase
   may erase one.

### Cluster 2, blocks: recursion

5. **A circular definition is decided.** "A recursive call is
   evaluated once for each state of knowledge" assumes a function's
   claims at its own inner call and decides them on the body.
   Termination is a separate claim that need not be made. So
   `lemma(n) => lemma(n)`, declared to return a proof of anything,
   has its claim recorded as decided by the kernel. Confirmed;
   reached by all three reviewers (feasibility 1, security 4,
   consistency 7). To choose: the assumption is licensed only by a
   decided decrease on that call; without one the claim is assumed or
   conditional, and no proof may rest on it.
6. **The same information never recurs in an ordinary loop.** A loop
   counting from a known start to an unknown bound meets a new state
   at each call, so evaluation runs to its budget; calls that are not
   recursive are all opened, which can grow a residual exponentially;
   and since every value's origin differs, "the same information"
   needs a definition of which fields count. Confirmed; the standard
   termination problem of partial evaluation. To choose: a rule for
   generalising, a widening on what is known, and a policy for when a
   call is opened. "A call is evaluated by evaluating the function's
   body", stated with no exceptions, cannot stand as written.

### Cluster 3, blocks: what a notation may do to a text

7. **The author of a notation can remove a user's claims and capture
   what the text names.** Every production can be replaced or wrapped,
   and a form maps what it matched to any expression. A library that a
   file asks for as notation can wrap the forms for `requires`, type
   annotations or `export`, drop them, or pass the user's
   sub-expressions to its own function. No claim was made, so nothing
   is refuted. Confirmed (security 1). To choose: what a grammar
   change may touch without the user's text saying so.

### Cluster 4, needs rulings: strength

8. **Two rules give one mechanism two strengths.** An outside solver's
   answer is assumed; a claim decided with a capability's help is
   decided and names it. A refinement whose predicate asks a server
   the author controls is therefore decided. Confirmed (security 8).
9. **A primitive's purity is assumed, a result resting on a weaker
   result takes the weaker strength, and yet a claim that used
   arithmetic is decided.** Read one way, almost nothing is ever
   decided; read the other, the weakest-link rule has an unstated
   exception. Confirmed (consistency 8, feasibility 4).
10. **A restored outcome is reported as decided, though the kernel
    that reports it did not evaluate it**, and the argument from
    determinism fails for an outcome that rested on a capability or on
    configuration. Confirmed (security 7).

    One ruling may settle 8 to 10: strength, and what a result rests
    on, are two axes; and which things lower a strength (an effectful
    capability's answer, a restored outcome) as against being named
    only (the trusted base).

### Cluster 5, needs rulings: identity

11. **Nothing mints an unforgeable value.** The kernel's primitives
    do not include it, and the one kind with identity is interned by
    name. If minting is pure, two calls give the same key; if not, an
    undecided branch, a second evaluation and the next phase each mint
    another. Confirmed (feasibility 8, consistency 6). A candidate the
    reviewers offer: a key's identity is a function of where it was
    defined, unforgeable because only the kernel writes origins.
12. **A saved program recreates keys by public calls, and a stored
    outcome's key cannot be computed for a claim that mentions one.**
    Confirmed (consistency 6, feasibility 12).
13. **A module is evaluated once, and is a function of the
    capabilities whoever loads it supplies.** With two importers that
    supply different capabilities, one gains the other's, or the
    module is two values. Confirmed (consistency 5, security 3). To
    choose: only the configuration supplies a module's capabilities,
    or a module has one instance for each set supplied.

### Other issues that need a ruling

14. **A refutation cannot be tested for, and search, proposal loops,
    parse recovery and budgeted evaluation all must.** Confirmed
    (consistency 3). To choose: a nested evaluation as a boundary
    whose result is data, which is one more kernel primitive.
15. **An undeclared name is a refutation, and an unknown is an unbound
    symbol that gives a residual.** A solver's unknown and a
    misspelling are the same situation. Confirmed (consistency 4,
    feasibility 9).
16. **Order.** "Order of definition carries no meaning" has
    exceptions that later decisions create and it does not state: a
    grammar change acts from its position and cannot use a binding
    made below it; a prompt rebinds where a file refuses; knowledge
    from `assert` holds "for the rest of the scope". Confirmed
    (consistency 10, feasibility 5).
17. **Which effects happen before a refutation depends on evaluation
    order**, and "halts" is used in two senses. Confirmed
    (consistency 11).
18. **A refutation in a branch that could not be ruled out refutes the
    program, though a limit or an undecidable condition must never
    refute.** Confirmed (consistency 9).
19. **An effect waits for undecided claims that a run can never
    decide**, such as termination or a law: either a wholesale claim
    stops a working program from printing, or the gate covers only
    what a concrete value decides. Confirmed (feasibility 11).
20. **A step budget is not deterministic** across the order in which
    values arrive, the order of evaluation, memo hits and kernel
    variants. Confirmed (feasibility 7). To choose: determinism means
    a claim is never decided differently, only decided or not yet.
21. **A kernel that only tells bit sequences apart cannot host a
    reference definition of arithmetic**, and floating point differs
    between machines in ways bits reveal. Confirmed (feasibility 4
    and 14).
22. **A grammar change must settle the parse, and every parse must be
    reported.** Without looking ahead the two conflict wherever two
    readings are alive at the change. Confirmed in principle
    (feasibility 5). To choose: where a grammar change may appear.
23. **Loaders and prompts written in Allegro need to make a scope,
    keep its bindings and exclude others**, which the kernel's
    primitives do not offer. Confirmed (consistency 12). The same
    finding's second scenario, that a function's free names resolve
    where it is called, rests on the wording of three settled
    implementation entries and is **not confirmed** against the code.
24. **A proposal that is accepted runs later with the capabilities of
    the place it filled.** Confirmed (security 10). To choose: a value
    that fills an unknown holds no capability unless a claim says
    otherwise.
25. **The data form of a saved program may contain any interface
    call**, including filling a cell and setting limits. Confirmed
    (security 11). To choose: a smaller interface for a record.
26. **A configuration source of low priority can choose the parser,
    the loader, the kernel and the accepted keys.** Confirmed
    (security 9). To choose: which source may set which value.
27. **A module with no export list hands out its keys and whatever
    capabilities it bound**, and who authorises an import is not
    stated. Confirmed (security 12).
28. **Where an access "was written" has several answers** once an
    expression is inlined or produced by a notation. Confirmed as two
    more cases for a decision already marked to prove (feasibility
    10).

### Wording

29. **The launcher fills a cell with an exception**, a value only the
    standard language can make. It should fill the cell with plain
    data that a wrapper turns into an exception. Confirmed
    (consistency 13).
30. **Stale words.** "The core types are built over bits" still says
    "machine arithmetic capability"; "A capability is granted, never
    acquired" says host code enters only through configuration, where
    Part VI allows loading it under a pinned list; "check has no
    capability to act" must still read modules. Confirmed
    (consistency 14 and 15).

### Hardening and cost, noted

31. Limits and refutations as levers for untrusted code; a check that
    is not inert, because parsing evaluates and the loader reads files
    a text names; fields carried onto a derived value (not confirmed);
    how little evaluation with the value unknown decides without
    induction or a relational domain, including a false result at the
    largest machine integer; a module summary that will read "sampled"
    for nearly every module; the speed of a parser obtained by partial
    evaluation (security 13 to 15, feasibility 13 and 15).

### The reader who does not know the project

The fourth reviewer flagged 67 of the 216 decisions: 9 in Part I, 13
in Part II, 6 in Part III, 25 in Part IV, 6 in Part V, 8 in Part VI.
Most are terms used before the file explains them. The ten that cost
most: configuration, standard extension, scope, unit, module, engine,
the strength words, metadata, capability, trusted code. The decisions
are in dependency order; the terms are not. This is for the pass on
wording, and is not checked item by item here.

## The review session's reading

Phase 1's structure stands: the parts, the chapters and most
decisions drew no finding. The findings gather where the design is
newest and where the review session and the maintainer agreed
fastest: expressions as readable, re-evaluable data set against
authority held in them; recursion; what a grammar change may do; the
meaning of the strength words; and identity across evaluations,
phases and saved programs. Each is design work with known literature
behind it, and the reviewers name it. None was visible to the
mechanical checks phase 1 ran.

## Rulings taken

**The order of work, 2026-11-13.** The maintainer asked how many
findings must be resolved before the kernel's interface and the
saved-program data form, which the rebuild program
(`docs/plans/rebuild.md`) makes the kernel stream's first chunk. The
review session's answer, agreed: stage the two contracts. Issues 25
and 29 block a first version; identity (issues 11 and 12) and
strength (issues 8 to 10) block the second; the rest block neither.
The order agreed: the first versions; issue 15 with the first
milestone; identity and strength, then the second versions; cluster 1
with issues 14 and 23 as one design; recursion, proved by building;
the rest with their parts.

**Issue 25, ruled 2026-11-13.** The maintainer asked what happens to
a saved program's top-level effects, and to a module's when it is
loaded: construct-and-bind alone has no place for them, and an
evaluate call in the record would perform them at load. The
maintainer suggested gathering them into a function under a reserved
name, called at the caller's discretion, and asked for another
option. Ruled, two decisions:

- "A module is a function of the capabilities it declares", taken
  literally. Its parameters are what it declares; its body holds its
  bindings and its top-level effects in written order. Loading
  constructs the function and evaluates nothing; instantiating it is
  a call. A saved program's data form constructs values and nothing
  else, and yields a module function.
- "Only the module being run performs effects when instantiated."
  The alternative, any module performing top-level effects in
  dependency order, makes the order of instantiation observable. In
  the inventory it is stated inside the first decision's entry until
  it can have its own: a test of the acceptance stream pins the
  decision map's row count.

**Put to the maintainer with the first versions, to confirm at their
PR.** Issue 29: the launcher fills a cell with plain data, and a
wrapper in the standard language makes a failure an exception; the
decision keeps its title for now, since a corpus file of the acceptance
stream cites it by title. The
first version of the data form leaves out claim outcomes, keys and
origins, defines the data form only, and is written as JSON. The
calls of the first version of the interface.

**How the kernel evaluates again when a cell is filled, ruled
2026-11-13.** The first draft of the interface had the host ask for
each result it kept. The maintainer asked whether the host
necessarily knows every expression that waits, and had assumed the
update would be built into the cell: a `set` that triggers
re-evaluation up the expression DAG, a read-only `filled` flag, and a
list of unbound cells on a result. Three approaches were compared:
the host pulls for each result (the host must know every root, and
each pass walks the whole residual); the cell pushes at once
(complete, but the work runs inside the fill with no budget, effects
fire in arrival order, and a waiter on two cells is evaluated twice);
the kernel tracks what waits on what and the host says when. Ruled:
the third. Filling a cell records the value and evaluates nothing; a
kernel-wide call, `advance`, evaluates again everything that became
ready, under a step budget, each waiter once after all it depends on.
Cells stay opaque handles and all logic is in the kernel's calls. The
order of effects that become ready together waits on issue 17.

**On PR #207, 2026-11-14.** The maintainer merged the first versions
of the two contracts: "Everything looks good." Confirmed with it: the
interface with `advance`; a record that constructs values and binds
nothing; issue 29, plain data in a cell; what the first version
leaves out. The kernel stream's remaining chunks are approved
(`docs/plans/book-pass.md` §2.9 and §5).

**Issue 15, under discussion, 2026-11-14.** The review session
recommended that a name is declared when something binds it, and that
a name bound to nothing is a refutation. The maintainer leans the
other way: "I want Allegro to support using a name before it is
defined, as in function hoisting in Javascript, nonterminals in
grammar definitions, or variables in Prolog. Since there are a few
use cases, and we're supporting it as an extension mechanism, there
doesn't seem to be a simple rule to govern when an unidentified
symbol becomes a refutation. I'm not greatly concerned about finding
misspellings late. This needs more thought." Not ruled.

**Issue 15, ruled 2026-11-14.** The maintainer set out three ways to
make the handling of identifiers depend on the language, since it
"may even be specific to certain symbols within a parsed expression":
a property on symbols; a kernel primitive in expressions that checks
a symbol is bound; the loader calling the kernel to check bindings,
which "would make the loader responsible for something that only the
parse grammar knows about". The review session withdrew its proposal
of closing a scope and offered a fourth, which adds nothing to the
kernel. Ruled: "This approach is the right way to handle issue 15."

- The kernel never refutes an unbound name; evaluating one gives a
  residual.
- A language checks the names it cares about. From the expression it
  built, it computes the names used and the names bound, and states
  the result as a claim on that constant. The claim is about the
  expression, so it is decided at once; a claim on the name's value
  would wait for ever. The maintainer: it checks "which symbols are
  bound and which are not for the expression as a whole - up to that
  point", with "a utility function for doing this kind of check being
  defined outside the kernel, but available to parsers and language
  specific loaders".
- The standard language checks at the end of a text.
- A form's mapping from what it matched to its expression is a pure
  function that may compute.

In the inventory: the new entry "A language checks the names it cares
about"; "a name that nothing declares" leaves the causes listed in "A
refutation marks everything computed from it"; a name nothing has
bound is a cell, in "A missing value is a cell that is filled once".
"Only the module being run performs effects when instantiated" now
has its own entry, the acceptance stream having loosened the test
that pinned the decision map's row count.

**On PR #214, 2026-11-15.** The maintainer merged the reference
kernel's first part and signed milestone 1. Confirmed with it: the
truth values are the bits of length one; the kernel primitives `if`,
`claim` and `quote`; a structure's entries are evaluated in order.

**Strength, issues 8 to 10, ruled 2026-11-15.** "Agreed on both
rulings." Strength says how the claim itself was settled; what a
result rests on is recorded beside it and never changes the word.

- Decided means a kernel evaluated the claim, on the values in hand,
  and it came out true. Assumed means someone stated it and no kernel
  evaluated it.
- The weakest-link rule applies among claims only. A claim that used
  a pure primitive stays decided and names it (issue 9).
- A claim evaluated on a capability's answer is decided, about that
  answer, and names the capability; a claim a solver merely vouches
  for is assumed (issue 8). Lowering every result that used a
  capability to assumed was rejected: a program that reads a number
  and checks it has truly checked that number.
- A restored outcome keeps the word its builder's kernel recorded and
  names the builder. An outcome that rests on a capability's answer
  is never stored (issue 10).

**Identity, issues 11 and 12, ruled 2026-11-15.** "A key is made
with the module that holds it." The kernel derives a module's
identity from its content, and its keys from that identity. A saved
program records key slots, never keys. Rejected: making a key as an
effect; a key identified by the place in the text where it is made.
Not ruled, and noted as a reading on the module decision: issue 13, a module instantiated once for each
set of arguments, every instance sharing the module's identity and
keys.

**What a key is, ruled 2026-11-15.** The first build made a key an
eighth kind of value. The maintainer asked for an alternative: "I was
assuming a key would be a Bits value or a structure." Bits or a
structure alone can be forged, since a key's content is derived from
a hash of public code. With a mark that only the kernel writes it
cannot, which is the mechanism of "Trust in a value needs no seal".
Ruled: a key is a structure that the kernel marks. The kinds stay
seven. The mark is never carried onto another value, and whether a
value is a key, or two are the same key, is asked of the kernel and
never answered by comparing content.

**On PR #215, 2026-11-15.** The maintainer: "Go ahead with the
temporary second version, the other stream is going to be a while."
The second versions of both contracts sit beside the first until the
acceptance stream moves over. And: "Let's implement the kernel
building a key for each restore claim." The first build had tied a
stored outcome to its claim only by the record's content. Now the
kernel computes a key from the claim's content, the content of the
function it sits in, and what the outcome rests on; a builder stores
it; the loading kernel computes it again and refuses the record where
the two differ.

**Values and descriptions: cluster 1 with issues 14 and 23, ruled
2026-11-15.** The maintainer merged PR #215 ("Reviewed - all good")
and took the design for what Allegro code may do with an expression.
The core idea: a value is live and a description is plain data, and
every problem of cluster 1 came from letting code treat a live
expression as data and then make it live again. Five decisions, all
agreed, two of them reversing earlier rulings:

1. A function is opaque, and describing one is an authority, held
   through the key of the module that made it or through an inspection
   right a configuration grants. This reverses "any code can read an
   expression's structure". A description never yields authority.
2. A live expression is built only from live values.
3. No argument can be inspected. This replaces "A function may take
   an argument unevaluated". (First written as "a delayed expression
   is a function, and the notation wraps it"; corrected below.)
4. One kernel primitive evaluates a function under a budget and
   returns how it ended as data.
5. An origin is a description, read under the same authority; a phase
   may drop origins nobody with the right will ask for.

No primitive inside the language makes or reads a scope. The kernel's
primitives are now eight things, listed in "The kernel's primitives
are pure and few".

The maintainer: "this is the scope of change we need. Unevaluated
arguments and carrying the originating expressions raised far too
many legitimate concerns." They had been suggested for four use
cases: conditionals passing knowledge in and out of the partial
evaluation of branches; language features not obviously supported,
such as solving for unknowns and grammars; analysis, optimisation
beyond partial evaluation and transforms; and reporting findings in
the terms of the original code. "One solution for all this was
tempting and ambitious. But I think we have separate solutions for
each." And: "We'll judge all this with another adversarial review
round."

**Lazy evaluation and unevaluated arguments are two things, ruled
2026-11-15, on PR #216.** The review session had built the reference
kernel to evaluate arguments before a call, and so wrote decision 3
as "a delayed expression is a function, and the notation wraps it",
with the conditional taking its branches as functions. The maintainer
asked when a delayed expression is needed at all, and then named the
confusion: "what you're describing appears to be lazy evaluation. All
composed functions have their arguments evaluated lazily, i.e. the
arguments are passed into the function body to the functions/
operations inside as expressions, which are only evaluated when they
are applied to eager primitive functions. 'Unevaluated arguments'
means the argument is of type `expression` and may be inspected
directly within the function body." Confirmed and built:

- A composed function's arguments are evaluated when needed, at most
  once, in the scope where they were written. An argument nothing
  needs is never evaluated.
- No argument can be inspected. That is what decision 3 removes.
- The conditional needs its condition and then only the branch taken;
  a conditional a user defines needs no wrapper.
- An effect happens when its value is needed, and the statements of a
  body are needed in written order.
- A consequence to test, not a rule: a typed function claims its
  parameter types on entry, which needs the arguments, so typed code
  is strict in practice.

### Solving (2026-11-15)

The maintainer told the acceptance stream that unevaluated arguments
were gone, "because there are so many references to the decision, and
because the work there includes plan solving, which requires
inspecting a plan expression after PE has run, so it can find
solutions more efficiently", and asked how Allegro supports solving
an expression for one or more unknowns. Ruled ("This solution looks
good to me"):

- A problem is a function of its unknowns.
- A kernel primitive specializes a function: it evaluates the body
  with the parameters unknown, under a budget, and returns a function
  whose body is the residual. It evaluates both branches of a
  conditional whose condition is unknown, performs no effect, and
  keeps a refutation inside its branch.
- The solver reads the residual by describing the specialized
  function, tries a candidate by calling it, and fixes some unknowns
  by specializing again.
- The caller grants the right to describe as a function that closes
  over its key.
- Each part of a residual stays marked with the module whose function
  it came from, and is described only under a right that covers that
  module.

The maintainer asked whether inverting all or part of a function
needs `build`. Recorded: an inverse computed as a candidate needs
none; an inverse returned as a function is a function that interprets
the inverted description, specialized; a partial inversion that keeps
a part described as opaque needs a function built with live values
taken from the function described. That form of `build` is a grant
separate from the right to describe, and is built when the planning
model needs it.

The maintainer ratified the term "specialization", and allowed the
review session a mechanical rename of decision titles in the
acceptance stream's corpus, so that every title can be made accurate.

### Titles made accurate (2026-11-15)

The maintainer asked that every decision title be correct and
accurate. The review session read all the titles against what each
decides and proposed eight changes; the maintainer questioned four,
and the result is seven retitled entries and two new ones. The
decision map keeps each former title, so the acceptance stream's
corpus passes its check and follows with one command of its own tool.

| Former title | Title now |
|---|---|
| A function may take an argument unevaluated | No argument can be inspected |
| A solver sees its problem unevaluated | A solver reads the residual of its problem |
| A value that arrives later fills a cell, and a failure fills it with an exception | A late answer or its failure fills a cell as plain data |
| An extension registers its own fields; the kernel has two | An extension registers its own fields |
| Every value keeps its origin | A value's origin is a description |
| A module is a function of the capabilities it declares | A module is a function of its capabilities, inputs and imports |
| Functions are data: params plus body | A composed function is parameters and a body |

- **"An expression is evaluated when its value is needed"** is new. The maintainer asked whether the rule for
  arguments is a corollary of a broader rule, and there was none. The
  entry says what needs a value, and that the kernel evaluates more
  only where no one can tell. Open by the maintainer's word: whether
  a structure needs its entries. The maintainer prefers that entries
  are evaluated when needed too, and holds that the order of effects
  needs another answer: "a way to determine effect ordering, and
  optionally declare ordering for specific effects, but that's a
  different topic."
- **"Reading an expression never yields authority"** keeps its title, and **"Describing a function requires authority"** is a new entry. The
  session had put both rules in one entry and retitled it; the
  maintainer: that "seems like creating a completely new distinct
  rule". The second title is the maintainer's wording.
- The cell's title names the failure: a failure fills the cell as an
  answer does, as plain data.
- The module's title names its parameters. The session's first
  wording, "a function of what it declares", read as if every
  declaration were a parameter.

Three entries also had a sentence corrected: a composed function is
reached from outside the kernel only by describing it; authority is a
value, since a key is a structure; the kernel registers three fields.
Titles that are accurate and only awkward in form are left for the
style pass.

### The remaining issues, and the acceptance stream's rulings (2026-11-16)

The maintainer asked for the remaining issues before a second review.
The acceptance stream's session had meanwhile taken rulings from the
maintainer on 2026-11-15, recorded in
`next/corpus/scenarios/README.md` and handed over as nine lines under
B-197 (evidence against a ruled decision). All nine are now recorded
in the inventory, each in a note dated 2026-11-16.

- **Issues 17 and 19 are settled by those rulings.** A strength short
  of decided prevents no effect unless a policy requires it; a refuted
  value never reaches an effect; a build reports every refutation
  that does not rest on an earlier one and performs no effect after
  the first. The entry is retitled "A refuted value never reaches an effect", from "An effect consumes only values whose claims are decided".
- **Issue 18, ruled.** The kernel keeps a refutation in its branch.
  That no branch which may be taken is refuted is the check phase's
  claim, undecided where the condition met a limit.
- **Issue 20, ruled.** A claim is never decided two ways; a limit
  only leaves it not yet decided. A step budget is no longer called
  deterministic.
- **Issue 26, ruled.** Each configuration value has a rule for which
  sources may set it. A project's file may choose its parser and
  loader.
- **Issue 30, done.** Three stale wordings corrected.
- **Issue 31.** Two of the notes are filed in the backlog: a claim
  decided wrongly at the largest machine integer, and what a module's
  one-word summary says when most laws are assumed.
- **The reader who does not know the project.** The 67 flagged terms
  go to the pass on wording, with the titles' style.

Open after this: issues 5 and 6 (recursion, by building); 7, 21, 22
and 28, which the maintainer set for discussion; 13, 16, 24 and 27,
which the first notation's questions touch; and the requirements of
the first notation itself.

### The order of effects (2026-11-16)

The first of the discussions the maintainer set. Three gaps: the
kernel could not say "this, then that"; need alone would let a rewrite
swap two reads; and a phase holding one capability could perform half
of an order. Ruled ("Yes, this meets the need"; "I agree with this
approach and your recommendations"):

- One kernel primitive for sequence, `then(first, second)`. A body of
  statements is a chain of it.
- A primitive function needs its arguments left to right.
- Effects on one capability keep their order, and no rewrite changes
  it.
- Effects on different capabilities are unordered unless an order is
  declared. A capability's definition may declare parts of itself
  unordered.
- An effect is performed only when every effect ordered before it has
  been performed; otherwise it stays in the residual.
- The order is read from the residual of a phase that holds no
  capability.
- A structure's entries are evaluated when needed. A statement needs
  its value and no more; the standard language's check reports an
  effect that nothing needs.
- Late answers: the order of arrival is information, and a program
  that needs an order declares it.

Recorded in "Sequence is one kernel primitive", "Effects on one capability keep their order" and "An expression is evaluated when its value is needed". Built in the reference
kernel: `then`, which evaluates what follows a waiting statement
ahead with no effect performed. Not built: entries evaluated when
needed, and declared orders.

### Allegretto (2026-11-16)

The acceptance stream proposed a first notation: a subset of the
standard language's surface, read through the present tree's parser.
The maintainer judged it "far from complete, or even sound". The
review session's reading: it cannot write an extension, its statements
run only by the order of a structure's entries, its recursion is a
workaround, and its emitter guesses an operator's meaning from what it
can see of an operand. The maintainer asked whether the first notation
is Allegretto, and what a text form is worth when a host loader can
load the first extensions as saved programs. Ruled:

- The first notation is Allegretto: a small language for the bare
  kernel and nothing else, usable, with blocks, bindings, operator
  expressions and function definitions. It ships with the platform.
- The parser engine and the module loader are written in Allegretto,
  test first, with their checks written out as calls. Writing them in
  the standard language and compiling with the previous build, which
  the review session recommended, is rejected as too risky.

Recorded in "Allegretto is a small language for the kernel and nothing else" and "The parser engine and the module loader are written in Allegretto". To design: the forms, and first what
an operator stands for in a language without types.

### Allegretto's forms (2026-11-16)

Ruled before the draft: an operator stands for exactly one primitive
function, and more may be added for readability; a block is bindings
and statements, which may be mixed; a primitive outside its domain is
a refutation ("I don't see an alternative"); the present parser reads
it first ("I'm sure it's pretty close"). The draft,
`next/ext/allegretto/forms.md`, was approved whole with one change:
a capability is declared by the word `capability`, "the canonical
term for what's being declared". With it are ruled the symbol
literal, `++` for joining, the binding `x <- e` that happens at its
place, and that milestone 3's programs are Allegretto texts.

Issue 21 is ruled with it: the kernel joins two bits values, measures
one and takes a part of one, beside telling two apart. The draft
listed these among the shipped primitives; they are the kernel's,
since a shipped primitive's reference definition is written in them.

### Recursion, by building (2026-11-16)

Issues 5 and 6 were left to be settled by building. The block of
bindings makes a recursive function one value, and the reference
kernel then showed three things:

- In ordinary evaluation no rule is needed. An undecided conditional's
  branches stay unevaluated, so a recursion on an unknown argument
  ends with the inner call unopened. The reviewers' picture of calls
  opened without end assumed both branches are evaluated.
- Where effects are performed the rule must not apply. A function
  that prints and calls itself with the same argument is a program
  that prints for ever.
- The rule is needed where the kernel evaluates ahead of what is
  done. A check phase holds no capability, so a program's first
  effect waits and everything after it is evaluated ahead. There a
  call to a function already being opened with the same information
  stays in the residual. Built, and tested on a loop that prints for
  ever: checked, it ends.

Open: a recursion whose argument changes with known values, evaluated
ahead, runs to its budget. A counter that prints from a known start
with no end is the case. It needs a rule for generalising, and is
taken with specialization. On issue 5 the kernel's part holds: a claim
on a call left in the residual is undecided. The standard language's
part, assuming a function's claims at its own inner call only under a
decided decrease, is for the maintainer to rule when Part IV is built.

## Terms introduced

- **Description**: plain data that says what an expression looks
  like, holding public identities where the expression holds
  unforgeable values.
- **Inspection right**: the authority to describe a function one did
  not make.
- **Rests on**: what a result's evaluation used that the kernel did
  not itself evaluate.
- **Key slot**: a place in a module where one of its keys goes.
- **Specialization**: a function whose body is the residual of
  another function's body, evaluated with its parameters unknown.
- **Instantiate**: to call a module's function with its capabilities
  and inputs, yielding its bindings.
