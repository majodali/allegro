# The evaluator

> **Reader.** This chapter is the design truth for the `evaluator`
> [unit](../units.md#def-unit), unit 13 of the unit DAG. The chapter is
> the definition site of one term, [*tail call*](#def-tail-call).
> [Partial evaluation](../concepts.md#def-partial-evaluation) and
> [residual](../concepts.md#def-resolved-unresolved-residual) keep their
> definition sites in the spine, `concepts.md` §25 (partial evaluation)
> and §26 (resolved, unresolved, residual). This chapter describes
> partial evaluation as implemented. The reader has read the
> [Part I chapters](../README.md#part-i-foundations) and the chapter on metadata and capability
> (`metadata-and-capability.md`). Earlier chapters define every term this
> chapter uses except *tail call*, each linked at its first use:
>
> - [value](../concepts.md#def-value)
> - [representation kind](../concepts.md#def-representation-kind)
> - [Structure](../concepts.md#def-structure)
> - [binding](../concepts.md#def-binding)
> - [scope](../concepts.md#def-scope)
> - [plane](../concepts.md#def-plane)
> - [metadata field](metadata-and-capability.md#def-metadata-field)
> - [channel](metadata-and-capability.md#def-channel)
> - [propagation](metadata-and-capability.md#def-propagation)
> - [writer capability](metadata-and-capability.md#def-writer-capability)
>
> **Authority.** The chapter carries the [Tier 1](../process.md#1-documentation-map)
> authority that `process.md` §1 (documentation map) gives every chapter of
> the book. Each section carries the status tag that
> `../README.md` defines. The chapter executes
> [R2](../concepts.md#def-r2) (partial evaluation is the mechanism),
> [R4](../concepts.md#def-r4) (evaluation is total over unresolved information),
> D22 (structures are immutable by default) and the rulings of
> B-112 (the four owed plane interfaces). The chapter executes three
> B-112 rulings. The first ruling has the base call one check hook per
> registered field. The second ruling folds member dispatch into the
> dispatch hook. The third ruling, of 2026-10-22, puts call-site
> unification into the dispatch hook. The examples are verbatim excerpts of
> `tests/functions.alg` and `tests/logical.alg`. The suite runs both files
> against their `// expect:` lines.

## 1. The unit and its file [implemented]

`src/evaluator.ts` is the one file of the `evaluator`
[unit](../units.md#def-unit) in `scripts/analyze/units.json`. The unit
DAG lets the `evaluator` unit import eight units: `scope`, `expression`,
`composed-function`, `primitive-function`, `param`, `symbol`, `metadata`,
`capability`. The `evaluator` unit holds six decisions:

- [PE Rule 1](../concepts.md#def-partial-evaluation);
- [PE Rule 2](../concepts.md#def-partial-evaluation);
- application and substitution;
- [tail calls](#def-tail-call);
- the [scope](../concepts.md#def-scope) carve-out from D22;
- the four B-112 hooks as its install surface.

## 2. Evaluation, one switch over the kinds [implemented]

`evaluate` in `src/evaluator.ts` takes a [value](../concepts.md#def-value),
a [scope](../concepts.md#def-scope), a depth and an optional dependency
collector. `evaluate` returns a value, or a
[`TailCall` sentinel](#def-tail-call) for an
[Expression](../concepts.md#def-expression) that
`markTailCalls` marked (§5 (tail call)). `evaluate` returns a
[Bits](../concepts.md#def-bits), a
[primitive function](../concepts.md#def-primitivefunction), a
[composed function](../concepts.md#def-composedfunction), a
[Structure](../concepts.md#def-structure) or a
[Param](../concepts.md#def-param) unchanged. `evaluate` throws "Maximum
evaluation depth exceeded" when the depth passes 10,000.

`evaluate` resolves a [Symbol](../concepts.md#def-symbol) by looking its
name up along the scope's parent chain and evaluating the bound value. A
resolved Symbol's own
[metadata fields](metadata-and-capability.md#def-metadata-field) are laid
under the fields of its value by `mergeOverMeta`, where the value's
fields win except a `union` field, which merges. The facts the scope
holds for a Symbol's name are attached to the Symbol's value as
predicates. A Symbol with no [binding](../concepts.md#def-binding), or
whose binding is a pending
[future cell](../concepts.md#def-future-cell-and-completion), evaluates to
itself. The dependency collector records the name of each Symbol that
evaluates to itself.

`evaluate` applies an Expression through `evaluateExpr`. An Expression's
own metadata fields are laid under the fields of the application's
result, except when the result is a `TailCall` sentinel. `evaluateExpr`
evaluates an Expression's function position before anything else. A
primitive function in function position is applied by `applyPrimitive`. A composed function in function
position is applied by `applyComposed`, except in an Expression that
`markTailCalls` marked (§5). A Structure in function position with a
constructor slot applies its constructor.

The [discriminator rule](../units.md#32-the-discriminator-rule) lets only
the evaluator switch on kind for behaviour. Under the discriminator
rule, the evaluator's switch must name only the participating kinds. The
inert rest of the kinds must fall to one default arm of the evaluator's
switch. The switch in `evaluate` has no default arm. The missing arm is
a defect against the discriminator rule. No backlog item owns the
defect. Nothing counts the defect, because the `units` report's
discriminator count skips the `evaluator` unit. Two walkers in
`src/evaluator.ts`, `subst` and `remapParams`, switch on kind themselves.
The discriminator rule assigns every walker to a traversal protocol of
the `kinds` [unit](../units.md#def-unit). The `kinds` unit, which would
hold the traversal protocol, is owed.

## 3. Partial evaluation as implemented [partial]

R4 requires that an
[unresolved](../concepts.md#def-resolved-unresolved-residual) input
produce a residual, never a failure to proceed. `isResolved` in
`src/types.ts` answers false for a [Symbol](../concepts.md#def-symbol), a
[Param](../concepts.md#def-param) and an
[Expression](../concepts.md#def-expression). `isResolved` answers true
for every other kind, including a
[Structure](../concepts.md#def-structure) whatever its slots hold. No
abort that `src/evaluator.ts` raises is caused by an unresolved input.
`src/evaluator.ts` raises three aborts during evaluation:

- a depth past 10,000;
- a declared parameter type with no field check installed;
- a primitive with no implementation.

[PE Rule 1](../concepts.md#def-partial-evaluation) says that an
application with an unresolved argument produces a
[residual](../concepts.md#def-resolved-unresolved-residual). Under
PE Rule 1, [metadata fields](metadata-and-capability.md#def-metadata-field)
[propagate](metadata-and-capability.md#def-propagation) onto the
residual per their rules. The evaluator applies PE Rule 1 at an eager
primitive application and at an unresolved function position. A
[composed function](../concepts.md#def-composedfunction) applied to an
unresolved argument is unfolded into its substituted body, unless the
call enters a recursion cycle during a typed compilation. In an unfolded
body, PE Rule 1 applies to each application the body contains.

`src/runtime.ts` decides cycle membership once per typed compilation.
`src/runtime.ts` installs the cycle-membership answer as the inline
cutoff through `setInlineCutoff`. For a call that the inline cutoff
stops, `applyComposed` returns a residual carrying the callee's effects.

An eager primitive receives its arguments evaluated, with their
metadata intact. An eager primitive with an unresolved argument returns
a residual Expression of the primitive over the evaluated arguments. An eager primitive application whose
arguments carry a viral field returns a residual carrying the first such
field, whether or not the arguments are resolved. The first installed
dispatcher that answers gives an eager primitive's residual its type. An
eager primitive's result carries the union of the primitive's static
[effect](../concepts.md#def-effect) tags and the effects of its evaluated
arguments. During [precompile](../concepts.md#def-the-evalsource-pipeline),
an effectful primitive returns a residual even over resolved arguments,
which defers its side effect to the run.

A function position that evaluates to no applicable kind yields a
residual Expression of the evaluated function over the evaluated
arguments. The residual of an unresolved function position carries the
first viral field found on the function or on an argument. When the
unresolved function is a Param, the residual carries the Param's effect
variable, the Param's effect bound, or the label `opaque` for a Param
with no bound.

[PE Rule 2](../concepts.md#def-partial-evaluation) says that a lazy
primitive whose control input is unresolved returns a residual over both
of its evaluated branches. A lazy primitive receives its arguments unevaluated, with
an evaluation function the primitive calls on a
[value](../concepts.md#def-value) and a [scope](../concepts.md#def-scope). `src/evaluator.ts` leaves PE Rule 2 to each lazy
primitive's implementation. A lazy primitive's result carries the
effects of every evaluation made through its evaluation function, with
the primitive's own effect tags.

`eval_if` in `src/primitives.ts` evaluates both branches when its
condition is unresolved. `eval_if` then returns a residual `eval_if`
over the condition and the two evaluated branches. The residual
`eval_if` carries a type when the two evaluated branches have matching
type names. `eval_when` returns a residual without evaluating any branch
when its subject is unresolved. `&&` and `||` return a residual without
evaluating the right operand when the left operand is unresolved.
So `eval_when`, `&&` and `||` do not meet PE Rule 2.

## 4. Application and substitution [implemented]

`applyComposed` evaluates the arguments before anything else. An
argument carrying a viral field ends a composed application with a
[residual](../concepts.md#def-resolved-unresolved-residual) carrying the
viral field. Each installed dispatcher may bind the callee's declared
constraints to the arguments through the dispatcher's `call` entry
point. A call binding hands back the
[scope](../concepts.md#def-scope) the body evaluates in, the substituted
arguments and a finisher for the body's result. The evaluator
hands each dispatcher a check loop, `checkArg`, for the per-argument
checks. `applyComposed` evaluates the substituted body in the scope a
call binding handed back, or in the caller's scope when no dispatcher
bound the call.

`substituteParams` replaces each [Param](../concepts.md#def-param) of the
body by the argument at the Param's position. A Param is replaced only
when the applied function owns the Param by membership in its parameter
list, or when no function has claimed the Param. Substitution leaves a
[Symbol](../concepts.md#def-symbol) in place, because a Symbol resolves
by name through the scope. Substitution returns an unchanged subtree
itself, not a copy. Substitution copies an inner
[composed function](../concepts.md#def-composedfunction) whose body
changed, with fresh Params rebound to the copy. A copied composed
function keeps its [metadata](metadata-and-capability.md#def-metadata-field)
through `carryMeta`. `PRESERVED_FN_META_KEYS` names the function
properties that a copied composed function keeps. The excerpt below
is `tests/functions.alg` lines 4 to 20: an application, a higher-order call and a closure.

```
// Basic function
add(a, b) => a + b
print(add(3, 4))
// expect: 7

// Higher-order function
apply(f, x) => f(x)
print(apply(x => x * 2, 21))
// expect: 42

// Closure
make_adder(n) => x => x + n
add5 = make_adder(5)
print(add5(10))
// expect: 15
print(add5(100))
// expect: 105
```

`precompileFunction` runs `evaluate` over a function body at compile
time, with typed Param placeholders in place of the arguments. A typed
placeholder is a Param carrying the declared `type` field, plus a
`domain` field when the type carries an abstract domain.
`precompileFunction` reads the inferred return type from the `type`
field of the body's result. `precompileFunction` reports an error thrown
during the body's evaluation as a returned error string, not as an
abort.

<a id="def-tail-call"></a>
## 5. Tail call [implemented]

A **tail call** is an application of a
[composed function](../concepts.md#def-composedfunction) whose result is
the enclosing function body's result. The
evaluator runs a tail call as another round of the enclosing
application's loop, not as a nested evaluation. Without tail calls, the finite host stack would bound
the depth of recursion a program can use. `markTailCalls` marks the outermost
[Expression](../concepts.md#def-expression) of a function body as one
whose result is the function's result. `markTailCalls` carries the mark
into the branch bodies of `eval_if` and `eval_when`. `markTailCalls`
carries the mark through a wrapper (`type_check`, `ensures_check`, an
`*_attach` wrapper, `seq`) only to an `eval_if`, an `eval_when` or a
further wrapper, never to a bare call. `src/runtime.ts` marks every
composed function body among a file's
[bindings](../concepts.md#def-binding) after symbol resolution and
before [precompile](../concepts.md#def-the-evalsource-pipeline). Before
marking, `src/runtime.ts` collapses the `*_attach` wrappers of each
function body onto function properties with `collapseBodyMetadata`.

In a marked Expression, a composed function in function position is not
applied: `evaluateExpr` evaluates the arguments and returns a `TailCall`
sentinel holding the function and the arguments. A `TailCall` sentinel
is a host object, not a [value](../concepts.md#def-value).
`applyComposed` catches a sentinel the body returns and loops with the
sentinel's function and arguments. The loop in `applyComposed` accepts
any composed function, not only the function that made the call. Each
round of the loop in `applyComposed` evaluates the next body at the
depth of the first round. A chain of 100,000 tail calls through a typed
function's return check completes without reaching the depth bound.

A sentinel that a
[primitive function](../concepts.md#def-primitivefunction)'s application
returns inside an unmarked Expression is applied immediately by
`evaluateExpr`. A local binding of an `if` or a `when` whose chosen
branch is a call holds the call's value, because the binding's `if` or
`when` Expression is unmarked. Substitution and parameter
remapping copy the mark onto each Expression they rebuild. The excerpt
below is `tests/functions.alg` lines 52 to 69.

```
// A local binding of an `if` or `when` whose chosen branch is a call: the
// branch is not in tail position, so the binding holds the call's VALUE and
// later uses of it read a value, not a pending call.
pick(q) => q
bump(v) => v + 1
via_if(q) =>
  y = if q > 1 then pick(q) else 0
  bump(y)
print(via_if(5))
// expect: 6
via_when(q) =>
  y = when q is 5 then pick(q) is _ then 0
  bump(y)
print(via_when(5))
// expect: 6
top = if true then pick(41) else 0
print(bump(top))
// expect: 42
```

`type_check` and `ensures_check` in `src/primitives.ts` return a
sentinel from their wrapped body untouched. `&&` and `||` apply their
right-operand thunk as a call, which answers with a value rather than a
sentinel. `precompileFunction` drives the sentinels of a body's top
Expression itself, with a bound of 10,000 rounds. The excerpt below is
`tests/logical.alg` lines 59 to 70.

```
is_b(x) => x == "b"
print(("a" != "b") && is_b("a"))
// expect: false

print(true && is_b("b"))
// expect: true

print(false || is_b("b"))
// expect: true

print(false || is_b("a"))
// expect: false
```

Nothing checks that a wrapper around a function body forwards the
sentinel. B-113 (TailCall forwarding is convention-only) owns the
missing check.

## 6. Writing in place: the scope carve-out [implemented]

D22 makes a [Structure](../concepts.md#def-structure) immutable from
birth. A [value](../concepts.md#def-value) is written in place only while
the value is provably unshared, during construction and before it
escapes. A [scope](../concepts.md#def-scope) is exempt from D22, because a
scope is mutable evaluator state, not data. D49 (scope leaves `Value`)
rules that the scope becomes a host construct outside `Value`.
B-136 (scope leaves `Value`) owns the execution of D49. A scope today is a
Structure with `isScope` set.

The one scope write in `src/evaluator.ts` is the `compileMode` flag that
`precompileFunction` sets. `precompileFunction` restores the
`compileMode` flag's previous value after the body's evaluation, even
when the evaluation throws. `scopeCompileMode` in `src/scope.ts` reports
compile mode when any scope along the parent chain carries the flag.
`src/evaluator.ts` reads scopes through three functions of the `scope`
[unit](../units.md#def-unit): `scopeLookup`, `scopeFactsFor`,
`scopeCompileMode`.

`markTailCalls` and `markPatternBinders` write in place into a file's
own values, called by `src/runtime.ts` before those values are
evaluated. `precompileFunction` writes the inferred
[effect](../concepts.md#def-effect) set onto the function it is given, as
the function's `inferredEffects` property. The
[precompile](../concepts.md#def-the-evalsource-pipeline) stage in
`src/runtime.ts` skips a function that a library owns.

## 7. The install surface [partial]

B-112 names four [plane interface](../concepts.md#def-plane-interfaces)
hooks: dispatch, check, projection, channel registration. A
[layer](../layers.md#def-layer) installs a hook under the gate of the
field's [writer capability](metadata-and-capability.md#def-writer-capability).
The base calls an installed hook with opaque values.

With resolved arguments, an installed dispatcher may answer an eager
primitive application in place of the primitive. A dispatcher that
declines returns null, leaving the primitive to run as Allegretto runs
it. `checkArg` runs every installed field check with a free reader and
the argument's site. `checkArg` throws when a parameter type is declared
and no field check is installed.

The evaluator reaches the projection hook only through `metaReadRaw`,
which serves an installed projection without naming the field. The
channel-registration hook is not built. B-111 (field versus channel
registration) owns that hook.

The evaluator applies the two generic
[propagation](metadata-and-capability.md#def-propagation) rules through
`viralOnto` and `mergeOverMeta` of the `metadata`
[unit](../units.md#def-unit). `assertPropagationTableLinkage` checks at
module load that six fields keep the rules the evaluator implements for
them. `setInlineCutoff` accepts the inline cutoff without any writer
capability. The B-112 plan, `docs/plans/plane-interfaces.md`, records
the inline cutoff as an injection that should
become a gated analysis.

## 8. The edges the unit still owes [partial]

`src/evaluator.ts` imports seven symbols from two files that
`scripts/analyze/units.json` assigns wholly to
[Allegro Standard](../layers.md#def-layer) units: three from
`src/refinements.ts`, four from `src/effects.ts`. The `units` report
shows both imports as violations of the [unit](../units.md#def-unit) DAG.
B-146 (knowledge propagation) owns both edges.

The `refinements` edge is [knowledge](../concepts.md#def-knowledge)
propagation: predicate sets computed at primitive application, plus the
[scope](../concepts.md#def-scope) facts of §2 (evaluation). The `effects` edge is
[effect](../concepts.md#def-effect) inference: a primitive's static tags,
a [Param](../concepts.md#def-param)'s bound or effect variable, the
`opaque` label, the precompile stash. The generic `union` rule cannot replace the effect path, because
the base cannot encode an effect set. B-112's done-condition, that the
`evaluator` unit imports nothing from Allegro Standard, is not met.

Two paths carry a field by name: precompile's placeholder seeding of
`type` and `domain`, plus the post-call `type` stamp on an untyped
[Bits](../concepts.md#def-bits) result. B-145 (type vocabulary) owns the carrying by name.

`src/evaluator.ts` imports `primitives` and `renderExprSource` from
`src/primitives.ts`, which holds units of three layers, Allegro Standard
among them. The unit DAG places `base-primitives`, one of the units
`src/primitives.ts` holds, above the `evaluator` unit.
`renderExprSource` lies inside the lines of `src/primitives.ts` that the
`base-primitives` unit holds. The unit DAG forbids the `evaluator`
unit's import of `renderExprSource`. The `units` report counts an edge
as unresolved when `scripts/analyze/units.json` maps the file at either
end to several units. Until `src/primitives.ts` is split, the `units`
report counts the `renderExprSource` edge as unresolved, not as a
violation.

## 9. Where the code is, and what pins it [implemented]

| What | Where | Pinned by |
|---|---|---|
| `evaluate`, `evaluateExpr`, `applyPrimitive`, `applyComposed`, substitution, `checkArg`, `precompileFunction`, `markTailCalls`, `setInlineCutoff`, `assertPropagationTableLinkage` | `src/evaluator.ts` | the whole suite |
| the application and tail-call paths that §4 (application and substitution) and §5 quote | `src/evaluator.ts` | `tests/functions.alg` and `tests/logical.alg`, run through `src/test/types-core.ts` and `src/test/grammar2-language.ts` |
| `isResolved`, `makeExpr`, `withMeta` | `src/types.ts` | the whole suite |
| `viralOnto`, `mergeOverMeta`, `metaReadRaw`, the check and dispatch tables | `src/metadata.ts` | the boundary gates of `src/boundary-tests.ts` |
| `eval_if` | `src/primitives.ts` | `src/test/effects.ts` (both branches under an unresolved condition) |
| `type_check` | `src/primitives.ts` | `src/test/totality.ts` (a tail call 100,000 deep) |
| `eval_when`, `&&`, `\|\|` | `src/primitives.ts` | `tests/functions.alg`, `tests/logical.alg` |
| `scopeLookup`, `scopeFactsFor`, `scopeCompileMode` | `src/scope.ts` | the whole suite |
| the marking of every function body, the install of the inline cutoff, the precompile stage | `src/runtime.ts` | the whole suite |
| the unit's file and permitted imports | `scripts/analyze/units.json` | `npm run lint:units` |

<!-- render map: C1→¶1 C2→¶1 C3→¶1 C4→¶1 C5→¶1 C132→¶1 C6→¶2 C150→¶2 C7→¶2 C131→¶2 C136→¶2 C137→¶2 C138→¶2 C8→¶2 C160→¶2 C10→¶3 C11→¶3 C9→¶3 C12→¶4 C169→¶4 C13→¶4 C21→¶4 C14→¶5 C15→¶5 C16→¶5 C17→¶5 C18→¶5 C19→¶6 C20→¶6 C27→¶6 C28→¶6 C29→¶6 C30→¶6 C22→¶7 C153→¶7 C157→¶7 C158→¶7 C164→¶7 C165→¶7 C151→¶7 C24→¶7 C25→¶7 C26→¶7 C31→¶8 C32→¶8 C33→¶8 C163→¶8 C34→¶8 C35→¶9 C168→¶9 C161→¶9 C44→¶9 C154→¶9 C46→¶10 C139→¶10 C45→¶10 C36→¶11 C37→¶11 C38→¶11 C39→¶11 C40→¶11 C47→¶11 C41→¶12 C42→¶12 C43→¶12 C48→¶13 C49→¶13 C50→¶13 C51→¶13 C52→¶14 C53→¶14 C54→¶14 C55→¶14 C56→¶14 C57→¶14 C58→¶15 C59→¶15 C60→¶15 C61→¶15 C62→¶15 C69→¶15 C63→¶16 C64→¶16 C65→¶16 C66→¶16 C67→¶16 C68→¶16 C156→¶16 C70→¶17 C71→¶17 C72→¶17 C73→¶17 C140→¶18 C134→¶18 C74→¶18 C75→¶18 C76→¶18 C77→¶18 C78→¶18 C79→¶19 C80→¶19 C81→¶19 C82→¶19 C83→¶19 C84→¶19 C85→¶20 C86→¶20 C87→¶20 C88→¶21 C89→¶21 C90→¶21 C91→¶22 C92→¶22 C93→¶23 C94→¶23 C95→¶23 C96→¶23 C133→¶23 C97→¶23 C98→¶24 C99→¶24 C100→¶24 C101→¶24 C102→¶25 C103→¶25 C104→¶25 C105→¶26 C106→¶26 C107→¶26 C108→¶27 C109→¶27 C110→¶27 C111→¶27 C112→¶28 C113→¶28 C114→¶28 C115→¶29 C116→¶29 C117→¶29 C118→¶29 C119→¶30 C120→¶30 C121→¶30 C122→¶31 C123→¶31 C124→¶31 C125→¶31 C126→¶32 C127→¶32 C128→¶33 C130→¶33 C162→¶33 C159→¶33 C166→¶33 C129→¶33 C141→¶34 C167→¶34 C142→¶34 C143→¶34 C144→¶34 C145→¶34 C146→¶34 C147→¶34 C148→¶34 C149→¶34 -->
