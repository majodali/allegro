# Metadata and the capability to write it

> **Reader.** This chapter is the design truth for two
> [units](../units.md#def-unit), `metadata` and `capability`. You know
> [values](../concepts.md#def-value),
> [representation kinds](../concepts.md#def-representation-kind),
> [Structures](../concepts.md#def-structure),
> [bindings](../concepts.md#def-binding),
> [residuals](../concepts.md#def-resolved-unresolved-residual) and
> [partial evaluation](../concepts.md#def-partial-evaluation) from
> earlier chapters.
>
> **Authority.** Tier 1. The chapter executes five decisions of the
> register: annotation fields are extensible; writes are gated while reads
> are free; the capability is a delegable closure; trust needs no seal;
> metadata rides every kind. The examples are verbatim excerpts of
> `tests/metadata-channels-demo.alg`, which the suite runs against the
> demo's `// expect:` lines. The chapter presents ten decisions about
> metadata in dependency order, each in a
> [decision section](../preface.md#def-decision-section). A final section
> holds the content of two chapters not yet written, on how metadata
> propagates and on installing a layer into the base.

## Metadata fields are independent [partial]

Each metadata field is handled by its own declaration, independently of
every other field. No operation may disturb a metadata field the
operation does not know about. The independence of metadata fields is a
[foundational decision](../preface.md#def-foundational-decision) about
language capability. A <a id="def-metadata-field"></a>**metadata field**
is a named piece of information that a value may carry about itself,
such as the value's type, an error, or a proof's discharge.

The problem is how many [layers](../layers.md#def-layer) can each attach
information to values without every operation knowing about every layer.
Without independence, every layer would thread the layer's own
information through every operation by hand. Layers compose only when an
operation's treatment of one field does not depend on which other fields
a value carries. The independence rests on the decision that
[the base does not know about the layers](../concepts.md#def-r6).

Statements saying only which fields survive an operation were the
alternative, and were merged into this decision. A survival-only
statement cannot say what matters under a `drop` rule: no operation may
drop a field the operation has never heard of. The reason for
independence, that layers compose, holds for any evaluator, partial or
not.

As a consequence, a layer can register a new field without a change to
any operation of the base. Where a value's fields are stored is a
separate decision, the next one in this chapter.

As implemented, the `metadata` unit, in `src/metadata.ts`, holds the
field registry and the generic propagation code that serves every field
alike. Today `viralOnto` in `src/metadata.ts` carries only the first
viral field found, on the first candidate value that carries one. A user
field registered `viral` therefore erases `error` from a result whose
earlier operand carries the user field. The decision requires `viralOnto`
to carry every viral field, each field at the field's first occurrence.

To try another independence rule, change the propagation functions in
`src/metadata.ts`, through which every field's propagation passes.

## Metadata is a field on every value [implemented]

Every [representation kind](../concepts.md#def-representation-kind)
carries an optional metadata map, so a typed `42` is a Bits value with a
`type` field. Attaching metadata to a value yields a new value of the
original value's kind. The field on every kind is a foundational decision
about language capability, since every metadata read, every write and
every [residual](../concepts.md#def-resolved-unresolved-residual)'s
propagated fields rest on the field.

The problem is where a value's metadata lives, given that metadata
belongs to one occurrence of a value. One option wraps a non-composite
value in a transparent carrier [Structure](../concepts.md#def-structure)
that holds the fields. A carrier is a second value, so every operation
must tell the carrier from the value the carrier wraps. A side table
keyed by the host object fails, because one object can occur at two
positions with different metadata. The field on every kind was taken
because metadata then rides each occurrence of a value with no wrapper
to see through.

One consequence: attaching metadata to an interned
[Symbol](../concepts.md#def-symbol) clones the Symbol, which breaks the
Symbol's identity by fully-qualified name. The host warns when metadata
is attached to an interned Symbol, without refusing the attachment.

As implemented, `MetadataBearing` in `src/types.ts` declares the optional
`meta` slot, and all seven kind interfaces extend `MetadataBearing`.
`withMeta` in `src/types.ts` returns a new value of the input's kind,
deriving a Structure and cloning every other kind. A value that carries
nothing leaves the slot undefined, so plain values pay nothing.

To explore, note that replacing the slot with another storage changes
`withMeta`, the free reads in `src/metadata.ts` and every factory that
takes metadata.

## A field is a name and one propagation rule [implemented]

A field is declared by registering a name and one propagation rule. An
extension registers the fields the extension needs, and the base fixes
no set of fields. Registration by extensions is a foundational decision
about language capability, since every field registers this way.

The problem is who decides which fields exist. A fixed set of annotation
fields in the base was the alternative. A fixed set would have the base
know which layers exist, which the decision that the base does not know
about the layers forbids.

As implemented, `registerMetaField` in `src/capability.ts` takes a
specification holding a name, a rule and an optional integrity flag.
`MetaFieldSpec` in `src/metadata.ts` also holds an optional binding key,
for the one field stored among a Structure's
[bindings](../concepts.md#def-binding). Registrations sit in the modules
that own the fields: `src/capability.ts`, `src/types-std.ts`,
`src/effects.ts`, `src/refinements.ts`, and `channel_register` in
`src/primitives.ts` for Allegro code.

To explore, another registration surface, such as one registration for a
group of fields, replaces `registerMetaField` and the calls of
`registerMetaField`.

## Originating a field value needs the writer; reads and propagation need nothing [partial]

Allegro code originates a field value only through the field's writer.
Authority is the writer held, not the field's name. Host kernel modules
are trusted, and write fields through the accessor layer. Reading a field
needs no authority, and neither does propagation. The origination rule
and the free reads are foundational decisions about language capability.
A <a id="def-writer-capability"></a>**writer capability**, or writer, is
the closure, returned by a field's registration, that originates a value
of the field on a value. An <a id="def-integrity-field"></a>**integrity
field** is a field registered with `integrity`, whose origination
requires the field's writer and whose rule may not fabricate.

The problem is how a field can carry authority, such as a proof's
discharge, when any code can name the field. Metadata that anything can
write cannot be evidence. Introspection and the prover protocol need
every field readable by any code. Which fields need protection is a
layer's decision, so the base must not list the protected fields.

Carrying trust by a field's name fails, because any code that names the
field could then counterfeit the field's values. Authority carried by
holding the writer closure needs no list of protected fields. As a
consequence, a proof's `discharged` field is evidence, because only the
holder of the field's writer can originate the field.

As implemented, the battery in `src/boundary-tests.ts` refuses Allegro
code that originates `discharged` without the writer, by an object
literal or by re-registration. A free read cannot become a write: a
writer for one field cannot reach `discharged`. `metaReadRaw` in
`src/metadata.ts` and `channel_read` in `src/primitives.ts` read a field
without demanding anything of the caller. `assertNotIntegrityKey` in
`src/capability.ts` refuses, on user-reachable construction paths, the
binding keys under which integrity fields are stored.

The first example in `tests/metadata-channels-demo.alg` registers a field
named `audit`, writes the field on `42` and reads the field back with no
authority.

```
audit = channel_register("audit", "union")
v = audit(42, "checked")
print(channel_read(v, "audit"))
// expect: checked

// The field rides on the value; the value is still 42.
print(v)
// expect: 42

// A value that does not carry the field answers `none`.
print(channel_read(42, "audit"))
// expect: none

// `channel_list` names the fields a value carries. A plain typed literal
// carries only its `type`.
print(channel_list(42))
// expect: [type]
```

The kernel's trust is used widely. `withType` in `src/types-std.ts`
writes `type` through `withMeta`, without the `type` writer. `writeShape`
in `src/metadata.ts` writes `type` in place, from 23 call sites outside
the `metadata` unit. `withSource` in `src/metadata.ts` writes `source`
without a writer, while the writer minted for `source` is discarded at
registration. Any module can take any field's writer from
`metaFieldEntry` in `src/metadata.ts`. Only `discharged` is written
through the field's writer, in `makeProof` in `src/types-std.ts` and in a
failed proof's construction in `src/primitives.ts`. A boundary lint
admits calls of `kernelFieldWriter`, the kernel's acquisition path in
`src/capability.ts`, only in `src/types-std.ts`, `src/primitives.ts` and
`src/runtime.ts`.

Whether kernel origination should also go through writers is an
[open decision](../preface.md#def-open-decision). Routing kernel
origination through writers has `withType` and `withSource` take their
writers, with `metaFieldEntry` offering a check of possession instead of
the writer. It also needs a writer for `writeShape` that stamps in place.
The cost is about 190 call sites, most of them calls of `withType`, in
five source files.

Whether a field may restrict the field's reads is a second open decision.
`readVisibility` on `MetaFieldSpec` in `src/metadata.ts` records a read
policy that no code sets or enforces.

To contribute an option to either open decision, branch
`src/capability.ts` and `src/metadata.ts`, where registration, writers
and reads live.

## A fixed vocabulary of propagation rules [partial]

A field's rule is one of four: `viral`, `union`, `computed` and `drop`.
Registration refuses any rule outside the four rules of the vocabulary.
An [integrity field](#def-integrity-field) may register only `drop` or
`computed`. The base applies a field's rule without knowing the field's
meaning. The semantics a rule needs, such as the merge for `union`, are
installed by the field's owner. The vocabulary is a foundational decision
about language capability.

<a id="def-propagation"></a>**Propagation** is what an operation does
with the metadata fields of the operation's operands when the operation
produces a result, as each field's rule says. Under `viral`, a result
carries the field when any operand carries the field, each viral field at
the field's first occurrence. Under `union`, the operands' values of the
field are combined by the merge the field's owner installed. Under
`computed`, the field's owner derives the field at the sites the owner
annotates. Under `drop`, a derived value never carries the field. A
<a id="def-fabricating-rule"></a>**fabricating rule** is a propagation
rule that places a field value on a result where no writer put the
value: `viral` or `union`.

The problem is how a field declares what operations do with the field,
in a form the base can check. Arbitrary propagation closures, one per
field, were the alternative. A closure is not inspectable, so
registration could not refuse a fabricating closure on an integrity
field. Over a fixed vocabulary, refusing a fabricating rule is a check of
one rule name against two names. A discipline the vocabulary cannot
express extends the vocabulary instead of opening the vocabulary to
closures.

You can run the refusal. In the battery's forgery scenario C, registering
an integrity field with `viral` is refused. The command
`ALLEGRO_TEST_FILTER="forgery C" npm test` runs the scenario C experiment
again. As a consequence, the integrity check stays decidable whatever
fields the layers register.

As implemented, `registerMetaField` in `src/capability.ts` refuses a
fabricating rule on an integrity field. `registerMetaField` does not
check that a rule belongs to the vocabulary. `channel_register` in
`src/primitives.ts` passes the rule string through unchecked, so
`channel_register("x", "nonsense")` registers a field that behaves as
`drop`. `PropagationRule` in `src/metadata.ts` still lists a fifth rule,
`positional`, that no field registers and no code applies.

To try an open vocabulary, accept a closure in `MetaFieldSpec` and apply
the closure where `viralOnto` and `mergeOverMeta` apply the rules.

## A writer is a closure [implemented]

A [writer](#def-writer-capability) is a closure returned by
registration. Delegation is passing the writer, and attenuation is
wrapping the writer in a re-checking closure. A writer holds no data,
prints as the writer's field's name, and cannot be compared from Allegro.
The host's gates compare writers by identity. The writer's shape is a
foundational decision about language capability, since every gated
install checks a writer's identity.
<a id="def-attenuation"></a>**Attenuation** is wrapping a writer in a
closure that checks each write before passing the write on.

The problem is what form the authority to write a field takes. Authority
ambient in a scope was rejected, because ambient authority is recoverable
from tokens as a usage pattern, while a move from ambient authority to
tokens would break programs. A separate `channel_write` primitive was
rejected, because the writer is the write operation. A writer as a value
can be tracked through
[partial evaluation](../concepts.md#def-partial-evaluation) like any
other value.

Two consequences follow. An Allegro writer cannot install a merge, so a
user `union` field never merges. Module-private authority is a usage
pattern: a module keeps the writer in a private binding and never
exports the writer.

As implemented, `channel_register` in `src/primitives.ts` returns the
writer as a [primitive function](../concepts.md#def-primitivefunction)
that closes over the host writer, branded with the field's name. A
writer for a field named `audit` prints as
`<primitive:<channel:audit writer>>`. `channel_attenuate` in
`src/primitives.ts` wraps a held writer in a closure that evaluates a
predicate on the field value before writing. `channel_attenuate` refuses
a first argument that carries no writer's brand. Comparing two writers
with `==` from Allegro fails, because equality expects Bits values.
`holdsWriterFor` in `src/capability.ts` compares a writer with the
registered writer by identity. The battery in `src/boundary-tests.ts`
finds a module-private writer unreachable through every export surface.

The attenuation example in `tests/metadata-channels-demo.alg` writes
through a writer that admits only `"ok"`.

```
ok_only = channel_attenuate(audit, x => x == "ok")
good = ok_only(5, "ok")
print(channel_read(good, "audit"))
// expect: ok
```

To try another shape for authority, replace `buildWriter` in
`src/capability.ts` and the writer primitives in `src/primitives.ts`.

## Trust without a seal [partial]

No seal primitive or per-value brand marks a value as trusted. Trust in
a constructed value decomposes into three legs: write authority over the
value's [integrity field](#def-integrity-field), immutability of the
value's data, and a non-fabricating rule. Trust in a constructed value is
global and structural. Trust without a seal is a foundational decision
about language capability.

The problem is how a reader of a value knows the value came from a
trusted constructor. A `seal` operation was superseded, because the
operation was only ever conceptual. A provenance tag on each value was
rejected. Each of the three legs is needed for the leg's own reason, so a
seal would duplicate what the legs already give.

As a consequence, a value carrying `discharged` is trustworthy for three
reasons: no code without the writer originated the field; the data under
the field is immutable; `drop` never fabricates the field.

As implemented, forgery scenarios A, B and C in `src/boundary-tests.ts`
test the three legs: the writer, immutability, and the non-fabricating
rule. The immutability leg is declared, not enforced: no check stops an
in-place write after a value escapes. The writer for `discharged`, the
one field stored among a Structure's bindings, stamps the field in place
on a fresh kernel value.

To try a seal, add a sealing primitive to `src/capability.ts` and a check
of the seal where `discharged` is read.

## Metadata supplied at construction, in a slot the metadata unit owns [partial]

Factories take an optional metadata argument, so a value never exists
without what the value must carry. `withMeta` is the one attachment
operation. `carryMeta` moves metadata onto a value derived from the
source value. The `meta` slot is not part of the contract every value
meets: the `metadata` unit adds the slot to every kind, and no kind unit
reads the slot. The construction surface and the slot's placement are
[swappable decisions](../preface.md#def-swappable-decision) about
implementation.

The problem is when metadata reaches a value, and which unit owns the
slot that holds the metadata. Constructing a value and then attaching
metadata is the alternative, in which the value exists for a moment
without the value's metadata. Four named operations, create, derive, map
and stamp, are a second alternative to one operation with two
conveniences. Supplying metadata at construction saves one allocation on
the residual path of PE Rule 1. Writing the slot in place is permitted
only while the value is provably unshared, during construction and before
the value escapes.

As implemented, `makeBits`, `makeInt`, `makeFloat`, `makeSymbol` and
`makeExpr` in `src/types.ts` take metadata. `makePrimitive`, `makeParam`,
`makeComposedFn` and `makeStructure` in `src/types.ts` take no metadata.
`carryMeta` in `src/metadata.ts` shares the source value's map with the
derived value, without copying the map. `writeShape` and
`removeShapeSlot` in `src/metadata.ts` change a type's `type` field in
place, on type Structures minted and not yet escaped. The slot is not yet
mixed in: `MetadataBearing` and `withMeta` are declared in
`src/types.ts`, which the unit manifest maps to ten units.

To explore, splitting `src/types.ts` along the unit manifest moves the
slot and `withMeta` into the `metadata` unit.

## Registration is one-shot within a pass [implemented]

The first registrant of a field receives the field's
[writer](#def-writer-capability), and no one else can obtain the writer.
The exception to one-shot registration is Allegro re-registration with an
identical rule within one evaluation pass, which returns the held writer.
Kernel registrations never re-issue a writer. One-shot registration is a
swappable decision about language capability, held inside the
`capability` unit.

The problem is who can obtain a field's writer. One-shot registration
lets origination control hold without the base keeping a list of the
fields that matter. Re-issue within a pass exists because the evaluation
loop may re-evaluate a top-level binding within one pass. Any caller may
receive the held writer within a pass, since one pass is one program's
evaluation. Keying re-issue by registration site is the alternative, at
the cost of changes to `src/capability.ts`, `src/primitives.ts` and the
pinned demo.

As implemented, `registerMetaField` re-issues a writer only when Allegro
minted the field, the rule matches, and the field's epoch is the current
pass. `bumpMetaEpoch` advances the epoch at the start of each
`evalSource` pass, in `src/runtime.ts`. Kernel fields register at epoch
−1, which no pass matches. Comments in `src/capability.ts` and in the
pinned demo tie re-issue to the registration site, which re-issue does
not check. The battery in `src/boundary-tests.ts` refuses a later program
that re-registers a field an earlier program registered.

The re-registration example in `tests/metadata-channels-demo.alg` gets
the held writer back within one pass.

```
again = channel_register("audit", "union")
print(channel_read(again(1, "x"), "audit"))
// expect: x
```

To key re-issue by site, extend the re-issue condition in
`registerMetaField` and pass a site from `channel_register`.

## A refused write aborts [implemented]

A refused write, install or [fabricating rule](#def-fabricating-rule)
aborts evaluation instead of returning an error value. An
<a id="def-abort"></a>**abort** is a refusal that stops the program's
evaluation with no value returned. Denial as an abort is a swappable
decision about language capability.

The problem is what a refused write gives back to the code that
attempted the write. An error value was rejected, because an error value
would be forgeable: the forger chooses what to do with the error value.

As implemented, every refusal in `src/capability.ts` and in the writer
primitives of `src/primitives.ts` throws `AllegroError`. A rejected
attenuated write halts the program before the program's next line. During
[precompile](../layers.md#def-precompile) and inference, catch-alls in
`src/runtime.ts`, `src/evaluator.ts` and `src/primitives.ts` record or
swallow a denial before the program's own run halts.

To try denial as a value, return an error value where `src/capability.ts`
throws, then run the forgery battery.

## Propagation and installs, held until their chapters are written [partial]

This section is held in this chapter until the chapters on how metadata
propagates and on installing a layer into the base are written.

A <a id="def-channel"></a>**channel** is the apparatus by which one
capability of the language rides values through partial evaluation: one
or more [metadata fields](#def-metadata-field), the fields' rules, the
fields' writers and the layer code that interprets the fields. Typing,
effect analysis and proof discharge are channels. A channel may need
several fields, as knowledge needs three. No channel-level registration
exists: each layer registers the layer's fields one by one. Whether one
channel-level registration replaces registration field by field is an
open decision.

The base registers two fields in `src/capability.ts`: `source`, an
integrity field with rule `drop`, and `error`, with rule `viral`.
`src/types-std.ts` registers three fields: `type`, `computed` and
integrity; `shape`, `computed`; `discharged`, `drop` and integrity.
`src/effects.ts` registers `effects` with rule `union`.
`src/refinements.ts` registers three fields: `predicates` and `domain`,
both `computed`, and `bound`, with rule `drop`. Three fields registered
in `src/capability.ts` have no owner: `knowledge`, `warnings` and
`exported`. Nothing stores `knowledge`, whose storage is `predicates`,
`domain` and the refinement layers of a type. Nothing writes `warnings`.
`exported` serves nothing, since visibility is a property of the
binding. The ownership test in `src/boundary-tests.ts` pins each field's
registration and integrity flag, without comparing the owners the test
lists.

The base registers a field only if the concept the field serves survives
in Allegretto. `make_error` and `source of` both work under `--base`.
`error` is a `viral` field with a public writer, `make_error`, so an
error rides every result derived from an error-carrying value. An
error-carrying `if` condition propagates the error instead of taking a
branch. The error example in `tests/metadata-channels-demo.alg` carries
an error through primitives, a user function and a conditional's test.

```
e = make_error("boom")
print(channel_read((e + 1) * 2, "error"))
// expect: boom

sq = x => x * x
print(channel_read(sq(e), "error"))
// expect: boom

print(channel_read(if e then 1 else 2, "error"))
// expect: boom
```

`source` carries the
[Expression](../concepts.md#def-expression) a value was evaluated from,
with rule `drop`, because a derived value was not produced by the
recorded Expression. Only the evaluator attaches `source`, at calls of
source-aware primitives and on resolved top-level bindings. `source` is
an integrity field, so no doctored source can make a verdict display a
proposition other than the proposition checked. `source of x` reads the
field under the `observe` effect, rendering the Expression as text.

The generic half of [propagation](#def-propagation) lives in
`src/metadata.ts`. `viralOnto` carries the first viral field found on the
callee or an argument onto the residual, with the candidate's `type`. An
application with a user viral operand is not computed: the evaluator
returns the residual carrying the viral field. `mergeOverMeta` lays a
value's fields under the fields of the value the first value
re-evaluates to, merging `union` fields and letting the inner value win
otherwise. `drop` needs no code, because nothing carries a `drop` field.
The `drop` example in `tests/metadata-channels-demo.alg` reads a field on
`n` and finds nothing on `n + 1`.

```
note = channel_register("note", "drop")
n = note(7, 1)
print(channel_read(n, "note"))
// expect: 1

print(channel_read(n + 1, "note"))
// expect: none
```

A user `union` field written on a leaf does not survive `v + 1`, because
`effects` rides a path of the evaluator's own and the generic rule
applies only at re-evaluation. The `effects` path and the knowledge
interpretation beside the path are the evaluator's two imports from
Allegro Standard that the unit order forbids.

A layer installs what a field means into the base, gated on the field's
writer, because an install is authority. Each installer compares the
installer's writer with the registered writer by identity.
`installFieldMerge` in `src/capability.ts` installs how two values of a
field combine under `union`. `src/effects.ts` is the one caller of
`installFieldMerge`, installing effect union. `installFieldCheck`
installs how an argument is checked against a declared constraint naming
the field, a check the evaluator runs at every typed call site.
`src/types-std.ts` installs the `type` check, and `src/effects.ts`
installs the `effects` check. `installDispatch` installs how the
evaluator dispatches on a field, at a primitive application and at a
composed call, as `src/types-std.ts` does for `type`.
`installProjection` installs how a field is computed on read when nothing
stores the field, as `src/types-std.ts` computes `shape` from `type`.

`installAnalysis` lets a producer high in the unit order answer a
question about a field for a consumer lower in the order. Two questions
about `effects` are installed: `inferred`, by the type primitives, and
`diverges`, by the pipeline once per compilation. `installFactsMerge` in
`src/scope.ts` gates one install into the scope unit: how facts about a
name combine across scope layers. `src/refinements.ts` installs the facts
merge with the `predicates` writer. The battery in `src/boundary-tests.ts`
refuses a foreign writer at each installer.

<!-- render map: C1→¶1 C2→¶1 C4→¶2 C5→¶2 C3→¶2 C6→¶2 C7→¶3 C8→¶3 C9→¶3 C10→¶3 C11→¶4 C12→¶4 C13→¶4 C14→¶4 C15→¶5 C16→¶5 C17→¶5 C18→¶6 C19→¶6 C20→¶7 C21→¶7 C22→¶7 C23→¶7 C24→¶8 C25→¶9 C26→¶9 C27→¶9 C28→¶10 C29→¶10 C30→¶10 C31→¶10 C32→¶10 C33→¶11 C34→¶11 C35→¶12 C36→¶12 C37→¶12 C38→¶13 C39→¶14 C40→¶14 C41→¶14 C42→¶15 C43→¶15 C44→¶15 C45→¶16 C46→¶16 C47→¶16 C48→¶17 C49→¶18 C50→¶18 C51→¶18 C52→¶18 C53→¶18 C54→¶18 C55→¶18 C56→¶19 C57→¶19 C58→¶19 C59→¶19 C60→¶20 C61→¶20 C62→¶20 C63→¶21 C64→¶21 C65→¶21 C66→¶21 C224→¶22 C67→¶23 C68→¶23 C69→¶23 C70→¶23 C71→¶23 C72→¶23 C73→¶24 C74→¶24 C75→¶24 C76→¶24 C77→¶25 C78→¶25 C79→¶26 C80→¶27 C81→¶27 C82→¶27 C83→¶27 C84→¶27 C85→¶27 C86→¶28 C87→¶28 C88→¶28 C89→¶28 C90→¶28 C91→¶28 C92→¶29 C93→¶29 C94→¶29 C95→¶29 C96→¶29 C97→¶30 C98→¶30 C99→¶30 C100→¶31 C101→¶31 C102→¶31 C103→¶31 C104→¶32 C105→¶33 C106→¶33 C107→¶33 C108→¶33 C109→¶33 C110→¶33 C111→¶34 C112→¶34 C113→¶34 C114→¶34 C115→¶35 C116→¶35 C117→¶36 C118→¶36 C119→¶36 C120→¶36 C121→¶36 C122→¶36 C123→¶36 C124→¶37 C125→¶38 C126→¶39 C127→¶39 C128→¶39 C129→¶39 C130→¶40 C131→¶40 C132→¶40 C133→¶40 C134→¶41 C135→¶42 C136→¶42 C137→¶42 C138→¶43 C139→¶44 C140→¶44 C141→¶44 C142→¶44 C143→¶44 C144→¶45 C145→¶45 C146→¶45 C147→¶45 C148→¶45 C149→¶46 C150→¶46 C151→¶46 C152→¶46 C153→¶46 C154→¶47 C155→¶48 C156→¶48 C157→¶48 C158→¶48 C159→¶49 C160→¶49 C161→¶49 C162→¶49 C163→¶49 C164→¶50 C165→¶50 C166→¶50 C167→¶50 C168→¶50 C169→¶51 C170→¶52 C171→¶53 C172→¶53 C173→¶53 C174→¶54 C175→¶54 C176→¶55 C177→¶55 C178→¶55 C179→¶56 C180→¶57 C181→¶58 C182→¶58 C183→¶58 C184→¶58 C185→¶58 C186→¶59 C187→¶59 C188→¶59 C189→¶59 C190→¶59 C191→¶59 C192→¶59 C193→¶59 C194→¶59 C195→¶60 C196→¶60 C197→¶60 C198→¶60 C199→¶60 C200→¶61 C201→¶61 C202→¶61 C203→¶61 C204→¶62 C205→¶62 C206→¶62 C207→¶62 C208→¶62 C209→¶63 C210→¶63 C211→¶64 C212→¶64 C213→¶64 C214→¶64 C215→¶64 C216→¶64 C217→¶64 C218→¶64 C219→¶65 C220→¶65 C221→¶65 C222→¶65 C223→¶65 -->
