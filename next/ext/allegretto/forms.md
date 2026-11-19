# Allegretto: the forms

> **Status: ruled 2026-11-16.** The maintainer approved the forms, the
> shipped primitives and the five answers of section 6, with one change:
> a capability is declared by the word `capability`. Allegretto
> is the rebuild's first notation, one of the three contracts between
> the streams (`docs/plans/rebuild.md`). This document states its
> forms. It replaces the proposal on the branch
> `majodali/q5-first-notation` as the basis.
>
> **Reader.** The maintainer, and the acceptance stream, which builds
> the reader and the emitter. The reader knows the ruled decisions of
> `docs/plans/book-pass-inventory.md` and the kernel's interface.

## 1. What is ruled

From "Allegretto is a small language for the kernel and nothing else"
and the maintainer's rulings of 2026-11-16:

- Each form stands for something the kernel has. There are no types.
- An operator stands for exactly one primitive function. More operators
  may be added for readability.
- A block is bindings and statements. Bindings are order-free and may
  refer to each other and to themselves. Statements are started in
  written order, and none waits for the one before it to be over.
  Bindings may be written among the statements.
- A primitive function applied outside its domain is a refutation.
- The present tree's parser engine reads Allegretto, with a grammar
  written for it, until the engine written in Allegretto reads itself.

## 2. The forms

"Stands for" names the kernel's own things: the kinds of value, the
kernel's primitives `if`, `then`, `claim`, and a shipped pure primitive
by its name in section 3.

### Values

| Form | Stands for |
|---|---|
| `"text"`, with the escapes `\"`, `\\`, `\n`, `\t` | bits: the text's UTF-8 bytes |
| `42`, `0xFF` | bits: 64, the number in two's complement, most significant byte first |
| `1.5` | bits: 64, IEEE 754 binary64 |
| `true`, `false` | bits of length one: 1 and 0 |
| `{a: e, b: f}` | a structure whose keys are the symbols `a` and `b` |
| `{a: e, [k]: f}` | the same, with an entry whose key is computed: `put({a: e}, k, f)`. `k` is any expression that gives a symbol or a key. Where it is a name a `key` header line declares, the entry is private |
| `[e, f]` | a structure with no keys |
| `` `name `` | the symbol `name`, as data |

A whole number outside the signed 64-bit range is refused by the
reader. There is no interpolation in a text: it would need a number's
text chosen by type.

### Names, functions and application

| Form | Stands for |
|---|---|
| `x` | what the innermost block around it binds `x` to; a name no block binds is refused at the end of the text ("A language checks the names it cares about"), and the kernel gives it no value |
| `x => e`, `(x, y) => e`, `() => e` | a composed function |
| `f(a, b)` | an application |
| `a \|> f` | `f(a)` |
| `p.a` | reading the entry of `p` keyed by the symbol `a` |
| `p[i]` | `get(p, i)`: the entry of `p` at place `i`, counted from 0; or, where `i` is a key, the private entry keyed by it |

### Control and claims

| Form | Stands for |
|---|---|
| `if c then a else b` | `if(c, a, b)`, the kernel's conditional |
| `a && b`, `a \|\| b`, `!a` | `if(a, b, false)`, `if(a, true, b)`, `if(a, false, true)` |
| `claim(e)` | the kernel's claim |

The kernel's other primitives are reached as names Allegretto binds:
`then`, `also`, `attempt`, `describe`, `build(description, names)`, `refuse(reason)`,
`assume(x)`, `undecided(reason)`, and those ruled and not yet
built. What `describe` gives is a program that means the same as the
function: where the function reads names of a block, or holds an
argument used more than once and not yet evaluated, the description is
a block around the function that binds them. A check the standard
language writes as an annotation is written as a claim: ``claim(kind(x) == `bits)``.

Data whose shape the text does not fix is built and read with five more:

| Name | Gives |
|---|---|
| `put(s, k, v)` | a new structure: `s` with the entry `v` under the key `k`, added at the end or in place of the entry already under `k`. `k` is a symbol, a key, or `[]` for an entry with no key. `v` is evaluated when the entry is read |
| `key(s, i)` | the key of the entry of `s` at place `i`: a symbol, or `[]` where it has none |
| `kind(x)` | what `x` is, as a symbol: `` `bits ``, `` `symbol ``, `` `structure ``, `` `function `` or `` `key `` |
| `symbol(t)` | the symbol whose name is the text `t`, as data |
| `spelling(s)` | the name of the symbol `s`, as text |

Allegretto has no loop form: a loop is a function that calls itself.
A call that is the value of the function's body takes no space, and a
counter or a total computed by one primitive on known values is
evaluated at each call. A value carried by a function of the program's
own is put first with `then` where it must not be put off.

`put` never changes `s`. A structure of a size the text does not fix is
built by a recursion: `range(n) => if n == 0 then [] else put(range(n -
1), [], n)`.

### Operators

Each stands for one shipped primitive, on signed 64-bit integers unless
it says otherwise.

| Operators | Primitive |
|---|---|
| `a + b`, `a - b`, `a * b`, `a / b`, `a % b`, `-a` | `int.add`, `int.sub`, `int.mul`, `int.div`, `int.mod`, `int.neg` |
| `a < b`, `a > b`, `a <= b`, `a >= b` | `int.lt`, `int.gt`, `int.le`, `int.ge` |
| `a == b`, `a != b` | the kernel's primitive that tells two bits values apart, and its negation |
| `a ++ b` | the kernel's primitive that joins two bits values: the bits of `a` followed by the bits of `b`; on two texts, the joined text |

Precedence, loosest first: `|>`; `||`; `&&`; `==` `!=`; `<` `>` `<=`
`>=`; `++`; `+` `-`; `*` `/` `%`; prefix `-` `!`; application, `.` and
`[ ]`. All binary operators group to the left. Float arithmetic has no
operators: `float.add(a, b)`.

`==` compares bits. `1 == 1.0` is false, and two structures are not
compared: that is a refutation. Equality by type is the standard
language's.

### Bindings and blocks

| Form | Stands for |
|---|---|
| `x = e` | a binding of `x` in the enclosing block |
| `f(x, y) => e` | the binding `f = (x, y) => e` |
| `x <- e` | a statement: `e` is started here, and `x` is bound to its value for the rest of the block |
| an indented block | a block of bindings around a chain of `also` |
| `sync` and an indented block | the same block around a chain of `then`: each statement is over before the next is started |

A block's bindings are one group, whatever lines they are written on.
Each may use any other, and itself. A binding's value is evaluated when
something needs it, at most once. So a binding is never the place where
an effect happens: `line = read()` reads when `line` is first needed.

A block's statements are started in written order, and the block's value
is its last statement's. A statement does not wait for the one before it
to be over, and the block gives its value as soon as its last
statement's is known, while what it started goes on. Four things make a
statement wait:

- it uses the value of an earlier one, as `name <- read()` followed by
  `write(name)`;
- it is written after a claim: a claim holds every statement after it in
  its block until it is decided, and if it is refuted none of them
  happens;
- it is written after a statement whose value is dropped and whose
  answer has not come (see "Failures" below);
- the block is written `sync`, or the two are written `then(a, b)`.
  `then` waits for more than a value: `b` is started when `a`'s value
  is known and nothing that `a` started still goes on. So
  `then(body(), files.close(f))` closes the file after everything the
  body did, whatever functions it called.

So what runs at once is a statement whose value is bound, as
`a <- fetch(x)` followed by `b <- fetch(y)`, and the arguments of a
call, as `price(fetch(x)) + price(fetch(y))`. With no late answer,
statements happen in the order written. What must happen in an order is
best written so that it cannot be forgotten: the second takes what the
first returns, or the capability offers the pair as one operation.

### Failures

A failure is plain data of one shape: a structure whose first entry is
keyed `failure` and holds a symbol naming what failed, with details
after it.

```
{failure: `file_missing, path: p}
```

The kernel has nothing for a failure. A capability's operation that can
fail answers with its result or with a failure, and the caller tells
them apart. Allegretto ships two functions for that, written in
Allegretto:

| Name | Gives |
|---|---|
| `is_failure(x)` | true where `x` is a failure |
| `handle(x, name, handler)` | `handler(x)` where `x` is a failure named `name`; otherwise `x`. A failure of another name comes through as it is |

```
is_failure(x) =>
  if kind(x) == `structure
  then if count(x) == 0 then false
       else if kind(key(x, 0)) == `symbol then key(x, 0) == `failure else false
  else false

handle(x, name, handler) =>
  if is_failure(x) && x.failure == name then handler(x) else x
```

A failure that nothing handles is a refutation. A statement whose value
is dropped stands for a claim: the line `files.write(f, t)` is
`claim(!is_failure(files.write(f, t)))`. Being a claim, it holds the
statements after it until the write's answer is known, and if the
answer is a failure none of them happens. A statement that binds its
value, `r <- files.write(f, t)`, stands for no claim and holds nothing:
`r` is the program's to look at. The last statement of a block is its
value and goes to the caller, a failure or not. A failure handed to a
primitive function is outside its domain, which is a refutation, so
nothing computes with one unseen. A name is bound once in a block; an inner block may
bind it again.

A block with bindings stands for the kernel's block of bindings (section
4). A block with none is the chain of `also` alone.

### The module

A text is one module: a function, as "A module is a function of its
capabilities, inputs and imports" has it. Its parameters are declared by
lines of their own. Each may stand anywhere at the top level of the
module, in any order: like a binding, it declares a name for the whole
module.

| Form | Declares |
|---|---|
| `capability output` | a capability the module is handed, bound to the name `output` |
| `input name` | an input, bound to `name`: plain data. The configuration supplies it to the module being run, and an importing module supplies it to a module it imports. Unknown until it is supplied |
| `key name` | one of the module's keys, bound to `name`. Several lines declare several keys, in written order |
| `import name` | another module, instantiated, bound to `name`; a binding of it is read as `name.f` |
| `import name with a: e, b: f` | the same, with `e` handed for the capability or input the imported module calls `a`, and `f` for `b` |
| `import name without c` | the same, with the capability or input `c` withheld |

**What an import stands for.** A binding: `name = M(arguments)`, where
`M` is the imported module's function, which the kernel supplies, and
the arguments are one for each capability and input `M` declares, in
`M`'s order:

- by default, the importing module's capability or input of the same
  name;
- for a name listed after `with`, the expression given. It may use any
  name of the importing module, its bindings included;
- for a name listed after `without`, `refuse("the capability c was
  withheld by the importing module")`: a refusal that happens if the
  imported module uses it.

A capability or input the imported module declares, which the importing
module neither holds under that name, nor hands with `with`, nor
withholds, is a finding when the text is read. `with` and `without` may
both appear, each with a comma-separated list.

Being a binding, an import is evaluated when something first needs it.
The imported module's top-level statements are started then, in written
order, and once: two imports of one module with the same arguments are
one instance. An import nothing needs is never instantiated.

`use name` brings a module's bindings and its notation. It takes `with`
and `without` as `import` does. Its place in the text matters, as no
other declaration's does: the notation acts from that line. The notation
is taken from an instance made with no capability and no input.

The rest of the text is the module's block. What the module yields is a
structure of its bindings, keyed by symbols of their names: those marked
`export`, or all of them when none is marked ("Export marks the binding,
and a module with no exports is open"). A part of a capability is read
as an entry: `output.write("hello")`.

Comments are `// to the end of the line` and `/* between */`.

## 3. The shipped primitives Allegretto names

Pure primitive functions, each with a content hash and, as the goal, a
reference definition. Outside its domain each gives a refutation:
division or remainder by zero, a place outside a structure, a text that
is not a number.

- `int.add`, `int.sub`, `int.mul`, `int.neg`: 64-bit, wrapping.
- `int.div`, `int.mod`: signed, truncating toward zero.
- `int.lt`, `int.gt`, `int.le`, `int.ge`: signed.
- `int.text`: an integer's decimal text. `text.int`: the reverse.
- `float.add`, `float.sub`, `float.mul`, `float.div`, `float.neg`,
  `float.lt`, `float.le`, `float.text`, `int.float`, `float.int`.

## 4. What the kernel stream owes for this

1. **The block of bindings**: the kernel primitive `block(bindings,
   body)`. The bindings are a structure keyed by names; they are one
   group, each may use any other and itself, and a recursive function is
   one value with one identity. In the data form a block is an
   application of the primitive, so it needs no node of its own. `x <- e`
   is `block({x: e}, also(x, rest))`, and in a `sync` block
   `block({x: e}, then(x, rest))`. *Built.*
2. **The kernel's primitives on bits**: `same` tells two bits values or
   two symbols apart; `join`, `length` and `slice` join two bits values,
   measure one and take a part of one. Allegretto binds the last three
   to the names `bits.join`, `bits.length` and `bits.slice`. They are
   the kernel's and not shipped primitives because every shipped
   primitive is to have a reference definition, and these are what such
   a definition is written in (issue 21 of the adversarial review).
   *Built.*
3. **Reading a structure**: `get` reads an entry by key or by place, and
   `count` gives the number of entries. An entry is evaluated when it is
   read, at most once; a primitive function is handed a structure with
   every entry evaluated. *Built.*
4. **The shipped primitives** of section 3, in `next/prims/index.ts`.
   *Built.* Each is named by a hash over its host code, by ruling: the
   helpers all share and its own entry, comments left out. The hashes
   are committed in `next/prims/hashes.ts` and a test computes them
   again.
5. **A primitive function that refuses**: its host code throws
   `Refusal` with a reason, and the kernel answers a refutation.
   *Built.*
6. **A symbol as data**, for the symbol literal: `Kernel2.symbolData`.
   *Built.* In the data form it is the node `datum`, in a record of the
   second version.

### Keys and private entries

Ruled 2026-11-17. A key is an ordinary name once declared: it is passed
to `describe`, closed over by a function, and used to read. A private
entry is passed over by a place, by `count` and by a primitive function;
only `p[k]` with the key reads it.

```
capability output
key secret

make(n) => { shown: n, [secret]: n * 2 }
hidden(p) => p[secret]

box = make(21)
output.write(int.text(count(box)))     // 1: the private entry is not counted
output.write(int.text(hidden(box)))    // 42
```

The brackets of a literal may hold any expression that gives a symbol or
a key; a key's name is one case. A module may hand a key out by
binding it and exporting the binding; the header name itself is not a
binding, so a module with no exports hands out no key. In the data form
the keys are the module function's first parameters, counted by `keys`,
and a private entry is a structure entry whose key is that parameter.

## 5. Against the present tree's base grammar

`src/grammar2/base-grammar.ts` is the grammar the present tree calls
Allegretto. It already has the literals, names, lambdas, function
bindings, application, the pipe, `.` and `[ ]`, `if then else`, the
logical and arithmetic operators at these precedences, object and array
literals, indentation blocks, comments, `import` and `export`.

Allegretto's grammar is that grammar with these productions removed,
each a part of the standard language: type annotations and type
expressions, typed parameters, generics, `when` and patterns, `theorem`
and `verify`, the `grammar` block and its declarations, `&` on types,
`instanceof` and `subtypeof`, `Y of x`, `error`, `none`, and text
interpolation. It adds seven: the symbol literal, `++`, the binding `<-`, the header
lines `capability`, `input` and `key`, and a private entry in a
structure literal.

The reader takes the engine's parse tree. It does not use the present
tree builder, which rewrites what it reads: it puts a block binding's
value at each use, wraps branches in functions, and wraps literals in
calls of the type system.

## 6. The questions, as ruled

The maintainer approved each proposal on 2026-11-16, with one change.

1. **The symbol literal** is `` `name ``.
2. **`++` joins bits.** It is the first operator added for readability.
3. **A binding that happens at its place** is written `line <- read()`.
   It is a statement: it is started at its place, and the name is
   bound to its value for the rest of the block. A binding written with
   `=` is never where an effect happens.
4. **The header words** are `capability`, `input` and `import`. The
   proposal had `uses`; the maintainer: "we should use `capability`
   since it's the canonical term for what's being declared".
5. **Milestone 3's programs** are Allegretto texts written for the
   purpose, with the kernel's tests among them. The present-surface
   cases that need types move to milestone 4. The acceptance stream
   carries this out in its census.
6. **Keys** (2026-11-17). A header line `key name` declares a key; a
   structure literal writes a private entry as `[name]: e`; `p[name]`
   reads it, with no form of its own. The maintainer asked for a form
   since Allegretto has one for everything the kernel does.
7. **Imports** (2026-11-18). An import is a binding that calls the
   imported module's function. It hands over the capabilities and
   inputs of the same name by default; `with` replaces what is handed
   for a name and `without` withholds one. `capability`, `input`, `key`
   and `import` may stand anywhere at a module's top level. A module
   with top-level statements may be imported: they happen when it is
   first needed.
8. **Building data** (2026-11-18). Five names: `put`, `key`, `kind`,
   `symbol` and `spelling`. The brackets of a structure literal take
   any expression. `kind`'s answers are plain symbols.
9. **Statements do not wait** (2026-11-19). A block's statements are a
   chain of the kernel's `also`: started in written order, none waiting
   for the one before it. A claim holds what is written after it. `sync`
   before a block makes its statements a chain of `then`. The maintainer
   wants effects that do not depend on each other to run at once, and
   sequence to be asked for.
10. **Failures** (2026-11-19). A failure is plain data: a structure
   whose first entry is keyed `failure`. `is_failure` and `handle` are
   Allegretto's functions for it, and no primitive. A statement whose
   value is dropped stands for a claim that the value is no failure.
11. **`then` waits for all of its first** (2026-11-19). A function may
   give its value and leave work going; a caller who writes `then` or
   `sync` waits for that work too, and one who does not, does not.
