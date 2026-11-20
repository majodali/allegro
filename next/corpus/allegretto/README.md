# The Allegretto programs of the corpus

Programs in Allegretto (`next/ext/allegretto/forms.md`), the first
notation, that show the cases of `next/corpus/cases.json` on the new
kernel. The tests and other code of milestones 4 to 7 are written in
Allegretto too, by the maintainer's ruling of 2026-11-16.

## Where a program lives

A program is a `.alg` file in a directory `m<milestone>` directly under
`next/corpus/allegretto/`. Its milestone is its directory's.

## What a program states

Each statement is a comment line of its own:

| Line | Says |
|---|---|
| `// realises: <case id>` | the program shows this case; one line per case, the id exactly as in `next/corpus/cases.json` |
| `// expect: <line>` | a line the program prints; the lines in order, each compared exactly |
| `// end: <how>` | how the run ends: `completed`, `refuted: <the reason the kernel gives>`, or `waiting: <the reason the launcher gives>`; every program has one |
| `// yields: a, b` | the keys of the structure the module yields, in order |
| `// input: name = <literal>` | the configuration supplies this input at the start |
| `// later: name = <literal>` | a later phase supplies this input; one phase per line, in order |

A program written for the purpose that shows no case of the present
tree has no `// realises:` line.

An input's value is one Allegretto literal: a text, a whole number, a
decimal fraction, `true`, `false`, a symbol literal, a negative whole
number, or a structure or array literal of these. `readLiteral` of
`next/bootstrap/literal.ts` reads it. A module's input that no line
supplies is a cell for the whole run.

A `// later:` line is one later phase: an input that arrives later in
the same run. The word phase is used in its general sense; a value that
arrives later is the same event. The launcher applies the line when the
kernel waits and no capability's answer is due, in the order of the
lines. A later phase supplies inputs and nothing else: the kernel, the
capabilities and the step budget are the run's. An `// expect:` line above a `// later:` line must be printed
before that phase is applied; one below it, in that phase or after. The
launcher's count of the lines printed before each phase
(`linesBeforePhase` of `next/launch/launcher.ts`) checks this, and a
`// later:` line whose phase is never applied fails the program.

`runProgram` of `next/corpus/allegretto.ts` reads these lines. It emits
the text with `next/bootstrap/emit.ts` and runs the record with the
launcher of `next/launch/launcher.ts` on the reference kernel, with the
output capability, the shipped primitives, its inputs and a budget of
1,000,000 steps. A program passes when its printed lines, its end, the
lines printed before each later phase and its yielded keys are the ones
stated. The yielded keys are read with the program's inputs handed in.

## When a case is realised

A case is realised when a program that names it passes. A program names
a case only if it shows what the case asserts: the case's own text, or a
faithful restatement in Allegretto, printing the value the present test
compares, with the present expectation as its `// expect:` lines. For a
case of class `changes` the expectation is the case's `becomes`, not the
present result.

A number is printed through `int.text`, a text as it is, and a truth
value as `if … then "true" else "false"`.

## How a program's statements run

The forms rule this (`next/ext/allegretto/forms.md` §2, "Bindings and
blocks" and "Failures"). A program's top-level statements are started
in written order, and none waits for the one before it to be over. A
statement whose value is dropped stands for a claim that the value is no
failure, and a claim holds what is written after it until it is decided.
Every top-level statement's value is dropped, since the module yields
the structure of its bindings. So a line written with `output.write`
holds the lines after it until the write has answered, and with no late
answer the lines print in written order. A line written `x <- e` holds
nothing: only what uses `x` waits for it. An indented block written
after `sync` runs each statement to its end before the next. `sync`
cannot stand before a program's top level: the forms do not say where it
would be written.

## A text of the standard language

By the maintainer's ruling, an Allegretto program may hand a text of the
standard language to the parser engine. That engine is to be written in
Allegretto by the kernel stream and does not exist yet, so no program
here does so.

## Checks

- `npm run test:next` runs every program here
  (`next/corpus/allegretto.test.ts`).
- `npm run harness:next` runs them with the same implementation and
  reports, per milestone, the programs passing and failing and the cases
  realised (`next/corpus/harness.ts --next`). It fails on a failing
  program, on a `// realises:` line naming no case, and on one case named
  twice by one program. A case named by a program of another milestone's
  directory is reported and does not fail.
