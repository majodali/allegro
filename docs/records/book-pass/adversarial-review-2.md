# The second adversarial review

> **Record.** Written 2026-11-17 by the review session. It reports what
> four independent reviewers found in the design as it stood after the
> first review's issues were ruled, and sorts the findings. Nothing in
> it is ruled: the rulings are the maintainer's, and are recorded here
> as they are taken.

## What was reviewed, and how

The 245 decisions of `docs/plans/book-pass-inventory.md` as they stood
on PR #240, with Allegretto's forms (`next/ext/allegretto/forms.md`),
the kernel's interface (`next/kernel/interface.ts`), the saved-program
data form, the head of the reference kernel and the shipped
primitives. The maintainer asked for the round on 2026-11-17; the
wider scope was the review session's recommendation, taken when the
maintainer did not choose between the two.

Four reviewers read an extract with no reasoning in it: each decision's
name, what it decides, its status and what it depends on. None saw the
first review, the records or the notes. Their angles: consistency,
feasibility, security, and a reader who does not know the project. The
feasibility and security reviewers ran probes against the reference
kernel. The brief, the extract, the four reports and the probes are in
`adversarial-2/`. The reports number the decisions in the extract's order,
from 1 to 245 with a letter D before each.

The four reports hold 60 findings. Sorted and merged they are the 14
clusters below. "Ran" means a reviewer's probe showed it on the
reference kernel; the review session ran the security probes again and
each completed. A finding the review session has not itself checked
against the text is marked so.

## The clusters

### 1. A name is resolved where the code is evaluated, not where it was written

- A saved program may hold a free name. The kernel looks it up in the
  scope the module is instantiated in, so a record that declares no
  capability used one the host had bound, and read a binding made
  later (security 3; ran).
- A function made by `build` takes its free names from the block
  around the call that builds it. A library read its caller's
  capability and binding this way (security 4; ran).
- A proposal is a description with names; placed, it reaches what is
  in scope where it is placed (security 7).
- "By being evaluated in a scope that holds it" grants a capability by
  name, against "Authority is an unforgeable value" (stranger 13).
- "In the scope where it was written" against symbols resolved by base
  name; a saved residual captures names (consistency 6).

Direction: a module's function and a built function have no free
names. The maintainer has already ruled that `scope` and `bind` leave
the interface; with that, what a function may name is what its own
blocks bind and what it is handed.

### 2. A module's identity, its instances, its keys and stored outcomes

- Keys follow from a module's content, and the content leaves out what
  each parameter is declared to be. Two records with the same nodes and
  different declarations got the same identity and the same key
  (security 1; ran).
- Every instance has the module's keys, so an instance handed other
  imports reaches what another instance protects (consistency 1, 9).
- A stored outcome for a claim that mentions a parameter or an input
  is restored for every value: a claim was reported decided for a value
  that refutes it, and the value reached an effect (security 2; ran.
  The kernel's own test restores such a claim).
- A record names an import by name only, so an outcome can be restored
  against other imports (consistency 4).
- A prompt session is a module, and a module's identity is its content
  (stranger 14).

Direction: what a module is declared to take is part of its content; a
key belongs to an instance or instantiating is the loader's alone; only
a claim with nothing unknown under it is restored.

### 3. A private member has nowhere to live

`get` by place, `count`, a primitive function's view of a structure
and a field's free reading all show an entry whatever its key (security
6, ran; consistency 2). "A private member is one whose key not all code
holds" does not say where the member is stored.

### 4. The mark of where a part was written is not built, and has no stated carrier

- A callee wraps its argument in a function of its own and describes
  that with its own key: it read the caller's expression and constants
  (security 5; ran). The mark on each part, ruled with solving and for
  issue 28, would close it; the kernel marks whole functions.
- The mark is none of the kernel's three fields, is absent from the
  data form, and a description can lose it (consistency 7).
- A solver cannot read parts of a residual that came from other modules
  (consistency 14).
- An origin is free to read in some decisions and read under a right,
  and droppable, in others (stranger 4).

### 5. Claims under evaluation when needed

- A claim written in a binding or an entry nothing needs is never
  evaluated, silently, where the tools promise every claim (stranger
  7, consistency 11, feasibility 10; ran).
- A typed function's claims on its parameters evaluate arguments its
  untyped form would skip (feasibility 10).
- An undecided claim written as a statement holds back the effects
  after it (consistency 11).
- Assumed, sampled and "cannot tell" have no way to be recorded: the
  kernel's claim refutes any known answer that is not true, and only
  the kernel records an outcome (feasibility 9).

### 6. How a library is loaded, instantiated and given capabilities

- Nothing keeps an imported module's top-level statements from acting
  (stranger 8, consistency 8, feasibility 14).
- An imported module that needs a capability has nobody to hand it one:
  `import name` takes no arguments (stranger 2).
- A capability a phase lacks is said to be a cell, but a cell is filled
  with plain data only; what a check phase passes for `capability
  output` is not said (stranger 1).
- `use` needs a module's values while the text is parsed, where
  "loading evaluates nothing" (consistency 10, stranger 8).

### 7. `attempt`, limits and budgets

- The limit comes back as data, so a claim on it is decided one way in
  one kernel and another way in another, against "The same program and
  the same information give the same result" (consistency 3,
  feasibility 2 ran, security 9).
- Step counts are data: a caller recovered secret bytes from them, and
  one module learned what another had evaluated (security 9; ran).
- After a limit an evaluation cannot go on, and evaluating again
  repeats its effects (feasibility 4; ran).
- A step budget bounds neither time nor memory: 16 steps took 8.6
  seconds. A limit that is not the budget ends the caller's evaluation
  and is not `attempt`'s answer (security 13; ran).

### 8. The order of effects, a refutation, and a kernel that knows no phase

- Whether effects on different capabilities are ordered is said three
  ways (consistency 5, feasibility 12).
- The interface cannot say in what order late answers arrived
  (feasibility 12).
- "After a phase has refuted a claim, it performs no further effect":
  one `advance` reported a refutation and performed another waiter's
  effect (security 11; ran).
- "Halts" still has three meanings (stranger 3).

### 9. Recursion, loops and strength

- A recursive function's claim is "assumed at the inner call and
  decided on the body", with no termination claim required, against the
  rule that a result is as weak as what it rests on (consistency 12,
  feasibility 11, security 12). This is issue 5 of the first review,
  left to building.
- Evaluation ahead and specialization do not end on a loop that carries
  state, and "the same information" is not defined (feasibility 3; part
  ran). This is the second half of issue 6.
- Recursion is the only loop. An accumulator that is not needed until
  the end grows a chain that fails near 400 turns (feasibility 8; ran).
  The maintainer has ruled that the depth limit goes.

### 10. What a residual holds, and what a record can hold

- A residual read as data and built again performs an effect twice:
  "evaluated at most once" is not in the data (feasibility 5; ran).
- A phase's residual holds a function made in a block, a value with
  fields, another module's key, a cell and a live capability. The data
  form and a description hold none of them (feasibility 6, consistency
  15).

### 11. Building data in Allegretto

No primitive makes a structure of a computed size or with a computed
key, makes a symbol from a text, lists a structure's keys or tells a
value's kind (feasibility 1, stranger 9, stranger 6). A parser's output
is a description, whose applications and structures have as many
entries as the text gives. The acceptance stream's parser speed test
builds its trees from nested pairs, so the engine is not blocked today;
its output cannot be a description without at least the first of
these.

### 12. Notation

- A notation that only adds can still change text that parsed before:
  by longest match, by a word added to a cumulative reserved set, or by
  a terminal that changes the parser's state (security 10).
- A grammar change in mid-text needs a rule for when the parse is
  settled, and terminals with state break termination on left recursion
  (feasibility 13).
- `x <- e` followed by `y = x + 1`: the binding waits for ever or takes
  an outer `x` (feasibility 7 ran, consistency 13). The acceptance
  stream had read it the same way and refuses the text.
- Gaps in the forms document: dotted primitive names against `.`
  access, `count` and `same` unnamed, the example `is_int` cannot
  exist, `attempt`'s shapes unstated (stranger 11, feasibility 15).

### 13. What is trusted, and what the interface gives away

- The loader hands out every capability and the parser gives every
  text its meaning. Both are trusted in fact, and a project's file may
  choose them; "Three things are trusted" names neither (security 8).
- Any holder of the kernel object can restore with any builder's name,
  take the inspection right and read any function. A primitive's hash
  is what its declaration says it is. A pure primitive is reachable by
  hash through `build` by code that was never handed it (security 14).
- A launcher cannot list the claims of a result: a result has one
  boolean (stranger 12).

### 14. Wording, and the reader who does not know the project

- "The kernel's plain data is a sequence of bits, and it computes
  nothing on them" against joining, measuring and slicing (stranger 5).
- "Expressions are values" against "no code holds an expression"
  (stranger 10).
- A symbol is three things under one word (stranger 6); symbols keep
  types apart by accident only (security 15).
- Eight decisions decide "open"; nine are written in the present
  tree's vocabulary (stranger 15).
- Ten terms a reader needs earlier: claim, configuration, capability,
  halt and refutation, strength, policy, cell, scope, description and
  right, module and key.

## Faults in the reference kernel's code

Reported apart from the design, each to be checked by the kernel
stream: a function made in a block inside a module loses the block's
names (ran); a failure of the host's stack inside `attempt` ends the
whole evaluation; a binding made through the interface's `bind` is
evaluated again by each `evaluate`.

## What the reviewers checked and found sound

Primitives and `fill` refuse to return or deliver a function or a key.
A key cannot be forged or built. Another module's function stays
opaque to a direct `describe`. A refuted value does not reach an effect
by any direct path. Evaluation ahead performs no effect. A nested
`attempt` is held to the outer budget. The data form's checks hold for
what they cover. The decisions' dependency order holds.

## The review session's reading

The first review's findings gathered around expressions as readable
data. This round's gather around three things built since: names and
scopes, modules as functions with instances and keys, and evaluation
when needed. Clusters 1 to 4 are about authority and are the most
serious; four of their findings were shown by running. Cluster 1 has a
direction the maintainer has already taken. Cluster 2 needs design.
Clusters 5 and 6 are where evaluation when needed meets the standard
language's promises, and each has more than one reasonable answer.

## Rulings taken

### Cluster 1: names (2026-11-17)

The maintainer agreed the order of the clusters and took the first.
Ruled ("I agree with the rule and with your recommendation on how to
handle `bind` and `scope`"):

- A name means the binding of the innermost enclosing block that
  binds it. A name no block binds is free, and a free name never gets
  a value.
- A module's function has no free names; the kernel refuses one that
  has.
- `build` takes a value for each name a description leaves free, and
  a built function reads nothing from where it is built. This is also
  how a live value is supplied to a description.
- A proposal uses only the names its obligation lists.
- A capability is handed over by value only.
- `bind` leaves the interface now. `scope` stays as a token until the
  two versions of the interface are made one.

The maintainer asked whether a free name can appear in a correct
program. It cannot, except where it is never needed. So the ruling on
issue 15 of the first review is revised, on the review session's
recommendation: the kernel refuses a free name where a function is
made, and refutes one that is needed in an expression handed to it.
`waiting()` lists cells only.

Built in the reference kernel with the ruling, and one fault a
reviewer reported is fixed: a function made in a block inside a
module lost the block's names.

### Cluster 2: a module's identity (2026-11-17)

Ruled ("I agree with all six points, and the cost is acceptable"):

1. A module's identity covers what it declares: each parameter's
   role and name, and for an import the identity of the module
   imported.
2. Instantiating checks the imports: an argument for an import must
   be an instance of the module declared.
3. Instances that differ only in capabilities and inputs share
   identity and keys.
4. A stored outcome is restored only for a claim with nothing unknown
   under it: no parameter but the module's key slots and imports, and
   no cell.
5. A prompt entry is a module that imports the session so far.
6. A field belongs to a module's identity, not to an instance.

Set aside: a key for each instance covering its capabilities and
inputs (no key would exist until a run supplies the inputs); and
instantiation by the loader alone under a granted right (it relies on
every loader, and does nothing for stored outcomes). The cost,
accepted: an edit to a module changes the identity of everything
that imports it.

Points 1 to 4 are built in the reference kernel and the data form.
Points 5 and 6 wait for the prompt and for metadata fields.

### Cluster 3: where a private member lives (2026-11-17)

Ruled ("I agree with the solution and all recommendations"):

1. An entry of a structure may be keyed by a key, and `get` with that
   key reads it.
2. Such an entry has no place and is not counted.
3. A primitive function is handed the structure without it, and it is
   not evaluated for that.
4. Conformance, descriptions and saved programs follow from the key,
   as already ruled.
5. The host's `entriesOf` shows every entry, until the interface is
   split into narrower handles.

Recorded with it: equality from outside ignores private members; a
primitive that builds a structure from another is to carry them
across. Set aside: private data kept inside a function that checks
the key.

Built in the reference kernel. Allegretto has no form for a key yet.

### A form for keys in Allegretto (2026-11-17)

The maintainer, on PR #247's gap: "in general Allegretto has forms
corresponding to all kernel functionality". Ruled ("Let's go with this
approach"):

- A header line `key name` declares one of the module's keys.
- A structure literal writes a private entry as `[name]: e`. The
  brackets hold only a key's name for now.
- Reading needs no form: `p[name]` is `get(p, name)`.
- A module may hand a key out by exporting a binding of it.

Recorded in `next/ext/allegretto/forms.md`. The grammar, reader and
emitter are the acceptance stream's.

### Cluster 4: the mark on each part (2026-11-17)

The review session proposed four points and asked for rulings. The
maintainer first asked whether `describe` is needed as a general
operation: "could we have it only available to a limited set of system
modules? Would that then remove the need for this fine-grained
authority machinery?" The review session's answer: yes. Describing by
a right the configuration grants, and by nothing else, removes the
marks, the opaque form and marks in the data form; the cost is that a
solver or an optimiser is trusted to read all code. It recommended the
change.

Ruled against: "I agree, the vast majority of projects will have only
a single optimizer and at most one solver - so this is a very
reasonable approach. However, I'm going to rule we don't take it, and
keep `describe` generally available, and mark every node in an
expression. My main reason for this is that it enables more
sophisticated integrations between a grammar extension and the code
that uses it - e.g. solvers, autograd, library specific optimizations,
etc." The maintainer: "When we write the book, this will be a decision
we encourage readers to try both sides of."

Built on that ruling, with three of the review session's points taken
as it proposed them and put to the maintainer on the PR:

- A function built from a description takes the mark of the code that
  built it; a part host code made has none.
- An opaque part lists the parameters of the described function that
  it mentions.
- An origin is read under a right wherever it is mentioned.

Deferred to cluster 10: marks in the saved-program data form.

Confirmed by the maintainer on PR #249: all three points, the term
"mark", and the opaque part's list of parameters going untested until
specialization is built. Two questions were answered first. A record
of the second version is made a module when it loads, so its parts
are marked; a record of the first version is not, and only the
inspection right describes it. A part host code builds stays
unmarked and closed: a host that wants a part to be a module's makes
it one, and a rule that an unmarked part is open to all would fail
open. The entry on reading a field with `Y of x` is reworded so that
`source of x` reads an origin under a right.

### Cluster 6: imports (2026-11-18)

The review session proposed that an importing module name each
capability it hands a library, and that a module with top-level
statements could not be imported. The maintainer changed both.

Ruled:

1. An import is a binding the importing module evaluates itself: a
   call of the imported module's function. The kernel supplies that
   function by the identity declared. This replaces the check of
   cluster 2 that an import is an instance of the module declared.
2. By default an import hands over each capability and input the
   imported module declares that the importing module holds under the
   same name. `with name: value` hands another value for a name, in a
   comma-separated list, and what is not listed is still handed by
   default. `without name` withholds one: it silences the finding, and
   hands a refusal that happens if the imported module uses it.
3. A capability or input the imported module declares and nothing
   hands it is a finding.
4. `capability`, `input`, `key` and `import` may stand anywhere at a
   module's top level, in any order. Only `use` has a place.
5. A module's top-level statements happen when it is instantiated: a
   library's when a module that imports it first needs it.
6. One instance for imports of the same module with the same
   arguments. The maintainer was unsure of this, "that function may
   not be pure", had no case that needs two, and let it stand.
7. A capability a phase lacks is a parameter left unknown.
8. Reading a text evaluates the notation it uses, from an instance
   made with no capability and no input.
9. Inputs are handed to an import as capabilities are.

Built in the reference kernel: the table of modules by identity, the
instance for each set of arguments, and `refuse`. The forms are in
`next/ext/allegretto/forms.md`. The finding of point 3 and the forms
are the reader's and the emitter's.

### Cluster 5: claims under evaluation when needed (2026-11-18)

Ruled ("I agree with all four points"):

1. A claim is needed where it is made. Every claim form of the
   standard language places its claim among the statements of its
   block. In Allegretto a claim written as a value stays evaluated
   when needed, and the end-of-text check reports one nothing needs.
2. Claiming a parameter's type needs the argument: a typed function
   evaluates that argument on entry.
3. A claim that waits for a value holds back what follows. A claim
   that is done holds back nothing, whatever its outcome short of
   refuted.
4. The weaker outcomes are recorded by the kernel on request: assumed,
   with who assumed it from the mark; undecided, when what decides a
   claim answers that it cannot tell; sampled, by the kernel evaluating
   the cases. Code can ask for a weaker outcome and never a stronger.

Built at the maintainer's word: `assume` and `undecided`. Sampling and
the standard language's claim forms are built with Part IV.

### Cluster 7: attempts and limits (2026-11-18)

Ruled ("I agree on all five rules and recommendations"):

1. An attempt's answer "limit" is information from outside the
   program. A result that went on from it rests on a limit, is never
   stored or restored, and is not compared between kernels.
2. `attempt` stays available to all code. Step counts can be observed;
   the kernel's comparison takes steps by size and not by content, and
   a project may claim a module does not use the primitive. Attempting
   as a right was set aside.
3. A limit pauses an evaluation, which the caller continues. Built
   when the evaluator stops using the host's stack.
4. A step is a bounded amount of work: bits are charged by size, and a
   structure handed to a primitive function by its entries.
5. Effects inside an attempt that reaches its limit stay performed.
   An evaluation made for a text nobody trusts yet runs under a
   configured budget.

Built: the record of a limit, the refusal to restore an outcome that
rests on one, charging by size with primitives on bits that work a
byte at a time, and a fault fixed: the host's stack running out inside
an attempt ended the whole evaluation.

With this the seven clusters the maintainer put first are ruled.
Seven remain: the order of effects and a kernel that knows no phase
(8), recursion and strength (9), what a residual and a record hold
(10), building data in Allegretto (11), notation (12), what is trusted
and what the interface gives away (13), and wording (14).

### Cluster 11: building data (2026-11-18)

Ruled ("I agree with all five primitives and both recommendations"):

- `put(structure, key, value)`: a new structure with the entry added
  at its end, or in place of the entry already under that key. The
  key is a symbol, a key, or the empty structure for none. The value
  is not evaluated. Private entries are carried across.
- `key(structure, place)`: a symbol, or the empty structure.
- `kind(value)`: bits, symbol, structure, function or key, as a plain
  symbol. A composed function and a primitive one are both functions.
- `symbol(text)` and `spelling(symbol)`.
- The brackets of a structure literal take any expression.

Left out until needed: removing an entry, listing all keys at once,
and building a structure from a list in one step.

Built in the reference kernel.

### Cluster 10: what a residual holds (2026-11-18)

The review session proposed that a phase's residual be a module
function that can be saved as a third version of the data form, loaded
only on its builder's word because it would hold marks, other modules'
keys and values with fields.

The maintainer questioned the premise: "My assumption has been that
phases get rerun, rather than saving a residual. That's also not a
decision, we need to weight the pros and cons of saving a phase's
residual. If multiple phases are run in sequence in a single
execution, I assume that means we just use the residual from an
earlier phase directly without saving."

The review session weighed it. Saving buys faster starts, carrying
build-only information to a run, and shipping less. It costs a record
that is trusted on a builder's word, a saved form for every future
kernel feature, two paths that must agree, and staleness. It
recommended rerunning.

The maintainer on export, which keeps the need: "When an exported
executable gets run, it will have a wrapper than binds runtime
capabilities like console, filesystem, networking etc. Similarly, when
a deployable artifact is exported and then deployed, it has
environmental information and resources configured and attached. In
both of these cases, the code must act exactly as if those same
resources/capabilities were bound within an Allegro execution. So
ultimately we can't escape the 'two paths that must agree'." And on
phases: "I've never thought of phases as a first class element of the
Allegro build system."

Ruled: "Let's go with rerunning phases in sequence, until we address
the export use case." Then: "I agree with all recommendations, and
confirm the block form for `describe`."

1. Phases are rerun. In one execution the next phase evaluates the
   residual as the kernel holds it. A later execution loads the saved
   programs, restores outcomes and runs the phases again.
2. Saving a residual is not taken now. It returns with export, with
   marks in a data form, other modules' keys and values with fields.
3. An exported program behaves as the same program in a kernel with
   the same capabilities bound, and tests hold the two together. A new
   decision; not built.
4. A description is a program that means the same. A function made in
   a block is described with the bindings it reads, as a block around
   it. An argument used more than once and not yet evaluated is a
   binding of that block. The kernel renames a binding whose name the
   description already writes. Sharing a part in two places means
   nothing.

Built: point 4, in the kernel's `describe` and `build`. A binding that
is plain data is written where it is used and needs no block. The
block is around the whole function, which is right while no binding
mentions a parameter of a function inside the description; a block
inside a function comes with specialization.

Not answered: a residual that waits on a cell at the end of a phase
stays in its kernel, and nothing more is ruled about it.

### Cluster 13: what is trusted (2026-11-18)

Six points, ruled as the review session proposed them ("I agree with
all 6 rulings"):

1. The loader and the parser are checked code that is still relied on:
   the loader is handed every capability a program gets, and the
   parser gives every text its meaning. A result names both by module
   identity, with the source that chose each.
2. A project's file keeps its choice of loader and parser, bounded
   three ways. The loader's file capability in check reads only the
   project's and the platform's directories. A loader a project chose
   runs under the launcher's ceiling. Only the launcher and the
   command line grant the inspection right, allow restore, keep
   origins or turn off a default policy.
3. Whoever holds the kernel object is trusted as the launcher is. The
   interface is not split into narrower handles. Allegro code reaches
   restore, inspection and loading through capabilities the launcher
   makes, each as narrow as its decision says. The split waits for an
   embedding application with host plug-ins.
4. A primitive's hash is its registrar's statement; the kernel does
   not verify it.
5. A pure primitive is available to all code. Reviewing a primitive
   includes reviewing its "pure".
6. A result lists its claims: one record for each claim as written,
   with counts by outcome, how many wait, the reasons and what the
   outcomes rest on.

Built: point 6, in the reference kernel and the interface, and the
warning of point 3 in the interface. Points 1 and 2 wait for the
loader and the launcher's configuration.

The stranger's fourteen questions from a new launcher's author are
mostly wording of the interface; they are taken with cluster 14 or at
the interface merge.

### Cluster 9: recursion, loops and strength (2026-11-18)

The review session proposed seven points, the third being an
induction rule in the kernel. The maintainer: "When we get into the
standard language we'll implement more sophisticated recursion
analysis - all recursion will be unfolded and put through rigorous
data-flow analysis. That will cover most of these points." And on the
third: "do we leave recursive functions assumed until the standard
language, or do we implement a simple kernel rule now that is
superseded by more sophisticated analysis in the standard language?"

The review session recommended leaving it, and withdrew its reason
for a kernel rule: the standard language's analysis is a function the
kernel evaluates, so its answer is decided and rests on the extension;
only the kernel writes "decided" either way. A claim inside a
recursive function in Allegretto is evaluated on each call's real
arguments and needs no induction. A kernel rule would need
specialization and knowledge carried on an unknown value first, and
would then be replaced.

Ruled ("Ok - go ahead with those rulings"):

1. The kernel never assumes. The sentence "assumed at that inner call
   and decided on the body" is struck.
2. A claim about every value of a recursive function is as strong as
   the function's termination claim. The standard language's rule.
3. No induction rule in the kernel. Until the standard language,
   Allegretto writes such a claim with `assume`.
4. Ahead of what is done, a function already being opened is not
   opened again, whatever it is given.
5. "The same information" is defined with specialization, by the
   standard language's unfolding of recursion.
6. An argument that is a pure primitive function applied to values
   already known is evaluated when the call is made.
7. A call that is the value of a body takes no space. The entry on
   tail calls is restated and retitled "A loop written as a recursion
   runs in constant space". No loop form in Allegretto.

Built: points 4 and 6. Point 7 comes with the evaluator's move off the
host's stack.

### Cluster 8: the order of effects (2026-11-19)

The review session proposed that sequence and need order every effect,
with "unordered" as a licence a capability's definition grants. The
maintainer asked which finding wanted a default order. None did: two
findings said the decisions gave two answers for one program.

The maintainer: "my main reason for keeping ordering undefined is to
allow concurrent execution wherever possible. My preference is for
`then` to be only be used when two effects need ordering and
evaluation order doesn't determine the required order. I would even
allow undefined ordering on effects in a single capability - e.g.
reading and writing files could happen asynchronously. What we need is
a set of use cases to determine when ordering is and isn't necessary,
in a single capability and across multiple."

The use cases. "Decides" is need (the second uses the first's
answer), the capability (its definition knows), or the writer.

| # | Case | Order needed | Decides |
|---|---|---|---|
| 1 | Two lines written to the console | yes | the capability |
| 2 | Two reads from standard input | yes | the capability |
| 3 | Writes to two different files | no | nothing |
| 4 | Write a file, then read it; two writes to one file | yes | the capability, by path |
| 5 | Make a directory, then write a file in it; write a temporary file, then rename it | yes | the writer |
| 6 | Two requests to different web addresses | no | nothing |
| 7 | Send data to a service, then read it back | yes | the writer, or need |
| 8 | Read a counter, then write it plus one | yes | need |
| 9 | Read many module files at load | no | nothing |
| 10 | Replies on one connection; requests on different ones | yes; no | the capability, by connection |
| 11 | Write a prompt, then read the answer | yes | the writer |
| 12 | Read a file, send its content over the network | yes | need |
| 13 | Log "deleting", delete, log "deleted" | yes | the writer; need for the second log if it takes the delete's answer |
| 14 | Read the clock, do work, read the clock | yes | the writer |
| 15 | Take a lock, write, release it | yes | the writer, or need |
| 16 | Charge a card, then ship | yes | need, if shipping takes the receipt |
| 17 | Send an email and a text message | no | nothing |
| 18 | Record a metric beside any other effect | no | nothing |
| 19 | Fetch two pages, print both | fetches no; prints yes | the console; need |
| 20 | Close a file after all writes to it | yes, after all of a set | need, if the close takes their answers |
| 21 | Read an answer at run time, claim it is "yes", delete everything | yes | the writer: the delete takes none of the claimed value |
| 22 | Try, catch and finally | catch by need; finally by `then` | the writer |

What they showed: need settles many cases, and a capability's design
can make it settle more; no one default fits inside a capability;
across capabilities a short list needs an order with no data flowing
(11, 13, 14, 15, 21).

The maintainer's answers:

- "lack of explicit effect order doesn't mean indeterminacy. Two
  executions with the same information and inputs will still result in
  the same output including order of effects."
- On the cases where an order is easy to forget: "it's a stronger
  argument for designing those capabilities with more intuitive APIs -
  e.g. console `prompt` operation; file lock/operation/release blocks
  and mutexes and transactions more generally; timers and loggers that
  wait for the operations they are timing or logging to complete. I'm
  in favor of having a synchronous block form as an option, and even
  configurable warnings for when certain effect combinations are not
  strictly ordered. I don't want to go down the synchronous by default
  path until we've seen evidence it's necessarily better."
- "I don't think capabilities will be marked as wholly ordered or
  not."
- On case 21: an operation that needs authorization takes the token
  and is checked far earlier, and such claims are mostly decided
  before the capability is there. "Nevertheless, I agree with your
  recommendation - refuted claims should block all effects written
  later in the same block."

Ruled ("I agree with the other six"), of seven points:

1. Unordered means the kernel starts statements in the order written
   and none waits for an earlier one to be over. A statement waits
   where it uses an earlier one's value, where `then` says so, or
   behind a claim.
2. A second kernel primitive, `also(first, second)`, is what a block's
   statements are a chain of. `then` stays as the ordered one.
3. Not taken as proposed. The review session proposed that a block is
   over only when everything it started is over. The maintainer:
   "There may be some value in a function returning its value and
   allowing its calling expression to continue evaluation, while
   kicking off some asynchronous cleanup. An example might be an
   websocket request that returns a response and then checks if it
   should close the socket." Built to that: a block gives its value as
   soon as its last statement's value is known, and what it started
   goes on as work of the evaluation.
4. The arguments of a primitive function and the entries of a
   structure needed in full are started in order and none waits. This
   reverses what was built on 2026-11-16.
5. A claim holds what is written after it in its block.
6. A block in sequence is written `sync` in Allegretto.
7. No capability is marked ordered. Its definition offers patterns of
   use, written in Allegro with `then`. A project may claim an order
   over a residual's description, and a tool may warn. Not built.

What follows from the third point as built, put to the maintainer on
the PR: a refutation in work that goes on after a value was given is
reported by the `advance` that meets it; "finally" waits for a body's
value and not for work the body chose to leave going; steps that work
spends are charged to the `advance` that takes it up, not to an
attempt that has answered.

#### Late answers (2026-11-19)

The maintainer, on the work that goes on after a value is given: "we
should go into detail on the mechanism used when a capability's effect
returns an asynchronous value, such as a file or network read or
waiting for a write to complete. That's going to be the more common
case for a body to continue processing after returning a value."

The mechanism as it stood: an effectful primitive's host code starts
the operation and returns a cell; the launcher fills the cell when the
answer arrives and calls `advance`; `advance` walked every unfinished
evaluation from its top, in the order they were started. Five
shortfalls for a common path: every arrival walked everything; steps
were spent again; the order was not the order of arrival; a failure
nothing reads is lost; nothing bounds how much is in flight.

Ruled ("I agree on 1, 2 & 5"):

1. A cell knows what waits on it. `advance` takes up only the waiters
   of cells filled since the last call, in the order the cells were
   filled, each once.
2. Two steps. Now the waiter is a whole unfinished evaluation. With
   the evaluator that keeps its own stack, it is the computation at
   the point where it stopped.
5. How much is in flight is the capability's business.

Built: the first step of point 2, with point 1.

Point 3, whether `fill` takes up the waiters itself. The maintainer:
a waiter that is a suspended evaluation "could include a reference to
the step budget and timing counter(s) so an active `fill` would
continue to use the current budget"; asynchronous work is mostly done
at run time and budgets mostly at check time; the reasons for `fill`
then `advance` look like batching and transactions, in which case "use
of passive `fill` plus `advance` may be opt-in only". The review
session found three more reasons, none needing the passive form by
default: an answer must not be taken up in the middle of another
computation; a host bounds one call's time at run time too; results
need one place to land. Transactions are no reason: answers are acted
on in the order of the fills, so filling several and then advancing
does what advancing after each does.

Ruled ("I agree with the four recommendations for point 3"):

- `fill` takes up what waits on the cell and returns what `advance`
  returns. Called while the kernel is evaluating, it is queued and
  taken up before that call returns.
- Each evaluation carries the budget it was started with.
- `advance` stays for going on after a limit, and for filling several
  cells before any is acted on.
- It is made when the interface's two versions are made one, with the
  acceptance stream, whose launcher calls `fill` and then `advance`.

Two gaps the maintainer named. How a budget is filled up again at run
time: "This is thread management, we should cover this and other
details in a separate discussion on that." Open. And how what `fill`
returns is used: only the launcher fills, since the kernel object
stays with it, and a capability's host code hands the launcher the
promise of its answer. A refutation ends the phase; claim records go
into its report.

Point 4, a failure that nothing reads. The maintainer: "`check`
asserts program correctness, it does not handle runtime exceptions. My
assumption is that operations that may return a catchable exception
will have a return type that is a union of the success result type and
all exception types, rather than having a separate 'throw' mechanism
as other languages do." Then two alternatives: "have `then(a,b)` and
`also(a,b)` claim their respective `a`s return a non-exception value",
or have them test the result and return the exception. The second
cannot work for `also`: by the time a late failure arrives the second
has started and the block may have given its value.

Whether that claim holds what follows: "(a) having the claim on the
first not hold evaluation on the second - reversing a previous
decision to have claims always hold; (b) if the claim is cleared at
runtime then the two statements run at once, if not, then the `also`
behaves like a `then`." The review session had argued for (a), and
withdrew it: only a statement whose value is dropped is held, a bound
one and the arguments of a call still run at once, and (b) needs
nothing of the kernel.

What a failure is. The review session first proposed a mark of the
kernel's. The maintainer: "not sure why it has to be private. If
`kind` is going to return a distinct value, it would be odd if it's
inconsistent with the set of Value kinds", and "I tend to think
metadata fields should only by information that is likely removed by
PE and doesn't have to be present in a fully optimized program at
runtime. Having exceptions denoted by a kernel authored mark also
makes metadata mandatory at runtime. Perhaps we need to look at pros
and cons of the different approaches before overriding the previous
decision." Three forms were compared: plain data of one shape, a mark
of the kernel's, and the ruled field an extension owns.

Ruled ("I agree on all four"):

1. A failure is plain data of one shape.
2. Option (b), written by the notation: a statement whose value is
   dropped is claimed to be no failure.
3. `is_failure(x)` and `handle(x, name, handler)` are Allegretto
   functions and no primitives. `handle` names the failure it handles,
   as the maintainer asked in place of a function that ignores one.
4. The ruled entry is reworded and retitled "A failure a program can
   handle is plain data of one shape".

The maintainer on the standard language: "I would have an extension
type hierarchy in the standard language, but it would also include the
`failure` field to remain compatible with Allegretto." So the shape is
a structure whose first entry is keyed `failure`, where the review
session had proposed the bare symbol as the first entry.

Built: nothing in the kernel. Its tests hold that the two functions
and the claim need no primitive.

#### What a refutation halts (2026-11-19)

The last three points of the cluster, ruled as proposed ("Agreed and
confirmed on all three asks"):

1. A call of `advance` that meets a refutation performs no further
   effect in that call. The rest are evaluated ahead and stay for a
   later call; the launcher says whether there is one.
2. After a refuted statement the kernel evaluates what was written
   after it ahead, to report further refutations. A claim that only
   receives an earlier refutation is not counted again.
3. "Halts" has one meaning, stated in "A refuted value never reaches
   an effect": a refuted claim halts its phase. Six other entries used
   the word, or "before any effect", otherwise and are corrected.

Settled in building: looking ahead is given half of the steps that
are left, so it never ends an evaluation at its limit. The maintainer
on PR #258: "Halving the remaining budget is ok, but arbitrary. We
could change it so that an evaluation that uses its budget but has a
refutation, would still return the refutation. Not a high priority
though." Filed with B-202 (threads and budgets at run time). The
definition of "halts" was confirmed as written.

The maintainer also confirmed the shape of a failure, a block giving
its value early with what follows from it, and that a claim inside a
called function holds as one written in the block does.

With this cluster 8 is ruled. Two remain: notation (12) and wording
(14). Open beside them, filed in the backlog: B-202 (threads and
budgets at run time) and B-203 (streams, large data and asynchronous
iteration).

### Three questions after cluster 8 (2026-11-19)

The maintainer asked three things before cluster 12.

Whether a claim can be assumed false, or another's assumption
overridden: "a user may decide claim assumed by a module is unreliable
or concerning and want to analyze a program with that claim assumed
false, to see the effect." The review session: the kernel derives
nothing from an assumption, so assuming one false would show nothing.
Ruled: no way to assume a claim false; what rests on an assumption
names the assumption as written; a configuration may withdraw an
assumption, which is then evaluated as a claim.

Streams, large data and asynchronous iteration: a discussion of its
own, filed as B-203 (streams, large data and asynchronous
iteration) beside B-202 (threads and budgets at run time).

"Should `then(a, b)` wait for `a` to finish all async effects before
calling `b`?" Ruled: yes. `then` is the one word for "over", and a
caller cannot see what a function it calls left going. A caller who
does not write `then` does not wait. This replaces what PR #257 said
of "finally": a cleanup written `then(attempt(body, n), cleanup)` now
runs after everything the body started.

Built in the reference kernel: all three.

### Cluster 12: the wording of Allegretto's forms (2026-11-19)

Fixed in `next/ext/allegretto/forms.md`, with no ruling needed: the
name `count` and the four primitives that have a form and no name; a
row for `export`; where an indented block may stand; that `read` in
the examples is no shipped operation; how emptiness and a number as a
condition are written. The example `is_int` had gone with cluster 11.

Five points were put to the maintainer. Ruled on 2026-11-19:

1. `x <- e` is a binding of its block's one group and a statement at
   its place. A statement above the arrow that needs the name is
   refused by the reader. ("Agreed")
4. The parser's state has an equality and the engine keeps what it has
   tried by rule, position and state. A left-recursive rule entered
   again at one position with a changed state is refused: "Agreed - or
   the parser engine simply prevents it."
5. `int`, `float`, `text` and `bits` are structures Allegretto binds.
   `attempt` answers the value itself, or a failure named `refuted` or
   `limit`. Four primitives are added: `float.eq`, `float.gt`,
   `float.ge` and `bits.int`. ("Agreed on all")

Built: the four primitives; the forms document. `attempt`'s answer is
built in a pull request of its own, because a test of the acceptance
stream reads the answer's present shape.

2. "A notation only adds" is kept by three rules, checked on the
   grammar when the notation is brought in. The maintainer asked what
   an owner's alternative is (one in force before the `use`), what
   state a terminal owns (what its own grammar declares), and
   "couldn't analysis of the grammar additions directly tell us if it
   breaks those rules?" It can: with the rules every earlier parse is
   still a parse, so a change shows as a second parse, which the
   engine reports. The review session withdrew its proposal to parse
   the text twice. A fourth case was found on the way and the second
   rule widened to it: an alternative appended to what a rule in force
   tests negatively. Ruled: "I agree with point 2 as it stands."

3. The form that changes the grammar. The review session proposed a
   boundary between statements. The maintainer: "If it's a wholly new
   grammar, can we use 'statement boundary'?" and "It seems we only
   need to identify one thing - which is the phrase that returns the
   parser extension operation. I think in general we should be able
   to flag any phrase as needing to be unambiguous." And: "If a
   grammar is extending the standard language, I'd be hesitant to
   allow it to change how the grammar is then further extended ... I
   would at a minimum have a configurable policy to prevent that. For
   new self-contained grammars, they can do what they want." Ruled on
   2026-11-20 ("Agreed on point 3. Both terms ratified."):
   - any production may be marked `unambiguous`: where a parse of it
     is complete, another reading still open is a refutation;
   - the engine changes the grammar only from such a production, whose
     value calls `parser.extend`;
   - the right to call it is a capability, which a notation brought in
     with `use` is not handed unless a configuration says so.

With this cluster 12 is ruled. What of it is for the parser engine is
recorded and not built. One cluster remains: wording (14).

### Cluster 14: wording (2026-11-20)

Seven points were put to the maintainer. Ruled ("Agreed") on five:

1. Bits. The kernel reads bits as a count or a place where one of its
   primitives takes one, as a whole number with the most significant
   bit first, and gives them no other meaning. The entry is reworded
   and retitled.
4. A text that does not parse is a failure the parser answers; the
   loader claims a program's own text parsed, and there it is a
   refutation.
5. The order of the four strengths is stated where they are defined;
   refuted is an outcome and no strength.
6. Entries not to build from as written are marked in the inventory's
   header: five that decide "open" and seven in the present tree's
   vocabulary. None is rewritten now and none is split.
7. The tour introduces ten terms, each in one sentence, before Part I
   uses them. Drafted in the inventory for the maintainer to correct.

2. Symbols. The maintainer: "The text needs to clearly define what a
   symbol is in terms of function. 'A symbol is its spelling' states
   how symbol identity works, but not what it does. Have we given up
   fully-qualified names for symbols? Perhaps I'm missing the
   difference between symbols and keys for private field access."
   Ruled: a symbol is a value that carries nothing but which symbol it
   is, and names three kinds of thing: a binding, an entry, a case.
   The same spelling is the same symbol. A fully-qualified name is a
   spelling a language's reader writes; the kernel has no part in it.
   A symbol names and a key guards. One entry is retitled and one
   withdrawn. What the standard language qualifies with is left to
   Part IV.
3. Expressions and what a parser returns. The maintainer: "Should we
   be clearer on what the parser returns? Is 'a description' defined
   well enough?" It was not: the forms stood only in a comment of the
   kernel's source. Ruled: a new decision, "A description is plain
   data in a fixed set of forms"; a parser of a module's text returns
   the description of the module's function, its declarations and the
   number of its keys; where a part was written gets a form of its
   own, designed with the parser engine; "Expressions are values,
   forming a DAG" is retitled.

Three more titles were wrong and are changed by ruling: "Order of
definition carries no meaning", "Running a program is evaluating its
main module with a configuration's capabilities" and "Discharge
mechanisms without search".

All seven confirmed on 2026-11-20. With this the second adversarial
review is ruled: fourteen clusters. Open beside it, in the backlog:
B-202 (threads and budgets at run time) and B-203 (streams, large
data and asynchronous iteration).

### B-202: threads and budgets at run time (2026-11-20)

The discussion the maintainer set aside on 2026-11-19, held before the
evaluator is rebuilt. The review session's finding: one count of steps
had two uses. A budget bounds the whole work of an evaluation. A slice
bounds one call into the kernel. The question "how is the budget
replenished" has the answer that a slice needs no filling, since each
call brings its own, and a budget is never filled.

Seven points, ruled as proposed ("All asks and terms confirmed"):

1. A budget and a slice are kept apart. A call's result says complete,
   paused or limit.
2. A task is one piece of work the kernel can run, pause and take up
   again. One runs at a time. Computing on several processors is a
   capability's business.
3. A slice never changes what happens: a paused task is the first to
   go on.
4. Inside one evaluation a task runs until it finishes or waits, and
   ready tasks are taken in the order their answers arrived. A turn
   of a fixed number of steps may be added later. Among separate
   evaluations the launcher chooses.
5. A refutation outranks a limit. This replaces giving the look ahead
   half of the steps left.
6. A budget that is spent drops what its evaluation had in flight.
7. `first(a, b)` gives the value of whichever of two is known first
   and cancels the other.

Terms ratified: task, slice, `first`.

Built: point 5. The others are rules for the evaluator that keeps its
own stack; `first` is not built.

### Review of the acceptance stream's emitter (2026-11-20)

The maintainer asked for a review of PR #264, "to be sure the work
streams aren't diverging". The emitter follows the forms point for
point; merged onto the main line it type-checks and every test passes.
It found three things on the kernel stream's side.

- The kernel held a statement the forms say is not held: after
  `a <- f()`, where a claim waits inside `f`. Ruled: the forms stand,
  and the kernel holds only where the statement is itself a claim that
  waits. This withdraws the detail confirmed with PR #257.
- A binding that needs itself ran until its steps ran out. Fixed: a
  value needed while it is being evaluated is a refutation.
- `-1.5` was read as the integer negation of a float's bits, and
  printed `-3`. Ruled: "read -1.5 as one literal".

Four readings the acceptance stream took where the forms were silent,
all confirmed: the module's last statement is claimed; a statement
that is itself a claim stands for no second one; `sync` is the last
word of the line before a block, and not at a module's top level; a
dropped statement's claim uses Allegretto's own `is_failure`.

### B-203: streams, large data and asynchronous iteration (2026-11-20)

The second discussion to hold before the evaluator is rebuilt. The
review session's proposal: a stream is an ordinary value, and nothing
is added to the kernel for it. A structure's entries are evaluated
when read, so a structure of an item and a rest is a stream, and
reading the rest is what fetches the next item.

Eight points, ruled as proposed ("All eight asks and terms
confirmed"):

1. A stream is a value: `{item, rest}`, the empty structure at its
   end, or a failure. Read twice it gives the same items.
2. Host code offers an operation that answers the next item, the end
   or a failure, and serves calls in order. The capability's
   definition wraps it as a stream.
3. Reads stay in order by need. One is in flight at a time.
4. Iteration is recursion, with library functions and no primitive:
   one at a time, all at once, at most a given number at once; and
   starting every entry of a list and waiting for all.
5. A loop that carries only the rest holds one item. Keeping the
   first part keeps everything read since. No mechanism is added.
6. The kernel shares what an operation does not change: building a
   structure entry by entry costs about its size. A requirement on
   the rebuilt kernel.
7. Data too large for memory stays behind a capability. Parsing a
   text larger than memory is not provided for.
8. `first` cancels only what nothing else can need. A value with a
   name, or an entry of a structure, goes on once started. A cell
   nobody waits on leaves the list of cells waited on.

Terms ratified: stream, `item`, `rest`.

Built: nothing in the kernel. Its tests hold a stream over late
answers, read one item at a time and replayed, and a list whose
entries are started at once and waited for together. The four
library functions are written in Allegretto in the forms document and
run on a stream computed in the program.

## Terms introduced

- **Stream**: a structure of an item and a rest, where the rest is
  evaluated when read. Its two entries are named `item` and `rest`.
  Ratified by the maintainer on 2026-11-20.
- **Task**: one piece of work the kernel can run, pause and take up
  again. Ratified by the maintainer on 2026-11-20.
- **Slice**: the most steps one call into the kernel runs before it
  returns. Ratified the same day.
- **`first`**: the kernel primitive for the earlier of two answers.
  Ratified the same day.
- **`unambiguous`**: a mark on a production. Where a parse of it is
  complete, it must be the only reading of the text so far. Ratified
  by the maintainer on 2026-11-20.
- **`parser.extend`**: the engine's operation that changes the grammar
  a text is read in. Ratified the same day.
