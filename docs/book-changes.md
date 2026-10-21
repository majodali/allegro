# Book change log

> Tier 2 register, an appendix of the book (`docs/reading-order.json`).
> Logs every **non-monotonic structural change** to the book's content:
> an identifier renamed, merged, removed, renumbered or reclassified; a
> chapter moved, split or merged; a definition site moved. Additions are
> not logged here (the changelog records what landed). The book itself
> carries only live content (D52); this log is where a reader with an
> older citation finds what it became. An identifier removed here is
> free for reuse (maintainer ruling 2026-10-21), so the book's numbering
> stays dense over time rather than accumulating gaps.
>
> **Row shape**: date · kind · subject · from → to · pointer. Newest
> first. Kinds: `rename`, `merge`, `remove`, `renumber`, `reclassify`,
> `move`, `split`.

| Date | Kind | Subject | From → to | Pointer |
|---|---|---|---|---|
| 2026-10-21 | move | the constitution | `docs/VISION.md`, `docs/PROCESS.md` → `docs/book/vision.md`, `docs/book/process.md` (chapters I.4, I.5); stubs at the old paths | PR #78 |
| 2026-10-21 | rename | requirement R3′ | R3′ (the merged metadata requirement's working name since 2026-08) → **R3**; anchor `def-r3-prime` → `def-r3`. Rule: `docs/book/process.md` §6, flat numbering, never primes | PR #79 |
| 2026-10-21 | remove | requirement IDs R5, R11, R13, R15 from Part 0 §1.0 | listed as merged or withdrawn → no longer listed; **free for reuse** | PR #79; this log holds what they were (rows below) |
| 2026-10-21 | move | the Tier-1 chapters | `docs/design/**`, `docs/grammar-formalism.md`, `docs/proving-in-allegro.md`, `docs/getting-started.md`, `docs/language-reference.md` → `docs/book/**`; the record to `docs/records/`; stubs at every old path | PR #76 |
| 2026-10-20 | split | `concepts.md` Part 0 | the analysis passes (known tensions, cohesion pass, abort classification, metadata merge, the B-108 measured rulings) → `docs/records/concepts-analyses.md`; Part 0 keeps the model | PR #72 |
| 2026-10-20 | reclassify | SC-6 (scopes are values) | live specification → superseded by D49 (Scope leaves `Value`), owner B-136 | `docs/book/concepts.md` Part 0 SC-6 |
| 2026-10-20 | add-as-proposed | SC-7, SC-8 | "Proposed" inside the analyses → entries in Part 0 §2, status proposed | `docs/book/concepts.md` Part 0 |
| 2026-08 (S4b) | remove | candidate requirement R15 (program-level aggregation) | withdrawn: a program is a value, and channel operations already aggregate | `docs/book/concepts.md` §45; `docs/records/concepts-analyses.md` |
| 2026-08 (S2d) | merge | R3 (values carry metadata, channels processed orthogonally), R5 (metadata survives evaluation), R11 (propagation is declared, not coded), R13 (channels can carry mergeable information) | → one requirement, *metadata channels are independent*, named R3′ until 2026-10-21 and R3 since; R11's fixed vocabulary → SC-7; R13 → `union` in SC-7 | `docs/records/concepts-analyses.md` §4 |
| 2026-08 (S2c) | reclassify | R1, R7, R8, R10 | R1 → the simplicity criterion, not a requirement; R7 → the sufficiency claim; R8's derivation corrected (from R1 + R9); R10 → derived from R2 + R14 | `docs/records/concepts-analyses.md` §2.1 |
| 2026-08 (S2b) | renumber | the implementation choices IC-1 to IC-7 | IC-1 (Bits) → SC-2; IC-2 → SC-5 + IC-1; IC-3 → IC-2; IC-4 → IC-3; IC-5 → SC-4 + IC-4; IC-6 → IC-5; IC-7 → SC-3 + IC-6 | `docs/book/concepts.md` Part 0 §3's note |
| 2026-08 (S2f) | rename | the metadata-plane slot | "channel" → **field**; "channel" now names the whole apparatus (fields, rules, writer, semantics) | `docs/book/concepts.md` §19, §19b |
| 2026-08 (C7.1) | remove | the `Context` kind name | retired; the one composite is Structure; the environment role is Scope | `docs/book/concepts.md` §9, §15; D25 |
