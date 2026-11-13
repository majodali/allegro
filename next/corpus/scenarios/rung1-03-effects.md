# Rung 1, scene 3: what code does not do

| Source | Rung | Milestone | Evidence for |
|---|---|---|---|
| `demos/rung1/03-effects.alg`, `demos/rung1/transcripts/03-broken.txt` | 1 | 5 | Provability, positive and negative: the negative half |

## Who and why

The developer states which capabilities a function may use. They want
that bound checked like any other claim. They want a function that
reaches past its bound refused before anything runs.

## Steps

1. **Does.** Declares `square(x) => x * x` with no bound and prints
   `square(7)`. **Must find.** No claim is made about its capabilities
   ("Nothing is a claim until someone makes it"). The function holds no
   capability, so it is pure, decided from what it holds. The run
   prints 49.
2. **Does.** Declares `loud(msg)` with `effects io`; its body calls
   `print`. Calls `loud("declared and verified")`. **Must find.** The
   bound claim holds, decided. The only capability `loud` reaches is the
   output capability, through `print`, and the bound allows it. A caller
   of `loud` reaches output through `loud`. The run prints "declared and
   verified" from inside `loud`.
3. **Does.** Declares `maybe_log(msg)` with `effects io`; its body uses
   no capability. **Must find.** The bound claim holds, decided: a bound
   states the most a function may use. The run prints 2.
4. **Does.** Prints `"no undeclared effects"`. **Must find.** The run
   prints it.
5. **Does.** Runs `inspect`. **Must find.** For `loud` and `maybe_log`,
   the bound and its claim's strength, decided. For `square`, the
   capabilities it holds, which are none. The module's summary is
   decided.

## Break it

**Does.** Uncomments `sneaky(x)`, which declares `effects pure` and
calls `print`. **Must find.** The bound claim is refuted, decided. The
refutation names `sneaky`, its bound (no capability), the capability it
reaches (output) and where (the call of `print`). It is found while the
program is checked, before any effect: the run prints nothing. The
present tree already halts before output here.

## What changes by ruling

- "An effect is the use of a capability": the code infers sets of
  effect labels (`io`) and compares them in a pass of its own. What a
  function may do is read from the capabilities it holds, and the
  refusal names a capability. The text "declared `pure`, inferred `io`
  (undeclared: io)" goes.
- "What code may do is bounded by the capabilities it is given, and
  that bound is a claim": "effects declaration check failed" becomes the
  refutation of the bound claim of `sneaky`.
- "A module's summary is the weakest strength among its claims": the
  grade `proven-safe` becomes the word decided.
- "Four strengths, one vocabulary": `inspect`'s "effects: io (declared,
  verified)" gives the strength decided.

## Open questions

1. What is the output capability called in an `effects` clause? The
   scene writes `io`. The ruled launchers ship output, timers and HTTP
   ("The terminal and the browser ship output, timers and HTTP"), and no
   name for them is ruled.
2. Does the bound need `use effects`, or is the `effects` clause part of
   the standard language without it?
3. The scene's comment says `inspect` shows `square` as pure. The
   present `inspect` shows nothing for it. Must milestone 5's `inspect`
   show the capabilities a function holds when it makes no claim, as a
   report?

## Present pins

Four pins. All are covered.

| Line | Pinned output | Step |
|---|---|---|
| 11 | `49` | 1 |
| 19 | `declared and verified` | 2 |
| 25 | `2` | 3 |
| 39 | `no undeclared effects` | 4 |
