// Phase E Stage 0: `partial` body-form annotation.
//
// Functions annotated with `partial` opt out of the totality analyzer
// (exhaustiveness in Stage 1, termination in Stage 2+). Stage 0 ships the
// substrate only — the annotation parses and attaches a `partial_attach`
// wrapper around the function body, but no real check fires yet.
//
// Runtime behavior is unchanged: the wrapper is a passthrough.

use totality

// A function whose `when` doesn't cover every case. Later stages would
// flag this; for now `partial` is documentation.
classify(b) =>
  partial
  when b
    is true then "yes"

// Even pure / total functions can be marked `partial` (no-op annotation).
trivial() =>
  partial
  42

print(classify(true))          // expect: yes
print(trivial())               // expect: 42
