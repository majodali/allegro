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
  refer to each other and to themselves. Statements happen in written
  order. Bindings may be written among the statements.
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
| `[e, f]` | a structure with no keys |
| `` `name `` | the symbol `name`, as data |

A whole number outside the signed 64-bit range is refused by the
reader. There is no interpolation in a text: it would need a number's
text chosen by type.

### Names, functions and application

| Form | Stands for |
|---|---|
| `x` | what `x` is bound to; an unbound name is refused at the end of the text ("A language checks the names it cares about") |
| `x => e`, `(x, y) => e`, `() => e` | a composed function |
| `f(a, b)` | an application |
| `a \|> f` | `f(a)` |
| `p.a` | reading the entry of `p` keyed by the symbol `a` |
| `p[i]` | reading the entry of `p` at place `i`, counted from 0 |

### Control and claims

| Form | Stands for |
|---|---|
| `if c then a else b` | `if(c, a, b)`, the kernel's conditional |
| `a && b`, `a \|\| b`, `!a` | `if(a, b, false)`, `if(a, true, b)`, `if(a, false, true)` |
| `claim(e)` | the kernel's claim |

The kernel's other primitives are reached as names Allegretto binds:
`then`, `attempt`, `describe`, `build`, and those ruled and not yet
built. A check the standard language writes as an annotation is written
as a claim: `claim(is_int(x))`.

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
| `x <- e` | a statement: `e` happens here, and `x` is bound to its value for the rest of the block |
| an indented block | a block of bindings around a chain of `then` |

A block's bindings are one group, whatever lines they are written on.
Each may use any other, and itself. A binding's value is evaluated when
something needs it, at most once. So a binding is never the place where
an effect happens: `line = read()` reads when `line` is first needed. A
block's statements happen in written order, and the block's value is its
last statement's. A name is bound once in a block; an inner block may
bind it again.

A block with bindings stands for the kernel's block of bindings (section
4). A block with none is the chain of `then` alone.

### The module

A text is one module: a function, as "A module is a function of its
capabilities, inputs and imports" has it. Its parameters are declared by
header lines, before anything else:

| Form | Declares |
|---|---|
| `capability output` | a capability the module is handed, bound to the name `output` |
| `input name` | an input, bound to `name` |
| `import name` | another module's bindings, bound to `name`; one is read as `name.f` |

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

1. **The block of bindings**, in the kernel and in the saved-program
   data form: a group of named values that may refer to each other, and
   a body. It is what makes a recursive function one value with one
   identity, where self-application made it a wrapper.
2. **The kernel's primitives on bits**: telling two apart, ruled in
   "The kernel's primitives are pure and few" and not built; and
   joining two, measuring one and taking a part of one, bound in
   Allegretto to the names `bits.join`, `bits.length` and `bits.slice`.
   They are the kernel's and not shipped primitives because every
   shipped primitive is to have a reference definition, and these are
   what such a definition is written in (issue 21 of the adversarial
   review).
3. **Reading a structure**: an entry by key, an entry by place, and the
   number of entries. Entries are evaluated when read.
4. **The shipped primitives** of section 3, under `next/prims/`.
5. **A primitive function that refuses**: a way for a primitive's host
   code to answer a refutation with its reason.

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
interpolation. It adds five: the symbol literal, `++`, the binding `<-`, and the header
lines `capability` and `input`.

The reader takes the engine's parse tree. It does not use the present
tree builder, which rewrites what it reads: it puts a block binding's
value at each use, wraps branches in functions, and wraps literals in
calls of the type system.

## 6. The questions, as ruled

The maintainer approved each proposal on 2026-11-16, with one change.

1. **The symbol literal** is `` `name ``.
2. **`++` joins bits.** It is the first operator added for readability.
3. **A binding that happens at its place** is written `line <- read()`.
   It is a statement: it happens in written order, and the name is
   bound to its value for the rest of the block. A binding written with
   `=` is never where an effect happens.
4. **The header words** are `capability`, `input` and `import`. The
   proposal had `uses`; the maintainer: "we should use `capability`
   since it's the canonical term for what's being declared".
5. **Milestone 3's programs** are Allegretto texts written for the
   purpose, with the kernel's tests among them. The present-surface
   cases that need types move to milestone 4. The acceptance stream
   carries this out in its census.
