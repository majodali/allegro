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

## 4. Runtime grammar extension — recorded decisions [implemented]

Decisions from the Phase 6/7 extension work that shipped but weren't part
of the formalism spec (recovered from the archived Phase 6 plan in the
2026-07 triage):

- **Grammar-value base identity and prefix compatibility.** Every
  `grammar { … }` value carries its base chain ("allegro", "empty" via
  `new grammar`, or a module's grammar via `grammar extends X`). Two
  grammars merge at `use` time iff one base chain is a prefix of the
  other; otherwise `E_INCOMPATIBLE_GRAMMARS`. Modules do not transitively
  re-export grammars — each consumer `use`s its own.
- **Silent production replacement warns, does not error.** `rule foo = …`
  overwriting a base production emits `W_PRODUCTION_REPLACED` — a
  deliberate warn-not-error ruling: replacement is a legitimate extension
  technique, but silent shadowing has bitten before, so it's surfaced.
- **`left`/`right`/`none` are globally reserved for simplicity.** They are
  logically context-sensitive (meaningful only inside `grammar { … }`
  blocks) but Phase 6 reserved them globally; revisit if this breaks real
  user code. New keywords added by extensions face the same choice.
- **Template substitution is hygienic** (since Phase 7): free Symbols in
  grammar templates resolve against the defining module's context at
  definition time, so consumer rebindings can't hijack an extension.

Syncing the shipped error/warning codes into `grammar-formalism.md` §6–7
is tracked in the BACKLOG revalidation register.

---

*Sources: `design_brace_offside_modes` (memory, promoted 2026-06);
alt-order and tree-builder corrections from the 2026-06 review with
maintainer ruling; §4 recovered from
`.claude/plans/archive/dappled-cascading-cantor.md` (2026-07 triage).
Parser experiment context: `.claude/memory/user_parser_experiments.md`.*
