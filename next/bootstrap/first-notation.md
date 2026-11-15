# The first notation — a proposal

> **Status: proposed 2026-11-15, for the maintainer to rule.** The
> notation is one of the rebuild's three contracts
> (`docs/plans/rebuild.md`, "How the two sessions meet", rule 2). This
> document is chunk Q5 (the first notation and the bootstrap), part 1,
> of B-196 (the rebuild's acceptance side). It proposes the forms and
> asks eleven questions. The emitter `next/bootstrap/emit.ts` builds the
> forms marked *expressible today* under the recommended options; the
> census `next/bootstrap/census.ts` measures what the rest wait on.
>
> **Reader.** The maintainer, and the kernel stream for section 4. The
> reader knows the ruled decisions of `docs/plans/book-pass-inventory.md`,
> the kernel's interface `next/kernel/interface.ts` and the data form
> `next/kernel/saved-program.ts`.
>
> **Two kernels.** The emitter was built and tested against the kernel
> of `a479e5e`. The kernel stream's pull request #216 (values and
> descriptions, kernel chunk K4 (what Allegro code may do with an
> expression)) changes how arguments are evaluated. It merged on
> 2026-11-15, after this proposal was written; `origin/main` is now at
> `4b6b395`. In this document "on `origin/main`" means the kernel before
> #216, at `a479e5e`, and "once #216 merges" means the kernel now on
> main. Every statement about #216 was first checked on its branch at
> `6829b3d`; the emitter's tests, the fixtures and the census were run
> again on the merged kernel, with the same results. The forms' table
> gives both states where they differ.
>
> **Term introduced.** <a id="def-sort"></a>**Sort**: what the emitter
> can see of a value from the form that made it, without types: a text,
> a number, a float, a truth value, a structure, a function, the answer
> of an effect, or unknown.

## 1. What the first notation is for, and what it is not

The first notation is the syntax in which the first extensions and the
milestone 3 programs are written, until the parser engine written in
Allegro replaces the bootstrap at milestone 8. The present tree's parser
reads it: `next/bootstrap/present-reader.ts` calls the first two steps
of the present `evalSource` and nothing after them. Each form stands for
one kernel expression, as "Every notation stands for an expression"
requires. The emitter writes that expression as a saved program in the
data form, as "A saved program is a recorded sequence of interface
calls" has it: the record constructs values and binds nothing.

The first notation is not the standard language. It has no types, no
patterns and no grammar change. Its grammar is fixed, because "A text
can change the grammar it is read in" needs a parser that runs on the
kernel ("The platform's parser engine ships already built"). A text
with a `use` line is refused.

It reads the present surface syntax wherever the meaning is the same, so
the corpus's milestone 3 programs need no change of source. Where the
present meaning differs from a ruled decision, the form is refused, and
the table says why.

## 2. The forms

The kernel expression is written in the data form's nodes: `bits`,
`param`, `function`, `expression`, `structure`, `symbol`, and `kernel`
for the kernel's own primitives. `out` is the module's parameter for the
output capability. The column *Read from* names what the present parser
builds (`src/grammar2/tree-builder.ts`), which is what the emitter reads.

| Form, as written | Read from (present parse) | Kernel expression | State on `origin/main` | State once #216 merges |
|---|---|---|---|---|
| A text `"hello"` | `typed_string(bits)` | `bits`, the UTF-8 bytes (question 2) | expressible today | the same |
| A number `42`, `0xFF`, `1.5` | 64-bit `bits`; `typed_float(bits)` | `bits`, 64 bits, most significant byte first; the operators read a whole number as signed (question 3) | expressible today below 2^53; nothing computes on one yet | the same |
| A whole number of 2^53 or more | 64-bit `bits`, rounded through a double | refused (question 3) | needs the bootstrap's own reader of the text | the same |
| `true`, `false` | the names `true`, `false` | `bits` of length one, 1 and 0 | expressible today | the same |
| A name bound in the text | a symbol, or a `param` | the node it is bound to; the record holds no name | expressible today | the same |
| A name the text does not bind | a symbol | refused (question 4) | question 4 | the same |
| A function `f(x) => e`, a lambda `x => e`, `() => e` | a composed function | `function` of `param` nodes | expressible today | the same |
| An application `f(a, b)`, a pipe `a \|> f` | an expression | `expression` | expressible today | arguments are evaluated when needed: the same result for every text the emitter accepts |
| A binding at the top level `x = e` | a keyed entry of the program | `expression(function([x], structure([x: x], [rest])), [e])` (section 3) | expressible today: `e` is evaluated at the binding's place | expressible: `e` is needed by the entry `x: x`, at the binding's place |
| A binding inside a block | not kept: the tree builder puts `e` at each use (`buildBlockExpr`) | refused (question 5) | needs the bootstrap's own reader of the parse tree | the same, and the block of bindings #216 does not build |
| A sequence of statements | the program's entries; `seq(...)` in a block | `structure` of the statements, in written order | expressible today | the same: "a structure needs its entries in order" |
| A block whose last statement gives a value | `seq(..., e)` | refused (question 10) | needs reading a structure's last entry; a function of one unused parameter would work here | the function of one unused parameter no longer works: that argument is never evaluated |
| A conditional `if c then a else b` | `eval_if(c, thunk, thunk)` | `expression(kernel if, [c, a, b])`; the thunks are dropped | expressible today | the same; no branch needs wrapping |
| `&&`, `\|\|`, `!`, `and`, `or` | `typed_and(a, thunk)`, `typed_or`, `typed_not` | `if(a, b, false)`, `if(a, true, b)`, `if(a, false, true)` | expressible today | the same |
| `==`, `!=` on texts or truth values | `bits_eq`, `bits_neq` | the kernel's primitive for telling bits apart | needs a kernel primitive, not in #216 | the same |
| Arithmetic, comparison on numbers | `bits_add` and the rest, `bits_lt` and the rest | shipped pure primitives, by content hash (section 4); which family an operator takes is question 11 | needs a shipped pure primitive | the same |
| `+` on texts, interpolation | `bits_add` of texts | a shipped text primitive | needs a shipped pure primitive | the same |
| A claim `claim(e)`, as a statement | an application of the name `claim` | `expression(kernel claim, [e])` (question 1) | expressible today | the same |
| A claim inside an expression | the same | refused (question 1) | question 1 | an unneeded argument is never evaluated, so its claim would never be decided |
| A recursive function, or a group of them | a function whose body names itself | self-application (section 4) | expressible today | the same; recursion detection (kernel chunk K5 (recursion)) is in neither |
| A structure `{a: e}`, an array `[e, f]` | `typed_object`, `typed_array` | `structure`; a field's key is a `symbol` of its name (question 8) | expressible today | the same |
| An access `p.a`, `a[0]` | `type_dispatch(p, bits)` | the kernel's primitive for reading a structure | needs a kernel primitive, not in #216 | the same |
| A method `"x".length` | `type_dispatch` on a text or a number | the type's method | needs the standard language (milestone 4) | the same |
| Printing `print(e)` | an application of the name `print` | `expression(out, [e])` for a text; `expression(out, [if(e, "true", "false")])` for a truth value (question 7) | expressible today for a text and a truth value; a number waits on a shipped primitive | the same |
| print's value used | the same | refused (question 7) | question 7 | the same |
| A module's parameters | `print` used; `import NAME` | `out` for the capability `output`; a parameter of role `module` per import (question 6) | `output` expressible today; an import waits on the launcher and on reading a structure | the same |
| A comment `//`, `/* */` | dropped by the parser | nothing | expressible today | the same |
| `use NAME` | the header scan `scanUses` | refused | not accepted: the grammar is fixed | the same |
| A name bound twice in one scope | two keyed entries | refused | not accepted: "Order of definition carries no meaning" makes it an error | the same |
| A type annotation, `when`, `export` | `type_check`, `typed_function`, `eval_when`, a binding's visibility | refused | needs the standard language (milestone 4); `export` is question 8 | the same |

**What is forced, and by what.** The truth values are the bits of length
one: "The kernel's primitives are pure and few", note of 2026-11-12, as
the maintainer confirmed on PR #214. The capability is `output` and its
one part `write`: ruling E of the scenarios (`next/corpus/scenarios/README.md`).
A function used before its definition is accepted, and a name bound
twice is refused: "Order of definition carries no meaning". The record
binds no name and refers only to earlier nodes: "A saved program is a
recorded sequence of interface calls". Statements stay in written order:
"Only the module being run performs effects when instantiated". The
conditional and the claim are the kernel's own: "Claims are evaluated
like everything else". Every other choice is a question of section 5.

**Present forms the first notation must not accept.** `assert(e)` is the
present tree's assumption at a trust boundary (`assert_invariant` in
`src/primitives.ts`): it records a fact and checks nothing, so it is not
read as a claim. A name bound twice, which the present tree takes as the
later value. A binding inside a block, whose effects the present tree
builder moves to each use and repeats: `f() =>` with `x = print("a")`,
`print("b")`, `x`, `x` prints `b`, `a`, `a` in the present parse. A
whole-number literal of 2^53 or more, which the present parser reads
through a double: `9007199254740993` is built as 9007199254740992, and
`print(9223372036854775807)` prints `-9223372036854775808` in the
present tree. A
`use` line, because `use contracts` and `use effects` are part of the
standard language by rulings A and E of the scenarios, and every other
`use` changes the grammar.

## 3. The module

A text becomes one module function, as "A module is a function of its
capabilities, inputs and imports" has it.

**Its parameters.** The capabilities it uses, then the modules it
imports (question 6). Today the only one is `output`, declared when the
text uses `print`. The record's `declares` lists each with its role.

**Its body.** The text's entries in written order, each a structure
whose last entry is the rest:

- a statement `s` is `structure([null: s], [null: rest])`;
- a value binding `x = e` is `expression(function([x], structure([x: x], [null: rest])), [e])`;
- a function binding is no entry. It is a node built at its first use,
  after every value binding it reads, and it is order-free;
- the innermost structure is the structure of the bindings, keyed by
  symbols of their names: what the module yields (question 8);
- a text with one statement and no binding is that statement alone.
  That is how `print("hello, world")` gives exactly the committed record
  `next/launch/fixtures/hello.json`.

**Why the body is a structure.** The kernel evaluates a structure's
entries in order, on `origin/main` and after #216. Under #216 an
argument is evaluated when it is needed, and "the statements of a body
are needed in written order". The first draft of this emitter wrote a
statement as a function of one unused parameter applied to it. That
works on `origin/main`. On the #216 kernel the statement never runs: a
record `(_ => out("b"))(out("a"))` prints `a`, `b` on `origin/main` and
`b` alone on #216. The structure form prints the same on both, and so
does every fixture of `next/bootstrap/fixtures/`.

**A value binding** is needed at its written place on both kernels. On
`origin/main` the argument `e` is evaluated before the body. On #216 it
is evaluated by the entry `x: x`, which is the first entry of the
binding's structure. A use of `x` before its line is refused (question
5).

**Top-level effects** sit in the body in written order. Only the module
the launcher runs is instantiated with `output`, so a module that is
imported performs nothing until one of its functions is called.

**What the module's value is.** A nested structure: each statement's
value, then the rest, down to the structure of the bindings. Nothing
reads a module's value at milestone 3. A flat structure of bindings
needs a way to take the last entry of a structure (question 8).

## 4. What milestone 3 needs that does not exist

### The census

`npx tsx next/bootstrap/census.ts` reads each of the 216 cases due at
milestone 3: the 31 pins of the two programs `tests/logical.alg` and
`tests/types.alg`, and the 185 tests, whose texts it finds in their
bodies. Every need below is a finding of the emitter on the present
parse of a text. A program is emitted whole, so each pin of a program
waits on every need of that program. Today no pin emits; the texts of
38 tests emit. The numbers are on `origin/main` at `a479e5e`.

| Need | State | Pins waiting | Tests waiting | Cases waiting |
|---|---|---|---|---|
| `int-arith`: integer arithmetic (+ - * / % and unary minus) | shipped pure primitive | 12 | 79 | 91 |
| `int-compare`: integer comparison (== != < > <= >= on numbers) | shipped pure primitive | 31 | 36 | 67 |
| `bits-equal`: telling two bits values apart (== and != on texts and truth values) | kernel primitive | 19 | 1 | 20 |
| `match`: when/is, patterns and guards | standard language | 0 | 20 | 20 |
| `text-concat`: joining texts (+ on texts, interpolation) | shipped pure primitive | 12 | 7 | 19 |
| `unbound`: a name the text does not bind | question | 0 | 17 | 17 |
| `int-to-text`: an integer's decimal text (printing a number, interpolation) | shipped pure primitive | 12 | 4 | 16 |
| `float-arith`: floating-point arithmetic | shipped pure primitive | 12 | 1 | 13 |
| `float-to-text`: a float's text (printing a float) | shipped pure primitive | 12 | 1 | 13 |
| `types`: a type annotation, a typed function or a type check | standard language | 0 | 8 | 8 |
| `structure-read`: reading an entry of a structure (a field, an index) | kernel primitive | 0 | 5 | 5 |
| `block-binding`: a binding inside a block, which the present tree builder substitutes at each use | bootstrap | 0 | 4 | 4 |
| `print-sort`: print of a value whose sort the emitter cannot see | standard language | 0 | 4 | 4 |
| `host`: the test asserts through host code, with no Allegro text the parser reads | host | 0 | 3 | 3 |
| `import`: a module imported (import NAME) | question | 0 | 3 | 3 |
| `origin`: the expression a value came from (source of) | kernel primitive | 0 | 2 | 2 |
| `print-value`: the value of print used | question | 0 | 2 | 2 |
| `export`: export of a binding | question | 0 | 1 | 1 |
| `float-compare`: floating-point comparison | shipped pure primitive | 0 | 1 | 1 |
| `parse`: text the present parser does not read | not accepted | 0 | 1 | 1 |

What each step of supply would let the emitter emit, cumulatively:

| If these were supplied | Pins then emitted | Tests then emitted |
|---|---|---|
| integer arithmetic, comparison and decimal text (shipped) | 0 of 31 | 115 of 185 |
| and telling bits apart (kernel) | 19 of 31 | 116 of 185 |
| and joining texts, and the float primitives (shipped) | 31 of 31 | 124 of 185 |
| and reading a structure's entry (kernel) | 31 of 31 | 129 of 185 |
| and a reader that keeps block bindings (bootstrap) | 31 of 31 | 132 of 185 |

By program or module:

| Program or module | Cases | Every text emits today | Needs, with the cases waiting on each |
|---|---|---|---|
| `tests/logical.alg` | 19 | 0 | `bits-equal` 19, `int-compare` 19 |
| `tests/types.alg` | 12 | 0 | `float-arith` 12, `float-to-text` 12, `int-arith` 12, `int-compare` 12, `int-to-text` 12, `text-concat` 12 |
| `src/boundary-tests.ts` | 4 | 1 | `int-arith` 2, `import` 1, `int-compare` 1, `int-to-text` 1, `print-sort` 1, `unbound` 1 |
| `src/test/base.ts` | 59 | 6 | `int-arith` 37, `int-compare` 15, `unbound` 8, `block-binding` 1, `parse` 1 |
| `src/test/effects.ts` | 2 | 0 | `types` 2 |
| `src/test/equality-laws.ts` | 3 | 0 | `int-arith` 3, `origin` 2, `int-compare` 1, `unbound` 1 |
| `src/test/evaluator.ts` | 9 | 0 | `types` 6, `match` 3, `unbound` 3, `print-sort` 2, `block-binding` 1, `host` 1, `int-arith` 1, `int-compare` 1, `int-to-text` 1, `print-value` 1 |
| `src/test/grammar-legacy.ts` | 5 | 0 | `structure-read` 3, `int-arith` 2 |
| `src/test/grammar2-language.ts` | 28 | 9 | `int-arith` 14, `int-compare` 6, `structure-read` 2, `text-concat` 2, `block-binding` 1, `int-to-text` 1, `print-sort` 1 |
| `src/test/language.ts` | 29 | 2 | `match` 17, `int-arith` 8, `int-compare` 3, `block-binding` 1, `import` 1, `print-value` 1 |
| `src/test/modules.ts` | 14 | 4 | `int-arith` 6, `unbound` 4, `host` 2, `export` 1, `int-compare` 1 |
| `src/test/pcp.ts` | 1 | 0 | `int-arith` 1 |
| `src/test/refinements.ts` | 2 | 0 | `int-arith` 2, `int-compare` 2 |
| `src/test/types-battery.ts` | 11 | 5 | `text-concat` 4, `import` 1, `int-arith` 1 |
| `src/test/types-construction.ts` | 2 | 2 | none |
| `src/test/types-core.ts` | 16 | 9 | `int-compare` 6, `int-arith` 2, `bits-equal` 1, `float-arith` 1, `float-compare` 1, `float-to-text` 1, `int-to-text` 1, `text-concat` 1 |

The names used and not bound are those a test's host extension or
another module supplies (`abs`, `max`, `min`, `double`, `explain`) and
names a test leaves unbound on purpose (`zzz`, `w`, `cfg`). A test whose
texts all emit is not yet realised: how a test of the new tree names
its case is chunk Q6 (the comparison harness), part 2, and several of
the 38 assert through a host call (`applyPhase`, the module loader).

### What #216 supplies, and what stays missing after it

**#216 supplies** arguments evaluated when needed, at most once, in the
scope where they were written, and the kernel primitives `if`, `claim`,
`describe`, `build` and `attempt`. It removes `quote`. The emitter uses
`if` and `claim` only, and never `quote`; its tests check that. #216
changes no state in the census: none of its new primitives is a need of
a milestone 3 case.

**Missing after #216, for the kernel stream:**

1. **Shipped pure primitives with content hashes**, under `next/prims/`,
   each with a reference definition ("Every pure primitive the platform
   ships has a reference definition"), supplied by the launcher's target
   ("Machine arithmetic is a set of pure primitives that ships with the
   platform"). By need: 64-bit signed integer (question 3) `add`, `sub`, `mul`, `div`, `mod`
   and negation (91 cases); integer `eq`, `ne`, `lt`, `gt`, `le`, `ge`
   (67); an integer's decimal text (16); text concatenation (19); 64-bit
   float arithmetic (13), comparison (1) and text (13). The pins fix the
   behaviour at the edges: `print(1.5 + 2.5)` prints `4`, `7.0 / 2.0`
   prints `3.5`, `1 / 0` is a failure named "division by zero" (question
   9). No record can name one until its hash exists.
2. **Telling bits apart**, a kernel primitive in the ruled list of "The
   kernel's primitives are pure and few" and not built in #216 (20
   cases, 19 of them pins of `tests/logical.alg`, by `x == "b"`).
3. **Reading a structure's entry**, "making and reading structures" in
   the same list, not built in #216 (5 cases, and the flat module value
   of question 8, and a block's value of question 10).
4. **The block of bindings** that lets a built function bind its own
   names, which #216 names as not built. The first notation does not
   need it while names are resolved by the emitter; a loader of imported
   modules does (3 cases of `import`).
5. **Origins**: `source of` (2 cases), reworded on #216 to "an origin is
   a description" and not built.
6. **Recursion once for each state of knowledge** ("A recursive call is
   evaluated once for each state of knowledge"), kernel chunk K5 (recursion). No
   milestone 3 case of the census needs it to print its pins: every
   recursion there ends on known arguments. It is needed for the claims
   of milestone 5.

**Missing for this stream:** a reader of the present parse tree that
keeps a block's bindings (4 cases; question 5), and the realisation of
tests (Q6, part 2).

### Recursion on today's kernel

A recursive function cannot refer to itself in a saved program: a node
refers only to earlier nodes, and the record binds no name, so no node
can contain itself and no name can stand for it. The interface has no
call that closes a cycle either: `composedFunction` takes a body that
already exists, `bind` is the host's and the record cannot call it, and
`fill` takes plain data only.

**What works: self-application.** The emitter finds the groups of
function bindings that call each other (strongly connected parts of the
call graph). Each member `f` of a group of `n` becomes a raw function
whose first `n` parameters are the group's raw functions. A call of a
member `g(a)` inside the group is `g'(f', ..., g', a)`, applying the
parameter that holds `g`'s raw function. The public `f` is
`function([x], expression(f', [f', ..., g', x]))`. Nothing is bound, and
every node refers only to earlier ones.

**What I ran.** On `origin/main` and on the #216 kernel, with the
launcher:

- `tick(again)`, which prints `tick` and calls itself once: `tick`,
  `tick`, `done`;
- `ping` and `pong`, which call each other: `pong ends`, `ping ends`;
- `loop(x) => loop(x)`: runs to the step budget and ends `limit` on
  both kernels, since neither has chunk K5. Under "A recursive call is
  evaluated once for each state of knowledge" the inner call meets the
  same state and would stay a residual instead.

The cost of self-application: a recursive function's public value is a
wrapper, and the claims K5 will assume at an inner call must be found
on the raw function. Whether a notation of the standard language later
binds names by the block of bindings instead is the kernel stream's
call; the first notation can change its encoding without changing a
text.

## 5. Questions for the maintainer

Each has a recommendation, and the emitter follows it.

**1. The claim form.** (a) `claim(e)`, a name the first notation
reserves, as a statement only. (b) `assert(e)`, the present surface
name. (c) No claim form until the standard language's `requires` and
`ensures` (ruling A). Cost of (a): no program may bind `claim`, and the
present tree runs such a text as an unbound name. Cost of (b): the
present `assert` assumes rather than checks, so one text would mean two
things. Cost of (c): milestone 3's "claims" waits on milestone 4.
Statement only, because under #216 a claim inside an unneeded argument
is never evaluated. **Recommended: (a).**

**2. A text's bits.** (a) UTF-8 bytes, eight bits each. (b) Another
encoding. The output capability's part `write` already reads UTF-8
(`next/launch/output.ts`), and the inventory names UTF-8 a choice of the
standard language ("The kernel's plain data is a sequence of bits, and
it computes nothing on them", its note). **Recommended: (a).**

**3. A number's bits, and how they are read.** A whole-number literal
is written without a sign: the present parser reads `-1` as `0 - 1`. Its
record is 64 bits. The bits hold no sign. The sign is in the primitive
that reads them: addition, subtraction, multiplication and equality give
the same bits under either reading; division, remainder, ordering and
decimal text differ. So the question has four parts.

*The bits.* (a) 64 bits, most significant byte first; a literal with a
decimal point is IEEE 754 binary64. (b) The same, least significant
byte first, as the present tree stores a text. (c) Arbitrary precision.
Cost of (a): it fixes a byte order the shipped primitives must take.
Cost of (c): every pin that shows overflow or a float changes.

*The reading the bare operators take.* (d) Signed, two's complement:
`/`, `%`, the orderings and `print` on a whole number use the signed
primitives, as the present pins have it (`-7 / 2` prints `-3`, `-7 % 3`
prints `-1`). (e) Unsigned.

*Unsigned integers.* They are the same 64 bits, read by a second set of
shipped primitives for the operations that differ. The first notation
has no types, so no form of it can pick them. (f) They arrive with the
standard language, as a type whose methods are those primitives ("The
core types are built over bits": an operator is a method of its
operand's type). That decision's roster names Int and Float and no
unsigned type, so the type is an addition to the roster. (g) A suffix on
the literal in the first notation. Cost of (g): the present parser does
not read one, so it waits on this stream's own reader and adds a form
the standard language may not keep.

*The range of a literal.* Today a literal of 2^53 or more is refused,
because the present parser rounds it. Once this stream's reader takes
the digits from the text: (h) accepted up to 2^63 - 1 and refused above,
since the signed reading has no such value; (i) accepted up to 2^64 - 1
as a bit pattern, so `0xFFFFFFFFFFFFFFFF` is the bits a signed reading
calls -1.

**Recommended: (a), (d), (f) and (h).** Under them the kernel stream
ships three families over 64 bits: signed integer, unsigned integer and
float. A primitive is named by its reading wherever the readings differ,
so each has its own content hash and reference definition; those that
agree are shipped once. The emitter follows the kernel stream's
primitives if they choose another byte order.

**4. A name the text does not bind.** (a) A finding: the emitter
computes the names used and bound and refuses a text with any left
over, as "A language checks the names it cares about" lets a language
do, at the end of the text. (b) A symbol in the record: the kernel
leaves a residual that waits on it. Cost of (a): 17 cases wait, most
for names a test's host extension supplied. Cost of (b): a misspelt name
gives a program that waits and prints nothing. **Recommended: (a)**,
until imports and inputs supply names (question 6).

**5. Bindings and order.** Function bindings are order-free, by "Order
of definition carries no meaning". For value bindings: (a) each is
needed at its written place, and a use before that line is a finding;
(b) value bindings are ordered by what they use, as functions are. A
binding inside a block: (c) refused until this stream reads the present
parse tree itself; (d) accepted where its value is a literal or a
function. Cost of (b): a value binding that performs an effect would
move. Cost of (d): the emitter cannot see the binding in the built
expression at all, so (d) needs the reader of (c) anyway.
**Recommended: (a) and (c)**; the reader is part 2 of this chunk.

**6. A module's parameters.** (a) A capability is declared by use:
`print` declares `output`; `import NAME` declares a module parameter;
no input is declared at milestone 3. (b) An explicit header line names
each capability. Cost of (a): a capability is not written in the text,
though it is listed in the record's `declares`, which is what "A module
is a function of its capabilities, inputs and imports" makes visible where the
module is loaded. Cost of (b): every corpus program changes.
**Recommended: (a).** By ruling Q of the scenarios, `import` brings
bindings only; the launcher supplies no module yet, so an import is a
finding for now.

**7. Printing.** `print(e)` applies `out` to `e`'s text. (a) The text
is chosen by `e`'s [sort](#def-sort): a text as it is, a truth value as
`true` or `false` by the conditional, a number by the shipped decimal
primitive; a value of unknown sort is a finding until the standard
language's types exist. (b) `print` takes a text only. Cost of (a): the
emitter carries a small sort reading that the standard language
replaces. Cost of (b): 31 pins change their source. And print's value:
the part `write` answers an empty structure where the present `print`
answers its argument, so (c) a text that uses print's value is refused.
**Recommended: (a) and (c).**

**8. What a module yields, and the keys.** (a) Every binding, in a
structure keyed by symbols of the bare names, innermost in the nested
body of section 3; a field of a structure literal is keyed the same
way; `export` is a finding. (b) Keys under the module's fully
qualified name ("Symbol identity is a fully-qualified name"). (c) Keys
as the bits of the name, as the present parse builds them. Cost of (a):
a module's name is not known in a text, so the qualification waits for
the loader. Cost of (b): the emitter would invent module names. Cost of
(c): a key and a name would be two kinds of thing. **Recommended: (a).**
A flat value of bindings waits on reading a structure (section 4, item
3).

**9. Number rendering and the shipped primitives' edges.** The pins fix
the text: an integer in decimal, a float in its shortest form that
reads back (`4`, `3.5`). (a) A shipped primitive per type gives the
text, with a reference definition. (b) The standard language writes it
in Allegro over integer division and text concatenation. Division by
zero: (c) a failure named "division by zero", as the present pins have
it; (d) a refutation. Cost of (b): printing any number waits on the
standard language. **Recommended: (a) and (c)**, for the kernel stream
to confirm, since the primitives are its own.

**10. A block whose value is its last statement's.** (a) Refused until
the kernel can read a structure's entry; the block is then the structure
of its statements and its value is the last entry. (b) A kernel form
that evaluates a sequence and answers the last value. (c) A function of
one unused parameter, which works on `origin/main` only. Cost of (a):
a block that prints and then answers waits (0 cases of the census today;
the tests' blocks wait on block bindings first). Cost of (c): it breaks
silently when #216 merges. **Recommended: (a)**; (b) is the kernel
stream's if it prefers one.

**11. Which primitive an operator stands for.** The first notation has
no types, and the kernel's bits carry none. The present tree chooses at
run time, by the type each value carries: `add(a, b) => a + b` prints
`4` for `add(1.5, 2.5)` and `3` for `add(1, 2)`. A saved program has
nothing to choose by at run time, so the emitter must choose when it
writes the record. Today it chooses by [sort](#def-sort): a text
operand makes `+` the joining of texts, a float operand makes the
operator the float one, and anything else is the signed integer one.
It sees a literal's sort and not a parameter's. Of the 216 cases, 59
apply an operator where it sees the sort of some operand only, and 16
where it sees none, and there it would guess. No wrong record is
written today, because every such text is refused until the shipped
primitives exist. (a) Each operator has one meaning: `+ - * / %` and
the orderings are the signed integer primitives; an operand the emitter
can see is a float or a text is a finding; the float and text
primitives are bound to operators by the standard language's types
("The core types are built over bits": an operator is a method of its
operand's type). (b) By sort where the emitter sees one, and a finding
where it sees none. (c) The emitter infers each parameter's sort from
its uses and its callers, and refuses a function used at two sorts.
Cost of (a): the 13 float cases and the 19 cases of joining texts wait
for milestone 4, 12 pins of `tests/types.alg` among them; a float
passed where a function adds integers is added as an integer, which the
comparison harness shows as a failing pin. Cost of (b): a float passed
through a parameter to an operator with an integer literal is computed
wrongly with no finding, and 16 cases wait. Cost of (c): a small type
checker in the bootstrap, thrown away at milestone 4. **Recommended:
(a).** One operator, one primitive, as "Every notation stands for an
expression" has it; the choice by type belongs to the language that has
types.

## 6. Evidence and limits

**Read.** `docs/plans/rebuild.md`; the inventory entries named in the
brief; the adversarial review's rulings (`docs/records/book-pass/adversarial-review.md`);
the scenarios' rulings of 2026-11-15; the kernel, the interface and the
data form on `origin/main`; #216's diff of the kernel, its tests, the
inventory and the review record; the launcher and its fixture; the
present tree's file runner `src/index.ts`, the `evalSource` pipeline,
the tree builder's block handling and the `assert` primitive.

**The present tree's exports used**, all through
`next/bootstrap/present-reader.ts`: `scanUses` (`src/use-scanner.ts`),
`getBaseGrammar` (`src/grammar2/base-grammar.ts`), `parseSource`
(`src/grammar2/engine.ts`) and `buildProgram`
(`src/grammar2/tree-builder.ts`). The import is dynamic by a computed
path, so the new tree's typecheck does not compile `src/`. The present
tree is not changed.

**Ran.** The emitter's 25 tests, on `origin/main`. The five fixtures on
`origin/main` and on the #216 kernel, with the same lines and ends on
both. The record of a statement as an unused argument, on both: it
loses its effect on #216. The census over the 216 cases. `npm run
harness:next`: 71 programs, none emitted yet, so no pin fails.

**Limits.** The emitter's records mean the same on both kernels for
every text it accepts, with one known gap: an argument that never ends
and is never used makes the program run to its budget on `origin/main`
and is skipped on #216. A wrong program that refutes inside an unused
argument differs the same way. A test's texts are found by a rule over
its body (stated in `next/bootstrap/census.ts`); 3 tests have none and
are classed `host`. The census does not read a test's expected value, so
"every text emits" is a statement about forms, not about results.
