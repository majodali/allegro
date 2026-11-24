# The Allegretto programs of the corpus

Programs in Allegretto (`next/ext/allegretto/forms.md`), the first
notation, that show the cases of `next/corpus/cases.json` on the new
kernel. The tests and other code of milestones 4 to 7 are written in
Allegretto too, by the maintainer's ruling of 2026-11-16.

## Where a program lives

A program is a `.alg` file in a directory `m<milestone>` directly under
`next/corpus/allegretto/`. Its milestone is its directory's.

A program may import. `import name` reads the file `name.alg` in the
directory of the importing text (`importedFile` of
`next/bootstrap/driver.ts`). A program that imports texts which are no
programs of their own is the file `main.alg` in a directory of its own
directly under `m<milestone>`, and its imported texts are the other
`.alg` files of that directory. Those are not run alone and state no
lines. A program directly in `m<milestone>` may import another file
there, which is then a program too, with its own lines.

## What a program states

Each statement is a comment line of its own:

| Line | Says |
|---|---|
| `// realises: <case id>` | the program shows this case; one line per case, the id exactly as in `next/corpus/cases.json` |
| `// expect: <line>` | a line the program prints; the lines in order, each compared exactly |
| `// end: <how>` | how the run ends: `completed`, `refuted: <the reason the kernel gives>`, `waiting: <the reason the launcher gives>`, or `refused: <the reason>`; every program has one |
| `// summary: <word>` | the run's summary, the weakest strength among its claims: `refuted`, `undecided`, `assumed`, `sampled` or `decided`; at most one line (see "The summary") |
| `// claim at: <line>:<column> <word>` | the claim written at that line and column of the program's own text came out with this word: `decided`, `sampled`, `assumed`, `undecided`, `refuted` or `waiting`; several lines may be written (see "A claim by its place") |
| `// yields: a, b` | the keys of the structure the module yields, in order |
| `// input: name = <literal>` | the configuration supplies this input at the start |
| `// later: name = <literal>` | a later phase supplies this input; one phase per line, in order |
| `// check claim at: <line>:<column> <word>` | as `// claim at:`, for the check's result, where the phases are `check, run` (see "Phases") |
| `// phases: check` | the launch applies check alone, or with `// phases: check, run` check and then run; at most one line (see "Phases") |
| `// serves: <METHOD> <url> = <status> <literal>` | the network answers this request; one line per request served (see "Requests") |
| `// reports: <level>: <text>` | a message the program hands to `report.message`; one line per message, in order (see "Messages and status") |
| `// status: <n>` | the highest status the program hands to `report.status`; at most one line (see "Messages and status") |

A program written for the purpose that shows no case of the present
tree has no `// realises:` line.

## An expected refusal

`// end: refused: <the finding>` states that the reader, the emitter or
the driver refuses the text: nothing is launched. The program passes
when the message of one of the findings, without its place, is the one
stated, and it states no `// expect:`, `// later:` or `// yields:` line.
The part of a message before a colon may be stated alone: a text that
does not parse is stated as `not Allegretto`, since the words after it
are the parser engine's and change with the engine.
A finding in an imported text counts. A refusal by the launcher, before
anything is evaluated, is written the same way with the launcher's
reason.

An input's value is one Allegretto literal: a text, a whole number, a
decimal fraction, `true`, `false`, a symbol literal, a negative number,
or a structure or array literal of these. `readLiteral` of
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
the text and the texts it imports with the driver of
`next/bootstrap/driver.ts` and runs the records with the launcher of
`next/launch/launcher.ts` on the kernel `next/kernel/create.ts` gives, the imported ones
loaded first, with the output capability, the timer capability, the
HTTP capability, the check-output capability, the shipped primitives,
its inputs and a budget of 1,000,000 steps. A program passes when its
printed lines, its end, the lines printed before each later phase and
its yielded keys are the ones stated, and its summary, the word of each
claim it states by its place, its messages and its status where it
states them. The yielded keys are read
with the program's inputs handed in and its imported records loaded.

## Phases

`// phases: check` and `// phases: check, run` are the lines built
for a program, and `// phases: test` and `// phases: check, test` for a
test module (see "Tests"). Each
names the phases the launch applies, as the setting `phases` of
`next/tools/configuration.ts` names them. A program with no such line
runs as `run` alone, which is what the runner did before the line
existed.

Check is the kernel's check (`Phase.check` of
`next/launch/launcher.ts`). The launcher hands the module to the
kernel's `check` once, and nothing is performed. Every input is unknown,
so the `// input:` lines are not used. The check capabilities of the
ceiling, `report` alone today (`CHECK_CAPABILITIES` of
`next/tools/configuration.ts`), are not needed: a call on a part
performs nothing and answers the empty structure, so no message and no
status is handed over (see "Messages and status"). Every other declared
capability is not yet given: a call on it waits, and nothing is printed.
The check ends the launch refuted where it finds a refuted claim or any
other refutation, and at its limit where its budget runs out.
Otherwise it is over, and check alone completes. A `// later:` line
with check alone is never applied, so it fails the program.

Under `check, run` the run follows a check that found nothing. It is an
ordinary run, given the `// input:` lines, and each `// later:` line is
a phase after it. A check that finds a refutation ends the launch, and
nothing is printed.

The `// expect:`, `// end:`, `// reports:` and `// status:` lines hold
for the whole launch. The `// summary:` and `// claim at:` lines hold for
the last phase's result: the check's under check alone, the run's under
`check, run`. `// check claim at: <line>:<column> <word>` states a
claim's word in the check's result, where the phases are `check, run`;
it is read as `// claim at:` is (see "A claim by its place"). Such a
line with other phases, a line not of the form `phases: <name>, <name>`,
a list that is not built, and two lines each fail the program, and it is
not launched.

## The summary

The launcher gives, with how a run ended, what the run found: its result
(`LaunchResult` of `next/launch/launcher.ts`). The result lists each
claim as written with its counts, says what the run rests on, and gives
the summary: one word, the weakest strength among the claims, by the
decision "A module's summary is the weakest strength among its claims".
A claim with a refuted evaluation is `refuted`. Else one with an
undecided evaluation, or one that still waits when the run ends, is
`undecided`. Else one with an assumed evaluation is `assumed`. Else one
with a sampled evaluation is `sampled`. Else it is `decided`. A run with
no claim is `decided`. No program here gives `sampled` yet: the notation
does not write the kernel's `sample`.

`// summary: <word>` states the summary. A program that states one
passes only if the run's summary is that word. A program that states
none is not compared on it, so the line is written only where it says
something worth holding. Every statement whose
value is dropped stands for a claim, so a line written with
`output.write` is a claim too. A word that is not one of the five, two
lines, and a line in a program that is not launched or that the
launcher refuses each fail the program. `runProgram` gives the result
of the run (`ProgramRun.result`).

## A claim by its place

Each claim of the result gives the place it was written (`at` of
`ClaimResult` in `next/launch/launcher.ts`): the file, and the line and
column of its start and of the point after its end. The emitter writes
each part's place into the record, and the launcher copies the kernel's.
`// claim at: <line>:<column> <word>` states that the claim written at
that line and column of the program's own text came out with that word.
The line and column are those of the claim's first character, each
counted from 1. A statement whose value is dropped stands for a claim
written where the statement starts.

The word is the summary's rule for one claim (`claimWord` of
`next/launch/launcher.ts`): `refuted`, else `undecided`, else `waiting`
for a claim that still waits when the run ends, else `assumed`, else
`sampled`, else `decided`. The summary counts a claim that waits as
`undecided`; this line keeps the two apart.

A program may state several such lines. Every claim of the result
written at the place must have the word. A line that names a place where
no claim of the result is written fails the program. A line that is not
of the form, and a line in a program that is not launched or that the
launcher refuses, each fail the program. The line names a place in the
program's own text only, so a claim in an imported text is not stated
this way.

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

## Waits

The runner's ceiling grants `output`, `timer`, `http` and `report`. `timer.wait(n)`
(`next/launch/timer.ts`) answers late with the number `n` once `n`
milliseconds have passed. In the runner they pass on a clock that runs
no real time (`virtualClock` of `next/launch/clock.ts`), made anew for
each run. It answers the waits in the order they fall due, and among
waits due at the same time the one asked first. A wait asked when an
answer arrives falls due counted from that answer. So a program's
printed order under waits is the order its waits fall due, a run takes
no wall-clock time for them, and two runs print the same. `npm run
allegretto` grants the same capabilities on the host's real timer.

## Requests

`http.request(r)` (`next/launch/http.ts`) makes an HTTP request and
answers late. `r` is a structure: `method` and `url`, texts, are
required; `headers`, an array of pairs `[name, value]` of texts, and
`body`, bits of whole bytes, may be left out. The answer is the
structure `{status, headers, body}`: the status a whole number, the
headers an array of pairs of texts, the body the bytes received. Any
status is an answer, a 404 and a 500 included. A request that gets no
answer is the failure ``{failure: `unreachable, reason: <a text>}``. A
value outside that domain is a refutation with the part's reason.

No program here reaches a network. The runner makes the capability, for
each run, with a transport that answers from the program's own lines
(`scriptedTransport` of `next/launch/scripted-transport.ts`). Each line
serves one request:

```
// serves: GET https://example.org/hello = 200 "hello, world"
```

The method and the URL are compared exactly with the request's. The
status is a whole number of three digits. The literal is a text literal,
read by `readLiteral` of `next/bootstrap/literal.ts`, and its bytes are
the body. The answer has no headers. A request that no line serves is
unreachable, with the reason `nothing serves <METHOD> <url>`. A line
not of this form, a body that is no text literal, and two lines for one
request each fail the program, and it is not launched.

The transport answers the requests in the order they were asked, one at
a time, and lets the host's event loop take one turn between two
answers. So a program's printed order under requests is the same on
every run. What the transport was handed is part of what a run gives
(`requests` of `runProgram`), so a test can see the headers and the body
a program sent. `npm run allegretto` grants `http` on the host's
`fetch`.

## Messages and status

`report` (`next/launch/report.ts`) is the check-output capability: a
check capability, which check hands as not needed and a run supplies
with the rest.
It hands messages and an exit status to whatever ran the program. Its
two parts give the program nothing: each answers at once with the empty
structure, whatever it is given, so leaving a call out changes nothing
the program computes.

`report.message(m)` hands a message. `m` is a structure with `level`,
one of the symbols `` `error ``, `` `warning `` and `` `note ``, and
`text`, a text; `file`, a text, and `line` and `column`, whole numbers,
may be added. A text alone is a note. Any other value is a note that
says it was no message and names its kind. A message does not set the
status.

`report.status(n)` hands a status, a whole number from 0 to 255. The
highest handed over in a run stands. A value that is no status counts as
255, and a note says so.

The runner makes the capability, for each run, with a sink that keeps
the messages and the highest status. Two lines state them:

```
// reports: warning: an unused binding
// reports: main.alg:3:7: error: a name bound twice
// status: 2
```

Each `// reports:` line is one message, in the order handed over,
compared exactly as an `// expect:` line is. It is the line the terminal
writes for the message: `level: text`, with the place first where the
message gives a file, `file:line:column: level: text` with the parts it
has (`messageLine` of `next/launch/report.ts`). A program that states no
`// reports:` line is not compared on its messages; one that states any
must hand over exactly those. `// status: <n>` states the highest
status, 0 where none was handed over; a program that states none is not
compared on it. A line not of these forms, and two `// status:` lines,
each fail the program, and it is not launched. What the program handed
over is part of what a run gives (`messages` and `status` of
`runProgram`).

`npm run allegretto` and `npm run launch` write each message to stderr as
that line, as it is handed over. They exit with the higher of two
numbers: 0 for a completed run and 1 otherwise, and the highest status.

## Tests

`// phases: test` and `// phases: check, test` make the program a test
module, and the launch a test phase (`Phase.test` of
`next/launch/launcher.ts`). Nothing in the notation changes: a test
module is an ordinary text, and it imports what it tests.

The module function is called once, as a run calls it: that is the
load. It is given the `// input:` lines, its top-level statements run
and its claims are recorded. A test is an entry of the structure the
module yields whose value is a function of no parameters, and its name
is the entry's key. So in a module that marks exports the tests are the
exported functions of no parameters, and in one that marks none every
function of no parameters it binds. Reading an entry evaluates its
binding, as any read does, so a binding nothing had read is evaluated
at the load. Where the load completes, each test is called in order, by
an evaluation of its own, with the budget of the launch to itself. A
refuted claim ends that test and no other. Where the load does not
complete, no test is called. Under `check, test` the check comes first,
as under `check, run`, and a check that finds a refutation calls no
test.

```
// test: adds: passed
// test: subtracts: refuted: a claim that is not true
```

Each `// test: <name>: <end>` line is one test called, in order. `<end>`
is `passed` where the test completed, and otherwise the end as an
`// end:` line writes it. A program that states any `// test:` line must
state exactly the tests called; one that states none is not compared on
them. The `// end:` line is the launch's: `completed` where the load and
every test completed, and otherwise the end of the first that did not,
the load first. The `// expect:` lines are the lines of the load and of
every test, in order. The `// summary:` and `// claim at:` lines hold
for the load's result. `// reports:` and `// status:` hold for every
message and status handed over, by the load and by the tests. The runner
uses its own clock and transport as it does for a run, so a `// serves:`
line serves a test too. A `// later:` line with a test phase, a
`// test:` line with phases that are no test phase, and a line not of
the form `test: <name>: <end>` each fail the program, and it is not
launched.

`npm run allegretto` and `npm run launch` take `--phases test` and
`--phases check,test`. They print one line for each test, `test <name>:
passed` or `test <name>: <the end>`, the lines a test that did not
complete printed under it, each indented by two spaces, and a last line
`tests: <n> passed, <m> failed`. For each test that ended refuted they
write one message to stderr, `file:line:column: error: test <name>:
<the reason>`, with the place of its first refuted claim. Under a test
phase their timer is on a clock that moves itself, so a wait ends at
once, and their HTTP reaches nothing, so every request answers
`unreachable`. Coverage, the test modules of a project and test
versions a project supplies are not built.

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
