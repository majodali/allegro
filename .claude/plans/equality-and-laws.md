# Equality protocol + lawful interfaces — implementation plan (B-027)

> Tranche C, chunk family E. Design source: `docs/design/allegretto/
> structures.md` §7 (Equality, [designed]) + §8 (Conformance and lawful
> interfaces, [designed]); D8/D30/D34/D37/D38/D44 from the archived
> decision log. This plan is the RATIFICATION PASS deliverable: it
> verifies the §7–8 design against the post-C7.2 codebase, sharpens it
> into decisions (§3), and sequences the chunks (§4). Maintainer
> ratifies §3's decision points before E1 starts, per PROCESS §6.

## 1. Goal and scope

Make `==` a lawful, globally stable equivalence relation dispatched on
shape (D37), and ship the mechanism that makes "lawful" checkable: LAW
MEMBERS on interfaces (D38) whose obligations flow through the existing
PCP/discharge machinery. Equality is instance #1 of the law mechanism —
the point is the mechanism, with equality as its proving ground.

In scope: kernel structural equals; the three-step resolution
(shape → declared coercion to least common type → not-equal); declared
coercions with equality-preservation/coherence obligations; `law`
members + obligation instantiation + the D34 discharge spectrum;
purity/knowledge-independence gate on `equals`; `Equatable` and the
kernel-parametric certificate; proof-plane tier recording.

Out of scope (stay on BACKLOG): `Ordered`/`Monoid`/`Semiring` beyond a
demo (follow-on once the mechanism lands); full unification of the
proof plane's `proofValEqual` with protocol equality (E4 records tiers;
routing proof matching through user `equals` waits for a use case);
hash-consing/memoized equality performance work.

## 2. Current state (recon 2026-08, post-C7.2)

| Surface | Today | §7–8 target |
|---|---|---|
| `Int/Float/String/Bool ==` | per-type `eq` on raw bits data, typed Bool result | unchanged (shape-dispatched `equals`) |
| `[1,2] == [1,2]` | **host crash** (`Cannot read properties of undefined`) | true (kernel structural equals, element-wise) |
| `{x:1} == {x:1}` | **host crash** (`ctx.bindings is not iterable`) | true (kernel structural equals, field-wise) |
| record-type instances `==` | untested/reference at best | kernel structural equals by default |
| `1 == 1.0` | **silently false** (Int.eq compares raw bit patterns across types) | true via declared Int→Float coercion (least common type) |
| `UserId(42) == 42` (distinct) | **true** (distinct's fresh symbols share the parent's eq impl; dispatch runs it on both) | **not equal** until UserId declares a coercion (§7 step 3) |
| `PositiveInt(5) == 5` | true (shape walk peels refinement layers) | true — already matches D37 |
| coercions | none | declared registry + LCT resolution + preservation/coherence obligations |
| laws | none | `law` interface members → PCP Obligations → D34 discharge tiers |
| purity gate | effects machinery exists (`pure` bounds, `observe` label on `certificate_peek`) | mechanical: `equals` must infer effect-free (incl. `observe`) |
| obligations/discharge | H1 Obligation schema, H2 verify/obligations CLI, PE-discharge, `by` terms, `prove_for_all_bool`, F7 sampling | reused wholesale; new: `assume law` (admitted tier), law-obligation instantiation at draw time |

Substrate C5–C7 delivered that §7–8 depends on: symbol-identity
conformance (laws attach to drawn interface symbols), shape/knowledge
split (equality dispatches shape, ignores knowledge), kinds through the
recipe (interfaces are declaration-only), effects-as-component
(mechanical purity check), typed `params`/construct authority surfaces.

## 3. Decisions for ratification

**E-R1 — kernel structural equals is the default for every
structure-backed type.** Records (define-minted), arrays, and objects
get a kernel-supplied `equals`: same SHAPE (D37 — typeShape identity
after refinement peel), then field-wise/element-wise recursion through
each component's own protocol equality (so custom `equals` on a field
type composes). Dense arrays compare length + elements; records compare
the declared field set. The kernel impl is proven lawful ONCE,
parametrically (its laws hold by structural induction given lawful
component equalities) — record types drawing it inherit the certificate
free (§8 amortization). A user `equals` in the define spec overrides it
and BEARS the three obligations. Conscious deltas: array/record `==`
goes crash→structural; `None`/`Error` keep identity semantics
explicitly (singleton identity IS their structure).

**E-R2 — coercion declarations are type-level members with obligations;
the numeric tower is instance #1.** A declared coercion is
`(from: A, to: B, fn)` registered on the PAIR (proposal: a reserved
`coerce` spec key on the TARGET type or a standalone
`Coercion.declare(A, B, fn)` — maintainer picks the surface; the
standalone form avoids reopening define specs and keeps pairs
first-class, so it is the recommendation). `==` resolution: same shape
→ equals; else find the least common type over the declared coercion
graph (both operands coerce in; ties/ambiguity = compile-or-runtime
error demanding an explicit declaration); none → not-equal (never an
error — §7 step 3 makes `distinct`-vs-parent simply false). Each
declaration instantiates equality-preservation + pairwise-coherence
obligations (pending until discharged; the Int→Float kernel coercion
ships with its `by`/kernel-auto discharge). `1 == 1.0` becomes true;
`UserId(42) == 42` becomes false — both conscious deltas, both the
designed semantics.

**E-R3 — `law` members ride the existing spec surface; `for_all` is a
proposition form.** Surface proposal (minimal grammar): inside
`Interface.define` specs, a reserved-shape entry
`law_refl: for_all((a: T) => equals(a, a))` — reserved PREFIX `law_` on
the key, `for_all` as a base-grammar proposition constructor (mirrors
`theorem`/`verify` residence: provability is core, not an opt-in lib).
The §8 sketch's `law refl:` statement form can arrive later as sugar;
the prefix form needs zero new statement grammar. Law entries become
Law descriptors in `__members` under the interface's scope (drawn like
any member — symbol identity gives law inheritance for free). Drawing a
law-bearing interface instantiates one PCP Obligation per law at
definition time, quantifier specialized to the implementing type.

*Generality note (maintainer Q&A at ratification, 2026-08): "lawful
interfaces" names instance #1's home, not a restriction. A law is an
ordinary member descriptor in a member SET — so any member-set-minting
surface can carry laws: `Interface.define`, `Type.define` (concrete
types stating laws about their own members; methods-only bundles /
mixins whose laws are drawn along with their methods), and refinement
specs by extension. Laws attach to SCOPES rather than to individual
members because a law may reference several members (§8's
distributivity example — the law lives with the declarations of all
participating members). The referenced members need not be abstract
(kernel-supplied `equals` carries its parametric certificate) but must
be effect-bounded pure (E-R5, proposition stability). E3 ships the
`Interface.define` surface as the proving ground; the same `law_` spec
key on `Type.define` is the same code path and lands in E3 or trails
it immediately.*

**E-R4 — discharge maps onto D34's spectrum using existing machinery;
`assume` is new and verdict-visible.** kernel-auto = PE +
`prove_for_all_bool` (finite domains) + the parametric kernel-equals
certificate; witnessed = `by` proof term attached to the law
obligation; sampled-falsification = F7's sampler run over the law's
quantified variable (counterexample halts; clean pass = survival, tier
recorded as `sampled`); admitted = `assume law NAME` (new marker,
verdict-visible, same standing as F-arc admitted facts); pending =
`allegro obligations` export (H2 — law obligations are exactly the
well-posed PCP tasks). STRICTNESS ships incrementally: E3 records tiers
on the Verdict; E4 turns on the first strict gate — `proof_trans`
refuses an equality whose transitivity is neither proven nor admitted.
(Gating everything at once would halt existing programs; the gate list
is a §6-style pre-approved queue.)

**E-R5 — the purity/knowledge-independence gate is mechanical.** At
definition time, an `equals` implementation (and any coercion fn) must
infer an EMPTY effect set — including the `observe` label
(`certificate_peek` inside equals is exactly the D37 violation:
equality must not see knowledge). Uses `__inferredEffects` from
precompile; violation = compile error naming the offending label. No
new machinery — this is a consumer of the effects component.

**E-R6 — proofs record equality identity + tier.** Equality proofs
(`proof_refl`/`proof_trans`/…) gain two recorded fields: which equality
(the shape's name) and which law tier backed it (proven / admitted /
sampled / kernel). `proof_trans` chains resting on admitted
transitivity render verdict-visibly weaker (extends D8). Storage: plain
instance-data bindings on the Proof value (the C6.3 pattern — no new
`__*` slots).

## 4. Chunks

**E1 — kernel structural equals + shape resolution (steps 1 and 3).**
Replace Array/Object/record eq impls with the kernel structural
`equals` (recursive through protocol equality); different shapes with
no coercion path → typed Bool false (kills both crashes and the
distinct leak — `UserId(42) == 42` flips false HERE, before coercions
exist). None/Error identity semantics pinned by test. The parametric
lawfulness certificate is recorded on the kernel impl (a marker the E3
tier machinery reads). Battery: structural eq over nesting/length/field
mismatches; refinement-peel equality (D37) re-pinned; distinct
non-equality; no-throw sweep (eq never host-crashes on any kind pair —
the incompleteness grid extended to `==`).

**E2 — declared coercions + least common type (step 2).** The
declaration surface (per E-R2 ruling), the pair registry, LCT
resolution inside `typed_eq`'s different-shape branch, symmetric
coercion of both operands, ambiguity errors. Int→Float ships
kernel-discharged; a demo user coercion (UserId→Int) shows the
opt-back-in path for distinct types. Preservation/coherence obligations
instantiate as PENDING (discharge arrives with E3's machinery; the
kernel pair carries its certificate immediately). `1 == 1.0` flips
true. Battery: commutativity by construction (both orders agree),
coherence triangle demo, distinct-with-declared-coercion equality.

**E3 — law members + obligation instantiation + discharge tiers.**
`law_`-prefixed spec entries + `for_all` proposition form; Law
descriptors in member sets; draw-time Obligation instantiation
(H1 schema, quantifier specialized); discharge: kernel-auto, witnessed
`by`, sampled (F7 generalization), pending (H2 export); tier recording
on the Verdict; the E-R5 purity gate on `equals`/coercion fns.
`Equatable` ships as instance #1; kernel equals + scalar eqs discharge
refl/sym/trans via the parametric certificate + finite-domain/PE paths.
Battery: obligation round-trip (define → pending → `by` → discharged),
sampled counterexample halts with concrete inputs, purity-gate
rejection (an `equals` calling `print` or `certificate_peek`).

**E4 — admitted tier + first strict gate + proof tier recording.**
`assume law` marker (verdict-visible); `proof_trans` demands
proven-or-admitted transitivity for the equality it chains (the first
law-dependent refusal — gate list is the pre-approved queue for
follow-ons); E-R6 proof fields + verdict rendering ("resting on
admitted transitivity"). `Ordered` sketched as instance #2 IF the
mechanism needs a second consumer to validate generality — else it
moves to BACKLOG as a follow-on.

Each chunk: recon → implement → battery → docs (CHANGELOG, CLAUDE.md,
structures.md §7–8 status stamps) → full suite → commit/push, per
PROCESS. Deviations recorded here in §6.

## 5. Verification strategy

- The no-throw-on-any-kind-pair equality sweep joins the boundary
  battery (equality is total: Bool or false, never a host crash).
- Lawfulness battery: kernel equals refl/sym/trans property-checked
  over generated structures (bounded depth) — the parametric
  certificate's empirical shadow.
- Obligation-machinery tests run through the REAL PCP path (H1/H2
  schemas), not a parallel test-only route.
- Every behavior delta in §6 lands with a test pinning the NEW
  behavior in the same commit.

## 6. Conscious behavior deltas (pre-approved on ratification)

1. `[1,2] == [1,2]`: host crash → `true` (E1).
2. `{x:1} == {x:1}` / record instances: host crash → structural (E1).
3. `UserId(42) == 42` (distinct): `true` → `false` (E1); opt back in
   via declared coercion (E2).
4. `1 == 1.0`: `false` (raw-bits accident) → `true` via Int→Float
   least-common-type coercion (E2).
5. `equals`/coercion fns with effects (incl. `observe`): previously
   unchecked → definition-time compile error (E3).
6. `proof_trans` over an equality with neither proven nor admitted
   transitivity: previously silent → refusal (E4; scalar + kernel
   equalities are auto-proven, so existing programs stay green).

## 7. Status log

- 2026-08: plan drafted (ratification-pass deliverable); §3 decision
  points E-R1–E-R6 presented to maintainer.
- 2026-08: **E-R1–E-R6 maintainer-ratified as they stand**; §6 deltas
  pre-approved. Generality note added to E-R3 (laws are
  member-set-general, not interface-only) from ratification Q&A.
  E1 unblocked.
