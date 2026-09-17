# Plane interfaces — the base holds the symbol, the layer installs the meaning

> Status: **draft** — awaiting the §7 rulings.
> Owner: **B-112**. Raised by the concept spine (S2f); `concepts.md` §24
> carries the interface table, and every T2 delta is an instance of an absent
> interface.
> Outcome (K-007): the four owed hooks exist, are capability-gated, and share
> one form. The five other upward-import populations are filed, not worked.

## 1. Why, stated precisely

The rework does **not** get the thesis tested sooner. Rungs 1 and 2 are
delivered and rung 3 — the Vivace pilot, `release-track.md` §5's named
hypothesis test — is blocked on B-079/B-080 and solution-finding primitives,
none of which is a layer-interface problem.

What it buys is the ability to **reason about findings, especially unexpected
ones** (maintainer, 2026-09). B-121 C2 is the evidence: eleven sites broke on
a change that altered no interface, every failure was silent, and two whole
classes of them were invisible to the survey that was supposed to find them.
Rung 3 adds new L0/L2 surface — a constraint substrate and solution finding
over it — so the risk C2 measured is live *while* the pilot is built, not
before it.

That is the whole justification. This plan deliberately does not claim more.

## 2. The measurement

Delta 23 records *L0 imports 27 symbols from L2*. Parsed from the import
clauses of the seven L0 files (`types.ts`, `structure.ts`, `slots.ts`,
`scope.ts`, `evaluator.ts`, `primitives.ts`, `runtime.ts`) against the six L2
modules:

**131 imported symbols, 98 distinct.** `primitives.ts` alone takes 54 from
`types-std`.

Classified by what the symbol IS, because the classes want different answers:

| Class | Distinct | Examples |
|---|---|---|
| operations | 23 | `unifyTypes`, `impliesDomain`, `propagateSetForPrimitive` |
| constructors / transforms | 19 | `withType`, `makeArray`, `normalizeType` |
| type constants | 13 | `IntType`, `BoolType`, `ArrayType` |
| accessors / projections | 13 | `getType`, `domainOf`, `predicatesOf` |
| TS types | 10 | `PredicateSet`, `AbstractDomain`, `EffectSet` |
| predicates | 9 | `isGenericType`, `isPrivateDescriptor` |
| **checkers** | **4** | `checkExhaustiveness`, `checkEffectsDeclarations` |
| formatters | 4 | `formatProofFinding`, `describeFailedProof` |
| injection points | 3 | `setDivergenceProbe`, `setEffectsInspector` |

**The four owed hooks address the 4 checkers.** B-112's row says *every T2
delta is an instance of an absent interface*, which may hold — but the four
named interfaces do not cover the absent-interface population. §6 files the
rest.

### 2.1 The pattern already exists, once, ungated

`installFieldMerge` (`src/slots.ts`): L0 holds a `Map<string, fn>` and knows
the string `"effects"`; `effects.ts` installs what it means at module init;
L0 reads it back through `fieldMerge(name)`. Its own comment states the
reason — *slots.ts cannot import the encodings without a cycle*.

That is the form B-112 prescribes, working today. **It is not
capability-gated**: any module may call it, so any module may decide what
merging `effects` means. The one existing instance does not meet the bar the
row sets.

Three symbols looked like further instances and are not.
`setDivergenceProbe`, `setEffectsInspector` and `setLawInstantiationSuspended`
run the **other way** — declared in `types-std.ts` (L2), filled from
`runtime.ts` / `primitives.ts` (L0). And the third is not a hook at all: it is
a mutable flag toggled around a critical section. Three shapes, three naming
conventions, one relation nothing names (§6).

## 3. Six provisional principles

Accepted as provisional (maintainer, 2026-09) to reason with, not to commit
to. They are **not promoted to `layers.md`**; §3.1 states the trigger that
decides their fate.

**P1 — The base may hold a symbol; it may not hold a meaning.**
SC-7 generalised from propagation to every plane boundary. `slots.ts` can name
`"effects"` without knowing what an effect is.

**P2 — The layer installs; the base never imports.**
Direction is not symmetric. An upward import makes the base depend on the
layer *existing*; an install makes the layer depend on the base's *shape*,
which is the direction R6 permits. All 131 imports point the wrong way;
`installFieldMerge` is the only thing pointing the right way.

**P3 — A base that must DECIDE needs a hook. A base that must CARRY needs
only a handle.**
This is the line between §4 and §6's first scope. The evaluator deciding
*does this argument check?* needs installed behaviour. A primitive stamping
*this result is an Int* needs an opaque token it was handed at registration —
no hook, and no knowledge of what Int is.

**P4 — Anything installable is capability-gated, or the install IS the
forgery.**
D23/D24 applied to hooks. If any module can install the check hook, any module
can decide what type-checking means.

**P5 — Vocabulary before policing.**
B-128's counterexample generalised: `unifyTypes` reached for storage because
the interface had no word for what it meant. A lint without the missing word
relocates the reach rather than removing it. The interface lands before the
check that enforces it — which is why B-128(b)/(c) wait on this plan and not
the reverse.

**P6 — A shared TYPE is a shared REPRESENTATION.**
Ten of the 98 are TypeScript types. They erase at runtime, so they look free;
they let L0 destructure L2's representation, which is the dependency the
planes exist to prevent. **Accepted with a recorded tension** (maintainer,
2026-09): there is no way around it, and it makes the interfaces porous. The
diagnosis is that these are a **semantic** dependency — concepts built on
simpler concepts — wearing an architectural mask, and the fix is a semantic
hierarchy that is also a type hierarchy, some of it written in Allegro rather
than TypeScript. That is bootstrapping-era work (**M9**) and is deliberately
not attempted here.

### 3.1 What decides whether the principles held

B-128's own criterion: **re-run B-121 C2's survey after this plan lands.** If
the answer is a short list rather than a class of things nobody could search
for, the principles held. If it is not, they were wrong and the survey says
where. A provisional rule with no trigger becomes permanent by default, which
is what this clause prevents.

## 4. In scope: the four hooks

**(a) Dispatch.** The evaluator needs type-directed dispatch during evaluation
(R2 — discharge happens BY evaluating) and must not know what a type is. A
channel installs *how to dispatch on my field*; the evaluator calls it with an
opaque field value.

**(b) Check.** `checkArgType` lives in `evaluator.ts`. Same shape: a channel
installs *how to check a value against my field*.

**(c) Projection.** `shape` is a computed projection of `type`, hardcoded.
Channels install their projections.

**(d) Channel registration** — B-111.

### 4.1 Both concrete targets are messier than one hook each

**`checkArgType` is ~150 lines doing three jobs**: effect-bound discharge
(`getEffectBound` + `impliesDomain`), refinement checking (`getPredicate`,
`getRefines`), and structural type checking. So *a channel installs how to
check against my field* is at least three installs, and the plan must say
whether they are three hooks or one hook called per registered field. **The
second reading is the one that matches P1** — one hook, the loop over
registered fields already exists in the propagation table.

**`typeShape` lives in `slots.ts`** and reads `__predicate`, `__refines` and
`__members` directly: L0's accessor layer encoding L2's refinement-chain
semantics. That is delta 32 in the flesh, and it is the cleanest single test
of whether a projection hook works — the function is 13 lines and has one
caller shape.

## 5. Method

The hooks land **before** anything is forbidden (P5). Each chunk installs one
hook and moves its callers; no chunk adds a lint. B-128(b)/(c) run afterwards
and are the check that the vocabulary was sufficient.

The measurement is re-run after each chunk with
`scripts/analyze/index.ts refs`, not by grep — B-127 measured the cost of the
alternative at 4.5×.

## 6. Out of scope, filed not worked

Five populations remain. Each is a distinct question with a distinct answer
shape, and none is served by extending the hook mechanism. **Worked after rung
3**, per the sequence ratified 2026-09.

| Scope | Question | Distinct symbols | Principle that separates it |
|---|---|---|---|
| **Type vocabulary** | How does a base primitive name a type it must not know? | ~25 | P3 — carrying, not deciding |
| **Knowledge propagation** | The evaluator does abstract interpretation over L2 knowledge | ~18 | P1 — `propagateSetForPrimitive` is L2 semantics running in L0's loop, not referenced from it |
| **Member dispatch & visibility** | An interface exists; it is imported rather than installed | ~9 | P2 — direction only |
| **Diagnostics & reporting** | L0 renders L2 findings as text | ~8 | P1 — the finding is a symbol, the rendering is a meaning |
| **Base→layer injection** | Is the reverse direction legitimate, and in what shape? | 3 | none — P2 does not cover it |

**Type vocabulary is the largest and the one to watch.** It touches every
primitive, and P3 says it cannot ride this plan's mechanism. If rung 3's pilot
needs new plane crossings — and *solution finding over a constraint substrate*
plausibly does — it stops being deferrable and becomes rung 3's blocker. That
is the assumption the sequence rests on, and it should be discovered from the
pilot rather than predicted here.

**Member dispatch and base→layer injection are the folding candidates.** The
first overlaps hook (a); the second is small but blocks a general form, since
a plan that names one direction and leaves three instances of the other
unnamed has not finished describing the boundary.

## 7. Rulings needed before chunk 1

1. **One check hook or three?** §4.1 recommends one, called per registered
   field, on P1's argument.
2. **Does base→layer injection fold in** (§6, row 5), or get its own item? It
   is three symbols and one missing word.
3. **Does member dispatch fold into hook (a)** (§6, row 3), or stay filed?
4. **Are the five scopes filed as backlog items now**, with their principle
   citations, or when their turn comes?

## 8. What this plan is not

It is **not** the upward-import fix. It addresses 4 of 98 distinct symbols and
says so in §2; the other 94 are §6's, and calling this plan "the layer rework"
would overstate it by an order of magnitude.

It is **not** a lint. P5 puts the vocabulary first, and B-128 owns the
enforcement.

It is **not** P6's answer. The semantic hierarchy that would dissolve the
shared-type tension is M9 work, recorded in §3 and left there.
