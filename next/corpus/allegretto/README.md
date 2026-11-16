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
| `// end: <how>` | how the run ends: `completed`, or `refuted: <the reason the kernel gives>`; every program has one |
| `// yields: a, b` | the keys of the structure the module yields, in order |

A program written for the purpose that shows no case of the present
tree has no `// realises:` line.

`runProgram` of `next/corpus/allegretto.ts` reads these lines. It emits
the text with `next/bootstrap/emit.ts` and runs the record with the
launcher of `next/launch/launcher.ts` on the reference kernel, with the
output capability, the shipped primitives and a budget of 1,000,000
steps. A program passes when its printed lines, its end and its yielded
keys are the ones stated.

## When a case is realised

A case is realised when a program that names it passes. A program names
a case only if it shows what the case asserts: the case's own text, or a
faithful restatement in Allegretto, printing the value the present test
compares, with the present expectation as its `// expect:` lines. For a
case of class `changes` the expectation is the case's `becomes`, not the
present result.

A number is printed through `int.text`, a text as it is, and a truth
value as `if … then "true" else "false"`.

## A text of the standard language

By the maintainer's ruling, an Allegretto program may hand a text of the
standard language to the parser engine. That engine is to be written in
Allegretto by the kernel stream and does not exist yet, so no program
here does so.

## Checks

- `npm run test:next` runs every program here
  (`next/corpus/allegretto.test.ts`).
