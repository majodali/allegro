// Demo: C3.3 (D36) — observation is effectful; re-checking is pure.
//
// `x instanceof PositiveInt` is a PURE PREDICATE RE-CHECK: it recomputes
// from the value's data, so two values equal in shape and data answer
// identically no matter how they were constructed (congruence).
// `certificate_peek(x, T)` asks the provenance question — "was x
// CONSTRUCTED as T?" — which can distinguish equal values, so it is
// EFFECTFUL (label "observe") and functions using it cannot claim
// `effects pure`.

PositiveInt = Int & _ > 0
x = PositiveInt(5)

// Pure re-check: construction history is irrelevant.
print(x instanceof PositiveInt)
// expect: true
print(5 instanceof PositiveInt)
// expect: true
print(0 - 3 instanceof PositiveInt)
// expect: false

// Equality ignores knowledge (D37 groundwork): the certificate rides
// along but never affects ==.
print(x == 5)
// expect: true

// Observation: the peek distinguishes what instanceof must not — which
// is exactly why it carries the "observe" effect.
print(certificate_peek(x, PositiveInt))
// expect: true
print(certificate_peek(5, PositiveInt))
// expect: false
