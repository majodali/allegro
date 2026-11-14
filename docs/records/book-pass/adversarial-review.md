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

## Terms introduced

- **Instantiate**: to call a module's function with its capabilities
  and inputs, yielding its bindings.
