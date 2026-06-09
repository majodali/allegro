// Domain-failure rendering hook (Vivace models — stage-(b) validation).
//
// A model type renders its own constraint failures in DSL vocabulary by
// attaching a renderer with `.onFailure`. The kernel routes a failed
// construction through the renderer (passing a structured, non-error
// failure descriptor) and surfaces its message instead of the kernel
// default. Types without a renderer keep the default message.

// A budget constraint that speaks money, not refinement-domain notation.
// The renderer reads the failure as data: `constraint` (the violated
// bound) and `counterexample` (the offending value).
Budget = (Int & _ <= 5000).onFailure(f =>
  "budget exceeds {constraint of f} limit (was {counterexample of f})")

over = Budget(6000)
print(error of over)            // expect: budget exceeds ≤ 5000 limit (was 6000)

// A passing construction is unaffected by the renderer.
print(Budget(3000))             // expect: 3000

// The renderer is inherited: a base type carrying `__renderFailure` passes
// it forward to a refinement built on top.
Quota = Int.onFailure(f => "quota violation: {message of f}")
SmallQuota = Quota & _ < 10
print(error of SmallQuota(42))  // expect: quota violation: refinement check failed: expected ≤ 9 (got 42)

// Without a renderer, the default kernel message is unchanged.
Plain = Int & _ <= 100
print(error of Plain(200))      // expect: refinement check failed: expected ≤ 100 (got 200)
