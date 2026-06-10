# Grammar & parser — design decisions and goals

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> The formalism specification lives in `docs/grammar-formalism.md`; runtime
> grammar-extension behavior is summarized in `CLAUDE.md`. This doc records
> decisions, goals, and known corrections that aren't part of the formalism
> spec itself.

## 1. Current architecture [implemented]

Allegro source is parsed by the grammar2 engine (`src/grammar2/`): a
scannerless recursive parser with memoization, Warth-style left recursion,
and stateful indent terminals, over a base grammar expressed as data with
stratified precedence levels. Runtime grammar extension merges user
fragments (`grammar { … }` blocks activated by `use`) into the base via
level insertion and rule surgery, with cross-fragment conflict validation.

The Earley parser (`src/parser.ts`, `src/grammar-ext.ts`) remains only for
standalone user-defined grammars via the `grammar_*` combinator primitives;
its retirement in favor of `grammar2_*` is a tracked backlog item.

## 2. Known corrections (accreted behavior ≠ intended design)

These record maintainer rulings from the 2026-06 review; the redesign
itself is the subject of a dedicated parser design discussion.

- **Alt-order significance is an artifact, not a contract.**
  [under revision] The engine currently tries alternatives in order and
  takes the first match; several base-grammar productions silently rely on
  that ordering, which is why the analyzer's alt-disjointness check is
  disabled by default. The intended design is the formalism's: precedence
  and associativity metadata drive disambiguation, ambiguity is banned and
  *detected*, and ordering is not semantically load-bearing. User-extended
  grammars especially must not inherit silent ordering hazards. The path —
  re-enabling disjointness analysis with explicit opt-outs, making
  `@prec`/`@assoc` operative, precedence-cycle checking over the merged
  constraint set — is design-discussion scope.
- **Tree-builder child access should be label-directed, not positional
  search.** [under revision] The positional `find`-style heuristics in
  `src/grammar2/tree-builder.ts` have produced real bugs; labeled-child
  extraction (already used for user rules) is the target model.

## 3. Design goals [designed]

- **Dual brace and offside-rule modes.** Allegro should eventually support
  both brace-delimited and indentation (offside-rule) syntax, like Scala 3
  and F#. Until then: when designing new syntactic constructs, make sure
  they can work in both modes — don't hardcode indentation-only
  assumptions.
- **Formalism gaps to close** (per `grammar-formalism.md`): `@error`
  productions with `@sync` panic recovery, the SAMELINE terminal, FIRST-set
  analysis completion, full GLL for left recursion where Warth iteration
  falls short.
- **Performance headroom.** The scannerless engine is ~linear after the
  memo-bucketing fix but with significant constants; a tokenizer layer is
  the known optimization if larger files demand it (benchmark before the
  first 1–2k-line corpus arrives). An external LL(k)+Pratt parser experiment
  exists outside the repo and is explicitly deferred until Allegro feature
  work is done.

---

*Sources: `design_brace_offside_modes` (memory, promoted 2026-06);
alt-order and tree-builder corrections from the 2026-06 review with
maintainer ruling. Parser experiment context: `.claude/memory/
user_parser_experiments.md`.*
