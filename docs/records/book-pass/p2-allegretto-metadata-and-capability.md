# Chapter review: Metadata and the capability to write it (P2)

> **Record.** Reader: RD-2 (the owner returning after a gap). Form:
> W-008 (reports map their deliverables). Subject: chunk P2 (the pilot
> chapter) of `docs/plans/book-pass.md`, the chapter
> `docs/book/allegretto/metadata-and-capability.md` (inventory chapter 7,
> units `metadata` and `capability`), read on `origin/main` at `98c5dc8`,
> 2026-11-07. Author: the review session. The first use of the
> decision-by-decision method of §2.7. The maintainer reads the chapter
> and this review together and rules by number; "defaults" takes every
> recommendation.

## Asks

Two of the chapter's thirteen decisions do not hold in the code. The
`viral` rule drops every viral field but the first, so an error vanishes
when it meets a value carrying another viral field. Registration accepts
a propagation rule outside the fixed vocabulary. Four more decisions hold
only in part. The first ask is whether the pilot may run before
chapters 1 to 6.

1. **R-P2-1 — Taking chapter 7 before chapters 1 to 6.** Seven of the
   chapter's decisions depend on decisions of chapters 1 to 6 that the
   pass has not approved: "Metadata channels are independent" on
   "Partial evaluation as the compilation model" (chapter 1) and "The
   base does not know about the layers" (chapter 2); "Metadata is a
   field on every value" on "Seven representation kinds" (chapter 4);
   "Metadata slot mixed in from the metadata unit" on "Value as a
   contract, seven kind units and an assembly" (chapter 4); "Writers are
   closures" on "Host functions as values with declared evaluation
   control" (chapter 5); "Symbols serialise by FQN" on "Symbol identity
   is a fully-qualified name" (chapter 5); "No seal operation" and
   "Metadata supplied at construction" on "Structures immutable by
   default; derive, never mutate" (chapter 6). Two of those are not
   built: no `Value` contract exists in `src/` (no `ValueBase` or
   augmentation in any file), and the in-place rule under immutability
   is stated, not enforced (B-143 (D22 is declared, not enforced)).
   Approving now would break R28 (the monotonic pass). Options: (a) rule
   and edit the pilot now, approval conditional: the chapter becomes
   final only when chapters 1 to 6 are approved, and a later change to
   an earlier decision re-opens it, a declared exception to R28 for the
   pilot only; (b) the pilot as a dry run: review, rule, write the IR
   and the prose, but make no code change and approve nothing until the
   pass reaches it in order; (c) start the pass at chapter 1 and take
   the pilot in its place. Recommended: (b), because it tests the
   method's document half now without spending R28's guarantee, and the
   code half is exercised at chapter 1. Default: (b).

2. **R-P2-2 — Metadata channels are independent.** Recommended: restate,
   and rename it "Metadata fields are independent". Inventory: each
   piece of named information is handled by its own declaration, and no
   operation disturbs a field it does not know about; capability;
   foundational; depends on "Partial evaluation as the compilation
   model" and "The base does not know about the layers". The chapter
   states it in §1 through R3 (metadata channels are independent). The
   code breaks it: `viralOnto` returns after the first viral field of
   the first candidate that carries one (`src/metadata.ts:337`–`345`).
   With a user field `taint` registered `viral`, `t + e` carries `taint`
   and loses `error`, and `e + t` the reverse, in both modes (a scratch
   run). Verdict: wrong. The rename makes the name match the Decides
   line, which already says "field"; *channel* is ch8's term (R-P2-16).
   The edge to partial evaluation is misread: R3's rationale is that
   layers compose (`docs/book/concepts.md:186`–`188`), which holds for
   any evaluator. Options: (a) fix it as this decision's change:
   `viralOnto` carries every viral field, the first occurrence per
   field; (b) leave the fix to chapter 8's "How the base applies
   propagation". Recommended: (a), because the change is what makes this
   decision hold (§2.7, item 2); chapter 8's Decides ("the first viral
   field found … is carried") is restated to "the first occurrence of
   each viral field" either way. Changes: `src/metadata.ts`, a test in
   `src/boundary-tests.ts`; no active stream holds either. Default: (a),
   made when R-P2-1 allows.

3. **R-P2-3 — Metadata is a field on every value.** Recommended: keep.
   Inventory: every kind carries an optional `meta` map, and attaching
   yields a new value of the same kind; capability (R33 (the ten type
   calls) let it stand); foundational; depends on R-P2-2 and "Seven
   representation kinds". Chapter: §2. Code: `MetadataBearing`
   (`src/types.ts:52`) is extended by all seven kind interfaces
   (`src/types.ts:58`, `74`, `100`, `140`, `153`, `161`, `233`);
   `withMeta` returns the same kind (`src/types.ts:405`–`420`). Verdict:
   holds. One consequence the chapter omits: metadata on an interned
   Symbol clones it and breaks its identity, with a warning only
   (`src/types.ts:415`, `432`–`441`). The rewritten section states it.
   Changes: none.

4. **R-P2-4 — Metadata fields registered with declared propagation
   rules.** Recommended: restate, to remove its overlap with chapter 8's
   "Each layer registers its own fields": "a field is declared by
   registering a name and one propagation rule; an extension registers
   the fields it needs, and the base fixes no set of fields". Inventory:
   capability; foundational; depends on R-P2-2. Chapter: §3. Code:
   `registerMetaField` (`src/capability.ts:56`–`72`); registrations at
   `src/refinements.ts:41`–`43`, `src/effects.ts:279`,
   `src/types-std.ts:442`, `3504`, `3512`, `src/capability.ts:181`–`195`
   and, from Allegro, `src/primitives.ts:508`. Verdict: holds. Which
   layer registers which field goes to chapter 8 (R-P2-17). Changes:
   none.

5. **R-P2-5 — Metadata origination is capability-controlled.**
   Recommended: (c). Inventory: a field carrying authority is
   unforgeable without its writer; capability; foundational; depends on
   R-P2-2. Chapter: §1, §6. Code: it holds for Allegro code (forgery A,
   D and F, `src/boundary-tests.ts:872`, `898`, `1153`). Host modules
   originate without a writer. `type` is written by `withType` through
   `withMeta` (`src/types-std.ts:64`–`84`) and in place by `writeShape`
   (`src/metadata.ts:226`, 23 call sites outside the unit); `source` by `withSource`
   (`src/metadata.ts:262`), while the writer minted for it is discarded
   (`src/capability.ts:181`). Any module can take any writer from
   `metaFieldEntry(name).writer` (`src/metadata.ts:80`). Only
   `discharged` is written through its writer (`src/types-std.ts:4684`,
   `src/primitives.ts:3807`). Verdict: partly. Options: (a) restate the
   scope: "Allegro code originates a field value only through the
   field's writer; authority is the writer held, not the name; host
   kernel modules are trusted and write through the accessor layer";
   (b) route kernel origination through writers: `withType` and
   `withSource` take their writers, `metaFieldEntry` stops exposing the
   writer and offers a holds-check for `src/scope.ts:121`, and
   `writeShape` needs a writer that stamps in place; cost: about 190 call
   sites (166 of `withType`, 23 of `writeShape`) in `src/types-std.ts`, `src/metadata.ts`, `src/evaluator.ts`,
   `src/scope.ts` and `src/primitives.ts`, the last in `pilot-findings`'
   boundary (R32 (M3 reconciled with the monotonic pass)); (c) (a) now,
   with (b) stated in the section as an open decision. Changes: none for
   (a) or (c). Default: (c).

6. **R-P2-6 — Fixed propagation vocabulary.** Recommended: restate, with
   two code changes: "a field's rule is one of `viral`, `union`,
   `computed`, `drop`; registration refuses any other; an integrity
   field may register only `drop` or `computed`; the base applies the
   rule without knowing the field's meaning, and the semantics a rule
   needs are installed by the field's owner". Inventory: partly built;
   capability; foundational; depends on R-P2-4 and R-P2-5. Chapter: §5.
   Code: `PropagationRule` (`src/metadata.ts:31`); the integrity refusal
   (`src/capability.ts:66`–`68`). Registration never checks the rule,
   and `channel_register` casts the string (`src/primitives.ts:508`):
   `channel_register("x", "nonsense")` registers, and the field acts as
   `drop` (a scratch run). `positional` occurs in `src/` only in the type
   at `src/metadata.ts:31`. Verdict: partly. Options for `positional`:
   (a) remove it; (b) keep it reserved and refuse it at registration;
   (c) keep it as today. Recommended: (a), because a rule with no
   semantics now acts as `drop` and nothing registers it. The integrity
   clause moves here from R-P2-7, its reason. Changes: refuse an unknown
   rule in `registerMetaField` (`src/capability.ts`), drop `positional`
   from `src/metadata.ts:31`, a test in `src/boundary-tests.ts`. The
   refusal covers the Allegro path without editing `src/primitives.ts`.
   No active stream holds these files. Default: (a).

7. **R-P2-7 — Writes gated by a capability, reads free.** Recommended:
   restate, and share one section with R-P2-5: "reading a field needs no
   authority, and neither does propagation". Its origination clause is
   R-P2-5's, and its integrity clause moves to R-P2-6; it then depends
   only on R-P2-5. Inventory: capability; foundational; depends on
   R-P2-5 and R-P2-6. Chapter: §2, §6. Code: `metaReadRaw`
   (`src/metadata.ts:149`) and `channel_read` (`src/primitives.ts:517`)
   demand nothing. Verdict: holds. `readVisibility`
   (`src/metadata.ts:38`–`39`) is set nowhere. Options: (a) state "may a
   field restrict its reads?" as an open decision in the section and
   delete the unused attribute; (b) keep the attribute. Recommended: (a),
   because the attribute changes no behaviour. Changes: delete
   `readVisibility` from `MetaFieldSpec`, a tidy-up that rides in the
   chapter's PR (R32, item 4). Default: (a).

8. **R-P2-8 — Writers are closures: delegable, attenuable,
   unforgeable.** Recommended: restate one clause. Inventory: capability;
   foundational; depends on R-P2-7 and "Host functions as values with
   declared evaluation control". Chapter: §6. Code: the writer is a
   `PrimitiveFunction` closing over the host writer
   (`src/primitives.ts:505`–`515`); attenuation wraps it
   (`src/primitives.ts:529`–`546`); host gates compare by identity
   (`src/capability.ts:86`–`89`). "Identity-equal only" is wrong from
   Allegro: `a == a` on a writer fails with "bits_eq: expected Bits, got
   PrimitiveFunction" in both modes (a scratch run). "Non-serialisable"
   is vacuous: no value serialiser exists, only `symbolToWire`. A writer
   prints as `<primitive:<channel:audit writer>>`. Verdict: partly. New
   Decides: "the writer is a closure returned by registration;
   delegation is passing it, attenuation is wrapping it in a re-checking
   closure; a writer holds no data, prints as its field's name, cannot
   be compared from Allegro, and the host's gates compare it by
   identity". A consequence to state: an Allegro writer cannot install a
   merge, so a user `union` field never merges. Changes: none.

9. **R-P2-9 — No seal operation: constructor trust decomposes.**
   Recommended: keep. Inventory: capability; foundational; depends on
   "Structures immutable by default" and R-P2-7. Chapter: §6. Code: no
   seal primitive exists; the three legs are forgery A (the writer), B
   (immutability, `src/boundary-tests.ts:879`) and C (non-fabricating
   rules, `src/boundary-tests.ts:1164`). Verdict: holds, resting on an
   unenforced leg (B-143). The binding-plane writer stamps in place
   (`src/capability.ts:41`). The section says both. Changes: none;
   B-143 belongs to chapter 6.

10. **R-P2-10 — Metadata supplied at construction, one attachment
    operation.** Recommended: restate to what is built, and share one
    section with R-P2-11. The inventory's status "settled" is wrong:
    partly built. Inventory: implementation; swappable; depends on
    R-P2-3 and "Structures immutable by default". Chapter: §2. Code:
    `makeBits`, `makeInt`, `makeFloat`, `makeSymbol` and `makeExpr` take
    metadata (`src/types.ts:272`, `276`, `280`, `337`, `343`);
    `makePrimitive`, `makeParam`, `makeComposedFn` and `makeStructure`
    do not (`src/types.ts:295`, `305`, `347`, `360`). `carryMeta` shares
    the source's map rather than copying it (`src/metadata.ts:203`–`204`).
    Verdict: partly. Options: (a) restate, with the four factories owed
    to the `types.ts` split; (b) add the parameter now (`src/types.ts`
    and its callers). Recommended: (a), because (b) lands with R-P2-11.
    Changes: none. Default: (a).

11. **R-P2-11 — Metadata slot mixed in from the metadata unit.**
    Recommended: keep, in R-P2-10's section. The inventory's status
    "partly built" is wrong: not built. Inventory: implementation;
    swappable; depends on "Value as a contract …" (chapter 4, unbuilt)
    and R-P2-3. Chapter: §1. Code: the slot is `MetadataBearing` in
    `src/types.ts:52`; `scripts/analyze/units.json:44` maps
    `src/types.ts` to ten units. Changes: the `types.ts` split
    (`docs/book/units.md` §7), its own PR after chapter 4's contract. It
    edits imports across `src/`, `src/primitives.ts` among them, so it
    comes to the maintainer under R32. Default: keep.

12. **R-P2-12 — Symbols serialise by FQN; deserialisation never mints
    reachability.** Recommended: move to "Who can see a member", after
    "Evidence is possession", merged with the wire clause of "Imported
    modules are typed objects whose type encapsulates". Inventory:
    capability; swappable; depends on "Symbol identity is a
    fully-qualified name" and R-P2-8. Its unit is `symbol`
    (`scripts/analyze/units.json:46`), not either of this chapter's. Its
    edge to R-P2-8 is misread: the wire rule protects reachability,
    which is D42 (evidence is possession), and touches writers only in
    forgery E's third route (`src/boundary-tests.ts:798`–`803`). Code:
    `symbolToWire` and `symbolFromWire` (`src/symbols.ts:180`–`199`).
    Verdict: holds; only tests call them. Changes: none. Default: move.

13. **R-P2-13 — One-shot field registration with a pass epoch.**
    Recommended: keep, and correct two comments. Inventory: capability;
    swappable; depends on R-P2-8. Chapter: §3. Code:
    `src/capability.ts:56`–`72`; the epoch bump at
    `src/runtime.ts:1191`; kernel fields at epoch −1
    (`src/capability.ts:70`). Re-issue checks the name, the rule and the
    pass (`src/capability.ts:61`), not the registration site. The
    comment at `src/capability.ts:59`–`60` and the demo's comment
    (`tests/metadata-channels-demo.alg:41`–`42`) say "the same
    registration site", while the demo re-registers at a second site
    (line 44, against line 10). Verdict: holds as the inventory states
    it. Three probes in which a library's code registered a field the
    program held were refused; I did not establish whether the epoch or
    load order refused them. Options: (a) keep any-caller re-issue
    within a pass and fix both comments; (b) key re-issue by site; cost:
    `src/capability.ts`, `src/primitives.ts` and the pinned demo, both
    of the latter in `pilot-findings`' boundary. Recommended: (a),
    because one pass is one program's evaluation. Changes: the
    `src/capability.ts` comment rides as a tidy-up; the demo comment is
    in `tests/**`, so it comes to the maintainer under R32. Default: (a).

14. **R-P2-14 — Capability denial is an abort, not an error value.**
    Recommended: keep, and define *abort* here, its first use. Inventory:
    capability; swappable; depends on R-P2-7. Chapter: §6. Code: every
    refusal throws `AllegroError` (`src/capability.ts:64`, `67`, `98`,
    `110`, `121`, `133`, `146`, `224`; `src/primitives.ts:533`, `538`).
    A rejected attenuated write and a re-registration halt the program
    before its next line (scratch runs). Verdict: holds. SC-8 (specified
    aborts) says nothing in `src/` catches the class; catch-alls do
    during precompile and inference (`src/runtime.ts:776`,
    `src/evaluator.ts:1240`, `src/primitives.ts:2022`, `2271`), where a
    denial is recorded or swallowed before the program's own run halts.
    Changes: none.

15. **R-P2-15 — The chapter's name and file.** Options: (a) keep the
    path, retitle the chapter "Metadata and the capability to write
    it", and give chapter 8 its own new file when the pass takes it;
    (b) move the file. Recommended: (a), because two code comments cite
    the path (`src/test/language.ts:649`–`650`,
    `tests/metadata-channels-demo.alg:2`) and five documents link its
    anchors; a move would send the comments to B-182 (unit tidy-ups from
    the book pass) under stop condition 4. Default: (a).

16. **R-P2-16 — Definition sites.** Options: (a) *metadata field* stays,
    defined in R-P2-2's section without "plane", since "Four planes" is
    chapter 9; *propagation* stays, in R-P2-6's section; *writer
    capability* moves from §6 to R-P2-5's section, its first use;
    *channel* moves to chapter 8's "Field versus channel, and channel
    registration", where its meaning is decided; *integrity field*,
    *fabricating rule*, *attenuation* and *abort* are defined here; (b)
    keep the four sites as they are. Recommended: (a), by principle 10.
    The *channel* move is a stop-3 case: `docs/book/architecture-vocabulary.md:76`–`77`,
    earlier in the order, links `#def-channel` by pointer. Default: (a).

17. **R-P2-17 — Content that leaves the chapter.** Recommended: §3's
    ownership table, §4, §5's application half, the base's fields of
    §8 and the error and `drop` examples go to chapter 8; §7 (installs)
    goes to chapter 10 ("Installing a layer into the base"); §9's file
    map leaves the narrative (principle 9), its rows becoming as
    implemented blocks; the Authority note's ids leave the prose
    (principle 11). The pinned demo stays, quoted by both chapters.
    Default: as recommended.

18. **R-P2-18 — Designation and count.** Recommended: normative and
    rendered, the IR (`metadata-and-capability.ir.md`) written first; no
    stranger count runs, since R22 (structure and correctness first)
    defers counts. Default: as recommended.

19. **R-P2-19 — Ratify or strike each term under *Terms introduced*.**
    Default: ratify all five.

## What is already covered

The chapter encodes these settled decisions: D2 (annotation channels
are extensible), D21 (no separate seal primitive), D23 (channel writes
are capability-gated, reads free), D24 (the capability is a delegable
closure), D48(b)(c) (metadata on every kind, supplied at construction),
D51 (`Value` as a contract, kind units and an assembly), D42 (evidence
is possession) for the wire rule, and R33's type for "Metadata is a field
on every value". R24 (the pilot) chose this chapter. The four definition
sites were set by D52 (the documentation book). Not covered: the
restatements in R-P2-2 and R-P2-4 to R-P2-8, the moves of R-P2-12,
R-P2-16 and R-P2-17, and the code changes of R-P2-2 and R-P2-6.

## What changed

### 1. The chapter against the code

| # | The chapter says | The code does | Pointer | Verdict |
|---|---|---|---|---|
| 1 | `viral`: "present on any argument, present on the result" (§5) | carries only the first viral field found; a second is lost, `error` included | `src/metadata.ts:337`–`345` | wrong |
| 2 | the base applies the rule from a fixed vocabulary (§5) | any rule string registers | `src/capability.ts:56`–`72`, `src/primitives.ts:508` | wrong |
| 3 | `viral` carries the field onto the result (§5) | an application with a viral argument is not computed: `print(t + 1)` prints nothing for a user viral `t` | `src/evaluator.ts:745`–`746` | stale (chapter 8) |
| 4 | origination is refused without the writer (§6) | holds for Allegro; host modules write `type` and `source` directly | `src/types-std.ts:64`–`84`, `src/metadata.ts:226`, `262` | partly |
| 5 | `kernelFieldWriter`'s lint admits `src/types-std.ts` and `src/primitives.ts` (§6) | it also admits `src/runtime.ts` | `src/boundary-tests.ts:142` | stale |
| 6 | writers are identity-equal only (§6) | Allegro cannot compare them | a scratch run | wrong |
| 7 | the factories take metadata (§2) | four of nine do not | `src/types.ts:295`, `305`, `347`, `360` | partly |
| 8 | `withMeta` is in `src/types.ts`, owed to the split (§1, §9) | as stated | `src/types.ts:405` | holds |
| 9 | the one in-place case is `writeShape` (§2) | `removeShapeSlot` also deletes in place | `src/metadata.ts:231` | partly |
| 10 | the battery pins the ownership table (§3) | it pins names and integrity flags; the owner strings are never compared | `src/boundary-tests.ts:924`–`936` | partly |
| 11 | forgery scenarios A to G (§6) | the roster is A to F; G is a separate test | `src/boundary-tests.ts:587`–`594`, `1109` | holds |
| 12 | dispatch, check and projection installs are owed by B-112 (§7 Delta) | all three are installed | `src/capability.ts:108`–`136` | stale |
| 13 | M11 is open and B-112's chunks replace the sites (§5 Delta) | `docs/book/units.md:401` records M11 closed | `docs/book/units.md:401` | stale |
| 14 | `discharged` is registered by `src/types-std.ts` (§3) | as stated; the capability unit's comment says `src/proofs.ts` | `src/types-std.ts:442`, `src/capability.ts:166` | holds |
| 15 | the pinned examples (§2, §3, §5, §6) | each line is in the demo and pinned | `tests/metadata-channels-demo.alg:10`–`75` | holds |
| 16 | the epoch is bumped at each `evalSource` pass (§3) | as stated | `src/runtime.ts:1191` | holds |

### 2. Links and references

- Line 25: the status tags of `../README.md` give way to decision
  sections; the tags leave.
- Lines 10 to 14, 22 to 23, 32 to 35, 53: links into
  `docs/book/concepts.md` (R3, R12 (metadata origination is
  capability-controlled), R6 (the base does not know about the layers),
  plane, residual) become links to the chapters that take those
  decisions.
- Line 234: the rationale cites `docs/records/concepts-analyses.md`
  §4.2, a record. Principle 3 asks for an experiment in the book: the
  refusal of a fabricating rule, run.
- Line 284: M11 (the evaluator holds type-system activities) is closed;
  the bullet is stale (§1, row 13).
- Line 318: three files, not two (§1, row 5).
- `docs/book/units.md:236` names `viralScan` in `src/evaluator.ts`; it is
  `viralOnto` in `src/metadata.ts:331`, beside `mergeOverMeta`
  (`src/metadata.ts:359`). A fix for chapter F8 (`units.md`).
- `docs/book/allegretto/structures.md:243`–`247` gives
  `channel_register(symbol, rule, read_visibility?)` and
  `channel_read(symbol, value)`; the code takes `(name, rule)` and
  `(value, name)` (`src/primitives.ts:505`–`520`). For chapter 6.

### 3. Terms and definition sites

As R-P2-16 (a). Rows for `docs/book-changes.md`: *writer capability*,
§6 to the origination section; *channel*, to chapter 8; *metadata
field*, §3 to the independence section; *propagation*, §5 to the
vocabulary section. Linkers to re-point: `docs/book/allegretto/evaluator.md:19`–`22`,
`docs/book/allegretto/evaluator.ir.md:56`–`62`,
`docs/book/platform/build-pipeline.ir.md:57`–`61`,
`docs/book/architecture-vocabulary.md:75`–`80`. The pointer stubs at
`docs/book/concepts.md:1356`–`1374` follow. *Plane* is used in §2's
heading and §3's definition before chapter 9 decides it; the rewrite
drops it.

### 4. Designation, rendering and count

Normative and rendered, IR first. No count (R22; R5 (when a
stranger-round count runs) deferred).

### 5. Restructuring

The chapter rewritten as decision sections, in inventory order:

1. Metadata fields are independent (R-P2-2).
2. Metadata is a field on every value (R-P2-3).
3. Fields registered with a propagation rule (R-P2-4).
4. Origination needs the writer; reads and propagation are free (R-P2-5
   with R-P2-7).
5. A fixed propagation vocabulary (R-P2-6).
6. Writers are closures (R-P2-8).
7. Trust without a seal (R-P2-9).
8. Building the metadata slot (R-P2-10 with R-P2-11).
9. One-shot registration (R-P2-13).
10. Denial aborts (R-P2-14).

R-P2-12 leaves. Sections 4 and 5 swap if the maintainer keeps the
integrity clause in R-P2-7.

### 6. Tidy-ups found

| # | Unit | File | What |
|---|---|---|---|
| 1 | capability | `src/capability.ts:166` | the comment says `discharged` moved to `src/proofs.ts`; it is registered at `src/types-std.ts:442` |
| 2 | capability | `src/capability.ts:59`–`60` | "the same registration site": re-issue is per pass and rule (R-P2-13) |
| 3 | metadata | `src/metadata.ts:38`–`39` | `readVisibility`, set nowhere (R-P2-7) |
| 4 | evaluator | `src/evaluator.ts:740`, `864` | "see viralScan" names a function that no longer exists |
| 5 | type-core | `src/types-std.ts:442`–`448` | registers `discharged`, discards the writer, then fetches it by name |

Rows 1 to 3 ride in the chapter's PR (R32, item 4); rows 4 and 5 go to
B-182.

### 7. Other findings

No spare backlog id is left; each is named for the maintainer to file.

1. **A second viral field erases the first** (R-P2-2), `src/metadata.ts:337`.
2. **Unknown propagation rules register** (R-P2-6), `src/capability.ts:56`.
3. **A user `viral` field stops computation.** `print(t + 1)` prints
   nothing when `t` carries a user viral field
   (`src/evaluator.ts:745`–`746`). For chapter 8.
4. **The ownership test does not check owners**
   (`src/boundary-tests.ts:924`–`936`). For chapter 8.
5. **Stale decision entries.** D10 (functions return annotated values), D15 (the flattened wrapper) and D17 (no data slots beside a `primary` channel) are still "accepted
   (executed)" after D48(b) retired the carrier; D48(c) still names
   four operations. For `docs/decisions.md`.

### 8. Headings and phrasing

Under R22, patterns only. Headings name the section's shape in §1 ("The
two units and the line between them") and §9 ("Where the code is, and
what pins it"). The Authority note buries the lede: it lists ids before
the reader knows what the chapter decides. Bold labels open every block
(**Definition.**, **Rationale.**, **As implemented.**, **Delta.**), 18
times. Contrast framing ("rather than", "not X"), on 17 lines: "not a
wrapper around a `Bits`", "is not cosmetic", "fixed rather than open".

## Terms introduced

- **Dry run**: a chapter taken through review, rulings, IR and prose
  with no code change and no approval.
- **Integrity field**: a field registered with `integrity`, whose
  origination requires its writer and whose rule may not fabricate.
- **Fabricating rule**: a propagation rule that places a field value on
  a result that no writer put there, `viral` or `union`.
- **Attenuation**: wrapping a writer in a closure that checks each write
  before passing it on.
- **Abort**: a refusal that stops the program's evaluation with no
  value returned.

## Rulings taken

Added by one commit before the merge.
