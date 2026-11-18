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

## Terms introduced

No terms introduced.
