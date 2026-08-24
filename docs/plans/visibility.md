# Visibility — the S3 mediated-member arc (B-097)

Status: active (V-R1–V-R8 + the forgery-E criterion maintainer-ratified
2026-08 at the plan gate, PR #14 — all eight as recommended;
`fallbackMember` name confirmed at ratification)

> Tranche C successor per the sequenced head: after B-027
> (equality, closed), before B-028 (completion effects). This plan is
> the RATIFICATION PASS deliverable for executing **D41 (mediated
> member protocol), D42 (evidence is possession), D43 (modifiers as
> declared member attributes)** — maintainer-ratified 2026-07, design
> in `docs/design/allegretto/structures.md` §5/§6/§13, full rationale
> in the archived decision log (rows D41–D43). It verifies that design
> against the post-C7.2/E4/B-094 codebase, sharpens what the record
> leaves open into decision points (§3), and sequences the chunks
> (§4). The conscious-delta queue (§5) is the largest since C4.3 and
> is pre-declared here per the standing §6-item-3 ruling.

## 1. Goal and scope

Member access becomes D41's four-stage pipeline — project →
availability → mediate → dispatch — as ONE partial-evaluation act,
with D42 possession evidence and D43 declared modifiers. Concretely,
at arc end:

- A module's private bindings are unreachable outside it through EVERY
  surface: dot access, operator dispatch, destructuring, printing,
  reflection accessors, flat `use`-injection, and the wire.
- A record type can declare `private` members; denial is an
  availability outcome ("private to T" — names public), static when
  scope + knowledge are static, folded away by PE.
- Forgery E goes LIVE: the ocap discipline ("holder keeps its writer
  module-private") becomes language-enforced for module-shaped
  holders, demonstrated by a real attack battery.
- The `exported` value-plane stopgap (known `y = x` aliasing wart;
  its designated Phase-2 dissolution point passed unexecuted) is
  retired for a scope-binding visibility attribute.

Out of scope (riders named in §6): `readonly`/mutability write
semantics (B-046), sync/async modifiers (B-047), surface keyword
syntax (`private x: Int` — B-043), `internal`/`protected` tiers
(V-R3), downcast refusal at call sites, S5 variance.

## 2. Design verification (2026-08, against the shipped codebase)

**What already executed** — stage 1 (project: `projectBaseName`, C5),
stage 2 (availability: the D36 occurrence-bound gate in
`type_dispatch`, C3.2 — whose own comment names it "the
current-representation form of the single PE resolver"), stage 4
(shape dispatch, Liskov), and D42's wire half (export partition:
`symbolFromWire` answers only from the exported registry; asserted in
the boundary battery). Stage 3 (mediate) does not exist — today's
`__getMember` is a 2-ary string-keyed fallback hook with no context,
and the module type's export-enforcing implementation is the one
production instance of a policy-bearing mediator.

**What changed under the design since ratification** (each feeds a §3
decision):

- **D44 dissolved the subtype chain** — D42's `protected` ("shared
  with subtype-declaring contexts at extends time") is dead AS
  SPECIFIED and needs restating over draw-from, if kept (V-R3).
- **I2's ordering inverted**: I2 put "visibility through accessors"
  before the representation swap; the swap (C4–C7) landed first. The
  premise that survives: enforcement rides the accessor/dispatch
  layer, which is now the shipped `type_dispatch` path — richer than
  I2 foresaw (descriptors, availability gate, kind tower). No design
  content is invalidated; the deviation is recorded here.
- **The `exported` stopgap outlived its dissolution point** (slot
  registry pins it to "Phase 2 scope split"; Phase 2 closed without
  it). Scope bindings still have no visibility attribute — that
  substrate is this arc's first chunk.
- **C5.2b type-local member scopes** (`<type:N>`) exist as the
  natural `private` home but are counter-keyed per-construction;
  making them the privacy boundary forces the deferred name-stable
  integration (V-R5 consequence, chunk V3).

**Code reality the pipeline must capture** (full map in the session
record; the load-bearing findings):

- Dot/bracket/interpolation all funnel into ONE site
  (`type_dispatch_impl`) — but FOUR readers bypass it entirely:
  pattern destructuring (`extractFields` reads raw bindings), the
  record printer (`formatValue`), operator dispatch
  (`PRIM_TO_METHOD` → `typeMethod`, no gate), and the untyped-Context
  meta-dispatch ladder (a shadow copy of the whole descriptor path
  with NO availability gate). Any pipeline on the typed branch alone
  is trivially bypassed.
- The evaluator already has `ctx` at every relevant site; D42's
  context argument needs no new plumbing — it needs three
  `undefined as any` drops repaired (getter call, `__getMember`
  invocation, meta-type getter).
- Two structural leaks defeat module privacy today: a module with
  zero `export` statements exports EVERYTHING (9 of 15 lib modules
  rely on this), and flat `use`-injection copies module bindings into
  the scope chain around the module type entirely.
- `typeMethod` falls through to raw type-Context bindings — any
  binding on a type is name-reachable, member set or not.
- Silent fragility: `totality.ts` HOF detection and the source
  renderer pattern-match the literal `type_dispatch` AST shape; the
  arc must not change the lowering shape without updating them in the
  same chunk (else termination verification silently degrades).
- Effects: `type_dispatch` is registered lazy with no effect tags; an
  impure mediator invoked via the current fallback path has its
  effects silently discarded (called outside `applyPrimitive`). The
  descriptor path already has the right per-wrapper pattern
  (`bound:` primitives propagate impl effects).
- Perf: `type_dispatch` is the hot path; the warn-only perf floor is
  baselined and will see any evidence check that PE does not fold.

## 3. Decisions for ratification (V-R1 … V-R8)

- **V-R1 — One pipeline, kernel-internal mediation; `fallbackMember`
  stays the user hook.** The D41 mediator is a KERNEL pipeline stage:
  `type_dispatch`'s descriptor path becomes the default mediator,
  consulting descriptor attributes (D43) + symbol reachability (D42).
  It is not a new user-facing slot — the existing
  `__getMember`/`Type.fallbackMember` remains the ONLY user policy
  hook (open-type string-key policy per D41's own carve-out), gains
  the evaluator-supplied context as a third argument (2→3 arity;
  positional impls are source-compatible), and its invocation is
  repaired to run inside `applyPrimitive` so its effect tags
  propagate. The naming collision dissolves: "mediate" names the
  stage, `fallbackMember` names the hook. The untyped meta-dispatch
  shadow ladder is UNIFIED into the typed path (one implementation,
  gate included), and operator dispatch routes through the same gated
  bridge — `a + b` on a type whose `add` is private is a denial.
  Recommended.
- **V-R2 — The context is an opaque evidence capsule, not the raw
  scope.** The evaluator supplies the access-site scope chain, but
  wrapped: a kernel-minted capsule value answering only the
  possession test (`holds(symbol)`), print-redacted,
  non-enumerable — user fallback mediators can consult and forward
  it, never mine it for the lexical environment (D25 introspection
  stays a property of scopes you HOLD, not scopes handed to you for
  evidence). Kernel default mediation reads it directly. Recommended.
- **V-R3 — Two tiers this arc: private and public.** `private` = the
  member symbol stays in the defining scope (module scope for module
  bindings, the type-local member scope for type members); `public` =
  exported with the type/module. `internal` (extension scope) and
  `protected` (restated over draw-from post-D44) are RESERVED
  vocabulary, deferred until a concrete consumer exists — the tier
  model stays possession-shaped so they slot in without rework.
  Recommended.
- **V-R4 — Export-ness moves to the scope binding; open-module
  compatibility is an explicit policy.** `Binding` gains a visibility
  attribute (the substrate the slot registry has pinned to S3 since
  D39); the `exported` value-plane channel is DELETED (the `y = x`
  wart dies with it). A module that declares NO exports remains fully
  open — now as a stated module-level policy ("no export statements =
  open module"), not an accident — so the nine no-export libs keep
  working; declaring any `export` closes the module (current
  semantics, kept). Flat `use`-injection is FILTERED to the same
  export set the module object exposes — closing the second leak
  route with zero effect on open modules. Recommended.
- **V-R5 — D43 attributes ride descriptors; the API surface is
  wrapper combinators.** Descriptor attributes follow the shipped
  `getter` precedent (optional bindings on the descriptor). With
  keyword syntax blocked on B-043, the define-spec surface is
  combinator wrappers: `Type.define({x: Int, hidden: private(Int),
  helper: private(fn)})` — `private(v)` marks the declaration;
  vocabulary extensible per kind per D43 (a kind-recipe input), with
  `readonly(...)` reserved but inert until B-046. Lowering: attribute
  on the descriptor + the member symbol staying in the type-local
  scope. Public-by-default and NAMES-public-by-default are ratified
  as shipped defaults (denial says "private to T"; name-secrecy is a
  later opt-in). Recommended.
- **V-R6 — Bespoke readers close per policy, not per accident.**
  Destructuring a private field OUTSIDE its scope is an ERROR naming
  privacy (not a silent no-match — names are public, and a silent
  no-match would be a semantic trap); inside the defining scope it
  works unchanged. `formatValue` omits private fields, rendering a
  `…` marker so output stays honest. Structural/declared conformance
  counts only externally-reachable members; draw-from of another
  type's private member is a denial. Recommended.
- **V-R7 — Reflection: names free, accessors gated.** Resolves the
  D23 ("reads are free") vs D42 tension: enumeration surfaces
  (`Type.members`, descriptors-by-name, `scope_bindings`,
  `channel_list`) stay FREE and caller-independent, listing member
  names + visibility flags — consistent with names-public, no
  information channel opened. What privacy guards is the ACCESSOR:
  obtaining a private member's value/impl through any reflective path
  requires the same possession evidence as dot access. Introspection
  and PCP tooling keep unrestricted name-level reads. Recommended.
- **V-R8 — Mediation effects: per-mediator tags, `observe` stays
  reserved.** Kernel default mediation is pure and folds (denial at
  PE time; zero runtime cost on the hot path — guarded by the perf
  floor). An impure user fallback mediator declares its OWN effect
  label, propagated via the per-wrapper pattern the descriptor path
  already uses — `type_dispatch` itself is never blanket-tagged
  (which would flip compile-mode deferral for every dot access).
  `observe` remains the knowledge/source-observation label (E-R5,
  D47); mediation does not borrow it. The E-R5 mechanical-purity-gate
  pattern is reused verbatim for any context where a mediator must be
  pure. Recommended.

Also ratified by adopting this plan: the forgery-E success criterion —
E goes live as an attack battery proving the module-private-writer
discipline is language-enforced (direct dot access, flat-injection
name, and wire rebind all refused for an unexported writer). A holder
that explicitly EXPORTS its writer is out of scope by design: that is
policy, not a flaw — E converts the archive's "assumption, not a base
flaw" into an enforced guarantee for holders that follow the
discipline.

## 4. Chunks

House sizing: one landable unit per chunk, suite green, landing
checklist per PROCESS §5; the behavior FLIP lands last (C5.2-R3
precedent). Each chunk on its own W-006 branch + PR.

**V1 — Visibility substrate (scope bindings + export migration)
[this PR].**
`Binding` gains the visibility attribute; `export` writes it;
`buildModuleObject` + flat `use`-injection + the wire's `markExported`
all read ONE export set derived from bindings; the `exported`
value-plane channel and its wart die (registry updated, D39 Appendix
A row resolved). Open-module policy stated in code and docs. Flat
injection filtered (leak route 2 closed). Conscious deltas: the
exported-channel tests; behavior of `y = x` re-export (was silent
export, becomes none — the fix). Forgery E partial (injection route).

**V2 — Pipeline unification (no policy change)  [this PR].** The three ctx drops
repaired; `fallbackMember` 3-ary with the V-R2 capsule; its
invocation moved inside `applyPrimitive` (effects propagate); the
untyped meta-dispatch shadow ladder unified into the typed path (the
availability gate now covers it — conscious delta: untyped values
gain the same refusals typed ones have); operator dispatch routed
through the gated bridge; `typeMethod`'s raw-binding fallthrough
narrowed to registered protocol slots. Totality's and the renderer's
`type_dispatch` shape-matchers updated in the same commit as any
lowering change (or the shape kept — decided in-chunk). No `private`
exists yet; the pipeline is in place and everything still public.

**V3 — Private members (the flip).** Descriptor attributes +
`private(...)` combinator in define/Interface specs; type-local
member scopes become name-stable and hold private member symbols;
kernel default mediator consults attributes + capsule; bespoke
readers close per V-R6 (destructuring, formatValue, conformance,
draw-from); reflection per V-R7. The delta queue lands here —
enumerated in §5, pre-discussed at this plan's gate, each item
verified in the chunk. Module-private bindings become unreachable
through every remaining route.

**V4 — Evidence hardening + forgery E + release.** Wire-route attack;
forgery E LIVE (skeleton → real battery, the last skeleton retires);
capsule print-redaction and non-fabrication asserted in the boundary
battery; confluence tests for stages 3–4 (late-arriving knowledge and
late context agree with folded resolution — the D41 invariant gets
its harness); perf-floor re-baseline if needed (warn-only); docs sync
(structures.md §6/§13 status stamps, type-system.md §3, modules.md,
language-reference, getting-started if surface examples change);
CHANGELOG; website loop (the sandbox gains a visibility example only
if the owner wants one — decided at gate).

Gate per chunk: land, summarize, stop (PROCESS §3).

## 5. Conscious-delta inventory (pre-declared per the §6-item-3 ruling)

1. `exported` channel tests (V1): component-based assertions replaced
   by binding-attribute assertions; `y = x` no longer exports `y`.
2. Untyped-Context dispatch (V2): gains availability refusals it
   never had (the shadow ladder had no gate). Existing
   "dot access on untyped context falls back to ctx_resolve" stays —
   untyped MODE is unaffected; this is about typed-mode values whose
   type is null.
3. Operator dispatch (V2): a private operator member denies — no
   current test depends on private operators (none exist), but the
   dispatch path changes shape; differential fixtures before/after.
4. Refusal messages (V3): the existing module test matches
   "not found" OR "not exported" substrings — new denials say
   "private to …"; the test's condition set is EXTENDED (never
   weakened) after discussion at the V3 gate.
5. `formatValue` (V3): records with private fields print `…`; the
   pinned `basicsOutput` snapshot regenerates only if basics.alg
   gains a private example (default: it doesn't; snapshot untouched).
6. Destructuring (V3): private field outside scope = error; no
   existing demo destructures another module's record privates (none
   can exist yet), so the delta is latent — asserted by new tests.
7. Reflection (V3): descriptor-enumeration surfaces list all names +
   flags (unchanged counts); accessor-bearing reads gated. The
   boundary battery's member pokes on IntType are unaffected (all
   public).

## 6. Riders and out-of-scope (owners named)

`readonly` write semantics → B-046; sync/async modifiers → B-047;
keyword surface (`private x: Int`) → B-043 (the combinator surface
this arc ships is forward-compatible: keywords lower to the same
descriptor attributes); `internal`/`protected` tiers → reserved,
V-R3; knowledge-gated downcast refusal → stays on the C3.2 deferred
list; qualified-import re-exports interaction → B-040 checks against
the V1 export set when it lands; S5 variance → B-050.

## 7. Status log

- 2026-08: plan drafted (design corpus + code-reality survey; both
  session records archived in the drafting session). Decision points
  V-R1–V-R8 proposed with recommendations; forgery-E criterion
  proposed. Awaiting maintainer ratification — no chunk starts before
  the gate (PROCESS §6).
