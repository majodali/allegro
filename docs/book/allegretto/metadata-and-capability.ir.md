# IR: Metadata and the capability to write it

Reader: RD-4
Purpose: document. The book's chapter on the `metadata` and `capability` units, written as decision sections: what a value carries about itself, who may write it, how rules are declared, and how refusal works.
Status: draft (a dry run under ruling R-P2-1 (b); claims and terms ratified 2026-11-08 on PR #174; not approved until the pass reaches the chapter in order; unratified terms 0)
Source: chunk P2 of docs/plans/book-pass.md (the book pass, B-174), a dry run under ruling R-P2-1 (b) of docs/records/book-pass/p2-allegretto-metadata-and-capability.md; src/metadata.ts and src/capability.ts, with the channel primitives of src/primitives.ts and the metadata slot of src/types.ts
Normative: yes
Footprint: docs/book/allegretto/metadata-and-capability.ir.md; docs/book/allegretto/metadata-and-capability.md; docs/book-changes.md; docs/documentation-census.md; docs/reading-order.json; docs/book/README.md

## Terms

T1. Value. defined-at: ../concepts.md#def-value [decided: docs/book/concepts.md §1]

T2. Representation kind. defined-at: ../concepts.md#def-representation-kind [decided: docs/book/concepts.md §2]

T3. Symbol. defined-at: ../concepts.md#def-symbol [decided: docs/book/concepts.md §4]

T4. Expression. defined-at: ../concepts.md#def-expression [decided: docs/book/concepts.md §6]

T5. Primitive function. defined-at: ../concepts.md#def-primitivefunction [decided: docs/book/concepts.md §8]

T6. Structure. defined-at: ../concepts.md#def-structure [decided: docs/book/concepts.md §9]

T7. Binding. defined-at: ../concepts.md#def-binding [decided: docs/book/concepts.md §13]

T8. Partial evaluation. defined-at: ../concepts.md#def-partial-evaluation [decided: docs/book/concepts.md §25]

T9. Residual. defined-at: ../concepts.md#def-resolved-unresolved-residual [decided: docs/book/concepts.md §26]

T10. Unit. defined-at: ../units.md#def-unit [decided: D50]

T11. Layer. defined-at: ../layers.md#def-layer [decided: docs/book/layers.md §1]

T12. Precompile. defined-at: ../layers.md#def-precompile [decided: docs/book/layers.md §2]

T13. Decision section. defined-at: ../preface.md#def-decision-section [decided: owner, 2026-11-03]

T14. Swappable decision. defined-at: ../preface.md#def-swappable-decision [decided: owner, 2026-11-03]

T15. Foundational decision. defined-at: ../preface.md#def-foundational-decision [decided: owner, 2026-11-03]

T16. Open decision. defined-at: ../preface.md#def-open-decision [decided: owner, 2026-11-03]

T17. The base does not know about the layers. defined-at: ../concepts.md#def-r6 [decided: docs/book/concepts.md R6]

T18. Metadata field: A named piece of information that a value may carry about itself, declared by registering the name with one propagation rule. anchor: #def-metadata-field [decided: owner, 2026-11-08]

T19. Writer capability: The closure, returned by a field's registration, that originates a value of the field on a value. anchor: #def-writer-capability [decided: owner, 2026-11-08]

T20. Integrity field: A field registered with `integrity`, whose origination requires the field's writer and whose rule may not fabricate. anchor: #def-integrity-field [decided: owner, 2026-11-07]

T21. Propagation: What an operation does with the metadata fields of the operation's operands when the operation produces a result, as each field's rule says. anchor: #def-propagation [decided: owner, 2026-11-08]

T22. Fabricating rule: A propagation rule that places a field value on a result where no writer put the value: `viral` or `union`. anchor: #def-fabricating-rule [decided: owner, 2026-11-07]

T23. Attenuation: Wrapping a writer in a closure that checks each write before passing the write on. anchor: #def-attenuation [decided: owner, 2026-11-07]

T24. Abort: A refusal that stops the program's evaluation with no value returned. anchor: #def-abort [decided: owner, 2026-11-07]

T25. Channel: The apparatus by which one capability of the language rides values through partial evaluation: one or more metadata fields, the fields' rules, the fields' writers and the layer code that interprets the fields. anchor: #def-channel [decided: D52]

## Claims

### Reader and authority

C1. This chapter is the design truth for two units, `metadata` and `capability`. [decided: docs/reading-order.json]

C2. The reader knows values, representation kinds, Structures, bindings, residuals and partial evaluation from earlier chapters. [decided: owner, 2026-11-08]

C3. The chapter presents ten decisions about metadata in dependency order, each in a decision section. [decided: owner, 2026-11-07]

C4. The chapter executes five decisions of the register: annotation fields are extensible; writes are gated while reads are free; the capability is a delegable closure; trust needs no seal; metadata rides every kind. [decided: docs/decisions.md D2, D21, D23, D24, D48]

C5. The examples are verbatim excerpts of `tests/metadata-channels-demo.alg`, which the suite runs against the demo's `// expect:` lines. evidence: E35. [decided: owner, 2026-11-08]

C6. A final section holds the content of two chapters not yet written, on how metadata propagates and on installing a layer into the base. [decided: owner, 2026-11-07]

### Metadata fields are independent

C7. Each metadata field is handled by its own declaration, independently of every other field. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C8. No operation may disturb a metadata field the operation does not know about. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C9. The independence of metadata fields is a foundational decision about language capability. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C10. A **metadata field** is a named piece of information that a value may carry about itself, such as the value's type, an error, or a proof's discharge. [decided: owner, 2026-11-08]

C11. The problem is how many layers can each attach information to values without every operation knowing about every layer. [decided: owner, 2026-11-08]

C12. Without independence, every layer would thread the layer's own information through every operation by hand. [decided: docs/book/concepts.md R3]

C13. Layers compose only when an operation's treatment of one field does not depend on which other fields a value carries. [decided: docs/book/concepts.md R3]

C14. The independence rests on the decision that the base does not know about the layers. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C15. Statements saying only which fields survive an operation were the alternative, and were merged into this decision. [decided: docs/book/concepts.md R3]

C16. A survival-only statement cannot say what matters under a `drop` rule: no operation may drop a field the operation has never heard of. [decided: docs/book/concepts.md R3]

C17. The reason for independence, that layers compose, holds for any evaluator, partial or not. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C18. A layer can register a new field without a change to any operation of the base. evidence: E1. [decided: owner, 2026-11-08]

C19. Where a value's fields are stored is a separate decision, the next one in this chapter. [decided: docs/book/concepts.md R3]

C20. The `metadata` unit, in `src/metadata.ts`, holds the field registry and the generic propagation code that serves every field alike. evidence: E2, E1, E37. [decided: owner, 2026-11-08]

C21. `viralOnto` in `src/metadata.ts` carries only the first viral field found, on the first candidate value that carries one. evidence: E1. [decided: owner, 2026-11-08]

C22. A user field registered `viral` therefore erases `error` from a result whose earlier operand carries the user field. evidence: E1. [decided: owner, 2026-11-08]

C23. The decision requires `viralOnto` to carry every viral field, each field at the field's first occurrence. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C24. To try another independence rule, change the propagation functions in `src/metadata.ts`, through which every field's propagation passes. evidence: E1, E37. [decided: owner, 2026-11-08]

### Metadata is a field on every value

C25. Every representation kind carries an optional metadata map, so a typed `42` is a Bits value with a `type` field. [decided: R-P2-3 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C26. Attaching metadata to a value yields a new value of the original value's kind. [decided: R-P2-3 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C27. The field on every kind is a foundational decision about language capability, since every metadata read, every write and every residual's propagated fields rest on the field. [decided: R-P2-3 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C28. The problem is where a value's metadata lives, given that metadata belongs to one occurrence of a value. [decided: owner, 2026-11-08]

C29. One option wraps a non-composite value in a transparent carrier Structure that holds the fields. [decided: docs/decisions.md D48]

C30. A carrier is a second value, so every operation must tell the carrier from the value the carrier wraps. [decided: owner, 2026-11-08]

C31. A side table keyed by the host object fails, because one object can occur at two positions with different metadata. evidence: E44. [decided: owner, 2026-11-08]

C32. The field on every kind was taken because metadata then rides each occurrence of a value with no wrapper to see through. [decided: owner, 2026-11-08]

C33. Attaching metadata to an interned Symbol clones the Symbol, which breaks the Symbol's identity by fully-qualified name. evidence: E4. [decided: R-P2-3 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C34. The host warns when metadata is attached to an interned Symbol, without refusing the attachment. evidence: E4. [decided: owner, 2026-11-08]

C35. `MetadataBearing` in `src/types.ts` declares the optional `meta` slot, and all seven kind interfaces extend `MetadataBearing`. evidence: E3. [decided: owner, 2026-11-08]

C36. `withMeta` in `src/types.ts` returns a new value of the input's kind, deriving a Structure and cloning every other kind. evidence: E4. [decided: owner, 2026-11-08]

C37. A value that carries nothing leaves the slot undefined, so plain values pay nothing. evidence: E12. [decided: owner, 2026-11-08]

C38. Replacing the slot with another storage changes `withMeta`, the free reads in `src/metadata.ts` and every factory that takes metadata. evidence: E4, E12, E23. [decided: owner, 2026-11-08]

### A field is a name and one propagation rule

C39. A field is declared by registering a name and one propagation rule. [decided: R-P2-4 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C40. An extension registers the fields the extension needs, and the base fixes no set of fields. [decided: R-P2-4 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C41. Registration by extensions is a foundational decision about language capability, since every field registers this way. [decided: R-P2-4 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C42. The problem is who decides which fields exist. [decided: owner, 2026-11-08]

C43. A fixed set of annotation fields in the base was the alternative. [decided: docs/decisions.md D2]

C44. A fixed set would have the base know which layers exist, which the decision that the base does not know about the layers forbids. [decided: owner, 2026-11-08]

C45. `registerMetaField` in `src/capability.ts` takes a specification holding a name, a rule and an optional integrity flag. evidence: E5, E2. [decided: owner, 2026-11-08]

C46. `MetaFieldSpec` in `src/metadata.ts` also holds an optional binding key, for the one field stored among a Structure's bindings. evidence: E2. [decided: owner, 2026-11-08]

C47. Registrations sit in the modules that own the fields: `src/capability.ts`, `src/types-std.ts`, `src/effects.ts`, `src/refinements.ts`, and `channel_register` in `src/primitives.ts` for Allegro code. evidence: E6. [decided: owner, 2026-11-08]

C48. Another registration surface, such as one registration for a group of fields, replaces `registerMetaField` and the calls of `registerMetaField`. evidence: E5, E6. [decided: owner, 2026-11-08]

### Originating a field value needs the writer; reading and propagating need nothing

C49. Allegro code originates a field value only through the field's writer. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C50. Authority is the writer held, not the field's name. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C51. Host kernel modules are trusted, and write fields through the accessor layer. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C52. Reading a field needs no authority, and neither does propagation. [decided: R-P2-7 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C53. The origination rule and the free reads are foundational decisions about language capability. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C54. A **writer capability**, or writer, is the closure, returned by a field's registration, that originates a value of the field on a value. [decided: owner, 2026-11-08]

C55. An **integrity field** is a field registered with `integrity`, whose origination requires the field's writer and whose rule may not fabricate. [decided: R-P2-19 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C56. The problem is how a field can carry authority, such as a proof's discharge, when any code can name the field. [decided: owner, 2026-11-08]

C57. Metadata that anything can write cannot be evidence. [decided: docs/book/concepts.md R12]

C58. Introspection and the prover protocol need every field readable by any code. [decided: owner, 2026-11-08]

C59. Which fields need protection is a layer's decision, so the base must not list the protected fields. [decided: docs/book/concepts.md R12]

C60. Carrying trust by a field's name fails, because any code that names the field could then counterfeit the field's values. [decided: docs/book/concepts.md R12]

C61. Authority carried by holding the writer closure needs no list of protected fields. [decided: docs/book/concepts.md R12]

C62. A proof's `discharged` field is evidence, because only the holder of the field's writer can originate the field. evidence: E18, E19. [decided: owner, 2026-11-08]

C63. The battery in `src/boundary-tests.ts` refuses Allegro code that originates `discharged` without the writer, by an object literal or by re-registration. evidence: E19. [decided: owner, 2026-11-08]

C64. A free read cannot become a write: a writer for one field cannot reach `discharged`. evidence: E19. [decided: owner, 2026-11-08]

C65. `metaReadRaw` in `src/metadata.ts` and `channel_read` in `src/primitives.ts` read a field without demanding anything of the caller. evidence: E12. [decided: owner, 2026-11-08]

C66. `assertNotIntegrityKey` in `src/capability.ts` refuses, on user-reachable construction paths, the binding keys under which integrity fields are stored. evidence: E45. [decided: owner, 2026-11-08]

C224. The first example in `tests/metadata-channels-demo.alg` registers a field named `audit`, writes the field on `42` and reads the field back with no authority. evidence: E28. [decided: owner, 2026-11-08]

C67. `withType` in `src/types-std.ts` writes `type` through `withMeta`, without the `type` writer. evidence: E14. [decided: owner, 2026-11-08]

C68. `writeShape` in `src/metadata.ts` writes `type` in place, from 23 call sites outside the `metadata` unit. evidence: E15. [decided: owner, 2026-11-08]

C69. `withSource` in `src/metadata.ts` writes `source` without a writer, while the writer minted for `source` is discarded at registration. evidence: E16. [decided: owner, 2026-11-08]

C70. Any module can take any field's writer from `metaFieldEntry` in `src/metadata.ts`. evidence: E17. [decided: owner, 2026-11-08]

C71. Only `discharged` is written through the field's writer, in `makeProof` in `src/types-std.ts` and in a failed proof's construction in `src/primitives.ts`. evidence: E18. [decided: owner, 2026-11-08]

C72. A boundary lint admits calls of `kernelFieldWriter`, the kernel's acquisition path in `src/capability.ts`, only in `src/types-std.ts`, `src/primitives.ts` and `src/runtime.ts`. evidence: E41. [decided: owner, 2026-11-08]

C73. Whether kernel origination should also go through writers is an open decision. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C74. Routing kernel origination through writers has `withType` and `withSource` take their writers, with `metaFieldEntry` offering a check of possession instead of the writer. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C75. Routing kernel origination through writers also needs a writer for `writeShape` that stamps in place. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C76. The cost of routing kernel origination through writers is about 190 call sites, most of them calls of `withType`, in five source files. [decided: R-P2-5 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C77. Whether a field may restrict the field's reads is an open decision. [decided: R-P2-7 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C78. `readVisibility` on `MetaFieldSpec` in `src/metadata.ts` records a read policy that no code sets or enforces. evidence: E13. [decided: owner, 2026-11-08]

C79. To contribute an option to either open decision, branch `src/capability.ts` and `src/metadata.ts`, where registration, writers and reads live. evidence: E5, E12. [decided: owner, 2026-11-08]

### A fixed vocabulary of propagation rules

C80. A field's rule is one of four: `viral`, `union`, `computed` and `drop`. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C81. Registration refuses any rule outside the four rules of the vocabulary. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C82. An integrity field may register only `drop` or `computed`. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C83. The base applies a field's rule without knowing the field's meaning. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C84. The semantics a rule needs, such as the merge for `union`, are installed by the field's owner. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C85. The vocabulary is a foundational decision about language capability. [decided: R-P2-6 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C86. **Propagation** is what an operation does with the metadata fields of the operation's operands when the operation produces a result, as each field's rule says. [decided: owner, 2026-11-08]

C87. Under `viral`, a result carries the field when any operand carries the field, each viral field at the field's first occurrence. [decided: R-P2-2 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C88. Under `union`, the operands' values of the field are combined by the merge the field's owner installed. [decided: docs/decisions.md D2]

C89. Under `computed`, the field's owner derives the field at the sites the owner annotates. [decided: docs/decisions.md D2]

C90. Under `drop`, a derived value never carries the field. [decided: docs/decisions.md D2]

C91. A **fabricating rule** is a propagation rule that places a field value on a result where no writer put the value: `viral` or `union`. [decided: R-P2-19 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C92. The problem is how a field declares what operations do with the field, in a form the base can check. [decided: owner, 2026-11-08]

C93. Arbitrary propagation closures, one per field, were the alternative. [decided: docs/book/concepts.md SC-7]

C94. A closure is not inspectable, so registration could not refuse a fabricating closure on an integrity field. [decided: docs/book/concepts.md SC-7]

C95. Over a fixed vocabulary, refusing a fabricating rule is a check of one rule name against two names. evidence: E7. [decided: owner, 2026-11-08]

C96. A discipline the vocabulary cannot express extends the vocabulary instead of opening the vocabulary to closures. [decided: owner, 2026-11-08]

C97. In the battery's forgery scenario C, registering an integrity field with `viral` is refused. evidence: E21. [decided: owner, 2026-11-08]

C98. The command `ALLEGRO_TEST_FILTER="forgery C" npm test` runs the scenario C experiment again. evidence: E21. [decided: owner, 2026-11-08]

C99. The integrity check stays decidable whatever fields the layers register. [decided: owner, 2026-11-08]

C100. `registerMetaField` in `src/capability.ts` refuses a fabricating rule on an integrity field. evidence: E7. [decided: owner, 2026-11-08]

C101. `registerMetaField` does not check that a rule belongs to the vocabulary. evidence: E5. [decided: owner, 2026-11-08]

C102. `channel_register` in `src/primitives.ts` passes the rule string through unchecked, so `channel_register("x", "nonsense")` registers a field that behaves as `drop`. evidence: E9, E1, E37. [decided: owner, 2026-11-08]

C103. `PropagationRule` in `src/metadata.ts` still lists a fifth rule, `positional`, that no field registers and no code applies. evidence: E8. [decided: owner, 2026-11-08]

C104. To try an open vocabulary, accept a closure in `MetaFieldSpec` and apply the closure where `viralOnto` and `mergeOverMeta` apply the rules. evidence: E2, E1, E37. [decided: owner, 2026-11-08]

### A writer is a closure

C105. A writer is a closure returned by registration. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C106. Delegation is passing the writer, and attenuation is wrapping the writer in a re-checking closure. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C107. A writer holds no data, prints as the writer's field's name, and cannot be compared from Allegro. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C108. The host's gates compare writers by identity. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C109. The writer's shape is a foundational decision about language capability, since every gated install checks a writer's identity. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C110. **Attenuation** is wrapping a writer in a closure that checks each write before passing the write on. [decided: R-P2-19 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C111. The problem is what form the authority to write a field takes. [decided: owner, 2026-11-08]

C112. Authority ambient in a scope was rejected, because ambient authority is recoverable from tokens as a usage pattern, while a move from ambient authority to tokens would break programs. [decided: docs/decisions.md D24]

C113. A separate `channel_write` primitive was rejected, because the writer is the write operation. [decided: docs/decisions.md D24]

C114. A writer as a value can be tracked through partial evaluation like any other value. [decided: owner, 2026-11-08]

C115. An Allegro writer cannot install a merge, so a user `union` field never merges. evidence: E39, E9. [decided: R-P2-8 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C116. Module-private authority is a usage pattern: a module keeps the writer in a private binding and never exports the writer. evidence: E42. [decided: owner, 2026-11-08]

C117. `channel_register` in `src/primitives.ts` returns the writer as a primitive function that closes over the host writer, branded with the field's name. evidence: E9. [decided: owner, 2026-11-08]

C118. A writer for a field named `audit` prints as `<primitive:<channel:audit writer>>`. evidence: E9. [decided: owner, 2026-11-08]

C119. `channel_attenuate` in `src/primitives.ts` wraps a held writer in a closure that evaluates a predicate on the field value before writing. evidence: E10. [decided: owner, 2026-11-08]

C120. `channel_attenuate` refuses a first argument that carries no writer's brand. evidence: E10, E19. [decided: owner, 2026-11-08]

C121. Comparing two writers with `==` from Allegro fails, because equality expects Bits values. evidence: E50. [decided: owner, 2026-11-08]

C122. `holdsWriterFor` in `src/capability.ts` compares a writer with the registered writer by identity. evidence: E11. [decided: owner, 2026-11-08]

C123. The battery in `src/boundary-tests.ts` finds a module-private writer unreachable through every export surface. evidence: E42. [decided: owner, 2026-11-08]

C124. The attenuation example in `tests/metadata-channels-demo.alg` writes through a writer that admits only `"ok"`. evidence: E29. [decided: owner, 2026-11-08]

C125. To try another shape for authority, replace `buildWriter` in `src/capability.ts` and the writer primitives in `src/primitives.ts`. evidence: E22, E9, E10. [decided: owner, 2026-11-08]

### Trust without a seal

C126. No seal primitive or per-value brand marks a value as trusted. [decided: docs/decisions.md D21]

C127. Trust in a constructed value decomposes into three legs: write authority over the value's integrity field, immutability of the value's data, and a non-fabricating rule. [decided: docs/decisions.md D21]

C128. Trust in a constructed value is global and structural. [decided: docs/decisions.md D21]

C129. Trust without a seal is a foundational decision about language capability. [decided: R-P2-9 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C130. The problem is how a reader of a value knows the value came from a trusted constructor. [decided: owner, 2026-11-08]

C131. A `seal` operation was superseded, because the operation was only ever conceptual. [decided: docs/decisions.md D13]

C132. A provenance tag on each value was rejected. [decided: docs/decisions.md D21]

C133. Each of the three legs is needed for the leg's own reason, so a seal would duplicate what the legs already give. [decided: owner, 2026-11-08]

C134. A value carrying `discharged` is trustworthy for three reasons: no code without the writer originated the field; the data under the field is immutable; `drop` never fabricates the field. [decided: docs/decisions.md D21]

C135. Forgery scenarios A, B and C in `src/boundary-tests.ts` test the three legs: the writer, immutability, and the non-fabricating rule. evidence: E19, E20, E21. [decided: owner, 2026-11-08]

C136. The immutability leg is declared, not enforced: no check stops an in-place write after a value escapes. evidence: E44. [decided: owner, 2026-11-08]

C137. The writer for `discharged`, the one field stored among a Structure's bindings, stamps the field in place on a fresh kernel value. evidence: E22, E18. [decided: owner, 2026-11-08]

C138. To try a seal, add a sealing primitive to `src/capability.ts` and a check of the seal where `discharged` is read. evidence: E5, E12. [decided: owner, 2026-11-08]

### Metadata supplied at construction, in a slot the metadata unit owns

C139. Factories take an optional metadata argument, so a value never exists without what the value must carry. [decided: R-P2-10 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C140. `withMeta` is the one attachment operation. [decided: docs/decisions.md D48]

C141. `carryMeta` moves metadata onto a value derived from the source value. [decided: docs/decisions.md D48]

C142. The `meta` slot is not part of the contract every value meets: the `metadata` unit adds the slot to every kind, and no kind unit reads the slot. [decided: R-P2-11 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C143. The construction surface and the slot's placement are swappable decisions about implementation. [decided: R-P2-10 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C144. The problem is when metadata reaches a value, and which unit owns the slot that holds the metadata. [decided: owner, 2026-11-08]

C145. Constructing a value and then attaching metadata is the alternative, in which the value exists for a moment without the value's metadata. [decided: owner, 2026-11-08]

C146. Four named operations, create, derive, map and stamp, are a second alternative to one operation with two conveniences. [decided: owner, 2026-11-08]

C147. Supplying metadata at construction saves one allocation on the residual path of PE Rule 1. [decided: owner, 2026-11-08]

C148. Writing the slot in place is permitted only while the value is provably unshared, during construction and before the value escapes. evidence: E44. [decided: owner, 2026-11-08]

C149. `makeBits`, `makeInt`, `makeFloat`, `makeSymbol` and `makeExpr` in `src/types.ts` take metadata. evidence: E23. [decided: owner, 2026-11-08]

C150. `makePrimitive`, `makeParam`, `makeComposedFn` and `makeStructure` in `src/types.ts` take no metadata. evidence: E23. [decided: owner, 2026-11-08]

C151. `carryMeta` in `src/metadata.ts` shares the source value's map with the derived value, without copying the map. evidence: E24. [decided: owner, 2026-11-08]

C152. `writeShape` and `removeShapeSlot` in `src/metadata.ts` change a type's `type` field in place, on type Structures minted and not yet escaped. evidence: E15. [decided: owner, 2026-11-08]

C153. The slot is not yet mixed in: `MetadataBearing` and `withMeta` are declared in `src/types.ts`, which the unit manifest maps to ten units. evidence: E3, E25. [decided: owner, 2026-11-08]

C154. Splitting `src/types.ts` along the unit manifest moves the slot and `withMeta` into the `metadata` unit. evidence: E25. [decided: owner, 2026-11-08]

### Registration is one-shot within a pass

C155. The first registrant of a field receives the field's writer, and no one else can obtain the writer. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C156. The exception to one-shot registration is Allegro re-registration with an identical rule within one evaluation pass, which returns the held writer. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C157. Kernel registrations never re-issue a writer. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C158. One-shot registration is a swappable decision about language capability, held inside the `capability` unit. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C159. The problem is who can obtain a field's writer. [decided: owner, 2026-11-08]

C160. One-shot registration lets origination control hold without the base keeping a list of the fields that matter. [decided: owner, 2026-11-08]

C161. Re-issue within a pass exists because the evaluation loop may re-evaluate a top-level binding within one pass. evidence: E26. [decided: owner, 2026-11-08]

C162. Any caller may receive the held writer within a pass, since one pass is one program's evaluation. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C163. Keying re-issue by registration site is the alternative, at the cost of changes to `src/capability.ts`, `src/primitives.ts` and the pinned demo. [decided: R-P2-13 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C164. `registerMetaField` re-issues a writer only when Allegro minted the field, the rule matches, and the field's epoch is the current pass. evidence: E26. [decided: owner, 2026-11-08]

C165. `bumpMetaEpoch` advances the epoch at the start of each `evalSource` pass, in `src/runtime.ts`. evidence: E26. [decided: owner, 2026-11-08]

C166. Kernel fields register at epoch −1, which no pass matches. evidence: E26. [decided: owner, 2026-11-08]

C167. Comments in `src/capability.ts` and in the pinned demo tie re-issue to the registration site, which re-issue does not check. evidence: E27. [decided: owner, 2026-11-08]

C168. The battery in `src/boundary-tests.ts` refuses a later program that re-registers a field an earlier program registered. evidence: E19. [decided: owner, 2026-11-08]

C169. The re-registration example in the pinned demo gets the held writer back within one pass. evidence: E30. [decided: owner, 2026-11-08]

C170. To key re-issue by site, extend the re-issue condition in `registerMetaField` and pass a site from `channel_register`. evidence: E26, E9. [decided: owner, 2026-11-08]

### A refused write aborts

C171. A refused write, install or fabricating rule aborts evaluation instead of returning an error value. [decided: R-P2-14 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C172. An **abort** is a refusal that stops the program's evaluation with no value returned. [decided: R-P2-19 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C173. Denial as an abort is a swappable decision about language capability. [decided: R-P2-14 of docs/records/book-pass/p2-allegretto-metadata-and-capability.md, 2026-11-07]

C174. The problem is what a refused write gives back to the code that attempted the write. [decided: owner, 2026-11-08]

C175. An error value was rejected, because an error value would be forgeable: the forger chooses what to do with the error value. [decided: docs/book/concepts.md SC-8]

C176. Every refusal in `src/capability.ts` and in the writer primitives of `src/primitives.ts` throws `AllegroError`. evidence: E33. [decided: owner, 2026-11-08]

C177. A rejected attenuated write halts the program before the program's next line. evidence: E10, E33. [decided: owner, 2026-11-08]

C178. During precompile and inference, catch-alls in `src/runtime.ts`, `src/evaluator.ts` and `src/primitives.ts` record or swallow a denial before the program's own run halts. evidence: E34. [decided: owner, 2026-11-08]

C179. To try denial as a value, return an error value where `src/capability.ts` throws, then run the forgery battery. evidence: E33. [decided: owner, 2026-11-08]

### Propagation and installs, held until their chapters are written

C180. The final section is held in this chapter until the chapters on how metadata propagates and on installing a layer into the base are written. [decided: owner, 2026-11-07]

C181. A **channel** is the apparatus by which one capability of the language rides values through partial evaluation: one or more metadata fields, the fields' rules, the fields' writers and the layer code that interprets the fields. [decided: D52]

C182. Typing, effect analysis and proof discharge are channels. [decided: D52]

C183. A channel may need several fields, as knowledge needs three. [decided: D52]

C184. No channel-level registration exists: each layer registers the layer's fields one by one. evidence: E6. [decided: owner, 2026-11-08]

C185. Whether one channel-level registration replaces registration field by field is an open decision. [decided: owner, 2026-11-08]

C186. The base registers two fields in `src/capability.ts`: `source`, an integrity field with rule `drop`, and `error`, with rule `viral`. evidence: E6. [decided: owner, 2026-11-08]

C187. `src/types-std.ts` registers three fields: `type`, `computed` and integrity; `shape`, `computed`; `discharged`, `drop` and integrity. evidence: E6. [decided: owner, 2026-11-08]

C188. `src/effects.ts` registers `effects` with rule `union`. evidence: E6. [decided: owner, 2026-11-08]

C189. `src/refinements.ts` registers three fields: `predicates` and `domain`, both `computed`, and `bound`, with rule `drop`. evidence: E6. [decided: owner, 2026-11-08]

C190. Three fields registered in `src/capability.ts` have no owner: `knowledge`, `warnings` and `exported`. evidence: E6. [decided: owner, 2026-11-08]

C191. Nothing stores `knowledge`, whose storage is `predicates`, `domain` and the refinement layers of a type. evidence: E6. [decided: owner, 2026-11-08]

C192. Nothing writes `warnings`. evidence: E6. [decided: owner, 2026-11-08]

C193. `exported` serves nothing, since visibility is a property of the binding. evidence: E6. [decided: owner, 2026-11-08]

C194. The ownership test in `src/boundary-tests.ts` pins each field's registration and integrity flag, without comparing the owners the test lists. evidence: E36. [decided: owner, 2026-11-08]

C195. The base registers a field only if the concept the field serves survives in Allegretto. evidence: E6. [decided: owner, 2026-11-08]

C196. `make_error` and `source of` both work under `--base`. evidence: E6. [decided: owner, 2026-11-08]

C197. `error` is a `viral` field with a public writer, `make_error`, so an error rides every result derived from an error-carrying value. evidence: E31. [decided: owner, 2026-11-08]

C198. An error-carrying `if` condition propagates the error instead of taking a branch. evidence: E31. [decided: owner, 2026-11-08]

C199. The error example in the pinned demo carries an error through primitives, a user function and a conditional's test. evidence: E31. [decided: owner, 2026-11-08]

C200. `source` carries the Expression a value was evaluated from, with rule `drop`, because a derived value was not produced by the recorded Expression. evidence: E16. [decided: owner, 2026-11-08]

C201. Only the evaluator attaches `source`, at calls of source-aware primitives and on resolved top-level bindings. evidence: E16, E47. [decided: owner, 2026-11-08]

C202. `source` is an integrity field, so no doctored source can make a verdict display a proposition other than the proposition checked. evidence: E6. [decided: owner, 2026-11-08]

C203. `source of x` reads the field under the `observe` effect, rendering the Expression as text. evidence: E16. [decided: owner, 2026-11-08]

C204. `viralOnto` in `src/metadata.ts` carries the first viral field found on the callee or an argument onto the residual, with the candidate's `type`. evidence: E1. [decided: owner, 2026-11-08]

C205. An application with a user viral operand is not computed: the evaluator returns the residual carrying the viral field. evidence: E38. [decided: owner, 2026-11-08]

C206. `mergeOverMeta` in `src/metadata.ts` lays a value's fields under the fields of the value the first value re-evaluates to, merging `union` fields and letting the inner value win otherwise. evidence: E37. [decided: owner, 2026-11-08]

C207. `drop` needs no code, because nothing carries a `drop` field. evidence: E21. [decided: owner, 2026-11-08]

C208. The `drop` example in the pinned demo reads a field on `n` and finds nothing on `n + 1`. evidence: E32. [decided: owner, 2026-11-08]

C209. A user `union` field written on a leaf does not survive `v + 1`, because `effects` rides a path of the evaluator's own and the generic rule applies only at re-evaluation. evidence: E37, E51. [decided: owner, 2026-11-08]

C210. The `effects` path and the knowledge interpretation beside the path are the evaluator's two imports from Allegro Standard that the unit order forbids. evidence: E52. [decided: owner, 2026-11-08]

C211. A layer installs what a field means into the base, gated on the field's writer, because an install is authority. evidence: E39. [decided: owner, 2026-11-08]

C212. Each installer compares the installer's writer with the registered writer by identity. evidence: E11, E39. [decided: owner, 2026-11-08]

C213. `installFieldMerge` in `src/capability.ts` installs how two values of a field combine under `union`. evidence: E39. [decided: owner, 2026-11-08]

C214. `src/effects.ts` is the one caller of `installFieldMerge`, installing effect union. evidence: E46. [decided: owner, 2026-11-08]

C215. `installFieldCheck` installs how an argument is checked against a declared constraint naming the field, a check the evaluator runs at every typed call site. evidence: E39. [decided: owner, 2026-11-08]

C216. `src/types-std.ts` installs the `type` check, and `src/effects.ts` installs the `effects` check. evidence: E46, E47. [decided: owner, 2026-11-08]

C217. `installDispatch` installs how the evaluator dispatches on a field, at a primitive application and at a composed call, as `src/types-std.ts` does for `type`. evidence: E39, E47. [decided: owner, 2026-11-08]

C218. `installProjection` installs how a field is computed on read when nothing stores the field, as `src/types-std.ts` computes `shape` from `type`. evidence: E39, E47. [decided: owner, 2026-11-08]

C219. `installAnalysis` lets a producer high in the unit order answer a question about a field for a consumer lower in the order. evidence: E39. [decided: owner, 2026-11-08]

C220. Two questions about `effects` are installed: `inferred`, by the type primitives, and `diverges`, by the pipeline once per compilation. evidence: E48. [decided: owner, 2026-11-08]

C221. `installFactsMerge` in `src/scope.ts` gates one install into the scope unit: how facts about a name combine across scope layers. evidence: E39. [decided: owner, 2026-11-08]

C222. `src/refinements.ts` installs the facts merge with the `predicates` writer. evidence: E49. [decided: owner, 2026-11-08]

C223. The battery in `src/boundary-tests.ts` refuses a foreign writer at each installer. evidence: E53. [decided: owner, 2026-11-08]

G1. cluster: C1, C2 [decided: owner, 2026-11-08]

G2. cluster: C4, C5, C3, C6 [decided: owner, 2026-11-08]

G3. cluster: C7, C8, C9, C10 [decided: owner, 2026-11-08]

G4. cluster: C11, C12, C13, C14 [decided: owner, 2026-11-08]

G5. cluster: C15, C16, C17 [decided: owner, 2026-11-08]

G6. cluster: C18, C19 [decided: owner, 2026-11-08]

G7. cluster: C20, C21, C22, C23 [decided: owner, 2026-11-08]

G8. cluster: C24 [decided: owner, 2026-11-08]

G9. cluster: C25, C26, C27 [decided: owner, 2026-11-08]

G10. cluster: C28, C29, C30, C31, C32 [decided: owner, 2026-11-08]

G11. cluster: C33, C34 [decided: owner, 2026-11-08]

G12. cluster: C35, C36, C37 [decided: owner, 2026-11-08]

G13. cluster: C38 [decided: owner, 2026-11-08]

G14. cluster: C39, C40, C41 [decided: owner, 2026-11-08]

G15. cluster: C42, C43, C44 [decided: owner, 2026-11-08]

G16. cluster: C45, C46, C47 [decided: owner, 2026-11-08]

G17. cluster: C48 [decided: owner, 2026-11-08]

G18. cluster: C49, C50, C51, C52, C53, C54, C55 [decided: owner, 2026-11-08]

G19. cluster: C56, C57, C58, C59 [decided: owner, 2026-11-08]

G20. cluster: C60, C61, C62 [decided: owner, 2026-11-08]

G21. cluster: C63, C64, C65, C66 [decided: owner, 2026-11-08]

G65. cluster: C224 [decided: owner, 2026-11-08]

G22. cluster: C67, C68, C69, C70, C71, C72 [decided: owner, 2026-11-08]

G23. cluster: C73, C74, C75, C76 [decided: owner, 2026-11-08]

G24. cluster: C77, C78 [decided: owner, 2026-11-08]

G25. cluster: C79 [decided: owner, 2026-11-08]

G26. cluster: C80, C81, C82, C83, C84, C85 [decided: owner, 2026-11-08]

G27. cluster: C86, C87, C88, C89, C90, C91 [decided: owner, 2026-11-08]

G28. cluster: C92, C93, C94, C95, C96 [decided: owner, 2026-11-08]

G29. cluster: C97, C98, C99 [decided: owner, 2026-11-08]

G30. cluster: C100, C101, C102, C103 [decided: owner, 2026-11-08]

G31. cluster: C104 [decided: owner, 2026-11-08]

G32. cluster: C105, C106, C107, C108, C109, C110 [decided: owner, 2026-11-08]

G33. cluster: C111, C112, C113, C114 [decided: owner, 2026-11-08]

G34. cluster: C115, C116 [decided: owner, 2026-11-08]

G35. cluster: C117, C118, C119, C120, C121, C122, C123 [decided: owner, 2026-11-08]

G36. cluster: C124 [decided: owner, 2026-11-08]

G37. cluster: C125 [decided: owner, 2026-11-08]

G38. cluster: C126, C127, C128, C129 [decided: owner, 2026-11-08]

G39. cluster: C130, C131, C132, C133 [decided: owner, 2026-11-08]

G40. cluster: C134 [decided: owner, 2026-11-08]

G41. cluster: C135, C136, C137 [decided: owner, 2026-11-08]

G42. cluster: C138 [decided: owner, 2026-11-08]

G43. cluster: C139, C140, C141, C142, C143 [decided: owner, 2026-11-08]

G44. cluster: C144, C145, C146, C147, C148 [decided: owner, 2026-11-08]

G45. cluster: C149, C150, C151, C152, C153 [decided: owner, 2026-11-08]

G46. cluster: C154 [decided: owner, 2026-11-08]

G47. cluster: C155, C156, C157, C158 [decided: owner, 2026-11-08]

G48. cluster: C159, C160, C161, C162, C163 [decided: owner, 2026-11-08]

G49. cluster: C164, C165, C166, C167, C168 [decided: owner, 2026-11-08]

G50. cluster: C169 [decided: owner, 2026-11-08]

G51. cluster: C170 [decided: owner, 2026-11-08]

G52. cluster: C171, C172, C173 [decided: owner, 2026-11-08]

G53. cluster: C174, C175 [decided: owner, 2026-11-08]

G54. cluster: C176, C177, C178 [decided: owner, 2026-11-08]

G55. cluster: C179 [decided: owner, 2026-11-08]

G56. cluster: C180 [decided: owner, 2026-11-08]

G57. cluster: C181, C182, C183, C184, C185 [decided: owner, 2026-11-08]

G58. cluster: C186, C187, C188, C189, C190, C191, C192, C193, C194 [decided: owner, 2026-11-08]

G59. cluster: C195, C196, C197, C198, C199 [decided: owner, 2026-11-08]

G60. cluster: C200, C201, C202, C203 [decided: owner, 2026-11-08]

G61. cluster: C204, C205, C206, C207, C208 [decided: owner, 2026-11-08]

G62. cluster: C209, C210 [decided: owner, 2026-11-08]

G63. cluster: C211, C212, C213, C214, C215, C216, C217, C218 [decided: owner, 2026-11-08]

G64. cluster: C219, C220, C221, C222, C223 [decided: owner, 2026-11-08]

## Relations

R1. C25 depends-on C7 because a field on every value serves fields that are handled independently.

R2. C39 depends-on C7 because registering a rule per field is how each field is handled by the field's own declaration.

R3. C49 depends-on C7 because origination control is stated per field.

R4. C80 depends-on C39 because the vocabulary is the set of rules a registration may declare.

R5. C82 depends-on C55 because the restriction on integrity fields applies the definition of an integrity field.

R6. C105 depends-on C52 because the writer is the authority that origination needs and reading does not.

R7. C127 depends-on C52 because write authority is one leg of trust.

R8. C139 depends-on C25 because metadata supplied at construction presupposes a field on every value.

R9. C155 depends-on C105 because one-shot registration decides who holds a writer.

R10. C171 depends-on C52 because a denial is the refusal of a gated write.

R11. C21 contradicts C7 because a second viral field on the operands is disturbed by the first.

R12. C101 contradicts C81 because the code registers a rule outside the vocabulary.

R13. C67 refines C51 because `withType` is one of the trusted kernel paths.

R14. C136 refines C127 because the immutability leg is stated without a check.

R15. C153 contradicts C142 because the slot is still declared beside the kinds.

R16. C150 contradicts C139 because four factories take no metadata.

## Evidence

E1. `src/metadata.ts:322–349`: `viralOnto` loops over candidates and viral fields and returns at the first viral field found, carrying that field and the candidate's `type` only.

E2. `src/metadata.ts:29–42`: the registry's `MetaFieldSpec` holds `name`, `rule`, an optional `integrity` flag, an optional `readVisibility` and an optional `bindingKey`.

E3. `src/types.ts:52–54`, `58`, `74`, `100`, `140`, `153`, `161`, `233`: `MetadataBearing` declares the optional `meta` slot, and the seven kind interfaces extend `MetadataBearing`.

E4. `src/types.ts:405–441`: `withMeta` returns a new value of the input's kind, deriving a Structure; line 415 warns when the input is an interned Symbol, and lines 432–441 count the warning without refusing.

E5. `src/capability.ts:53–72`: `registerMetaField` checks a duplicate name and the integrity refusal, then mints and records the writer; no check of the rule's name exists.

E6. `src/capability.ts:151–195`, `src/types-std.ts:442`, `3504`, `3512`, `src/effects.ts:279`, `src/refinements.ts:41–43`, `src/primitives.ts:508`: every field registration, with the comment naming the base's test (the field's concept works under `--base`) and the three fields with no owner.

E7. `src/capability.ts:66–68`: registration throws when an integrity field declares `viral` or `union`.

E8. `src/metadata.ts:31`: `PropagationRule` lists `viral`, `union`, `computed`, `positional` and `drop`; `positional` occurs nowhere else in `src/`.

E9. `src/primitives.ts:505–515`: `channel_register` casts the rule string, registers the field and returns a primitive function named `<channel:NAME writer>` that calls the host writer, branded with the field name.

E10. `src/primitives.ts:529–546`: `channel_attenuate` refuses an unbranded first argument and returns a branded primitive that evaluates the predicate on the field value and throws on rejection before calling the held writer.

E11. `src/capability.ts:84–89`: `holdsWriterFor` compares the given writer with the table's writer by identity.

E12. `src/metadata.ts:142–176` and `src/primitives.ts:517–527`: `metaReadRaw`, `metaOf`, `channel_read` and `channel_list` read fields with no authority check; a value carrying nothing has `meta` undefined.

E13. `src/metadata.ts:38–39`: `readVisibility` is declared on the specification; no registration in `src/` sets it and no code reads it.

E14. `src/types-std.ts:64–84`: `withType` clones the value's metadata, sets `type` and calls `withMeta`, holding no writer.

E15. `src/metadata.ts:210–231`: `writeShape` sets `type` on a Structure's `meta` in place and `removeShapeSlot` deletes it in place; the comment states the in-place licence; 23 lines outside `src/metadata.ts` call `writeShape`.

E16. `src/metadata.ts:246–272` and `src/capability.ts:175–181`: the `source` field's rule `drop`, the kernel-only `withSource` that writes through `withMeta`, the read `sourceOf`, the `observe`-tagged language read, and the registration whose returned writer is not kept.

E17. `src/metadata.ts:80–82`: `metaFieldEntry` returns the whole registry entry, writer included, to any importer.

E18. `src/types-std.ts:442–449`, `4680–4686` and `src/primitives.ts:3803–3807`: `discharged` is registered with a binding key, its writer is fetched once, and `makeProof` and the failed-proof constructor write through it.

E19. `src/boundary-tests.ts:872–877`, `898–913`, `1153–1162`: forgery A (an object literal and a re-registration of `discharged` refused), forgery D (a free read, and a writer that cannot reach `discharged`), forgery F (a fake writer and a cross-program re-registration refused).

E20. `src/boundary-tests.ts:879–896`: forgery B, writing a field on a proof yields a new value and leaves the proof's proposition and discharge unchanged.

E21. `src/boundary-tests.ts:1164–1180`: forgery C, `discharged` is neither viral nor union, an integrity field registered `viral` is refused, and a combination of proofs carries no discharge.

E22. `src/capability.ts:33–51`: `buildWriter` stamps a binding-plane field in place at line 41 and otherwise derives a new value through `withMeta`.

E23. `src/types.ts:272`, `276`, `280`, `295`, `305`, `337`, `343`, `347`, `360`: the signatures of the nine factories; five take an optional `meta`, four do not.

E24. `src/metadata.ts:202–206`: `carryMeta` assigns the source's `meta` map to the target, without copying it.

E25. `scripts/analyze/units.json:44`: `src/types.ts` is mapped to ten units, `metadata` among them.

E26. `src/capability.ts:56–72` and `src/runtime.ts:1191`: re-issue requires an Allegro-minted entry, a matching rule and the current epoch (line 61); kernel fields record epoch −1 (line 70); the pass bumps the epoch.

E27. `src/capability.ts:59–60` and `tests/metadata-channels-demo.alg:41–42`: both comments speak of the registration site, while the condition at `src/capability.ts:61` checks no site.

E28. `tests/metadata-channels-demo.alg:10–28`: `audit = channel_register("audit", "union")`, a write, two reads and a list, with `// expect: checked`, `// expect: 42`, `// expect: none` and `// expect: [type]`.

E29. `tests/metadata-channels-demo.alg:34–37`: `ok_only = channel_attenuate(audit, x => x == "ok")`, a permitted write, and `// expect: ok`.

E30. `tests/metadata-channels-demo.alg:44–46`: `again = channel_register("audit", "union")` and a write through it, with `// expect: x`.

E31. `tests/metadata-channels-demo.alg:53–62`: `e = make_error("boom")` read through primitives, a user function and an `if` test, with `// expect: boom` three times.

E32. `tests/metadata-channels-demo.alg:69–75`: a `drop` field `note` read on `n` with `// expect: 1` and on `n + 1` with `// expect: none`.

E33. `src/capability.ts:64`, `67`, `98`, `110`, `121`, `133`, `146`, `224` and `src/primitives.ts:533`, `538`: each refusal throws `AllegroError`.

E34. `src/runtime.ts:776`, `src/evaluator.ts:1240`, `src/primitives.ts:2022`, `2271`: catch-all handlers during precompile and inference that record or swallow a thrown error.

E35. `src/test/language.ts:652`: the suite runs `tests/metadata-channels-demo.alg` as a file test against its `// expect:` lines.

E36. `src/boundary-tests.ts:915–946`: the ownership test lists an owner per field but asserts only that each field is registered, that three are integrity fields and that their rules are non-fabricating.

E37. `src/metadata.ts:351–367`: `mergeOverMeta` sets each inner field over the outer map, merging through the installed merge where the rule is `union`.

E38. `src/evaluator.ts:740–746`: the evaluator calls `viralOnto` on the arguments before applying the function and returns the viral residual when one is found.

E39. `src/capability.ts:91–149` and `src/scope.ts:115–123`: the five installers and `installFactsMerge`, each refusing a writer that is not the registered writer of its field.

E41. `src/boundary-tests.ts:142`: the lint rule for `kernelFieldWriter` excludes `src/types-std.ts`, `src/primitives.ts` and `src/runtime.ts`.

E42. `src/boundary-tests.ts:781–803`: forgery E, a module-private writer is unreachable by dot access, by every export surface and by wire deserialisation.

E44. `src/structure.ts:64–82`: the in-place rule, write in place only while unshared; the comment states that metadata belongs to a value in a position, that a side table keyed by the object fails the same way, and that the battery and the rule are what enforce immutability.

E45. `src/capability.ts:197–228`: `assertNotIntegrityKey` refuses the binding keys of integrity fields, read from the registry.

E46. `src/effects.ts:279–295`: `effects` is registered `union`, its merge is installed with `installFieldMerge` and its check with `installFieldCheck`.

E47. `src/types-std.ts:3504–3557`, `src/evaluator.ts:719` and `src/runtime.ts:1662`: the `type` and `shape` registrations, the `shape` projection, the `type` check and the `type` dispatch installs; the evaluator's two `withSource` attachment sites.

E48. `src/primitives.ts:2006`, `src/runtime.ts:1197`, `1493`: `installAnalysis` for `effects` with the questions `inferred` and `diverges`.

E49. `src/refinements.ts:41–48`: `predicates` is registered and its writer installs the facts merge.

E50. `src/primitives.ts:216`: the Bits argument check throws "expected Bits, got" the argument's kind, which equality on a writer reaches.

E51. `src/evaluator.ts:832`: `assertPropagationTableLinkage` pins the evaluator's own `effects` path against the registry.

E52. `scripts/analyze/units-baseline.json:4–5`: the recorded forbidden edges from `evaluator` to `effects` and to `refinements`.

E53. `src/boundary-tests.ts:956–1108`: the five installation tests, each refusing a foreign writer.

## Asks

A1. Ratify in bulk the proposed claims about the code as it stands, the problems, forces and options this IR words, the definitions and the explore claims: C2, C5, C10, C11, C18, C20, C21, C22, C24, C28, C30, C31, C32, C34, C35, C36, C37, C38, C42, C44, C45, C46, C47, C48, C54, C56, C58, C62, C63, C64, C65, C66, C67, C68, C69, C70, C71, C72, C78, C79, C86, C92, C95, C96, C97, C98, C99, C100, C101, C102, C103, C104, C111, C114, C116, C117, C118, C119, C120, C121, C122, C123, C124, C125, C130, C133, C135, C136, C137, C138, C144, C145, C146, C147, C148, C149, C150, C151, C152, C153, C154, C159, C160, C161, C164, C165, C166, C167, C168, C169, C170, C174, C176, C177, C178, C179, C184, C185, C186, C187, C188, C189, C190, C191, C192, C193, C194, C195, C196, C197, C198, C199, C200, C201, C202, C203, C204, C205, C206, C207, C208, C209, C210, C211, C212, C213, C214, C215, C216, C217, C218, C219, C220, C221, C222, C223, C224, and the clusters G1 to G65. Depends: C2, C5, C10, C21, C54, C86, C101, C153, C185, C223.

A2. Ratify or strike the proposed terms metadata field (T18), writer capability (T19) and propagation (T21), each defined here without the word "plane" under ruling R-P2-16 (a). Depends: C10, C54, C86.


A1 resolved: ratified by the owner on PR #174, 2026-11-08, every default taken.

A2 resolved: ratified by the owner on PR #174, 2026-11-08; the three terms stand. The same comment's other rulings: the held section stands until chapters 8 and 10 are written; the chapter carries no *organized* marker until it is approved in order under R28 (the monotonic pass); the demo excerpt's elision of its id-citing comment stands for the dry run, the demo's comment to be edited when the chapter is taken in order; the removal of the serialisation sentence stands.